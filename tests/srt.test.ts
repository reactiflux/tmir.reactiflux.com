import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEpisode } from "../src/content/parse.ts";
import { toSrt } from "../src/content/srt.ts";

const raw = readFileSync(
  new URL("./fixtures/canonical-2026-05.md", import.meta.url),
  "utf8",
);

test("toSrt numbers cues, formats times, and prefixes the speaker", () => {
  const srt = toSrt(parseEpisode(raw, "2026-05"));
  assert.equal(
    srt,
    [
      "1",
      "00:00:00,000 --> 00:00:55,000",
      "Carl Vitullo: Thank you for joining us. We're coming to you live from Reactiflux.",
      "",
      "2",
      "00:00:55,000 --> 00:01:40,000",
      "Carl Vitullo: Okay, let's get into it. Before we go into, like, new releases and whatever.",
      "",
      "3",
      "00:01:40,000 --> 00:01:44,000",
      "Carl Vitullo: Stuff has changed. Stuff will continue to change. Just like life.",
      "",
      "4",
      "00:01:44,000 --> 00:01:49,000",
      "Mark Erikson: Yeah, that sounds all too real.",
      "",
      "5",
      "00:01:49,000 --> 00:01:54,000",
      "Carl Vitullo: But yeah, okay, into some new releases.",
      "",
    ].join("\n"),
  );
});

test("cues never end before, or at, their own start", () => {
  const raw = `---
title: t
date: 2026-05-28
description: d
---

# Transcript

**Carl Vitullo:** same second [00:01:00]

**Mark Erikson:** also same second [00:01:00]

**Carl Vitullo:** backwards [00:00:30]

**Mark Erikson:** last [00:02:00]
`;
  const srt = toSrt(parseEpisode(raw, "2026-05"));
  const spans = [
    ...srt.matchAll(/^(\d\d:\d\d:\d\d),000 --> (\d\d:\d\d:\d\d),000$/gm),
  ];
  assert.equal(spans.length, 4);
  for (const [, start, end] of spans)
    assert.ok(end > start, `${start} --> ${end}`);
});

test("every episode in content/ produces cues with a positive duration", async () => {
  const { loadEpisodes } = await import("../src/content/load.ts");
  const bad: string[] = [];
  for (const episode of await loadEpisodes()) {
    for (const [, start, end] of toSrt(episode).matchAll(
      /^(\d\d:\d\d:\d\d),000 --> (\d\d:\d\d:\d\d),000$/gm,
    )) {
      if (end <= start) bad.push(`${episode.slug} ${start} --> ${end}`);
    }
  }
  assert.deepEqual(bad, []);
});
