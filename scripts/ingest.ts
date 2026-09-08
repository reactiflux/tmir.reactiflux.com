import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Person } from "../src/content/parse.ts";
import { splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";
import { toSeconds } from "../src/content/time.ts";

export const FEED_URL = "https://feeds.transistor.fm/this-month-in-react";

export interface FeedItem {
  slug: string;
  transistorId: string;
  audioUrl: string;
  duration: number;
  season?: number;
  episode?: number;
  people: Person[];
  bskyPostUrl?: string;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
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

function tag(item: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item);
  return m ? decode(m[1].trim()) : undefined;
}

function attr(fragment: string, name: string): string | undefined {
  const m = new RegExp(`${name}="([^"]*)"`).exec(fragment);
  return m ? decode(m[1]) : undefined;
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  // Split on <item> so channel-level <podcast:person> tags are not picked up.
  for (const chunk of xml.split("<item>").slice(1)) {
    const item = chunk.slice(0, chunk.indexOf("</item>"));
    const title = tag(item, "title");
    if (!title) continue;
    const epSlug = slugFromTitle(title);
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
      console.warn(`skipping feed item ${epSlug}: missing audio url or duration`);
      continue;
    }

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
    const bskyPostUrl = /href="(https:\/\/bsky\.app\/profile\/[^/"]+\/post\/[^"]+)"/.exec(
      item,
    )?.[1];
    items.push({
      slug: epSlug,
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
  frontMatter.transistorId = item.transistorId;
  frontMatter.audioUrl = item.audioUrl;
  frontMatter.duration = item.duration;
  if (item.season !== undefined) frontMatter.season = item.season;
  if (item.episode !== undefined) frontMatter.episode = item.episode;
  // An empty list means the feed item carried no <podcast:person> tags, not
  // that the episode has no people: never clobber hand-curated front matter.
  if (item.people.length > 0) frontMatter.people = item.people;
  if (item.bskyPostUrl !== undefined) frontMatter.bskyPostUrl = item.bskyPostUrl;
  return serializeEpisodeFile(frontMatter, body);
}

const EPISODE_DIR = resolve("content/episodes");

async function main() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  const items = parseFeed(await res.text());

  const seen = new Set<string>();
  for (const item of items) {
    const path = join(EPISODE_DIR, `${item.slug}.md`);
    if (!existsSync(path)) {
      console.log(`no file for feed item ${item.slug}`);
      continue;
    }
    seen.add(item.slug);
    const before = readFileSync(path, "utf8");
    const after = applyFeedItem(before, item);
    if (before !== after) {
      writeFileSync(path, after);
      console.log(`updated ${item.slug}`);
    }
  }

  for (const name of readdirSync(EPISODE_DIR)) {
    const epSlug = name.replace(/\.md$/, "");
    if (name.endsWith(".md") && !seen.has(epSlug)) {
      console.log(`no feed item for file ${epSlug}`);
    }
  }
  console.log(`\n${items.length} TMiR feed items, ${seen.size} matched.`);
}

if (import.meta.filename === process.argv[1]) await main();
