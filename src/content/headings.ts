import { timestampToSeconds } from "./slug.ts";

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
 * paragraph, or one that would land on the same paragraph as the item before
 * it (no content between them), is skipped rather than opening an empty
 * section.
 *
 * Used by scripts/publish-transcript.ts, since a Descript export carries no
 * headings of its own.
 */
export function insertHeadings(paragraphs: string[], items: TimedItem[]): string[] {
  const times = paragraphs.map(paragraphSeconds);
  const headingAt = new Map<number, string>();
  let lastTarget = -1;

  for (const item of items) {
    const sec = timestampToSeconds(item.time);
    const idx = times.findIndex((t) => t !== undefined && t >= sec);
    if (idx === -1 || idx === lastTarget) continue;
    headingAt.set(idx, `## ${item.title}`);
    lastTarget = idx;
  }

  const out: string[] = [];
  paragraphs.forEach((p, i) => {
    const heading = headingAt.get(i);
    if (heading) out.push(heading);
    out.push(p);
  });
  return out;
}
