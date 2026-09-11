import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  outlineToText,
  buildDocumentRecord,
  rkeyOf,
} from "../scripts/publish-atproto.ts";
import { bskyUrlToParts } from "../src/content/atproto.ts";
import { parseEpisode } from "../src/content/parse.ts";

const raw = readFileSync(
  new URL("./fixtures/canonical-2026-05.md", import.meta.url),
  "utf8",
);
const episode = parseEpisode(raw, "2026-05");

test("outlineToText flattens the outline to indented 'Title — url' lines", () => {
  assert.equal(
    outlineToText(episode.outline),
    [
      "Some podcast meta",
      "New Releases",
      "  TS v7 beta — https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/",
      "  Rolldown 1.0 — https://voidzero.dev/posts/announcing-rolldown-1-0",
      "Outro",
    ].join("\n"),
  );
});

test("bskyUrlToParts splits a post URL and rejects anything else", () => {
  assert.deepEqual(
    bskyUrlToParts(
      "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
    ),
    { actor: "thismonthinreact.com", rkey: "3lqz7abcd2k2x" },
  );
  assert.deepEqual(
    bskyUrlToParts(
      "https://bsky.app/profile/did:plc:abc123/post/3lqz7abcd2k2x",
    ),
    { actor: "did:plc:abc123", rkey: "3lqz7abcd2k2x" },
  );
  assert.equal(
    bskyUrlToParts("https://bsky.app/profile/thismonthinreact.com"),
    null,
  );
  assert.equal(bskyUrlToParts("https://example.com/whatever"), null);
});

test("buildDocumentRecord matches the site.standard.document lexicon", () => {
  const record = buildDocumentRecord(episode, {
    siteUri: "at://did:plc:show/site.standard.publication/self",
    bskyPostRef: {
      uri: "at://did:plc:show/app.bsky.feed.post/3lqz7abcd2k2x",
      cid: "bafyreiexamplecid",
    },
  });

  assert.equal(record.$type, "site.standard.document");
  assert.equal(record.site, "at://did:plc:show/site.standard.publication/self");
  assert.equal(record.title, episode.title);
  assert.equal(record.publishedAt, "2026-05-28T00:00:00.000Z");
  assert.equal(record.path, "/episodes/2026-05");
  assert.equal(record.description, episode.description);
  assert.ok(String(record.textContent).startsWith("Some podcast meta\n"));
  assert.deepEqual(record.tags, ["devblogs.microsoft.com", "voidzero.dev"]);
  // contributors[].did is required by the lexicon and we have no DIDs, so
  // contributors is omitted entirely rather than sent without did.
  assert.equal("contributors" in record, false);
  assert.deepEqual(record.bskyPostRef, {
    uri: "at://did:plc:show/app.bsky.feed.post/3lqz7abcd2k2x",
    cid: "bafyreiexamplecid",
  });
  // `content` is deliberately omitted; textContent carries the outline.
  assert.equal("content" in record, false);
});

test("buildDocumentRecord omits bskyPostRef when there is no announcement post", () => {
  const record = buildDocumentRecord(episode, {
    siteUri: "at://did:plc:show/site.standard.publication/self",
  });
  assert.equal("bskyPostRef" in record, false);
});

test("rkeyOf takes the last segment of an AT URI", () => {
  assert.equal(
    rkeyOf("at://did:plc:abc123/site.standard.document/3lqz7abcd2k2x"),
    "3lqz7abcd2k2x",
  );
});
