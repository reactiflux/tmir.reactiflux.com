import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSpeaker,
  descriptToCanonical,
  replaceTranscript,
  addOutlineHeadings,
  fetchDescriptTranscript,
} from "../scripts/publish-transcript.ts";
import { parseEpisode } from "../src/content/parse.ts";

test("normalizeSpeaker maps Descript ids and passes anything else through", () => {
  assert.equal(normalizeSpeaker("1-vcarl"), "Carl Vitullo");
  assert.equal(normalizeSpeaker("vcarl"), "Carl Vitullo");
  assert.equal(normalizeSpeaker("2-acemarke"), "Mark Erikson");
  assert.equal(normalizeSpeaker("acemarke"), "Mark Erikson");
  assert.equal(normalizeSpeaker("Mo Khazali"), "Mo Khazali");
  assert.equal(normalizeSpeaker("3-guest"), "3-guest");
});

test("descriptToCanonical moves timestamps to the end and maps speakers", () => {
  const input = [
    "[00:00] **1-vcarl:** Hi, Carl here. Just a quick note.",
    "",
    "[00:11] Hello everyone. Thank you for joining us.",
    "",
    "[01:02:03] **2-acemarke:** And I'm Mark.",
    "",
  ].join("\n");

  assert.equal(
    descriptToCanonical(input),
    [
      "**Carl Vitullo:** Hi, Carl here. Just a quick note. [00:00:00]",
      "",
      "Hello everyone. Thank you for joining us. [00:00:11]",
      "",
      "**Mark Erikson:** And I'm Mark. [01:02:03]",
    ].join("\n"),
  );
});

test("replaceTranscript keeps front matter and outline, replaces the body below the marker", () => {
  const file = [
    "---",
    'title: "TMiR 2026-05: test"',
    "date: 2026-05-28",
    'description: "d"',
    "transistorId: dd8e79de",
    "---",
    "",
    "- [[00:00:55](#some-podcast-meta)] Some podcast meta",
    "",
    "# Transcript",
    "",
    "**Old Speaker:** stale text [00:00:01]",
    "",
  ].join("\n");

  const out = replaceTranscript(
    file,
    "## Some podcast meta\n\n**Carl Vitullo:** Fresh text. [00:00:55]",
  );

  assert.ok(!out.includes("stale text"));
  assert.ok(
    out.includes("- [[00:00:55](#some-podcast-meta)] Some podcast meta"),
  );
  assert.ok(out.includes("transistorId: dd8e79de"));

  const ep = parseEpisode(out, "2026-05");
  assert.equal(ep.sections.length, 1);
  assert.equal(ep.sections[0].anchor, "some-podcast-meta");
  assert.equal(ep.sections[0].segments[0].speaker, "Carl Vitullo");
  assert.equal(ep.sections[0].segments[0].text, "Fresh text.");
});

test("addOutlineHeadings gives a Descript body sections from the file's outline", () => {
  const file = [
    "---",
    'title: "TMiR 2026-05: test"',
    "date: 2026-05-28",
    'description: "d"',
    "---",
    "",
    "- [[00:00:00](#intro)] Intro",
    "- [[00:05:00](#main-content)] Main Content",
    "  - [[00:05:30](#a-sub-point)] A sub point",
    "- [[09:00:00](#never-reached)] Never reached",
    "",
    "# Transcript",
    "",
    "**Old Speaker:** stale [00:00:01]",
    "",
  ].join("\n");

  const descript = [
    "[00:00] **1-vcarl:** Hello everyone.",
    "",
    "[02:00] **2-acemarke:** I'm Mark.",
    "",
    "[06:00] **1-vcarl:** On to the main content.",
    "",
  ].join("\n");

  const body = addOutlineHeadings(file, descriptToCanonical(descript));
  assert.equal(
    body,
    [
      "## Intro",
      "",
      "**Carl Vitullo:** Hello everyone. [00:00:00]",
      "",
      "**Mark Erikson:** I'm Mark. [00:02:00]",
      "",
      "## Main Content",
      "",
      "**Carl Vitullo:** On to the main content. [00:06:00]",
    ].join("\n"),
  );

  const ep = parseEpisode(replaceTranscript(file, body), "2026-05");
  assert.deepEqual(
    ep.sections.map((s) => s.anchor),
    ["intro", "main-content"],
  );
});

test("addOutlineHeadings prefers the chapter titles over the outline's prose", () => {
  const file = [
    "---",
    'title: "TMiR 2026-08: test"',
    "date: 2026-08-28",
    'description: "d"',
    "chapters:",
    '  - time: "00:00:00"',
    "    title: Intro",
    '  - time: "00:05:00"',
    "    title: Lightning round",
    "---",
    "",
    "- [[00:00:00](#intro)] Intro",
    "- [[00:05:00](#lightning-round)] Short asides/lightning rounds",
    "  - [[00:05:00](#lightning-round)] A sub point with no chapter",
    "",
    "# Transcript",
    "",
    "**Old Speaker:** stale [00:00:01]",
    "",
  ].join("\n");
  const body = addOutlineHeadings(
    file,
    [
      "**Carl Vitullo:** Hello everyone. [00:00:00]",
      "",
      "**Mark Erikson:** Quick ones now. [00:06:00]",
    ].join("\n\n"),
  );
  // "Lightning round" is the chapter; "Short asides/lightning rounds" is what
  // the author wrote. The heading — and so the anchor — is the chapter's.
  assert.match(body, /^## Intro\n/);
  assert.match(body, /\n## Lightning round\n/);

  const ep = parseEpisode(replaceTranscript(file, body), "2026-08");
  assert.deepEqual(
    ep.sections.map((s) => s.anchor),
    ["intro", "lightning-round"],
  );
  // Every outline item, nested one included, resolves to a real section.
  const anchors = new Set(ep.sections.map((s) => s.anchor));
  const flat = ep.outline.flatMap((i) => [i, ...i.children]);
  assert.deepEqual(
    flat.filter((i) => !anchors.has(i.anchor)),
    [],
  );
  assert.equal(flat[2].anchor, "lightning-round");
});

test("without chapters, headings still come from the whole outline tree", () => {
  const file = [
    "---",
    'title: "TMiR 2026-05: test"',
    "date: 2026-05-28",
    'description: "d"',
    "---",
    "",
    "- [[00:00:00](#intro)] Intro",
    "  - [[00:05:00](#a-nested-topic)] A nested topic",
    "",
    "# Transcript",
    "",
    "**Old Speaker:** stale [00:00:01]",
    "",
  ].join("\n");
  const body = addOutlineHeadings(
    file,
    [
      "**Carl Vitullo:** Hello everyone. [00:00:00]",
      "",
      "**Mark Erikson:** The nested bit. [00:06:00]",
    ].join("\n\n"),
  );
  const ep = parseEpisode(replaceTranscript(file, body), "2026-05");
  assert.deepEqual(
    ep.sections.map((s) => s.anchor),
    ["intro", "a-nested-topic"],
  );
});

test("fetchDescriptTranscript refuses a degenerate 200 body", async () => {
  const real = globalThis.fetch;
  const stub = (body: string) => {
    globalThis.fetch = (async () =>
      new Response(body, { status: 200 })) as typeof fetch;
  };
  try {
    stub("");
    await assert.rejects(
      fetchDescriptTranscript("p", "t"),
      /refusing to overwrite/,
    );
    stub("   \n\n  ");
    await assert.rejects(
      fetchDescriptTranscript("p", "t"),
      /refusing to overwrite/,
    );

    const real200 = `[00:00] **1-vcarl:** ${"Hello everyone. ".repeat(60)}`;
    stub(real200);
    assert.equal(await fetchDescriptTranscript("p", "t"), real200);
  } finally {
    globalThis.fetch = real;
  }
});

test("descriptToCanonical drops a block that is only a timecode", () => {
  const out = descriptToCanonical(
    "[00:01] **1-vcarl:** real text\n\n[00:43:15]\n\n[00:44] **2-mark:** more",
  );
  assert.equal(out.includes(" [00:43:15]"), false);
  assert.equal(out.split("\n\n").length, 2);
});

test("replaceTranscript leaves a blank line under the heading", () => {
  const out = replaceTranscript(
    "---\ntitle: t\n---\n\n- item\n\n# Transcript\n\nold\n",
    "**Carl:** new [00:00:01]",
  );
  assert.ok(out.includes("# Transcript\n\n**Carl:**"));
});
