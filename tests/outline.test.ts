import test from "node:test";
import assert from "node:assert/strict";
import {
  outlineRegion,
  pairOutline,
  parseChapters,
  parseDraft,
  renderOutline,
  replaceOutlineRegion,
  report,
  withChapters,
} from "../scripts/outline.ts";
import { splitFile } from "../src/content/parse.ts";

const CHAPTERS = [
  { time: "00:00:00", title: "tmir-2026-08" },
  { time: "00:00:55", title: "New releases" },
  { time: "00:01:02", title: "Waku 1.0 (RC)" },
  { time: "00:23:49", title: "React Compiler support in OXC" },
  { time: "00:57:14", title: "Lightning round" },
  { time: "00:57:16", title: "npm.report" },
  { time: "01:05:09", title: "Outro" },
];

const DRAFT = `New releases

* [Waku 1.0 (RC)](https://waku.gg/blog/waku-v1-rc)
* React Compiler support
  * [React Compiler Linting \\- Oxlint Speedup](https://blog.master.dev/x)

Short asides/lightning rounds

- [Npm.report](https://bsky.app/profile/x)
`;

test("a draft parses into a tree, paragraph lines as roots", () => {
  const tree = parseDraft(DRAFT);
  assert.deepEqual(
    tree.map((n) => n.text),
    ["New releases", "Short asides/lightning rounds"],
  );
  assert.equal(tree[0].children.length, 2);
  assert.equal(tree[0].children[1].text, "React Compiler support");
  assert.equal(tree[0].children[1].children.length, 1);
  assert.equal(
    tree[1].children[0].text,
    "[Npm.report](https://bsky.app/profile/x)",
  );
});

test("pairing matches exactly, by fallback, and inherits for the rest", () => {
  const { lines, unusedChapters } = pairOutline(parseDraft(DRAFT), CHAPTERS);

  // Exact match on normalized text, links flattened.
  assert.deepEqual(
    lines.map((l) => [l.time, l.inherited]),
    [
      ["00:00:55", false], // "New releases", exact
      ["00:01:02", false], // "[Waku 1.0 (RC)](…)", exact once the link is flattened
      ["00:23:49", false], // "React Compiler support" ⊂ "React Compiler support in OXC"
      ["00:23:49", true], // Oxlint speedup has no chapter: inherits its parent's
      ["00:57:14", false], // "Short asides/lightning rounds" vs "Lightning round"
      ["00:57:16", false], // "[Npm.report](…)" vs "npm.report"
    ],
  );
  assert.deepEqual(
    unusedChapters.map((c) => c.title),
    ["tmir-2026-08", "Outro"],
  );
});

test("a repeated topic does not steal back its own earlier chapter", () => {
  const draft = parseDraft(
    "New releases\n\n* Waku 1.0 (RC)\n\nLightning round\n\n* Waku 1.0 (RC)\n",
  );
  const { lines } = pairOutline(draft, CHAPTERS);
  assert.deepEqual(
    lines.map((l) => l.time),
    ["00:00:55", "00:01:02", "00:57:14", "00:57:14"],
  );
  assert.equal(lines[3].inherited, true);
});

test("rendering keeps the author's markdown and nests by depth", () => {
  const { lines } = pairOutline(parseDraft(DRAFT), CHAPTERS);
  const rendered = renderOutline(lines).split("\n");
  assert.equal(rendered[0], "- [[00:00:55](#new-releases)] New releases");
  assert.equal(
    rendered[1],
    "  - [[00:01:02](#waku-10-rc)] [Waku 1.0 (RC)](https://waku.gg/blog/waku-v1-rc)",
  );
  // Unmatched sub-point: the author's text, but its parent chapter's anchor.
  assert.equal(
    rendered[3],
    "    - [[00:23:49](#react-compiler-support-in-oxc)] [React Compiler Linting \\- Oxlint Speedup](https://blog.master.dev/x)",
  );
});

test("anchors come from the chapter title, not the author's prose", () => {
  const { lines } = pairOutline(parseDraft(DRAFT), CHAPTERS);
  assert.deepEqual(
    lines.map((l) => [l.text, l.anchor]),
    [
      ["New releases", "new-releases"],
      ["[Waku 1.0 (RC)](https://waku.gg/blog/waku-v1-rc)", "waku-10-rc"],
      // The author wrote "React Compiler support"; the chapter is longer.
      ["React Compiler support", "react-compiler-support-in-oxc"],
      // No chapter of its own: it points at the chapter it sits inside
      // rather than minting an anchor no heading will ever carry.
      [
        "[React Compiler Linting \\- Oxlint Speedup](https://blog.master.dev/x)",
        "react-compiler-support-in-oxc",
      ],
      // The author wrote "Short asides/lightning rounds".
      ["Short asides/lightning rounds", "lightning-round"],
      ["[Npm.report](https://bsky.app/profile/x)", "npmreport"],
    ],
  );
});

test("withChapters records the chapter list without disturbing the rest", () => {
  const file = `---\ntitle: "x"\ndate: 2026-08-28\n---\n\n- a\n\n# Transcript\n\nhello\n`;
  const after = withChapters(file, CHAPTERS.slice(1, 3));
  assert.match(after, /^---\ntitle: "x"\ndate: 2026-08-28\nchapters:\n/);
  assert.match(after, /\n\n- a\n\n# Transcript\n\nhello\n$/);
  assert.deepEqual(splitFile(after).frontMatter.chapters, CHAPTERS.slice(1, 3));
});

test("the report names unused chapters and inherited lines", () => {
  const text = report(pairOutline(parseDraft(DRAFT), CHAPTERS));
  assert.match(text, /tmir-2026-08/);
  assert.match(text, /Outro/);
  assert.match(text, /React Compiler Linting - Oxlint Speedup/);
  assert.doesNotMatch(text, /WARNING/);
});

test("chapters come out of the feed item's description CDATA", () => {
  const xml = `<rss><item><title>Not this one</title><description><![CDATA[<ul><li>(00:10) - Nope</li></ul>]]></description></item>
<item><title>TMiR 2026-08: Something</title><description><![CDATA[<p>blurb &amp; more</p><ul><li>(00:00) - tmir-2026-08</li>
<li>(01:02) - Waku 1.0 (RC)</li>
<li>(01:05:09) - Outro</li>
</ul>]]></description></item></rss>`;
  assert.deepEqual(parseChapters(xml, "2026-08"), [
    { time: "00:00:00", title: "tmir-2026-08" },
    { time: "00:01:02", title: "Waku 1.0 (RC)" },
    { time: "01:05:09", title: "Outro" },
  ]);
  assert.deepEqual(parseChapters(xml, "2026-07"), []);
});

test("only the region between the front matter and the transcript is replaced", () => {
  const file = `---\ntitle: "x"\ndate: 2026-08-28\n---\n\nNew releases\n\n* Waku\n\n# Transcript\n\nhello\n`;
  assert.equal(outlineRegion(file), "\nNew releases\n\n* Waku\n");
  const after = replaceOutlineRegion(
    file,
    "- [[00:00:55](#new-releases)] New releases",
  );
  assert.equal(
    after,
    `---\ntitle: "x"\ndate: 2026-08-28\n---\n\n- [[00:00:55](#new-releases)] New releases\n\n# Transcript\n\nhello\n`,
  );
});
