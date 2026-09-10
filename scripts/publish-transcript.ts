import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeTime } from "../src/content/time.ts";
import { requireEnv } from "./env.ts";
import {
  flattenOutline,
  parseEpisode,
  TRANSCRIPT_MARKER,
} from "../src/content/parse.ts";
import { insertHeadings } from "../src/content/headings.ts";
import { toSrt } from "../src/content/srt.ts";

const DESCRIPT_BASE = "https://descriptapi.com/v1";
const TRANSISTOR_BASE = "https://api.transistor.fm";

/** Descript speaker ids -> published names. Anything else is kept as-is. */
export const SPEAKERS: Record<string, string> = {
  "1-vcarl": "Carl Vitullo",
  vcarl: "Carl Vitullo",
  "2-acemarke": "Mark Erikson",
  acemarke: "Mark Erikson",
};

export function normalizeSpeaker(raw: string): string {
  return SPEAKERS[raw.trim()] ?? raw.trim();
}

const LEADING_TIME = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*/;
const SPEAKER = /^\*\*(.+?):\*\*\s*/;

/**
 * Descript markdown export -> canonical transcript body.
 * Assumed input shape (see plan notes; verify against a real export):
 *   `[mm:ss] **1-vcarl:** text`
 */
export function descriptToCanonical(markdown: string): string {
  const out: string[] = [];
  for (const block of markdown.split(/\n{2,}/)) {
    let text = block.trim();
    if (!text) continue;

    let time: string | undefined;
    const t = LEADING_TIME.exec(text);
    if (t) {
      time = normalizeTime(t[1]);
      text = text.slice(t[0].length);
    }
    const s = SPEAKER.exec(text);
    if (s) {
      text = `**${normalizeSpeaker(s[1])}:** ${text.slice(s[0].length)}`;
    }
    // Descript emits the occasional block that is a timecode and nothing else.
    // Kept, it becomes a blank segment on the page and an empty SRT cue.
    if (!text.trim()) continue;
    out.push(time ? `${text.trim()} [${time}]` : text.trim());
  }
  return out.join("\n\n");
}

/**
 * A Descript export carries no `## ` headings, so a transcript written from
 * one straight would have no sections at all. Synthesize them from the
 * episode's chapter list — those titles are what the outline's anchors are
 * built from, so the two only agree if the headings come from the chapters.
 *
 * Episodes published before `chapters:` existed fall back to the outline,
 * flattened: a nested item is a section of the show too.
 */
export function addOutlineHeadings(
  fileText: string,
  transcriptBody: string,
): string {
  const { outline, chapters } = parseEpisode(fileText, "");
  const items =
    chapters.length > 0
      ? chapters
      : flattenOutline(outline)
          .filter((item) => item.time)
          .map((item) => ({ time: item.time!, title: item.title }));
  const paragraphs = transcriptBody.split(/\n{2,}/).filter((p) => p.trim());
  return insertHeadings(paragraphs, items).join("\n\n");
}

/** Swap everything below `# Transcript`, leaving front matter and outline alone. */
export function replaceTranscript(
  fileText: string,
  transcriptBody: string,
): string {
  const marker = fileText.indexOf(`\n${TRANSCRIPT_MARKER}\n`);
  if (marker === -1)
    throw new Error(`file has no "${TRANSCRIPT_MARKER}" heading`);
  const head = fileText.slice(0, marker + TRANSCRIPT_MARKER.length + 1);
  return `${head}\n\n${transcriptBody.trimEnd()}\n`;
}

export async function fetchDescriptTranscript(
  projectId: string,
  token: string,
): Promise<string> {
  const res = await fetch(`${DESCRIPT_BASE}/export/transcript`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project_id: projectId,
      format: "markdown",
      // Enum, not a boolean: off | changes | every_paragraph. "changes" labels
      // a speaker once per run rather than on every paragraph; toSrt carries the
      // current speaker forward so cues stay attributed either way.
      include_speaker_labels: "changes",
      include_markers: false,
      // Also an object now, not a boolean. descriptToCanonical reads a leading
      // [mm:ss] off each paragraph, so paragraph timecodes are the ones we need.
      timecodes: { on_paragraphs: true },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Descript export failed: ${res.status} ${await res.text()}`,
    );
  }
  const text = await res.text();
  // A 200 with an empty or stub body would otherwise canonicalize to "" and
  // wipe the committed transcript. The shortest real episode transcript runs
  // to tens of kilobytes, so anything under 500 characters is a broken export,
  // not a short episode.
  if (text.trim().length < 500) {
    throw new Error(
      `Descript export returned only ${text.trim().length} characters; refusing to overwrite the transcript`,
    );
  }
  return text;
}

/**
 * The account's show. Transistor's episode list wants the numeric show id, and
 * the obvious value to reach for — the hex share id in the feed URL — 404s with
 * an unhelpful "Resource not found". There is one show, so look it up rather
 * than making it something to configure wrongly.
 */
async function resolveShowId(apiKey: string): Promise<string> {
  const res = await fetch(`${TRANSISTOR_BASE}/v1/shows`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok)
    throw new Error(
      `Transistor shows failed: ${res.status} ${await res.text()}`,
    );
  const { data } = (await res.json()) as { data: { id: string }[] };
  if (data.length !== 1)
    throw new Error(
      `expected exactly one Transistor show, found ${data.length}; pass the numeric show id explicitly`,
    );
  return data[0].id;
}

async function findTransistorEpisodeId(
  transistorId: string,
  apiKey: string,
  showId: string,
): Promise<string> {
  for (let page = 1; page <= 20; page += 1) {
    const url = `${TRANSISTOR_BASE}/v1/episodes?show_id=${encodeURIComponent(showId)}&pagination[page]=${page}&pagination[per]=50`;
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok)
      throw new Error(
        `Transistor list failed: ${res.status} ${await res.text()}`,
      );
    const body = (await res.json()) as {
      data: { id: string; attributes: { share_url?: string } }[];
    };
    if (body.data.length === 0) break;
    const hit = body.data.find((e) =>
      (e.attributes.share_url ?? "").endsWith(`/${transistorId}`),
    );
    if (hit) return hit.id;
  }
  throw new Error(`no Transistor episode with share id ${transistorId}`);
}

export async function pushSrtToTranscript(
  transistorId: string,
  srt: string,
  apiKey: string,
): Promise<void> {
  const showId = await resolveShowId(apiKey);
  const id = await findTransistorEpisodeId(transistorId, apiKey, showId);
  const res = await fetch(`${TRANSISTOR_BASE}/v1/episodes/${id}`, {
    method: "PATCH",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ episode: { transcript_text: srt } }),
  });
  if (!res.ok) {
    throw new Error(
      `Transistor update failed: ${res.status} ${await res.text()}`,
    );
  }
}

/** The whole of `npm run publish-transcript`, minus argv parsing. */
export async function publishTranscript({
  slug: epSlug,
  projectId,
  skipDescript = false,
  skipTransistor = false,
}: {
  slug: string;
  projectId?: string;
  skipDescript?: boolean;
  skipTransistor?: boolean;
}): Promise<void> {
  const path = resolve("content/episodes", `${epSlug}.md`);
  let fileText = readFileSync(path, "utf8");

  if (!skipDescript) {
    const markdown = await fetchDescriptTranscript(
      projectId!,
      requireEnv("DESCRIPT_TOKEN"),
    );
    const body = addOutlineHeadings(fileText, descriptToCanonical(markdown));
    fileText = replaceTranscript(fileText, body);
    writeFileSync(path, fileText);
    console.log(`wrote transcript into ${path}`);
  }

  if (!skipTransistor) {
    const episode = parseEpisode(fileText, epSlug);
    if (!episode.transistorId) {
      throw new Error(`${epSlug} has no transistorId; run ingest first`);
    }
    const srt = toSrt(episode);
    await pushSrtToTranscript(
      episode.transistorId,
      srt,
      requireEnv("TRANSISTOR_API_KEY"),
    );
    console.log(
      `pushed ${srt.split("\n\n").length} SRT cues to Transistor episode ${episode.transistorId}`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipDescript = args.includes("--skip-descript");
  const skipTransistor = args.includes("--skip-transistor");
  const [epSlug, projectId] = args.filter((a) => !a.startsWith("--"));

  if (!epSlug || (!projectId && !skipDescript)) {
    console.error(
      "usage: npm run publish-transcript -- <yyyy-mm> <descriptProjectId> [--skip-descript] [--skip-transistor]",
    );
    process.exitCode = 1;
    return;
  }
  await publishTranscript({
    slug: epSlug,
    projectId,
    skipDescript,
    skipTransistor,
  });
}

if (import.meta.main) await main();
