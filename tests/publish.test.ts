import test from "node:test";
import assert from "node:assert/strict";
import { scaffoldEpisode } from "../scripts/publish.ts";
import { parseEpisode } from "../src/content/parse.ts";

test("the scaffold parses as an episode with no outline yet", () => {
  const text = scaffoldEpisode(
    {
      title: "TMiR 2026-09: Something happened",
      date: "2026-09-15",
    },
    "2026-09-09",
  );

  const ep = parseEpisode(text, "2026-09");
  assert.equal(ep.title, "TMiR 2026-09: Something happened");
  assert.equal(ep.date, "2026-09-15");
  // Never taken from the feed; written by hand.
  assert.equal(ep.description, "");
  // The `# Transcript` marker replaceTranscript needs, with nothing under it.
  assert.equal(ep.sections.length, 0);
  // The prompt is an HTML comment, so it is not mistaken for an outline item.
  assert.equal(ep.outline.length, 0);
});

test("the scaffold falls back to today when the episode isn't in the feed yet", () => {
  const ep = parseEpisode(scaffoldEpisode({}, "2026-09-09"), "2026-09");
  assert.equal(ep.date, "2026-09-09");
  assert.equal(ep.title, "");
  assert.equal(ep.description, "");
});
