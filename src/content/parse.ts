import YAML from "yaml";
import {
  flattenLinks,
  normalizeTime,
  slug,
  timestampToSeconds,
  unescapeMarkdown,
} from "./slug.ts";

export interface Person {
  name: string;
  role?: string;
  href?: string;
  img?: string;
}

export interface OutlineItem {
  title: string;
  url?: string;
  time?: string;
  anchor: string;
  children: OutlineItem[];
}

export interface Segment {
  speaker: string;
  time?: string;
  text: string;
}

export interface Section {
  title: string;
  anchor: string;
  time?: string;
  segments: Segment[];
}

export interface Episode {
  slug: string;
  title: string;
  date: string;
  description: string;
  time?: string;
  location?: string;
  transistorId?: string;
  audioUrl?: string;
  duration?: number;
  season?: number;
  episode?: number;
  people: Person[];
  outline: OutlineItem[];
  sections: Section[];
  bskyPostUrl?: string;
  atUri?: string;
}

export const TRANSCRIPT_MARKER = "# Transcript";

/** Split a file into its parsed front matter and the raw body text after it. */
export function splitFile(text: string): {
  frontMatter: Record<string, unknown>;
  body: string;
} {
  if (!text.startsWith("---\n")) {
    throw new Error("file does not start with front matter");
  }
  const end = text.indexOf("\n---\n", 3);
  if (end === -1) throw new Error("unterminated front matter");
  const yaml = text.slice(4, end + 1);
  return {
    frontMatter: (YAML.parse(yaml) ?? {}) as Record<string, unknown>,
    body: text.slice(end + 5),
  };
}

const OUTLINE_LINE = /^(\s*)- (.+)$/;
const OUTLINE_TIME = /^\[\[(\d{1,3}(?::\d{2}){1,2})\]\(#[^)]*\)\]\s*/;
const FIRST_LINK = /\[[^\]]*\]\(([^)]+)\)/;

export function parseOutline(region: string): OutlineItem[] {
  const roots: OutlineItem[] = [];
  // stack[d] is the item most recently opened at depth d
  const stack: OutlineItem[] = [];

  for (const line of region.split("\n")) {
    const m = OUTLINE_LINE.exec(line);
    if (!m) continue;
    const depth = Math.floor(m[1].length / 2);

    let rest = m[2].trim();
    let time: string | undefined;
    const t = OUTLINE_TIME.exec(rest);
    if (t) {
      time = normalizeTime(t[1]);
      rest = rest.slice(t[0].length);
    }
    const link = FIRST_LINK.exec(rest);
    const title = flattenLinks(rest).trim();
    const item: OutlineItem = {
      title,
      url: link ? link[1] : undefined,
      time,
      anchor: slug(title),
      children: [],
    };

    if (depth === 0 || stack.length === 0) {
      roots.push(item);
      stack.length = 0;
      stack.push(item);
    } else {
      const parentDepth = Math.min(depth, stack.length) - 1;
      stack[parentDepth].children.push(item);
      stack.length = parentDepth + 1;
      stack.push(item);
    }
  }
  return roots;
}

const SPEAKER = /^\*\*(.+?):\*\*\s*/;
const TRAILING_TIME = /\s*\[(\d{1,3}(?::\d{2}){1,2})\]\s*$/;

function parseSegment(paragraph: string, lastSpeaker: string): Segment {
  let text = paragraph.trim();
  let speaker = lastSpeaker;

  const s = SPEAKER.exec(text);
  if (s) {
    speaker = s[1].trim();
    text = text.slice(s[0].length);
  }

  let time: string | undefined;
  const t = TRAILING_TIME.exec(text);
  if (t) {
    time = normalizeTime(t[1]);
    text = text.slice(0, t.index);
  }

  return { speaker, time, text: unescapeMarkdown(text.trim()) };
}

function parseSections(region: string): Section[] {
  const sections: Section[] = [];
  // The synthetic lead-in section, kept only if paragraphs actually precede
  // the first heading — otherwise a transcript that opens with `## Intro`
  // would grow a second, empty Intro (and a duplicate anchor).
  let current: Section = { title: "Intro", anchor: "intro", segments: [] };
  let fromHeading = false;
  let lastSpeaker = "";

  // Blank-line-delimited blocks; a heading is always its own block.
  for (const block of region.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      // A heading with no paragraphs under it still gets a section, so the
      // anchor it publishes keeps resolving.
      if (fromHeading || current.segments.length > 0) sections.push(current);
      const title = trimmed.slice(3).trim();
      current = { title, anchor: slug(title), segments: [] };
      fromHeading = true;
      lastSpeaker = "";
      continue;
    }
    if (trimmed.startsWith("#")) continue; // stray heading, not a section

    const seg = parseSegment(trimmed, lastSpeaker);
    lastSpeaker = seg.speaker;
    current.segments.push(seg);
  }
  if (fromHeading || current.segments.length > 0) sections.push(current);

  // Several episodes repeat a heading title (e.g. two `## Quick hits`), which
  // would otherwise publish two elements with the same id. Suffix repeats in
  // document order; reconcileOutlineAnchors then matches against these values.
  const seen = new Map<string, number>();
  for (const section of sections) {
    const n = (seen.get(section.anchor) ?? 0) + 1;
    seen.set(section.anchor, n);
    if (n > 1) section.anchor = `${section.anchor}-${n}`;
    section.time = section.segments.find((s) => s.time)?.time;
  }
  return sections;
}

// Outline timestamps sometimes drift a bit from the first segment under the
// heading they describe (e.g. outline "Effect" at 00:28:08 vs section
// "Effect JS" starting at 00:28:41) — exact-time equality misses these.
const ANCHOR_DRIFT_TOLERANCE_SEC = 120;

/** Pre-order walk of the outline tree, in document order, at every depth. */
function flattenOutline(items: OutlineItem[]): OutlineItem[] {
  const out: OutlineItem[] = [];
  for (const item of items) {
    out.push(item);
    if (item.children.length > 0) out.push(...flattenOutline(item.children));
  }
  return out;
}

/**
 * Outline anchors are derived from the outline item's own title, but the
 * outline title and the section heading it points at sometimes differ
 * (e.g. outline `[Astro 4.5]` vs section `## Astro 4.5, AstroDB`), which
 * would otherwise produce an anchor that matches no section. Reconcile by
 * time, walking every outline item (any depth) in document order:
 *
 * 1. Claim: any item whose title-derived anchor already matches a section,
 *    or matches one on time exactly, claims that section — these are firm,
 *    unambiguous reference points and are never reassigned.
 * 2. Drift: each item still unresolved claims the nearest not-yet-claimed
 *    section within ANCHOR_DRIFT_TOLERANCE_SEC, but never one earlier than
 *    the section claimed by the nearest already-resolved item before it in
 *    document order (outline and transcript both move forward in time, so
 *    a later item can't reasonably drift-match an earlier moment). Ties go
 *    to the earlier section.
 *
 * An item with no eligible section keeps its title-derived anchor.
 *
 * The claim step is what keeps a nested sub-point (e.g. "TS v7 beta" at
 * 00:01:51, no section of its own) from stealing its parent's section
 * (e.g. "New Releases" at 00:01:49) out from under it: the parent's own
 * outline entry claims that section first, so it's no longer available.
 * The forward-only floor is what stops that same sub-point from instead
 * drifting backward onto an unrelated earlier section (e.g. "Intro" at
 * 00:00:00, which sits within tolerance of 00:01:51 by raw distance alone).
 */
function reconcileOutlineAnchors(roots: OutlineItem[], sections: Section[]): void {
  const sectionByAnchor = new Map(sections.map((s) => [s.anchor, s]));
  const items = flattenOutline(roots);
  const claimed = new Set<Section>();
  // Which section each item actually resolved to. Tracked per item rather than
  // re-derived from item.anchor, so a second outline item with the same title
  // as an earlier one doesn't count as resolved onto the section that item
  // already claimed — it falls through to time matching instead.
  const resolvedFor = new Map<OutlineItem, Section>();

  // Step 1: claim by already-correct title or exact time (firm; document order
  // doesn't matter for correctness here, but keeps this deterministic too).
  for (const item of items) {
    const titleMatch = sectionByAnchor.get(item.anchor);
    if (titleMatch && !claimed.has(titleMatch)) {
      claimed.add(titleMatch);
      resolvedFor.set(item, titleMatch);
      continue;
    }
    if (!item.time) continue;
    const exact = sections.find((s) => s.time === item.time && !claimed.has(s));
    if (exact) {
      item.anchor = exact.anchor;
      claimed.add(exact);
      resolvedFor.set(item, exact);
    }
  }

  // Step 2: drift match, in document order, never regressing before the
  // furthest-along already-resolved section seen so far.
  let floor = -Infinity;
  for (const item of items) {
    const resolved = resolvedFor.get(item);
    if (resolved) {
      if (resolved.time) floor = Math.max(floor, timestampToSeconds(resolved.time));
      continue;
    }
    if (!item.time) continue;
    const itemSec = timestampToSeconds(item.time);
    let best: Section | undefined;
    let bestDiff = Infinity;
    for (const section of sections) {
      if (!section.time || claimed.has(section)) continue;
      const sectionSec = timestampToSeconds(section.time);
      if (sectionSec < floor) continue;
      const diff = Math.abs(sectionSec - itemSec);
      if (diff <= ANCHOR_DRIFT_TOLERANCE_SEC && diff < bestDiff) {
        best = section;
        bestDiff = diff;
      }
    }
    if (best) {
      item.anchor = best.anchor;
      claimed.add(best);
      floor = Math.max(floor, timestampToSeconds(best.time!));
    }
  }
}

export function parseEpisode(text: string, epSlug: string): Episode {
  const { frontMatter, body } = splitFile(text);
  // The marker starts a line: either at position 0 (a file with no outline,
  // whose body begins with it) or just after a newline.
  const afterNewline = body.indexOf(`\n${TRANSCRIPT_MARKER}\n`);
  const marker = body.startsWith(`${TRANSCRIPT_MARKER}\n`)
    ? 0
    : afterNewline === -1
      ? -1
      : afterNewline + 1;
  const outlineRegion = marker === -1 ? body : body.slice(0, marker);
  const transcriptRegion =
    marker === -1 ? "" : body.slice(marker + TRANSCRIPT_MARKER.length + 1);

  const outline = parseOutline(outlineRegion);
  const sections = parseSections(transcriptRegion);
  reconcileOutlineAnchors(outline, sections);

  const fm = frontMatter as Record<string, any>;
  // A missing or unparseable date silently becomes `<pubDate>Invalid Date</pubDate>`
  // in the feed and throws mid-loop in publish-atproto, after records are already
  // written. Fail here, naming the episode, before any of that runs.
  const date = String(fm.date ?? "");
  if (Number.isNaN(Date.parse(date))) {
    throw new Error(
      `episode ${epSlug || "(unnamed)"}: missing or unparseable front matter date: ${JSON.stringify(fm.date ?? null)}`,
    );
  }
  return {
    slug: epSlug,
    title: String(fm.title ?? ""),
    date,
    description: String(fm.description ?? ""),
    time: fm.time,
    location: fm.location,
    transistorId: fm.transistorId,
    audioUrl: fm.audioUrl,
    duration: fm.duration,
    season: fm.season,
    episode: fm.episode,
    people: Array.isArray(fm.people) ? (fm.people as Person[]) : [],
    outline,
    sections,
    bskyPostUrl: fm.bskyPostUrl,
    atUri: fm.atUri,
  };
}
