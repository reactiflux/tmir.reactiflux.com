import type { Episode, OutlineItem } from "./parse.ts";
import { subjectsForLink, type SubjectId } from "./link-subjects.ts";
import { toSeconds } from "./time.ts";

export type LinkEntry = {
  text: string;
  url: string;
  host: string;
  episodeSlug: string;
  episodeTitle: string;
  time?: number;
  date: string;
  context: string[];
  discussionUrl: string;
  subjects: SubjectId[];
};

function walk(
  items: OutlineItem[],
  episode: Episode,
  out: LinkEntry[],
  parents: OutlineItem[] = [],
): void {
  for (const item of items) {
    if (item.url) {
      // A relative URL (e.g. an in-page anchor like "#section") parses to null
      // — no external link to index.
      const url = URL.parse(item.url);
      const host =
        url && ["https:", "http:"].includes(url.protocol)
          ? url.hostname.replace(/^www\./, "")
          : undefined;
      if (host)
        out.push({
          text: item.title,
          url: item.url,
          host,
          episodeSlug: episode.slug,
          episodeTitle: episode.title,
          time: toSeconds(item.time),
          date: episode.date,
          context: parents.map((parent) => parent.title),
          discussionUrl: discussionUrl(episode, item, parents),
          subjects: subjectsForLink(
            item.title,
            item.url,
            parents.map((parent) => parent.title),
          ),
        });
    }
    walk(item.children, episode, out, [...parents, item]);
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
  return [...Map.groupBy(entries, (entry) => entry.host)]
    .map(([host, list]) => ({ host, entries: list }))
    .sort(
      (a, b) =>
        b.entries.length - a.entries.length || a.host.localeCompare(b.host),
    );
}

/** Only link to anchors that actually exist in the transcript. */
function discussionUrl(
  episode: Episode,
  item: OutlineItem,
  parents: OutlineItem[],
): string {
  const base = `/episodes/${episode.slug}`;
  const section = [item, ...[...parents].reverse()].find((candidate) =>
    episode.sections.some((section) => section.anchor === candidate.anchor),
  );
  if (section) return `${base}#${section.anchor}`;
  // Older notes use abbreviations such as “RSC Devtools” while transcript
  // headings spell them out. Match only a unique, equivalent set of words.
  const words = (title: string) =>
    title
      .toLowerCase()
      .replace(/\brscs?\b/g, "react server components")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .sort()
      .join(" ");
  for (const candidate of [item, ...[...parents].reverse()]) {
    const matches = episode.sections.filter(
      (section) => words(section.title) === words(candidate.title),
    );
    if (matches.length === 1) return `${base}#${matches[0].anchor}`;
  }
  const seconds = toSeconds(item.time);
  if (seconds !== undefined) {
    const preceding = episode.sections
      .filter((section) => {
        const time = toSeconds(section.time);
        return time !== undefined && time <= seconds;
      })
      .at(-1);
    if (preceding) return `${base}#${preceding.anchor}`;
  }
  return base;
}

export interface LinkResource {
  id: string;
  url: string;
  host: string;
  text: string;
  mentions: LinkEntry[];
  subjects: SubjectId[];
}

// Keep meaningful query parameters and fragments; only discard known tracking.
export function resourceKey(raw: string): string {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key))
      url.searchParams.delete(key);
  }
  return url.href;
}

export function buildLinkResources(entries: LinkEntry[]): LinkResource[] {
  const resources = new Map<string, LinkResource>();
  for (const entry of entries) {
    const key = resourceKey(entry.url);
    let resource = resources.get(key);
    if (!resource) {
      resource = {
        id: `resource-${resources.size + 1}`,
        url: key,
        host: entry.host,
        text: entry.text,
        mentions: [],
        subjects: [],
      };
      resources.set(key, resource);
    }
    // Repeated outline entries in the same discussion are one appearance.
    const existing = resource.mentions.find(
      (mention) =>
        mention.episodeSlug === entry.episodeSlug &&
        mention.discussionUrl === entry.discussionUrl &&
        mention.time === entry.time,
    );
    if (existing) {
      existing.context = [
        ...new Set([...existing.context, ...entry.context, entry.text]),
      ];
      existing.subjects = [
        ...new Set([...existing.subjects, ...entry.subjects]),
      ];
    } else {
      resource.mentions.push({
        ...entry,
        context: [...entry.context],
        subjects: [...entry.subjects],
      });
    }
    resource.subjects = [...new Set([...resource.subjects, ...entry.subjects])];
  }
  for (const resource of resources.values()) {
    resource.mentions.sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? 0) - (b.time ?? 0),
    );
    resource.text = resource.mentions[0].text;
  }
  return [...resources.values()].sort(
    (a, b) =>
      a.mentions[0].date.localeCompare(b.mentions[0].date) ||
      a.url.localeCompare(b.url),
  );
}

export type LinkQuery = {
  q?: string;
  subject?: SubjectId;
  year?: string;
  sort?: "newest" | "oldest";
};

/** A resource plus the mentions that matched, newest (or oldest) first. */
export type LinkMatch = { resource: LinkResource; mentions: LinkEntry[] };

// Search the words the show used, not the words the reader typed: the notes say
// "RSC" and "React Forget" where a reader may type either form.
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\brscs?\b/g, "react server components")
    .replace(/react forget/g, "react compiler");

export function filterResources(
  resources: LinkResource[],
  { q, subject, year, sort }: LinkQuery,
): LinkMatch[] {
  const words = normalize(q?.trim() ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const newestFirst = sort !== "oldest";
  const matches: LinkMatch[] = [];
  for (const resource of resources) {
    const mentions = resource.mentions.filter((mention) => {
      const haystack = normalize(
        [mention.text, mention.url, ...mention.context].join(" "),
      );
      return (
        (!subject || mention.subjects.includes(subject)) &&
        (!year || mention.date.startsWith(year)) &&
        words.every((word) => haystack.includes(word))
      );
    });
    if (!mentions.length) continue;
    mentions.sort((a, b) => a.date.localeCompare(b.date));
    if (newestFirst) mentions.reverse();
    matches.push({ resource, mentions });
  }
  return matches.sort((a, b) => {
    const order = a.mentions[0].date.localeCompare(b.mentions[0].date);
    return (
      (newestFirst ? -order : order) ||
      a.resource.url.localeCompare(b.resource.url)
    );
  });
}
