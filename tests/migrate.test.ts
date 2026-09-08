import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  convert,
  mergeExistingFrontMatter,
  normalizeSpeakerName,
  slugFromFilename,
} from "../scripts/migrate.ts";
import { parseEpisode, splitFile } from "../src/content/parse.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("slugFromFilename maps both filename styles", () => {
  assert.equal(slugFromFilename("tmir-2024-03.md"), "2024-03");
  assert.equal(slugFromFilename("tmir-march-2023.md"), "2023-03");
  assert.equal(slugFromFilename("tmir-april-2023.md"), "2023-04");
  assert.equal(slugFromFilename("tmir-dec-2023.md"), "2023-12");
  assert.equal(slugFromFilename("tmir-nov-2023.md"), "2023-11");
  assert.equal(slugFromFilename("tmir-october-2023.md"), "2023-10");
  assert.equal(slugFromFilename("ali-spittel.md"), null);
});

test("2023 format: iframe stripped, outline synthesized from headings", () => {
  const { text, warnings } = convert(fixture("legacy-2023-march.md"));
  assert.ok(!text.includes("<iframe"));
  assert.ok(
    text.includes(
      "- [[00:02:10](#retire-spa-and-mpa)] Retire SPA and MPA?\n" +
        "- [[00:03:07](#create-react-app-no-longer-officially-recommended)] Create React App no longer officially recommended\n",
    ),
    text,
  );
  assert.ok(text.includes("\n# Transcript\n"));
  assert.ok(
    text.includes("**Carl Vitullo:** Thanks everyone for joining us for this month in React. [00:00:16]"),
  );
  assert.deepEqual(warnings, []);

  const ep = parseEpisode(text, "2023-03");
  assert.equal(ep.sections.length, 3); // Intro + 2
  assert.equal(ep.sections[0].title, "Intro");
  assert.equal(ep.outline.length, 2);
  assert.equal(ep.outline[0].anchor, ep.sections[1].anchor);
});

test("2024 format: link list dropped, leading timestamps moved to the end", () => {
  const { text } = convert(fixture("legacy-2024-03.md"));
  assert.ok(!text.includes("[Spotify]("));
  assert.ok(!text.includes("<iframe"));
  assert.ok(
    text.includes("- Quick Hits\n  - [[00:00:39](#layoffsfyi)] [Layoffs.fyi](https://layoffs.fyi/)\n"),
    text,
  );
  assert.ok(
    text.includes("**Carl Vitullo:** I'm going to start off with some layoffs news. [00:00:39]"),
  );
  assert.ok(text.includes("This month has about 7, 200 laid off so far. [00:00:58]"));

  const ep = parseEpisode(text, "2024-03");
  assert.equal(ep.sections.length, 3); // Intro, Layoffs, New releases
  assert.equal(ep.sections[0].title, "Intro");
  assert.equal(ep.sections[0].segments[0].speaker, "Carl Vitullo");
  assert.equal(ep.sections[1].title, "Layoffs (seems better!)");
  assert.equal(ep.sections[1].time, "00:00:39");
  assert.equal(ep.sections.at(-1)?.title, "New releases");
});

test("2025-01 format: style block dropped, outline anchors re-derived", () => {
  const { text } = convert(fixture("legacy-2025-01.md"));
  assert.ok(!text.includes("<style>"));
  assert.ok(!text.includes("<iframe"));
  assert.ok(
    text.includes(
      "- [[00:01:29](#job-market-fred-data-layoffsfyi)] Job market: [FRED data](https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE), [Layoffs.fyi](https://layoffs.fyi/)\n",
    ),
    text,
  );
  const ep = parseEpisode(text, "2025-01");
  assert.equal(ep.outline[0].anchor, "job-market-fred-data-layoffsfyi");
  assert.equal(ep.sections[1].anchor, "job-market-fred-data-layoffsfyi");
});

test("2025-06 format: heading timestamps moved to the outline, missing times warned", () => {
  const { text, warnings } = convert(fixture("legacy-2025-06.md"));
  assert.ok(text.includes("## job market\n"), text);
  assert.ok(!text.includes("## [00:52]"));
  assert.ok(text.includes("- Job market [FRED data]("));
  assert.ok(
    warnings.some((w) => w.includes("outline item without timestamp")),
    JSON.stringify(warnings),
  );
  assert.ok(
    warnings.some((w) => w.includes("dropped prose before outline")),
    JSON.stringify(warnings),
  );

  const ep = parseEpisode(text, "2025-06");
  assert.equal(ep.sections[1].title, "job market");
  assert.equal(ep.sections[1].time, "00:00:52");
  assert.equal(ep.sections[1].segments[0].speaker, "Carl Vitullo");
  assert.equal(ep.outline[0].time, undefined);
});

test("2026-05 format: already canonical apart from the embed and marker", () => {
  const { text, warnings } = convert(fixture("legacy-2026-05.md"));
  assert.ok(!text.includes("<style>"));
  assert.ok(!text.includes("<iframe"));
  assert.ok(!text.includes("# Interview"));
  assert.ok(text.includes("\n# Transcript\n"));
  assert.deepEqual(warnings, []);

  const ep = parseEpisode(text, "2026-05");
  assert.equal(ep.outline.length, 3);
  assert.equal(ep.outline[1].children.length, 1);
  assert.equal(ep.sections.length, 3);
  assert.equal(ep.sections[0].title, "Intro");
});

test("2025-09 format: unbolded speaker labels are bolded and normalized to full names", () => {
  const { text, warnings } = convert(fixture("legacy-2025-09.md"));
  assert.ok(!text.includes("<style>"));
  assert.ok(text.includes("**Carl Vitullo:** Alright. Hello everyone."));
  assert.ok(text.includes("**Mark Erikson:** Hi, I'm Mark."));
  assert.ok(text.includes("**Mo Javad:** And my name is Mo."));
  assert.deepEqual(warnings, []);

  const ep = parseEpisode(text, "2025-09");
  assert.equal(ep.sections[0].title, "Intro");
  assert.deepEqual(
    ep.sections[0].segments.map((s) => s.speaker),
    ["Carl Vitullo", "Mark Erikson", "Mo Javad", "Carl Vitullo"],
  );
  assert.equal(ep.sections[1].title, "New releases");
});

test("unbolded speaker recognition doesn't misfire on ordinary `Word:` prose", () => {
  const raw =
    "---\ntitle: t\ndate: 2025-01-01\ndescription: d\n---\n\n" +
    "Note: something important happened. [00:00]\n\n" +
    "**Carl Vitullo:** Real speaker line. [00:05]\n";
  const { text, warnings } = convert(raw);
  assert.ok(!text.includes("**Note:**"));
  assert.ok(
    warnings.some((w) => w.includes("Note: something important happened")),
  );
  assert.ok(text.includes("**Carl Vitullo:** Real speaker line."));
});

test("2023-10 format: headings synthesized from top-level outline items when the transcript has none", () => {
  const { text, warnings } = convert(fixture("legacy-2023-10.md"));
  assert.deepEqual(warnings, []);
  assert.ok(text.includes("\n## Introduction\n"), text);
  assert.ok(text.includes("\n## Second topic\n"), text);
  // Skipped: lands on the same paragraph as "Introduction".
  assert.ok(!text.includes("## Also zero"));
  // Skipped: no paragraph reaches this time.
  assert.ok(!text.includes("## Never happens"));
  // The outline itself is untouched (all four items still present).
  assert.equal((text.match(/^- \[\[/gm) ?? []).length, 4);

  const ep = parseEpisode(text, "2023-10");
  assert.equal(ep.sections.length, 2);
  assert.equal(ep.sections[0].title, "Introduction");
  assert.equal(ep.sections[0].segments.length, 2);
  assert.equal(ep.sections[1].title, "Second topic");
  assert.equal(ep.sections[1].segments.length, 2);
});

test("raw Descript ids are normalized to full names", () => {
  const raw =
    '---\ntitle: t\ndate: 2025-11-26\ndescription: d\n---\n\n2-vcarl: Hello! [00:00]\n\n1-acemarke: Hi, Mark here. [00:10]\n';
  const { text, warnings } = convert(raw);
  assert.ok(text.includes("**Carl Vitullo:** Hello!"));
  assert.ok(text.includes("**Mark Erikson:** Hi, Mark here."));
  assert.deepEqual(warnings, []);
});

test("converted output re-serializes to itself (idempotent)", () => {
  for (const name of [
    "legacy-2023-march.md",
    "legacy-2024-03.md",
    "legacy-2025-01.md",
    "legacy-2025-06.md",
    "legacy-2025-09.md",
    "legacy-2023-10.md",
    "legacy-2026-05.md",
  ]) {
    const once = convert(fixture(name)).text;
    assert.equal(convert(once).text, once, name);
  }
});

test("mergeExistingFrontMatter keeps ingest-owned fields and atUri", () => {
  const regenerated = [
    "---",
    'title: "TMiR 2026-05: regenerated"',
    "date: 2026-05-28",
    'description: "fresh"',
    "---",
    "",
    "- Outline",
    "",
    "# Transcript",
    "",
    "**Carl Vitullo:** hi [00:00:01]",
    "",
  ].join("\n");
  const existing = [
    "---",
    'title: "TMiR 2026-05: stale"',
    "date: 2026-05-28",
    'description: "stale"',
    "people:",
    "  - name: Mark Erikson",
    "    role: Host",
    "transistorId: dd8e79de",
    "audioUrl: https://media.transistor.fm/dd8e79de/x.mp3",
    "duration: 4198",
    "season: 3",
    "episode: 5",
    "bskyPostUrl: https://bsky.app/profile/did:plc:x/post/abc",
    "atUri: at://did:plc:x/site.standard.document/2026-05",
    "---",
    "",
    "old body",
    "",
  ].join("\n");

  const merged = mergeExistingFrontMatter(regenerated, existing);
  const { frontMatter, body } = splitFile(merged);
  // Hand-written fields come from the regenerated file...
  assert.equal(frontMatter.title, "TMiR 2026-05: regenerated");
  assert.equal(frontMatter.description, "fresh");
  assert.ok(body.includes("**Carl Vitullo:** hi [00:00:01]"));
  // ...ingest-owned fields and atUri from the existing one.
  assert.equal(frontMatter.audioUrl, "https://media.transistor.fm/dd8e79de/x.mp3");
  assert.equal(frontMatter.transistorId, "dd8e79de");
  assert.equal(frontMatter.duration, 4198);
  assert.equal(frontMatter.season, 3);
  assert.equal(frontMatter.episode, 5);
  assert.equal(frontMatter.bskyPostUrl, "https://bsky.app/profile/did:plc:x/post/abc");
  assert.equal(frontMatter.atUri, "at://did:plc:x/site.standard.document/2026-05");
  assert.deepEqual(frontMatter.people, [{ name: "Mark Erikson", role: "Host" }]);
});

test("normalizeSpeakerName canonicalizes bolded labels, guests keep theirs", () => {
  assert.equal(normalizeSpeakerName("Carl Vitullo (editing)"), "Carl Vitullo");
  assert.equal(normalizeSpeakerName("Carl (editing)"), "Carl Vitullo");
  assert.equal(normalizeSpeakerName("Carl"), "Carl Vitullo");
  assert.equal(normalizeSpeakerName("1-vcarl"), "Carl Vitullo");
  assert.equal(normalizeSpeakerName("Mark"), "Mark Erikson");
  assert.equal(normalizeSpeakerName("2-acemarke"), "Mark Erikson");
  assert.equal(normalizeSpeakerName("Mo"), "Mo Javad");
  assert.equal(normalizeSpeakerName("Mo", new Set(["mo khazali", "mo"])), "Mo");
  assert.equal(normalizeSpeakerName("Mo Khazali"), "Mo Khazali");
  assert.equal(normalizeSpeakerName("Sebastien Lorber"), "Sebastien Lorber");
});

test("convert normalizes bolded speaker labels in the transcript", () => {
  const raw = [
    "---",
    'title: "t"',
    "date: 2025-01-01",
    'description: "d"',
    "---",
    "",
    "- [00:00] Intro",
    "",
    "**Carl:** first [00:00:01]",
    "",
    "**Carl Vitullo (editing):** aside [00:00:05]",
    "",
    "**Mark:** second [00:00:09]",
    "",
    "**Sebastien Lorber:** guest [00:00:20]",
    "",
  ].join("\n");
  const { text } = convert(raw);
  assert.ok(text.includes("**Carl Vitullo:** first"), text);
  assert.ok(text.includes("**Carl Vitullo:** aside"), text);
  assert.ok(text.includes("**Mark Erikson:** second"), text);
  assert.ok(text.includes("**Sebastien Lorber:** guest"), text);
});

test("convert leaves bare Mo alone when Mo Khazali is the guest", () => {
  const file = (guest: string) =>
    [
      "---",
      'title: "t"',
      "date: 2025-01-01",
      'description: "d"',
      "---",
      "",
      "- [00:00] Intro",
      "",
      "**Carl:** hello [00:00:01]",
      "",
      `**${guest}:** hi [00:00:09]`,
      "",
      "**Mo:** and me [00:00:20]",
      "",
    ].join("\n");
  assert.ok(convert(file("Mo Khazali")).text.includes("**Mo:** and me"));
  assert.ok(convert(file("Mark")).text.includes("**Mo Javad:** and me"));
});
