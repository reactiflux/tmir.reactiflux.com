import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TMIR_CONTENT_DIR = "tests/fixtures/episodes";
const { cdata, outlineToHtml, outlineToChapters, renderFeed } =
  await import("../src/content/feed.ts");
const { loadEpisodes } = await import("../src/content/load.ts");

test("outlineToHtml nests lists and links out", async () => {
  const [episode] = await loadEpisodes();
  const html = outlineToHtml(episode.outline);
  assert.match(html, /^<ul>/);
  assert.ok(
    html.includes('<a href="https://react.dev/compiler">React Compiler</a>'),
  );
  assert.ok(html.includes("<ul><li>"), "nested child list present");
  assert.ok(html.includes("No link here"));
});

test("outlineToHtml escapes markup in titles", () => {
  const html = outlineToHtml([
    { title: "a & b <script>", anchor: "a", children: [] },
  ]);
  assert.ok(html.includes("a &amp; b &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("outlineToChapters flattens timed items in order", async () => {
  const [episode] = await loadEpisodes();
  const chapters = outlineToChapters(episode.outline);
  assert.deepEqual(
    chapters.map((c) => [c.startTime, c.title]),
    [
      [30, "React Compiler"],
      [130, "Caveats"],
      [600, "TanStack Start"],
    ],
  );
  assert.equal(chapters[0].url, "https://react.dev/compiler");
});

test("renderFeed produces one item per episode with the outline as body", async () => {
  const xml = renderFeed(await loadEpisodes(), "TMiR", "https://example.com");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.equal(xml.match(/<item>/g)?.length, 1);
  assert.ok(xml.includes("<link>https://example.com/episodes/2026-05</link>"));
  assert.ok(xml.includes("React Compiler"));
  assert.ok(xml.includes("<![CDATA["));
});

test("enclosure carries no length, duration stays on itunes:duration", async () => {
  const xml = renderFeed(await loadEpisodes(), "TMiR", "https://example.com");
  assert.ok(xml.includes("<enclosure "), "enclosure present");
  assert.ok(
    !/<enclosure[^>]*length=/.test(xml),
    "no length attribute (bytes unknown)",
  );
  assert.match(xml, /<itunes:duration>\d+<\/itunes:duration>/);
});

test("cdata splits a ]]> so content cannot terminate the section early", () => {
  assert.equal(cdata("plain"), "<![CDATA[plain]]>");
  assert.equal(
    cdata("watch out ]]> here"),
    "<![CDATA[watch out ]]]]><![CDATA[> here]]>",
  );
});
