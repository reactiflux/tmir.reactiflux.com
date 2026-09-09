import type { Episode, OutlineItem } from "./parse.ts";
import { toSeconds } from "./time.ts";

export type LinkEntry = {
  text: string;
  url: string;
  host: string;
  episodeSlug: string;
  episodeTitle: string;
  time?: number;
};

function walk(items: OutlineItem[], episode: Episode, out: LinkEntry[]): void {
  for (const item of items) {
    if (item.url) {
      let host: string | undefined;
      try {
        host = new URL(item.url).hostname.replace(/^www\./, "");
      } catch {
        // Not an absolute URL (e.g. an in-page anchor like "#section") — no
        // external link to index.
      }
      if (host)
        out.push({
          text: item.title,
          url: item.url,
          host,
          episodeSlug: episode.slug,
          episodeTitle: episode.title,
          time: toSeconds(item.time),
        });
    }
    walk(item.children, episode, out);
  }
}

export function buildLinkIndex(episodes: Episode[]): LinkEntry[] {
  const out: LinkEntry[] = [];
  for (const episode of episodes) walk(episode.outline, episode, out);
  return out;
}

export function groupByHost(
  entries: LinkEntry[],
): { host: string; entries: LinkEntry[] }[] {
  const map = new Map<string, LinkEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.host);
    if (list) list.push(entry);
    else map.set(entry.host, [entry]);
  }
  return [...map]
    .map(([host, list]) => ({ host, entries: list }))
    .sort(
      (a, b) =>
        b.entries.length - a.entries.length || a.host.localeCompare(b.host),
    );
}
