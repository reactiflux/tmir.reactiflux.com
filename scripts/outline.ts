import YAML from "yaml";
import { flattenLinks, slug } from "../src/content/slug.ts";
import { normalizeTime, timestampToSeconds } from "../src/content/time.ts";
import { frontMatterEnd, TRANSCRIPT_MARKER } from "../src/content/parse.ts";
import { decode, FEED_URL, slugFromTitle } from "./ingest.ts";

export interface Chapter {
  /** `HH:MM:SS`. */
  time: string;
  title: string;
}

export interface DraftNode {
  /** The author's line, verbatim (markdown links and escapes intact). */
  text: string;
  children: DraftNode[];
}

/**
 * Transistor keeps the chapter list as `<li>(MM:SS) - Title</li>` inside the
 * item's `<description>` CDATA. That blob is otherwise show-notes boilerplate,
 * so it is parsed here on demand rather than carried on FeedItem.
 */
export function parseChapters(xml: string, epSlug: string): Chapter[] {
  for (const chunk of xml.split("<item>").slice(1)) {
    const item = chunk.slice(0, chunk.indexOf("</item>"));
    const title = /<title>([\s\S]*?)<\/title>/.exec(item)?.[1];
    if (!title || slugFromTitle(decode(title.trim())) !== epSlug) continue;
    const description = /<description>([\s\S]*?)<\/description>/.exec(
      item,
    )?.[1];
    if (!description) return [];
    return [
      ...description.matchAll(
        /<li>\s*\((\d{1,3}(?::\d{2}){1,2})\)\s*-\s*([\s\S]*?)<\/li>/g,
      ),
    ].map((m) => ({
      time: normalizeTime(m[1]),
      title: decode(m[2].replace(/<[^>]+>/g, "").trim()),
    }));
  }
  return [];
}

export async function fetchChapters(epSlug: string): Promise<Chapter[]> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  return parseChapters(await res.text(), epSlug);
}

const BULLET = /^(\s*)[-*]\s+(.*)$/;

/**
 * Parse a show-notes draft — a nested `*`/`-` list with bare paragraph lines
 * acting as section headers — into a tree. Indentation gives nesting; a
 * paragraph line is always a root (those headers have chapters of their own).
 * HTML comments (the scaffold's prompt) are ignored.
 */
export function parseDraft(region: string): DraftNode[] {
  const roots: DraftNode[] = [];
  const stack: { indent: number; node: DraftNode }[] = [];

  for (const raw of region.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("<!--")) continue;

    const m = BULLET.exec(line);
    // Collapse internal runs of spaces: a Google Docs export is full of them,
    // and Prettier would rewrite the emitted line otherwise.
    const text = (m ? m[2] : line).trim().replace(/\s+/g, " ");
    if (!text) continue;
    // A paragraph line is a section header: always a root, whatever it looks
    // like it is indented to.
    const indent = m ? m[1].length : -1;

    const node: DraftNode = { text, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent)
      stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ indent, node });
  }
  return roots;
}

/** Comparable token set: links flattened, escapes dropped, naively singularized. */
function tokens(text: string): string[] {
  return flattenLinks(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

/** Share of `a`'s tokens that appear in `b`. */
function contained(a: string[], b: string[]): number {
  const set = new Set(b);
  return a.length === 0 ? 0 : a.filter((t) => set.has(t)).length / a.length;
}

// ponytail: token containment, not a real similarity metric. Chapter titles are
// the author's own draft lines lightly reworded, so overlap is high or nil;
// upgrade to real scoring only if a real episode starts mismatching.
const MATCH_THRESHOLD = 0.6;

export interface PairedLine {
  depth: number;
  text: string;
  time: string;
  /**
   * Anchor of the section this line points at — always derived from a
   * *chapter* title, never from the author's prose, because the transcript's
   * headings are the chapter titles.
   */
  anchor: string;
  /** True when no chapter matched and the time came from a neighbour. */
  inherited: boolean;
}

export interface PairResult {
  lines: PairedLine[];
  unusedChapters: Chapter[];
}

/**
 * Pair each draft node with a chapter and give every node a timestamp.
 *
 * Chapters are in time order and the draft is in document order, so matching
 * only ever moves forward: each match consumes its chapter and everything
 * before it. That is what keeps a topic the author repeats later (e.g. "Bun
 * 1.4" again in the lightning round) from stealing its own earlier chapter.
 *
 * A node with no match inherits the last matched timestamp — or, if nothing
 * has matched yet, the first chapter — so no line the author wrote is dropped
 * and times stay non-decreasing. It inherits that chapter's *anchor* too: an
 * unmatched line is a sub-point inside the chapter above it, and minting an
 * anchor of its own is exactly how outline links go dead.
 */
export function pairOutline(
  nodes: DraftNode[],
  chapters: Chapter[],
): PairResult {
  const lines: PairedLine[] = [];
  const used = new Set<Chapter>();
  let cursor = 0;
  let last = chapters[0]?.time ?? "00:00:00";
  // ponytail: two chapters with the same title collide here — parse.ts
  // suffixes the second section's anchor `-2`, this doesn't. Upgrade to
  // mirroring that counter if a show ever repeats a chapter title.
  let lastAnchor = chapters[0] ? slug(chapters[0].title) : "";

  const walk = (node: DraftNode, depth: number) => {
    const draftTokens = tokens(node.text);
    let best = -1;
    let bestScore = MATCH_THRESHOLD;
    for (let i = cursor; i < chapters.length; i++) {
      const chapterTokens = tokens(chapters[i].title);
      const score = Math.max(
        contained(chapterTokens, draftTokens),
        contained(draftTokens, chapterTokens),
      );
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }

    if (best === -1) {
      lines.push({
        depth,
        text: node.text,
        time: last,
        anchor: lastAnchor || slug(node.text),
        inherited: true,
      });
    } else {
      used.add(chapters[best]);
      cursor = best + 1;
      last = chapters[best].time;
      lastAnchor = slug(chapters[best].title);
      lines.push({
        depth,
        text: node.text,
        time: last,
        anchor: lastAnchor,
        inherited: false,
      });
    }
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const node of nodes) walk(node, 0);

  return { lines, unusedChapters: chapters.filter((c) => !used.has(c)) };
}

/** `- [[HH:MM:SS](#anchor)] <text>`, two spaces of indent per level. */
export function renderOutline(lines: PairedLine[]): string {
  return lines
    .map(
      (l) => `${"  ".repeat(l.depth)}- [[${l.time}](#${l.anchor})] ${l.text}`,
    )
    .join("\n");
}

/** Human-readable summary of what the author needs to eyeball. */
export function report(result: PairResult): string {
  const out: string[] = [];
  const inherited = result.lines.filter((l) => l.inherited);
  out.push(
    `${result.lines.length} outline lines, ${result.lines.length - inherited.length} matched to a chapter.`,
  );
  if (result.unusedChapters.length > 0) {
    out.push(
      `\nchapters with no draft line (${result.unusedChapters.length}):`,
    );
    for (const c of result.unusedChapters) out.push(`  ${c.time}  ${c.title}`);
  }
  if (inherited.length > 0) {
    out.push(
      `\ndraft lines with an inherited timestamp (${inherited.length}):`,
    );
    for (const l of inherited) out.push(`  ${l.time}  ${flattenLinks(l.text)}`);
  }
  const times = result.lines.map((l) => timestampToSeconds(l.time));
  if (times.some((t, i) => i > 0 && t < times[i - 1]))
    out.push("\nWARNING: timestamps are not in non-decreasing order.");
  return out.join("\n");
}

/**
 * Swap in a new outline, touching neither the front matter nor the transcript.
 * Both boundaries are found in the raw text, so the file round-trips verbatim
 * outside the region actually being replaced.
 */
export function replaceOutlineRegion(
  fileText: string,
  outline: string,
): string {
  const fmEnd = frontMatterEnd(fileText);
  const head = fileText.slice(0, fmEnd + 5);

  const marker = fileText.indexOf(`\n${TRANSCRIPT_MARKER}`, fmEnd);
  if (marker === -1)
    throw new Error(`file has no "${TRANSCRIPT_MARKER}" heading`);
  return `${head}\n${outline}\n${fileText.slice(marker)}`;
}

/**
 * Record the matched chapter list in the front matter. That is what carries
 * the chapter titles to the transcript step, which is offline and standalone
 * (`npm run publish-transcript`) and so can't re-read the feed itself.
 */
export function withChapters(fileText: string, chapters: Chapter[]): string {
  const end = frontMatterEnd(fileText);
  // parseDocument, not parse+stringify: it leaves every key we don't touch
  // formatted exactly as the author wrote it.
  const doc = YAML.parseDocument(fileText.slice(4, end + 1));
  doc.set("chapters", chapters);
  // lineWidth 0: no folding, or long titles and descriptions get rewrapped
  // across lines that were fine as they were.
  return `---\n${doc.toString({ lineWidth: 0 })}---\n${fileText.slice(end + 5)}`;
}

/** The text between the front matter and `# Transcript`. */
export function outlineRegion(fileText: string): string {
  const fmEnd = frontMatterEnd(fileText);
  const marker = fileText.indexOf(`\n${TRANSCRIPT_MARKER}`, fmEnd);
  return fileText.slice(fmEnd + 5, marker === -1 ? undefined : marker);
}
