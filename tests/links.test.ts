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

test("subject context follows nested links without treating every Next.js link as RSC", async () => {
  const { subjectsForLink } = await import("../src/content/link-subjects.ts");
  assert.ok(
    subjectsForLink("Code and demo", "https://github.com/example/demo", [
      "React Server Components",
    ]).includes("server-components"),
  );
  assert.ok(
    !subjectsForLink(
      "Next.js 15 release",
      "https://nextjs.org/blog/next-15",
      [],
    ).includes("server-components"),
  );
  assert.deepEqual(
    subjectsForLink("RSC demo", "https://example.com/demo", [], {
      remove: ["server-components"],
      add: ["tooling"],
    }),
    ["tooling"],
  );
});

test("deduplication preserves discussions across episodes and meaningful URL fragments", async () => {
  const { buildLinkResources, resourceKey } =
    await import("../src/content/links.ts");
  const [entry] = buildLinkIndex(await loadEpisodes());
  const older = {
    ...entry,
    date: "2023-01-01",
    episodeSlug: "2023-01",
    discussionUrl: "/episodes/2023-01#compiler",
    url: "https://example.com/article?utm_source=podcast",
  };
  const newer = {
    ...entry,
    date: "2024-01-01",
    episodeSlug: "2024-01",
    discussionUrl: "/episodes/2024-01#compiler",
    url: "https://example.com/article",
  };
  const resources = buildLinkResources([newer, older, older]);
  assert.equal(resources.length, 1);
  assert.deepEqual(
    resources[0].mentions.map((mention) => mention.date),
    ["2023-01-01", "2024-01-01"],
  );
  assert.notEqual(
    resourceKey("https://example.com/a#first"),
    resourceKey("https://example.com/a#second"),
  );
  assert.notEqual(
    resourceKey("https://example.com/a?v=1"),
    resourceKey("https://example.com/a?v=2"),
  );
});

test("discussion links use valid parent headings and expand RSC abbreviations", async () => {
  const [episode] = await loadEpisodes();
  const custom = {
    ...episode,
    sections: [
      {
        title: "React Server Components Devtools",
        anchor: "react-server-components-devtools",
        segments: [],
      },
    ],
    outline: [
      {
        title: "RSC Devtools",
        anchor: "rsc-devtools",
        children: [
          {
            title: "Source code",
            anchor: "missing",
            url: "https://example.com/code",
            children: [],
          },
        ],
      },
    ],
  };
  assert.equal(
    buildLinkIndex([custom])[0].discussionUrl,
    `/episodes/${episode.slug}#react-server-components-devtools`,
  );
  custom.sections = [];
  assert.equal(
    buildLinkIndex([custom])[0].discussionUrl,
    `/episodes/${episode.slug}`,
  );
});
