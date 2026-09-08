import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { flattenLinks, normalizeTime, slug } from "../src/content/slug.ts";
import { splitFile } from "../src/content/parse.ts";
import { insertHeadings } from "../src/content/headings.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "tmir-2024-03.md" | "tmir-march-2023.md" | "tmir-dec-2023.md" -> "yyyy-mm" */
export function slugFromFilename(name: string): string | null {
  const iso = /^tmir-(\d{4})-(\d{2})\.md$/.exec(name);
  if (iso) return `${iso[1]}-${iso[2]}`;

  const named = /^tmir-([a-z]+)-(\d{4})\.md$/.exec(name);
  if (!named) return null;
  const idx = MONTHS.findIndex((m) => m.startsWith(named[1]));
  if (idx === -1) return null;
  return `${named[2]}-${String(idx + 1).padStart(2, "0")}`;
}

const SPEAKER_PARA = /^(?:\[\d{1,3}(?::\d{2}){1,2}\]\s*)?\*\*[^*]+:\*\*/;
// Unbolded speaker prefix, e.g. `Carl: ` or a raw Descript id `2-vcarl: `
// (tmir-2025-09.md, tmir-2025-11.md never wrap the label in `**...**`).
// Matching on shape alone is too loose (`Note: something` looks identical),
// so a match here only counts as a speaker if isKnownSpeakerToken() confirms it.
const UNBOLDED_SPEAKER = /^(?:\[\d{1,3}(?::\d{2}){1,2}\]\s*)?([A-Za-z0-9-]{1,20}):\s+/;
const LEADING_TIME = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*/;
const TRAILING_TIME = /\s*\[(\d{1,3}(?::\d{2}){1,2})\]\s*$/;
const HEADING_TIME = /^(#{1,2})\s*\[(\d{1,3}(?::\d{2}){1,2})\]\s*(.*)$/;
const OUTLINE_LINE = /^(\s*)- (.+)$/;
// `- [[mm:ss](#anchor)] Title` (linked) or a bare `- [mm:ss] Title` (2023-10,
// 2023-11 have no anchor link at all). Both may sit behind a short prefix
// like `⚡️ ` (2024-04's lightning-round bullets); PREFIX captures that.
const PREFIX = /^([^[]{1,4})(?=\[)/;
const OUTLINE_TIME_LINKED = /^\[\[(\d{1,3}(?::\d{2}){1,2})\]\(#[^)]*\)\]\s*/;
const OUTLINE_TIME_BARE = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*/;

// Short first-name / raw-Descript-id -> full name, for the unbolded-speaker
// files where the label isn't the canonical "Carl Vitullo" form the bolded
// files use. Descript ids look like `1-vcarl`; strip the leading `N-`.
const NAME_MAP: Record<string, string> = {
  carl: "Carl Vitullo",
  vcarl: "Carl Vitullo",
  mark: "Mark Erikson",
  acemarke: "Mark Erikson",
  mo: "Mo Javad",
  mojavad: "Mo Javad",
};

/**
 * Canonicalize a speaker label, bolded or not. A trailing parenthetical is an
 * editing note, not part of the name (`Carl Vitullo (editing)`), so it's
 * dropped before the lookup. Bare `Mo` is Mo Javad except in the files where
 * Mo Khazali is the guest — there the short form is his, so leave it alone.
 * Anything not in the map (guests) keeps the name it already has.
 */
export function normalizeSpeakerName(raw: string, boldedNames?: Set<string>): string {
  const name = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const key = name.replace(/^\d+-/, "").toLowerCase();
  if (key === "mo" && boldedNames?.has("mo khazali")) return name;
  return NAME_MAP[key] ?? name;
}

/** Every name (and its first word) that appears bolded as a speaker anywhere in the file. */
function collectBoldedSpeakers(body: string): Set<string> {
  const names = new Set<string>();
  for (const m of body.matchAll(/\*\*([^*]+):\*\*/g)) {
    const name = m[1].trim().toLowerCase();
    names.add(name);
    names.add(name.split(/\s+/)[0]);
  }
  return names;
}

/** Is `raw` (an UNBOLDED_SPEAKER match) an actual known speaker, not just `Word:` prose? */
function isKnownSpeakerToken(raw: string, boldedNames: Set<string>): boolean {
  const key = raw.replace(/^\d+-/, "").toLowerCase();
  return key in NAME_MAP || boldedNames.has(key);
}

/** Remove <style>…</style> and <iframe …></iframe> blocks. */
function stripEmbeds(body: string): string {
  return body
    .replace(/<style>[\s\S]*?<\/style>\s*/g, "")
    .replace(/<iframe[\s\S]*?<\/iframe>\s*/g, "");
}

export function convert(raw: string): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  const { frontMatter, body } = splitFile(raw);
  const clean = stripEmbeds(body);
  const blocks = clean.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const boldedNames = collectBoldedSpeakers(clean);

  function isSpeakerParagraph(block: string): boolean {
    if (SPEAKER_PARA.test(block)) return true;
    const u = UNBOLDED_SPEAKER.exec(block);
    return !!u && isKnownSpeakerToken(u[1], boldedNames);
  }

  // The transcript starts at the first speaker paragraph, plus any `##`
  // section headings sitting directly above it. Walk back over `##` only:
  // a lone `#` there is the old transcript-start marker (`# Interview`), and
  // a `#` elsewhere in the region is outline structure (2024-04's
  // `# Main Content`).
  let start = blocks.findIndex((b) => isSpeakerParagraph(b));
  if (start === -1) {
    warnings.push("no speaker paragraphs found; body left in the outline region");
  }
  while (start > 0 && blocks[start - 1].startsWith("## ")) start -= 1;

  const head = start === -1 ? blocks : blocks.slice(0, start);
  const tail = start === -1 ? [] : blocks.slice(start);

  // --- outline ---
  const outlineLines: string[] = [];
  // Top-level (non-nested) outline items with a time, in source order — used
  // below to synthesize section headings for a transcript with none at all.
  const topLevelItems: { time: string; title: string }[] = [];
  for (const [i, block] of head.entries()) {
    if (!OUTLINE_LINE.test(block.split("\n")[0])) {
      const isMarker = i === head.length - 1 && /^#\s/.test(block);
      if (isMarker) continue; // old transcript-start marker; drop silently
      if (block.startsWith("#")) warnings.push(`dropped heading before outline: ${block.split("\n")[0]}`);
      else warnings.push(`dropped prose before outline: ${block.slice(0, 60)}`);
      continue;
    }
    for (const line of block.split("\n")) {
      const m = OUTLINE_LINE.exec(line);
      if (!m) continue;
      let rest = m[2].trim();
      // Drop the pre-iframe subscribe link list.
      if (/^\[(Spotify|Apple Podcasts|RSS|or anywhere you prefer)\]\(/.test(rest)) continue;

      // A short prefix (e.g. "⚡️ ") may sit before the timestamp; keep it
      // in the title and just skip past it to find the time.
      const p = PREFIX.exec(rest);
      const prefix = p ? p[1] : "";
      const afterPrefix = rest.slice(prefix.length);

      let time: string | undefined;
      const linked = OUTLINE_TIME_LINKED.exec(afterPrefix);
      const bare = linked ? null : OUTLINE_TIME_BARE.exec(afterPrefix);
      const match = linked ?? bare;
      if (match) {
        time = normalizeTime(match[1]);
        rest = prefix + afterPrefix.slice(match[0].length);
      } else {
        warnings.push(`outline item without timestamp: ${rest.slice(0, 60)}`);
      }
      const anchor = slug(flattenLinks(rest).trim());
      const timeMarker = time ? `[[${time}](#${anchor})] ` : "";
      outlineLines.push(`${m[1]}- ${timeMarker}${rest}`);
      if (m[1].length === 0 && time) topLevelItems.push({ time, title: rest });
    }
  }

  // --- transcript ---
  type Block = { text: string; time?: string; isHeading: boolean };
  const out: Block[] = [];
  const sectionTimes = new Map<string, string>();
  let pendingHeadingAnchor: string | null = null;

  for (const block of tail) {
    const h = HEADING_TIME.exec(block);
    if (h) {
      // `## [00:52] job market` -> heading loses the timestamp
      const title = h[3].trim();
      const anchor = slug(title);
      sectionTimes.set(anchor, normalizeTime(h[2]));
      pendingHeadingAnchor = anchor;
      out.push({ text: `## ${title}`, isHeading: true });
      continue;
    }
    if (block.startsWith("#")) {
      const level = /^#+/.exec(block)![0].length;
      const title = block.replace(/^#+\s*/, "").trim();
      // 2023 used h1 for sections; promote to h2.
      pendingHeadingAnchor = slug(title);
      out.push({ text: `## ${title}`, isHeading: true });
      if (level > 2) warnings.push(`heading deeper than h2 flattened: ${title}`);
      continue;
    }

    // Paragraph: move a leading timestamp to the end.
    let text = block;
    const lead = LEADING_TIME.exec(text);
    let time: string | undefined;
    if (lead) {
      time = normalizeTime(lead[1]);
      text = text.slice(lead[0].length);
    } else {
      const trail = TRAILING_TIME.exec(text);
      if (trail) {
        time = normalizeTime(trail[1]);
        text = text.slice(0, trail.index);
      }
    }
    // Speaker label -> bold + canonical name. Bolded labels are normalized
    // too: the sources mix `**Carl:**`, `**Carl Vitullo:**` and
    // `**Carl (editing):**` for the same person.
    const b = /^\*\*([^*]+):\*\*\s*/.exec(text);
    if (b) {
      text = `**${normalizeSpeakerName(b[1], boldedNames)}:** ${text.slice(b[0].length)}`;
    } else {
      const u = UNBOLDED_SPEAKER.exec(text);
      if (u && isKnownSpeakerToken(u[1], boldedNames)) {
        text = `**${normalizeSpeakerName(u[1], boldedNames)}:** ${text.slice(u[0].length)}`;
      }
    }

    if (!time) warnings.push(`paragraph without timestamp: ${text.slice(0, 60)}`);
    if (!/^\*\*[^*]+:\*\*/.test(text) && out.length === 0) {
      warnings.push(`paragraph without speaker: ${text.slice(0, 60)}`);
    }
    if (pendingHeadingAnchor && time && !sectionTimes.has(pendingHeadingAnchor)) {
      sectionTimes.set(pendingHeadingAnchor, time);
      pendingHeadingAnchor = null;
    }
    out.push({ text: time ? `${text.trim()} [${time}]` : text.trim(), time, isHeading: false });
  }

  // A transcript with no section headings at all (2023-10: an AI-written
  // outline with real timestamps, but a raw Descript export with no `##`
  // markers) gets headings synthesized from its own top-level outline items.
  if (!out.some((b) => b.isHeading) && topLevelItems.length > 0) {
    const merged = insertHeadings(out.map((b) => b.text), topLevelItems);
    out.length = 0;
    for (const text of merged) out.push({ text, isHeading: text.startsWith("## ") });
  }

  // No outline in the source: synthesize one from the section headings.
  if (outlineLines.length === 0) {
    for (const block of out) {
      if (!block.isHeading) continue;
      const title = block.text.slice(3).trim();
      const anchor = slug(title);
      const time = sectionTimes.get(anchor);
      outlineLines.push(time ? `- [[${time}](#${anchor})] ${title}` : `- ${title}`);
    }
  }

  const newBody = `\n${outlineLines.join("\n")}\n\n# Transcript\n\n${out.map((b) => b.text).join("\n\n")}\n`;
  return { text: serializeEpisodeFile(frontMatter, newBody), warnings };
}

// Front matter the legacy sources never carry: written by scripts/ingest.ts
// (everything but atUri) and scripts/publish-atproto.ts (atUri). Regenerating
// an episode must not throw these away.
const PRESERVED_FIELDS = [
  "transistorId",
  "audioUrl",
  "duration",
  "season",
  "episode",
  "people",
  "bskyPostUrl",
  "atUri",
] as const;

/**
 * Carry the ingest-owned (and atUri) front matter of an already-migrated file
 * into a freshly regenerated one. Hand-written fields come from the
 * regenerated text; the preserved fields come from the existing file.
 */
export function mergeExistingFrontMatter(newText: string, existingText: string): string {
  const fresh = splitFile(newText);
  const existing = splitFile(existingText);
  for (const key of PRESERVED_FIELDS) {
    if (existing.frontMatter[key] !== undefined) {
      fresh.frontMatter[key] = existing.frontMatter[key];
    }
  }
  return serializeEpisodeFile(fresh.frontMatter, fresh.body);
}

const SOURCE_DIR = resolve(
  process.env.TMIR_SOURCE_DIR ??
    "/Users/vcarl/workspace/reactiflux.com/src/transcripts",
);
const OUT_DIR = resolve("content/episodes");

function main() {
  const force = process.argv.includes("--force");
  mkdirSync(OUT_DIR, { recursive: true });

  const sources = readdirSync(SOURCE_DIR)
    .sort()
    .map((name) => ({ name, epSlug: slugFromFilename(name) }))
    .filter((s): s is { name: string; epSlug: string } => s.epSlug !== null);

  const existing = sources.filter((s) => existsSync(join(OUT_DIR, `${s.epSlug}.md`)));
  if (existing.length > 0 && !force) {
    console.error(
      `${existing.length} target file(s) already exist and would be overwritten:`,
    );
    for (const s of existing) console.error(`    content/episodes/${s.epSlug}.md`);
    console.error("\nRe-run with --force to regenerate them (ingest-owned front matter is preserved).");
    process.exit(1);
  }

  let files = 0;
  let warned = 0;
  const skipped: string[] = [];
  for (const { name, epSlug } of sources) {
    const outPath = join(OUT_DIR, `${epSlug}.md`);
    const { text: fresh, warnings } = convert(readFileSync(join(SOURCE_DIR, name), "utf8"));
    const text = existsSync(outPath)
      ? mergeExistingFrontMatter(fresh, readFileSync(outPath, "utf8"))
      : fresh;
    // No speaker paragraph found means the whole transcript uses a speaker
    // format this script doesn't recognize (e.g. bare `Carl:` / `2-vcarl:`
    // without bold markup, as in tmir-2025-09.md and tmir-2025-11.md) — the
    // entire body would be misfiled as outline and the output would parse
    // but carry zero transcript sections. Leave it out rather than emit a
    // silently-empty file.
    if (warnings.some((w) => w.startsWith("no speaker paragraphs found"))) {
      console.log(`${name} -> SKIPPED (no recognized speaker paragraphs)`);
      skipped.push(name);
      continue;
    }
    writeFileSync(outPath, text);
    files += 1;
    console.log(`${name} -> content/episodes/${epSlug}.md  (${warnings.length} warnings)`);
    for (const w of warnings) {
      console.log(`    ${w}`);
      warned += 1;
    }
  }
  console.log(`\n${files} files migrated, ${warned} warnings, ${skipped.length} skipped.`);
  if (skipped.length) console.log(`skipped: ${skipped.join(", ")}`);
}

if (import.meta.filename === process.argv[1]) main();
