import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEpisode, splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";
import { toSrt } from "../src/content/srt.ts";

const raw = readFileSync(
  new URL("./fixtures/canonical-2026-05.md", import.meta.url),
  "utf8",
);
const ep = parseEpisode(raw, "2026-05");

test("front matter fields land on the episode", () => {
  assert.equal(ep.slug, "2026-05");
  assert.match(ep.title, /^TMiR 2026-05:/);
  assert.equal(ep.date, "2026-05-28");
  assert.equal(ep.time, "2pm PT / 9pm GMT");
  assert.equal(ep.location, "Main Stage on Reactiflux");
  assert.equal(ep.transistorId, "dd8e79de");
  assert.equal(ep.duration, 4198);
  assert.equal(ep.season, 3);
  assert.equal(ep.episode, 5);
});

test("people is a list of objects", () => {
  assert.equal(ep.people.length, 2);
  assert.deepEqual(ep.people[0], {
    name: "Mark Erikson",
    role: "Host",
    href: "https://blog.isquaredsoftware.com",
    img: "https://img.transistorcdn.com/mark.jpg",
  });
});

test("outline nests by indentation and derives anchors from titles", () => {
  assert.equal(ep.outline.length, 3);
  assert.equal(ep.outline[0].title, "Some podcast meta");
  assert.equal(ep.outline[0].time, "00:00:55");
  assert.equal(ep.outline[0].anchor, "some-podcast-meta");
  assert.equal(ep.outline[0].url, undefined);
  assert.equal(ep.outline[0].children.length, 0);

  assert.equal(ep.outline[1].title, "New Releases");
  assert.equal(ep.outline[1].children.length, 2);
  assert.equal(ep.outline[1].children[0].title, "TS v7 beta");
  assert.equal(ep.outline[1].children[0].anchor, "ts-v7-beta");
  assert.equal(
    ep.outline[1].children[0].url,
    "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/",
  );

  assert.equal(ep.outline[2].title, "Outro");
  assert.equal(ep.outline[2].time, undefined);
});

test("segments before the first heading go into an Intro section", () => {
  assert.equal(ep.sections[0].title, "Intro");
  assert.equal(ep.sections[0].anchor, "intro");
  assert.equal(ep.sections[0].segments.length, 1);
  assert.equal(ep.sections[0].time, "00:00:00");
});

test("sections carry anchors and the time of their first segment", () => {
  assert.equal(ep.sections.length, 3);
  assert.equal(ep.sections[1].title, "Some podcast meta");
  assert.equal(ep.sections[1].anchor, "some-podcast-meta");
  assert.equal(ep.sections[1].time, "00:00:55");
  assert.equal(ep.sections[2].anchor, "new-releases");
});

test("speaker carries forward across consecutive paragraphs", () => {
  const segs = ep.sections[1].segments;
  assert.equal(segs.length, 3);
  assert.equal(segs[0].speaker, "Carl Vitullo");
  assert.equal(segs[0].time, "00:00:55");
  assert.equal(segs[1].speaker, "Carl Vitullo");
  assert.equal(segs[1].text, "Stuff has changed. Stuff will continue to change. Just like life.");
  assert.equal(segs[2].speaker, "Mark Erikson");
});

test("outline anchor is reconciled to the section anchor by matching time, not title", () => {
  const raw = `---
title: t
date: 2024-03-27
description: d
---

- [[00:00:40](#astro-45)] [Astro 4.5](https://astro.build/blog/astro-450/)
- [[00:05:00](#no-match)] No matching section

# Transcript

**Carl Vitullo:** Astro talk. [00:00:39]

## Astro 4.5, AstroDB

**Carl Vitullo:** Digging in. [00:00:40]
`;
  const ep = parseEpisode(raw, "2024-03");
  // Title-derived anchor ("astro-45") would not match the section's
  // ("astro-45-astrodb"); the time match reconciles it.
  assert.equal(ep.outline[0].anchor, "astro-45-astrodb");
  assert.equal(ep.outline[0].anchor, ep.sections[1].anchor);
  // No section shares this item's time, so it keeps its title-derived anchor.
  assert.equal(ep.outline[1].anchor, "no-matching-section");
});

test("outline anchor reconciliation tolerates drift within 120s, not beyond", () => {
  const raw = `---
title: t
date: 2024-05-29
description: d
---

- [[00:28:08](#effect)] Effect
- [[00:33:08](#far-away)] Far away

# Transcript

**Carl Vitullo:** Intro. [00:00:00]

## Effect JS

**Carl Vitullo:** Digging in. [00:28:41]
`;
  const ep = parseEpisode(raw, "2024-05");
  // 33s of drift (< 120s) still reconciles to the nearest section.
  assert.equal(ep.outline[0].anchor, "effect-js");
  assert.equal(ep.outline[0].anchor, ep.sections[1].anchor);
  // 5 minutes of drift is outside the 120s tolerance; keeps its own anchor.
  assert.equal(ep.outline[1].anchor, "far-away");
});

test("nested outline items also reconcile via drift, not just top-level", () => {
  const raw = `---
title: t
date: 2024-05-29
description: d
---

- [[00:10:00](#topic)] Topic
  - [[00:12:12](#react-for-two-computers-by-dan-abramov)] React for Two Computers by Dan Abramov

# Transcript

**Carl Vitullo:** Intro chat. [00:00:00]

## Topic

**Carl Vitullo:** Into the topic. [00:10:00]

## React for Two Computers

**Carl Vitullo:** Talk begins. [00:12:30]
`;
  const ep = parseEpisode(raw, "2024-05");
  // 18s of drift on a nested item reconciles to its section, same as a
  // top-level item would.
  assert.equal(ep.outline[0].children[0].anchor, "react-for-two-computers");
  assert.equal(ep.outline[0].children[0].anchor, ep.sections[2].anchor);
});

test("a section already claimed by an exact match isn't stolen by a nearby drifted item", () => {
  const raw = `---
title: t
date: 2024-06-01
description: d
---

- [[00:05:00](#topic)] Topic
  - [[00:05:10](#sidebar)] Sidebar

# Transcript

**Carl Vitullo:** Intro. [00:00:00]

## Topic

**Carl Vitullo:** Talking. [00:05:00]
`;
  const ep = parseEpisode(raw, "2024-06");
  // "Topic" claims its section (exact time match).
  assert.equal(ep.outline[0].anchor, "topic");
  // "Sidebar" is only 10s away from the same section, but it's already
  // claimed and there's no other section within tolerance — "Sidebar"
  // keeps its own title-derived anchor rather than stealing "Topic"'s.
  assert.equal(ep.outline[0].children[0].anchor, "sidebar");
});

test("serialize round-trips a file byte for byte", () => {
  const { frontMatter, body } = splitFile(raw);
  assert.equal(serializeEpisodeFile(frontMatter, body), raw);
});

test("serialize writes a changed field without disturbing the body", () => {
  const { frontMatter, body } = splitFile(raw);
  frontMatter.duration = 5000;
  const out = serializeEpisodeFile(frontMatter, body);
  assert.match(out, /^duration: 5000$/m);
  assert.ok(out.includes("**Mark Erikson:** Yeah, that sounds all too real. [00:01:44]"));
});

const withFrontMatter = (body: string) =>
  `---\ntitle: t\ndate: 2025-01-01\ndescription: d\n---\n${body}`;

test("a heading with no paragraphs under it still becomes a section", () => {
  const parsed = parseEpisode(
    withFrontMatter(
      [
        "",
        "- [[00:00:01](#first)] First",
        "- [[00:00:02](#empty)] Empty",
        "- [[00:00:03](#last)] Last",
        "",
        "# Transcript",
        "",
        "## First",
        "",
        "**Carl Vitullo:** hello [00:00:01]",
        "",
        "## Empty",
        "",
        "## Last",
        "",
        "**Carl Vitullo:** bye [00:00:03]",
        "",
      ].join("\n"),
    ),
    "x",
  );
  assert.deepEqual(
    parsed.sections.map((s) => s.anchor),
    ["first", "empty", "last"],
  );
  assert.deepEqual(parsed.sections[1].segments, []);
  assert.equal(parsed.sections[1].time, undefined);
});

test("no synthetic Intro when the transcript opens with a heading", () => {
  const parsed = parseEpisode(
    withFrontMatter(
      [
        "",
        "- [[00:00:01](#intro)] Intro",
        "",
        "# Transcript",
        "",
        "## Intro",
        "",
        "**Carl Vitullo:** hello [00:00:01]",
        "",
      ].join("\n"),
    ),
    "x",
  );
  assert.deepEqual(
    parsed.sections.map((s) => s.anchor),
    ["intro"],
  );
  assert.equal(parsed.outline[0].anchor, "intro");
});

test("repeated headings get suffixed anchors and the outline follows them", () => {
  const parsed = parseEpisode(
    withFrontMatter(
      [
        "",
        "- [[00:00:01](#quick-hits)] Quick hits",
        "- [[00:00:10](#main)] Main",
        "- [[00:00:20](#quick-hits)] Quick hits",
        "",
        "# Transcript",
        "",
        "## Quick hits",
        "",
        "**Carl Vitullo:** one [00:00:01]",
        "",
        "## Main",
        "",
        "**Carl Vitullo:** two [00:00:10]",
        "",
        "## Quick hits",
        "",
        "**Carl Vitullo:** three [00:00:20]",
        "",
      ].join("\n"),
    ),
    "x",
  );
  assert.deepEqual(
    parsed.sections.map((s) => s.anchor),
    ["quick-hits", "main", "quick-hits-2"],
  );
  assert.deepEqual(
    parsed.outline.map((i) => i.anchor),
    ["quick-hits", "main", "quick-hits-2"],
  );
});

test("toSrt tolerates sections with no segments", () => {
  const parsed = parseEpisode(
    withFrontMatter(
      [
        "",
        "- [[00:00:01](#a)] A",
        "",
        "# Transcript",
        "",
        "## Empty",
        "",
        "## A",
        "",
        "**Carl Vitullo:** hi [00:00:01]",
        "",
      ].join("\n"),
    ),
    "x",
  );
  assert.match(toSrt(parsed), /^1\n00:00:01,000 --> 00:00:06,000\nCarl Vitullo: hi\n$/);
});

test("markdown escapes and code spans are undone in titles and segments", () => {
  const parsed = parseEpisode(
    withFrontMatter(
      [
        "",
        "- [[00:00:01](#a)] [Redux \\\\\\+ signals](https://x.example)",
        "",
        "# Transcript",
        "",
        "## [Redux \\\\\\+ signals](https://x.example)",
        "",
        "**Carl Vitullo:** the \\\\\\`react-concurrent-store\\\\\\` ponyfill, snake\\_case [00:00:01]",
        "",
      ].join("\n"),
    ),
    "x",
  );
  assert.equal(parsed.outline[0].title, "Redux + signals");
  assert.equal(
    parsed.sections[0].segments[0].text,
    "the react-concurrent-store ponyfill, snake_case",
  );
});

test("a body that begins with the transcript marker still parses its sections", () => {
  const parsed = parseEpisode(
    withFrontMatter(
      ["# Transcript", "", "**Carl Vitullo:** hello [00:00:01]", ""].join("\n"),
    ),
    "x",
  );
  assert.deepEqual(parsed.outline, []);
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].segments[0].text, "hello");
});

test("a missing or unparseable date fails at parse time, naming the episode", () => {
  const noDate = "---\ntitle: t\ndescription: d\n---\n\n# Transcript\n";
  assert.throws(() => parseEpisode(noDate, "2026-05"), /2026-05.*date/);
  const badDate = "---\ntitle: t\ndate: nonsense\ndescription: d\n---\n\n# Transcript\n";
  assert.throws(() => parseEpisode(badDate, "2026-05"), /2026-05.*date/);
});
