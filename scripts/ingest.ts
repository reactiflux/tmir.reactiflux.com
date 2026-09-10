import { existsSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Person } from "../src/content/parse.ts";
import { splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";
import { slug } from "../src/content/slug.ts";
import { toSeconds } from "../src/content/time.ts";

export const FEED_URL = "https://feeds.transistor.fm/this-month-in-react";

export interface FeedItem {
  slug: string;
  title: string;
  /** Absent for the monthly show; the label of the side series otherwise. */
  series?: string;
  /** `<pubDate>` as yyyy-mm-dd. */
  date: string;
  transistorId: string;
  audioUrl: string;
  duration: number;
  season?: number;
  episode?: number;
  people: Person[];
  bskyPostUrl?: string;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Some episodes ship under a guest-branded title with no date substring at
// all (e.g. a one-off co-host episode), so slugFromTitle can't derive their
// slug from the string alone. These are permanently-fixed historical titles,
// looked up by exact text rather than guessed at with more regex.
const TITLE_OVERRIDES: Record<string, string> = {
  "Mark & Carl talk with Swizec Teller about using AI at work": "2026-04",
};

/** Feed title -> episode slug, or null for Office Hours / Spotlight / one-offs. */
export function slugFromTitle(title: string): string | null {
  if (title in TITLE_OVERRIDES) return TITLE_OVERRIDES[title];

  // Separator after "TMiR YYYY-MM" varies (":", "–", " -"), so match on the
  // date prefix alone rather than requiring a specific punctuation mark.
  const modern = /^TMiR\s+(\d{4})-(\d{2})\b/.exec(title);
  if (modern) return `${modern[1]}-${modern[2]}`;

  const legacy =
    /^This Month [Ii]n React\s*(?:[–—-]\s*|\()([A-Za-z]+)\s+(\d{4})\)?$/.exec(
      title.trim(),
    );
  if (!legacy) return null;
  const idx = MONTHS.indexOf(legacy[1].toLowerCase());
  if (idx === -1) return null;
  return `${legacy[2]}-${String(idx + 1).padStart(2, "0")}`;
}

/**
 * The feed also carries two side series that are not the monthly show. They get
 * their own slug shape — `<yyyy-mm>-<key>-<tail>` — so they can never collide
 * with a monthly `<yyyy-mm>`, and a `series` label so the site can mark them.
 * "Behind the React Documentary" carries no prefix of its own and is listed by
 * title, the same way TITLE_OVERRIDES handles off-format monthly episodes.
 */
const SERIES = [
  {
    key: "office-hours",
    label: "Reactiflux Office Hours",
    prefix: /^Office Hours\s*(?:[–—-]\s*|with\s+)/i,
  },
  {
    key: "spotlight",
    label: "Reactiflux Spotlight",
    prefix: /^Community Spotlight\s*[–—-]\s*/i,
    titles: ["Behind the React Documentary"],
  },
];

// Trailing connectives make for a sloppy slug ("…-states-of-burnout-with").
const SLUG_STOPWORDS = new Set([
  "with",
  "and",
  "the",
  "a",
  "an",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
]);

/**
 * A few kebab words from the title, enough to tell two same-month episodes
 * apart: everything before the first colon (a "with Wix: …" style guest list)
 * or the first " with "/" and " (the guest names), capped at four words.
 */
function slugTail(rest: string): string {
  const head = rest.split(":")[0].split(/,?\s+(?:with|and)\s+/i)[0];
  const words = slug(head).split("-").filter(Boolean).slice(0, 4);
  while (words.length > 1 && SLUG_STOPWORDS.has(words[words.length - 1]))
    words.pop();
  return words.join("-");
}

/** The side-series slug and label for a title, or undefined for anything else. */
export function seriesFromTitle(
  title: string,
  date: string,
): { slug: string; series: string } | undefined {
  // The month comes from <pubDate>; without one there is no slug to build.
  if (!date) return undefined;
  for (const s of SERIES) {
    const rest = s.titles?.includes(title.trim())
      ? title.trim()
      : s.prefix.test(title)
        ? title.replace(s.prefix, "")
        : undefined;
    if (rest === undefined) continue;
    const tail = slugTail(rest);
    return {
      slug: `${date.slice(0, 7)}-${s.key}${tail ? `-${tail}` : ""}`,
      series: s.label,
    };
  }
  return undefined;
}

function tag(item: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item);
  return m ? decode(m[1].trim()) : undefined;
}

/** RFC-822 `<pubDate>` -> yyyy-mm-dd, or "" when absent or unparseable. */
function pubDate(raw: string | undefined): string {
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString().slice(0, 10);
}

function attr(fragment: string, name: string): string | undefined {
  const m = new RegExp(`${name}="([^"]*)"`).exec(fragment);
  return m ? decode(m[1]) : undefined;
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const taken = new Set<string>();
  // Split on <item> so channel-level <podcast:person> tags are not picked up.
  for (const chunk of xml.split("<item>").slice(1)) {
    const item = chunk.slice(0, chunk.indexOf("</item>"));
    const title = tag(item, "title");
    if (!title) continue;
    const date = pubDate(tag(item, "pubDate"));
    // Monthly episodes derive their slug from the title alone; the side series
    // need the publication month too, so they are resolved after the date.
    const monthly = slugFromTitle(title);
    const side = monthly ? undefined : seriesFromTitle(title, date);
    let epSlug = monthly ?? side?.slug;
    if (!epSlug) continue;

    const enclosure = /<enclosure\b[^>]*>/.exec(item)?.[0] ?? "";
    const audioUrl = attr(enclosure, "url");
    // The <link> used to always be https://share.transistor.fm/s/<id>, but
    // newer items link to reactiflux.com instead. The id is reliably present
    // in the enclosure media URL (media.transistor.fm/<id>/<hash>.mp3) in
    // both styles, so read it from there instead of the link.
    const transistorId = audioUrl
      ? /media\.transistor\.fm\/([^/?#]+)/.exec(audioUrl)?.[1]
      : undefined;
    // <itunes:duration> is legally either raw seconds or HH:MM:SS / MM:SS;
    // toSeconds handles both.
    const duration = toSeconds(tag(item, "itunes:duration"));
    if (!transistorId || !audioUrl || duration === undefined) {
      console.warn(
        `skipping feed item ${epSlug}: missing audio url or duration`,
      );
      continue;
    }

    // Two same-month items whose titles reduce to the same tail would otherwise
    // ingest into one file; suffix instead of silently merging.
    if (taken.has(epSlug)) {
      let n = 2;
      while (taken.has(`${epSlug}-${n}`)) n++;
      epSlug = `${epSlug}-${n}`;
    }
    taken.add(epSlug);

    const people: Person[] = [];
    for (const m of item.matchAll(
      /<podcast:person\b([^>]*)>([\s\S]*?)<\/podcast:person>/g,
    )) {
      people.push({
        name: decode(m[2].trim()),
        role: attr(m[1], "role"),
        href: attr(m[1], "href"),
        img: attr(m[1], "img"),
      });
    }

    const season = Number(tag(item, "podcast:season") ?? NaN);
    const episode = Number(tag(item, "podcast:episode") ?? NaN);
    // The "Reply on Bluesky" anchor inside the <description> CDATA. Matched on
    // the URL shape, not the link text, so a renamed link still resolves.
    const bskyPostUrl =
      /href="(https:\/\/bsky\.app\/profile\/[^/"]+\/post\/[^"]+)"/.exec(
        item,
      )?.[1];
    items.push({
      slug: epSlug,
      title,
      series: side?.series,
      date,
      transistorId,
      audioUrl,
      duration,
      season: Number.isNaN(season) ? undefined : season,
      episode: Number.isNaN(episode) ? undefined : episode,
      people,
      bskyPostUrl: bskyPostUrl ? decode(bskyPostUrl) : undefined,
    });
  }
  return items;
}

/**
 * Rewrite only the ingest-owned front matter fields. `atUri` is deliberately
 * absent: it belongs to scripts/publish-atproto.ts and survives untouched
 * because we only assign named keys onto the parsed object.
 */
export function applyFeedItem(fileText: string, item: FeedItem): string {
  const { frontMatter, body } = splitFile(fileText);
  // Same guard as `people` below: fill in only what the file is missing, so a
  // hand-edited title survives every later ingest.
  if (!String(frontMatter.title ?? "").trim() && item.title)
    frontMatter.title = item.title;
  if (item.series !== undefined) frontMatter.series = item.series;
  frontMatter.transistorId = item.transistorId;
  frontMatter.audioUrl = item.audioUrl;
  frontMatter.duration = item.duration;
  if (item.season !== undefined) frontMatter.season = item.season;
  if (item.episode !== undefined) frontMatter.episode = item.episode;
  // An empty list means the feed item carried no <podcast:person> tags, not
  // that the episode has no people: never clobber hand-curated front matter.
  if (item.people.length > 0) frontMatter.people = item.people;
  if (item.bskyPostUrl !== undefined)
    frontMatter.bskyPostUrl = item.bskyPostUrl;
  return serializeEpisodeFile(frontMatter, body);
}

/**
 * A publishable skeleton: front matter parseEpisode accepts, an empty
 * `descriptProjectId` to fill in, and the `# Transcript` marker
 * replaceTranscript needs. The prompt is an HTML comment rather than a list
 * item so it does not parse as an outline entry — that keeps "is the outline
 * written yet" a single check on `outline.length`.
 *
 * A side-series episode gets neither: Office Hours and Spotlight recordings
 * are archive imports with no outline and no transcript, so the file is just
 * front matter and the series label.
 */
export function scaffoldEpisode(
  item: Partial<FeedItem>,
  today: string,
): string {
  return serializeEpisodeFile(
    {
      title: item.title ?? "",
      date: item.date || today,
      description: "",
      ...(item.series ? { series: item.series } : { descriptProjectId: "" }),
    },
    item.series
      ? ""
      : "\n<!-- Outline goes here: a nested list of topics, each a link with a [[00:00:00](#anchor)] timestamp. -->\n\n# Transcript\n",
  );
}

const EPISODE_DIR = resolve("content/episodes");

export async function ingestFeed() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  const items = parseFeed(await res.text());

  const seen = new Set<string>();
  for (const item of items) {
    const path = join(EPISODE_DIR, `${item.slug}.md`);
    // Scaffold rather than skip, so an Office Hours or Spotlight episode
    // published to Transistor turns up on the site without a migration script.
    const created = !existsSync(path);
    if (created) writeFileSync(path, scaffoldEpisode(item, item.date));
    seen.add(item.slug);
    const before = readFileSync(path, "utf8");
    const after = applyFeedItem(before, item);
    if (before !== after) writeFileSync(path, after);
    if (created) console.log(`created ${item.slug}`);
    else if (before !== after) console.log(`updated ${item.slug}`);
  }

  for (const name of globSync("*.md", { cwd: EPISODE_DIR })) {
    const epSlug = name.slice(0, -".md".length);
    if (!seen.has(epSlug)) console.log(`no feed item for file ${epSlug}`);
  }
  console.log(`\n${items.length} TMiR feed items, ${seen.size} matched.`);
}

if (import.meta.main) await ingestFeed();
