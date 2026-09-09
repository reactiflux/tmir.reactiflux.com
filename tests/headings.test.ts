import test from "node:test";
import assert from "node:assert/strict";
import { insertHeadings } from "../src/content/headings.ts";

const paras = [
  "**Carl Vitullo:** one [00:00:10]",
  "two [00:01:00]",
  "three [00:05:00]",
  "four [00:09:00]",
];

test("each item's heading lands before the first paragraph at or past its time", () => {
  assert.deepEqual(
    insertHeadings(paras, [
      { time: "00:00:00", title: "Intro" },
      { time: "00:04:30", title: "Main" },
    ]),
    [
      "## Intro",
      "**Carl Vitullo:** one [00:00:10]",
      "two [00:01:00]",
      "## Main",
      "three [00:05:00]",
      "four [00:09:00]",
    ],
  );
});

test("items with no later paragraph, or sharing a target, are skipped", () => {
  assert.deepEqual(
    insertHeadings(paras, [
      { time: "00:04:00", title: "First" },
      { time: "00:04:50", title: "Same target" },
      { time: "01:00:00", title: "Past the end" },
    ]),
    [
      "**Carl Vitullo:** one [00:00:10]",
      "two [00:01:00]",
      "## First",
      "three [00:05:00]",
      "four [00:09:00]",
    ],
  );
});

test("paragraphs without a timestamp are never a target", () => {
  assert.deepEqual(
    insertHeadings(
      ["no time here", "later [00:02:00]"],
      [{ time: "00:00:00", title: "Intro" }],
    ),
    ["no time here", "## Intro", "later [00:02:00]"],
  );
});

test("an out-of-order outline item doesn't overwrite a heading already placed", () => {
  assert.deepEqual(
    insertHeadings(
      ["p0 [00:00:10]", "p1 [00:01:00]", "p2 [00:05:00]"],
      [
        { time: "00:04:00", title: "Late" },
        { time: "00:00:05", title: "Early" },
        { time: "00:04:30", title: "Late2" },
      ],
    ),
    ["## Early", "p0 [00:00:10]", "p1 [00:01:00]", "## Late", "p2 [00:05:00]"],
  );
});
