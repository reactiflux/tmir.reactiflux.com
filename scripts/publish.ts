import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEpisode, splitFile } from "../src/content/parse.ts";
import {
  FEED_URL,
  ingestFeed,
  parseFeed,
  scaffoldEpisode,
  type FeedItem,
} from "./ingest.ts";
import {
  fetchChapters,
  outlineRegion,
  pairOutline,
  parseDraft,
  renderOutline,
  replaceOutlineRegion,
  report,
  withChapters,
} from "./outline.ts";
import { publishTranscript } from "./publish-transcript.ts";

export { scaffoldEpisode };

/** An outline entry that already carries a timestamp — i.e. not a raw draft. */
const OUTLINE_TIMESTAMP = /\[\[\d{1,3}(?::\d{2}){1,2}\]\(#/;

/** The feed item for this episode, or undefined if it isn't published yet. */
async function feedItem(epSlug: string): Promise<FeedItem | undefined> {
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
    return parseFeed(await res.text()).find((i) => i.slug === epSlug);
  } catch (err) {
    console.warn(`could not read the feed (${(err as Error).message})`);
    return undefined;
  }
}

async function main() {
  const epSlug = process.argv[2];
  if (!epSlug) {
    console.error("usage: npm run publish -- <yyyy-mm>");
    process.exitCode = 1;
    return;
  }
  const path = resolve("content/episodes", `${epSlug}.md`);

  // No file yet: scaffold and stop. addOutlineHeadings synthesizes the
  // transcript's section headings from the outline, so the outline has to
  // exist before the transcript is pulled.
  if (!existsSync(path)) {
    const item = await feedItem(epSlug);
    writeFileSync(
      path,
      scaffoldEpisode(item ?? {}, new Date().toISOString().slice(0, 10)),
    );
    console.log(
      item
        ? `created ${path} from the feed: ${item.title}`
        : `created ${path}. ${epSlug} is not in the Transistor feed yet, so the title and date are placeholders; ingest fills the title in once it is.`,
    );
    console.log(
      `\nnext: add the outline and descriptProjectId, then re-run the same command.`,
    );
    return;
  }

  const fileText = readFileSync(path, "utf8");
  const region = outlineRegion(fileText);

  // Still a show-notes draft: a nested bullet list with no `[[00:00:00](#…)]`
  // timestamps on it. Pair it against the feed's chapter list, write the real
  // outline back, and stop so the author can check it. Re-running the same
  // command then takes the branch below.
  if (!OUTLINE_TIMESTAMP.test(region)) {
    const draft = parseDraft(region);
    if (draft.length === 0)
      throw new Error(`write the outline in ${path} first`);
    const chapters = await fetchChapters(epSlug);
    if (chapters.length === 0)
      throw new Error(
        `no chapter list in the feed for ${epSlug} — add chapters in Transistor, then re-run.`,
      );
    const result = pairOutline(draft, chapters);
    // The chapters go into the front matter too: publish-transcript builds the
    // transcript's `## ` headings from them, offline.
    writeFileSync(
      path,
      withChapters(
        replaceOutlineRegion(fileText, renderOutline(result.lines)),
        chapters,
      ),
    );
    console.log(
      `wrote the outline into ${path} from ${chapters.length} chapters.\n`,
    );
    console.log(report(result));
    console.log(`\nnext: check the outline, then re-run the same command.`);
    return;
  }

  const episode = parseEpisode(fileText, epSlug);
  const projectId = String(
    splitFile(fileText).frontMatter.descriptProjectId ?? "",
  );
  if (episode.outline.length === 0)
    throw new Error(`write the outline in ${path} first`);
  if (!projectId) throw new Error(`set descriptProjectId in ${path} first`);

  // Ingest first: the SRT push needs the transistorId it writes, and an
  // episode Transistor hasn't published yet should fail before we call
  // Descript rather than after.
  await ingestFeed();
  const ingested = parseEpisode(readFileSync(path, "utf8"), epSlug);
  if (!ingested.audioUrl || !ingested.duration)
    throw new Error(
      `${epSlug} has no audio after ingest — Transistor has probably not published it yet. Publish it there, then re-run.`,
    );

  await publishTranscript({ slug: epSlug, projectId });
  console.log(`\n${epSlug} is ready. Commit it.`);
}

if (import.meta.main) {
  await main().catch((err: unknown) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
