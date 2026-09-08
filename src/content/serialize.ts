import YAML from "yaml";

/**
 * Re-emit front matter and splice the original body back on untouched.
 * `body` is exactly what splitFile() returned, so an unchanged front matter
 * object round-trips the file.
 */
export function serializeEpisodeFile(
  frontMatter: Record<string, unknown>,
  body: string,
): string {
  const yaml = YAML.stringify(frontMatter, { lineWidth: 0 });
  return `---\n${yaml}---\n${body}`;
}
