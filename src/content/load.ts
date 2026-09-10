import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEpisode, type Episode } from "./parse.ts";

function contentDir(): string {
  return join(
    process.cwd(),
    process.env.TMIR_CONTENT_DIR || "content/episodes",
  );
}

let cache: Promise<Episode[]> | undefined;

/**
 * Newest first. Several episodes share a `date` (the recording date is
 * sometimes reused when an outline is copied forward), so the slug — which is
 * `yyyy-mm` and therefore already chronological — breaks the tie.
 */
export function episodeOrder(
  a: { date: string; slug: string },
  b: { date: string; slug: string },
): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.slug < b.slug ? 1 : a.slug > b.slug ? -1 : 0;
}

export function loadEpisodes(): Promise<Episode[]> {
  cache ??= (async () => {
    const dir = contentDir();
    const files = globSync("*.md", { cwd: dir }).sort();
    const episodes = await Promise.all(
      files.map(async (f) => {
        const markdown = await readFile(join(dir, f), "utf8");
        const epSlug = f.slice(0, -".md".length);
        return parseEpisode(markdown, epSlug);
      }),
    );
    return episodes.sort(episodeOrder);
  })();
  return cache;
}

export async function getEpisode(slug: string): Promise<Episode | undefined> {
  return (await loadEpisodes()).find((e) => e.slug === slug);
}
