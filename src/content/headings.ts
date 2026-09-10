import { timestampToSeconds } from "./time.ts";

export interface TimedItem {
  time: string;
  title: string;
}

const TRAILING_TIME = /\[(\d{1,3}(?::\d{2}){1,2})\]\s*$/;

function paragraphSeconds(block: string): number | undefined {
  if (block.startsWith("#")) return undefined;
  const m = TRAILING_TIME.exec(block.trim());
  return m ? timestampToSeconds(m[1]) : undefined;
}

/**
 * Synthesize `## <title>` section headings for a canonical transcript that has
 * none, from timed outline items. Each item's heading is inserted directly
 * before the first paragraph at or past that item's time. An item with no such
 * paragraph, or one that would land on a paragraph another item
 * already claimed (no content between them), is skipped rather than opening an empty
 * section.
 *
 * Used by scripts/publish-transcript.ts, since a Descript export carries no
 * headings of its own.
 */
export function insertHeadings(
  paragraphs: string[],
  items: TimedItem[],
): string[] {
  const times = paragraphs.map(paragraphSeconds);
  const headingAt = new Map<number, string>();

  for (const item of items) {
    const sec = timestampToSeconds(item.time);
    const idx = times.findIndex((t) => t !== undefined && t >= sec);
    // First item to claim a paragraph keeps it: outlines drift out of order, and
    // overwriting the entry would silently drop the heading already placed there.
    if (idx === -1 || headingAt.has(idx)) continue;
    headingAt.set(idx, `## ${item.title}`);
  }

  const out: string[] = [];
  paragraphs.forEach((p, i) => {
    const heading = headingAt.get(i);
    if (heading) out.push(heading);
    out.push(p);
  });
  return out;
}
