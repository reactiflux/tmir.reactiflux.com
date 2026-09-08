/**
 * Undo markdown escaping so titles and transcript text read as prose.
 * Ingested content is sometimes doubly escaped (`\\\+`, `\\\`code\\\``), so the
 * backslash run is stripped wholesale rather than one level at a time.
 */
export function unescapeMarkdown(text: string): string {
  return text
    .replace(/\\+([!-\/:-@\[-`{-~])/g, "$1")
    .replace(/`([^`\n]*)`/g, "$1");
}

/** Reduce `[text](url)` to `text`, and unescape what's left. */
export function flattenLinks(text: string): string {
  return unescapeMarkdown(text.replace(/\[(.*?)\]\(.*?\)/g, "$1"));
}

/**
 * Split a heading/title into its plain text and its first `[text](url)` target,
 * so a heading written as a markdown link can render as a real anchor instead
 * of leaking brackets. `text` is the whole title with every link flattened.
 */
export function splitTitleLink(title: string): { text: string; url?: string } {
  const m = /\[[^\]]*\]\(([^)]+)\)/.exec(title);
  return { text: flattenLinks(title).trim(), url: m?.[1] };
}

/**
 * Anchor slug. Rule copied verbatim from reactiflux.com/scripts/process-tmir.ts
 * so anchors already published on reactiflux.com keep working.
 */
export function slug(title: string): string {
  return flattenLinks(title)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function timestampToSeconds(ts: string): number {
  return ts.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

export function secondsToTimestamp(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** `mm:ss`, `m:ss`, `h:mm:ss` or `hh:mm:ss` -> `hh:mm:ss`. */
export function normalizeTime(raw: string): string {
  return secondsToTimestamp(timestampToSeconds(raw.trim()));
}
