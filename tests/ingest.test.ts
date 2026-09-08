import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed, slugFromTitle, applyFeedItem } from "../scripts/ingest.ts";
import { parseEpisode } from "../src/content/parse.ts";

const xml = readFileSync(new URL("./fixtures/feed.xml", import.meta.url), "utf8");

test("slugFromTitle handles every TMiR title style and rejects the rest", () => {
  assert.equal(slugFromTitle("TMiR 2026-05: Who even is on the Core team anymore"), "2026-05");
  assert.equal(slugFromTitle("TMiR 2023-10: React Forget, Canary Releases"), "2023-10");
  assert.equal(slugFromTitle("This Month in React – September 2023"), "2023-09");
  assert.equal(slugFromTitle("This Month In React – March 2023"), "2023-03");
  assert.equal(slugFromTitle("This Month in React (April 2023)"), "2023-04");
  assert.equal(
    slugFromTitle("TMiR 2024-09 – Async Components??, a React 19 cheatsheet, static Hermes, and trademarks drama"),
    "2024-09",
  );
  assert.equal(
    slugFromTitle("Mark & Carl talk with Swizec Teller about using AI at work"),
    "2026-04",
  );
  assert.equal(slugFromTitle("Office Hours – States of Burnout with Jenny Truong"), null);
  assert.equal(slugFromTitle("Behind the React Documentary"), null);
});

test("parseFeed extracts TMiR items only", () => {
  const items = parseFeed(xml);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    slug: "2026-05",
    transistorId: "dd8e79de",
    audioUrl: "https://op3.dev/e/media.transistor.fm/dd8e79de/4c5d3ad7.mp3",
    duration: 4198,
    season: 3,
    episode: 5,
    people: [
      {
        name: "Mark Erikson",
        role: "Host",
        href: "https://blog.isquaredsoftware.com",
        img: "https://img.transistorcdn.com/mark.jpg",
      },
      {
        name: "Carl Vitullo",
        role: "Producer",
        href: "https://vcarl.com",
        img: "https://img.transistorcdn.com/carl.jpg",
      },
    ],
    bskyPostUrl: "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
  });
  assert.equal(items[1].slug, "2023-09");
  assert.equal(items[1].people.length, 1);
  // The 2023 item has no description and therefore no announcement post.
  assert.equal(items[1].bskyPostUrl, undefined);
});

test("applyFeedItem writes only ingest-owned fields and is idempotent", () => {
  const file = [
    "---",
    'title: "TMiR 2026-05: Who even is on the Core team anymore"',
    "date: 2026-05-28",
    'description: "A description"',
    "time: 2pm PT / 9pm GMT",
    "atUri: at://did:plc:example/site.standard.document/2026-05",
    "---",
    "",
    "- [[00:00:55](#some-podcast-meta)] Some podcast meta",
    "",
    "# Transcript",
    "",
    "**Carl Vitullo:** Hello. [00:00:55]",
    "",
  ].join("\n");

  const item = parseFeed(xml)[0];
  const once = applyFeedItem(file, item);
  assert.equal(applyFeedItem(once, item), once);

  const ep = parseEpisode(once, "2026-05");
  assert.equal(ep.transistorId, "dd8e79de");
  assert.equal(ep.duration, 4198);
  assert.equal(ep.season, 3);
  assert.equal(ep.episode, 5);
  assert.equal(ep.people[1].name, "Carl Vitullo");
  assert.equal(
    ep.bskyPostUrl,
    "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
  );
  // hand-written fields untouched
  assert.equal(ep.time, "2pm PT / 9pm GMT");
  assert.equal(ep.description, "A description");
  assert.equal(ep.sections[0].segments[0].text, "Hello.");
  // atUri belongs to publish-atproto; ingest must leave it exactly as it found it
  assert.equal(ep.atUri, "at://did:plc:example/site.standard.document/2026-05");
});
