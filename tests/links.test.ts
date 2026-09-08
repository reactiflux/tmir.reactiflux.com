import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TMIR_CONTENT_DIR = "tests/fixtures/episodes";
const { buildLinkIndex, groupByHost } = await import("../src/content/links.ts");
const { loadEpisodes } = await import("../src/content/load.ts");

test("buildLinkIndex flattens nested outline items with URLs", async () => {
  const entries = buildLinkIndex(await loadEpisodes());
  assert.deepEqual(
    entries.map((e) => e.text),
    ["React Compiler", "Caveats", "TanStack Start"],
  );
});

test("buildLinkIndex excludes items without a URL", async () => {
  const entries = buildLinkIndex(await loadEpisodes());
  assert.ok(!entries.some((e) => e.text === "No link here"));
});

test("buildLinkIndex records host, episode and time", async () => {
  const [first] = buildLinkIndex(await loadEpisodes());
  assert.equal(first.host, "react.dev");
  assert.equal(first.url, "https://react.dev/compiler");
  assert.equal(first.episodeSlug, "2026-05");
  assert.equal(first.episodeTitle, "TMiR 2026-05: React Compiler ships");
  assert.equal(first.time, 30);
});

test("groupByHost sorts by count descending", async () => {
  const groups = groupByHost(buildLinkIndex(await loadEpisodes()));
  assert.deepEqual(
    groups.map((g) => [g.host, g.entries.length]),
    [
      ["react.dev", 2],
      ["tanstack.com", 1],
    ],
  );
});
