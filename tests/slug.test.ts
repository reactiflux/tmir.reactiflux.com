import test from "node:test";
import assert from "node:assert/strict";
import {
  slug,
  normalizeTime,
  flattenLinks,
  splitTitleLink,
  unescapeMarkdown,
  secondsToTimestamp,
  timestampToSeconds,
} from "../src/content/slug.ts";

test("slug strips markdown links down to their text", () => {
  assert.equal(
    slug("[TS v7 beta](https://devblogs.microsoft.com/typescript/)"),
    "ts-v7-beta",
  );
});

test("slug matches anchors published in existing transcripts", () => {
  assert.equal(slug("Layoffs (seems better!)"), "layoffs-seems-better");
  assert.equal(slug("Astro 4.5, AstroDB"), "astro-45-astrodb");
  assert.equal(slug("Some podcast meta"), "some-podcast-meta");
  assert.equal(
    slug(
      "Job market: [FRED data](https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE), [Layoffs.fyi](https://layoffs.fyi/)",
    ),
    "job-market-fred-data-layoffsfyi",
  );
});

test("slug keeps underscores and digits, drops everything else non-word", () => {
  assert.equal(
    slug("React Strict DOM, Why is it so Great?"),
    "react-strict-dom-why-is-it-so-great",
  );
  assert.equal(slug("Node.js v22"), "nodejs-v22");
});

test("flattenLinks reduces links to text and leaves plain text alone", () => {
  assert.equal(flattenLinks("[a](http://x) and [b](http://y)"), "a and b");
  assert.equal(flattenLinks("no links here"), "no links here");
});

test("normalizeTime pads mm:ss and rolls minutes past 60 into hours", () => {
  assert.equal(normalizeTime("00:16"), "00:00:16");
  assert.equal(normalizeTime("1:23"), "00:01:23");
  assert.equal(normalizeTime("72:15"), "01:12:15");
  assert.equal(normalizeTime("00:00:55"), "00:00:55");
  assert.equal(normalizeTime("1:09:58"), "01:09:58");
});

test("seconds and timestamps round-trip", () => {
  assert.equal(secondsToTimestamp(4198), "01:09:58");
  assert.equal(timestampToSeconds("01:09:58"), 4198);
  assert.equal(secondsToTimestamp(0), "00:00:00");
});

test("splitTitleLink separates a heading's plain text from its first URL", () => {
  assert.deepEqual(
    splitTitleLink(
      "[Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta)",
    ),
    {
      text: "Vite+ Beta",
      url: "https://voidzero.dev/posts/announcing-vite-plus-beta",
    },
  );
  assert.deepEqual(
    splitTitleLink("Johnson Chu made [a bridge](https://example.com/b) for it"),
    { text: "Johnson Chu made a bridge for it", url: "https://example.com/b" },
  );
  assert.deepEqual(splitTitleLink("New releases"), {
    text: "New releases",
    url: undefined,
  });
});

test("unescapeMarkdown drops backslash escapes and unwraps code spans", () => {
  assert.equal(unescapeMarkdown("Redux \\\\\\+ signals"), "Redux + signals");
  assert.equal(
    unescapeMarkdown("React Native \\\\\\<\\\\\\> Imgui"),
    "React Native <> Imgui",
  );
  assert.equal(unescapeMarkdown("snake\\_case"), "snake_case");
  assert.equal(
    unescapeMarkdown(
      "Third-party \\\\\\`react-concurrent-store\\\\\\` ponyfill",
    ),
    "Third-party react-concurrent-store ponyfill",
  );
  assert.equal(unescapeMarkdown("plain `code` span"), "plain code span");
  assert.equal(unescapeMarkdown("nothing to do"), "nothing to do");
  assert.equal(unescapeMarkdown("**bold** stays"), "**bold** stays");
});

test("flattenLinks and slug unescape too", () => {
  assert.equal(
    flattenLinks(
      "[TS 6.0 may enable \\\\\\`strict\\\\\\` by default](https://x.example)",
    ),
    "TS 6.0 may enable strict by default",
  );
  assert.equal(
    slug("Mark's React-Redux \\\\\\+ signals draft"),
    "marks-react-redux-signals-draft",
  );
  assert.deepEqual(
    splitTitleLink("[React Native \\\\\\<\\\\\\> Imgui](https://x.example/1)"),
    { text: "React Native <> Imgui", url: "https://x.example/1" },
  );
});
