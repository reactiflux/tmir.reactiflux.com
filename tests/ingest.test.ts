import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseFeed,
  scaffoldEpisode,
  seriesFromTitle,
  slugFromTitle,
  applyFeedItem,
} from "../scripts/ingest.ts";
import { parseEpisode } from "../src/content/parse.ts";

const xml = readFileSync(
  new URL("./fixtures/feed.xml", import.meta.url),
  "utf8",
);

test("slugFromTitle handles every TMiR title style and rejects the rest", () => {
  assert.equal(
    slugFromTitle("TMiR 2026-05: Who even is on the Core team anymore"),
    "2026-05",
  );
  assert.equal(
    slugFromTitle("TMiR 2023-10: React Forget, Canary Releases"),
    "2023-10",
  );
  assert.equal(
    slugFromTitle("This Month in React – September 2023"),
    "2023-09",
  );
  assert.equal(slugFromTitle("This Month In React – March 2023"), "2023-03");
  assert.equal(slugFromTitle("This Month in React (April 2023)"), "2023-04");
  assert.equal(
    slugFromTitle(
      "TMiR 2024-09 – Async Components??, a React 19 cheatsheet, static Hermes, and trademarks drama",
    ),
    "2024-09",
  );
  assert.equal(
    slugFromTitle("Mark & Carl talk with Swizec Teller about using AI at work"),
    "2026-04",
  );
  assert.equal(
    slugFromTitle("Office Hours – States of Burnout with Jenny Truong"),
    null,
  );
  assert.equal(slugFromTitle("Behind the React Documentary"), null);
});

test("seriesFromTitle slugs the side series and leaves the monthly show alone", () => {
  const cases: [string, string, string, string][] = [
    [
      "Office Hours – States of Burnout with Jenny Truong",
      "2023-07-17",
      "2023-07-office-hours-states-of-burnout",
      "Reactiflux Office Hours",
    ],
    // Two Office Hours share 2023-03, so the tail has to disambiguate them.
    [
      "Office Hours – Rewrites, with Sunil Pai and Mark Erikson",
      "2023-03-23",
      "2023-03-office-hours-rewrites",
      "Reactiflux Office Hours",
    ],
    [
      "Office Hours – Becoming a leader with Ankita Kulkarni",
      "2023-03-14",
      "2023-03-office-hours-becoming-a-leader",
      "Reactiflux Office Hours",
    ],
    // "Office Hours with <guest>" — the "with" is part of the prefix here.
    [
      "Office Hours with Wix: Tom Raviv, Omer Kenet, & Peter Shershov",
      "2023-01-26",
      "2023-01-office-hours-wix",
      "Reactiflux Office Hours",
    ],
    [
      "Office Hours with Matt Pocock and MapleLeaf",
      "2023-01-11",
      "2023-01-office-hours-matt-pocock",
      "Reactiflux Office Hours",
    ],
    [
      "Community Spotlight – Joy of React, with Josh Comeau",
      "2023-02-14",
      "2023-02-spotlight-joy-of-react",
      "Reactiflux Spotlight",
    ],
    // No prefix of its own: listed by title.
    [
      "Behind the React Documentary",
      "2023-02-24",
      "2023-02-spotlight-behind-the-react-documentary",
      "Reactiflux Spotlight",
    ],
  ];
  for (const [title, date, slug, series] of cases) {
    assert.deepEqual(seriesFromTitle(title, date), { slug, series }, title);
  }
  assert.equal(
    seriesFromTitle("TMiR 2026-05: Who even is on the Core team", "2026-05-27"),
    undefined,
  );
});

test("a side-series scaffold carries the label and no transcript marker", () => {
  const text = scaffoldEpisode(
    {
      title: "Office Hours – Rewrites, with Sunil Pai and Mark Erikson",
      date: "2023-03-23",
      series: "Reactiflux Office Hours",
    },
    "2026-09-09",
  );
  const ep = parseEpisode(text, "2023-03-office-hours-rewrites");
  assert.equal(ep.series, "Reactiflux Office Hours");
  assert.equal(ep.sections.length, 0);
  assert.equal(ep.outline.length, 0);
  assert.ok(!text.includes("# Transcript"));
  assert.ok(!text.includes("descriptProjectId"));
});

test("parseFeed extracts the monthly show and the side series", () => {
  const items = parseFeed(xml);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    slug: "2026-05",
    title:
      "TMiR 2026-05: Who even is on the Core team anymore, TanStack got pwn'd bad",
    series: undefined,
    date: "2026-05-27",
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
    bskyPostUrl:
      "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
  });
  assert.equal(items[1].slug, "2023-09");
  assert.equal(items[1].date, "2023-09-27");
  assert.equal(items[1].people.length, 1);
  // The 2023 item has no description and therefore no announcement post.
  assert.equal(items[1].bskyPostUrl, undefined);
  // The side series comes through with its own slug shape and its label.
  assert.equal(items[2].slug, "2023-07-office-hours-states-of-burnout");
  assert.equal(items[2].series, "Reactiflux Office Hours");
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
  // the feed's title is longer; the curated one wins
  assert.equal(ep.title, "TMiR 2026-05: Who even is on the Core team anymore");
  assert.equal(ep.sections[0].segments[0].text, "Hello.");
  // atUri belongs to publish-atproto; ingest must leave it exactly as it found it
  assert.equal(ep.atUri, "at://did:plc:example/site.standard.document/2026-05");
});

test("parseFeed accepts HH:MM:SS and MM:SS itunes:duration", () => {
  const feed = (duration: string) =>
    [
      "<item>",
      "<title>TMiR 2026-06: Colon durations</title>",
      '<enclosure url="https://media.transistor.fm/abc12345/hash.mp3" type="audio/mpeg"/>',
      `<itunes:duration>${duration}</itunes:duration>`,
      "</item>",
    ].join("\n");

  assert.equal(parseFeed(feed("1:09:58"))[0]?.duration, 4198);
  assert.equal(parseFeed(feed("09:58"))[0]?.duration, 598);
  assert.equal(parseFeed(feed("4198"))[0]?.duration, 4198);
});

test("applyFeedItem does not clobber curated people with an empty feed list", () => {
  const file = [
    "---",
    'title: "TMiR 2026-05: test"',
    "date: 2026-05-28",
    'description: "d"',
    "people:",
    "  - name: Carl Vitullo",
    "    role: Producer",
    "---",
    "",
    "# Transcript",
    "",
    "**Carl Vitullo:** Hello. [00:00:55]",
    "",
  ].join("\n");

  const item = { ...parseFeed(xml)[0], people: [] };
  const ep = parseEpisode(applyFeedItem(file, item), "2026-05");
  assert.equal(ep.people.length, 1);
  assert.equal(ep.people[0].name, "Carl Vitullo");
});

test("applyFeedItem fills in an empty title but never the description", () => {
  const file = [
    "---",
    'title: ""',
    "date: 2026-05-28",
    'description: ""',
    "---",
    "",
    "- [[00:00:55](#some-podcast-meta)] Some podcast meta",
    "",
    "# Transcript",
    "",
  ].join("\n");

  const ep = parseEpisode(applyFeedItem(file, parseFeed(xml)[0]), "2026-05");
  assert.equal(
    ep.title,
    "TMiR 2026-05: Who even is on the Core team anymore, TanStack got pwn'd bad",
  );
  // The feed's <description> is the whole show-notes blob, so it is never
  // imported — the description stays whatever the file says.
  assert.equal(ep.description, "");
});
