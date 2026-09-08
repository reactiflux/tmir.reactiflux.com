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

test("the last cue runs five seconds", () => {
  const srt = toSrt(parseEpisode(raw, "2026-05"));
  assert.ok(srt.trimEnd().endsWith("Carl Vitullo: But yeah, okay, into some new releases."));
  assert.ok(srt.includes("00:01:49,000 --> 00:01:54,000"));
});
