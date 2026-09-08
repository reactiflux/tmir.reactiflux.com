/**
 * Serialize structured data for a <script type="application/ld+json"> block.
 * `<` becomes `\u003c` — still valid JSON, but a `</script>` inside a title or
 * description can no longer close the block.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
