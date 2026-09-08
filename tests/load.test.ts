import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TMIR_CONTENT_DIR = "tests/fixtures/episodes";
const { loadEpisodes, getEpisode, episodeOrder } =
  await import("../src/content/load.ts");

test("loadEpisodes reads and parses the content directory", async () => {
  const episodes = await loadEpisodes();
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].slug, "2026-05");
  assert.equal(episodes[0].title, "TMiR 2026-05: React Compiler ships");
  assert.equal(episodes[0].sections.length, 2);
});

test("loadEpisodes sorts by date descending", async () => {
  const dates = (await loadEpisodes()).map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("getEpisode finds by slug and misses cleanly", async () => {
  assert.equal((await getEpisode("2026-05"))?.slug, "2026-05");
  assert.equal(await getEpisode("1999-01"), undefined);
});

test("loadEpisodes breaks a date tie by slug descending", async () => {
  const { loadEpisodes: load } = await import("../src/content/load.ts");
  const tied = [
    { slug: "2026-06", date: "2026-06-24" },
    { slug: "2026-07", date: "2026-06-24" },
    { slug: "2026-05", date: "2026-05-01" },
  ];
  assert.deepEqual(
    tied.sort(episodeOrder).map((e) => e.slug),
    ["2026-07", "2026-06", "2026-05"],
  );
  assert.ok(await load());
});
