import test from "node:test";
import assert from "node:assert/strict";
import { bskyPostToAtUri } from "../src/content/atproto.ts";

const DID = "did:plc:showaccount";

test("builds an at:// URI from a handle URL plus the configured DID", () => {
  assert.equal(
    bskyPostToAtUri(
      "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
      DID,
    ),
    "at://did:plc:showaccount/app.bsky.feed.post/3lqz7abcd2k2x",
  );
});

test("uses the DID already in the URL and ignores the configured one", () => {
  assert.equal(
    bskyPostToAtUri(
      "https://bsky.app/profile/did:plc:other/post/3lqz7abcd2k2x",
      DID,
    ),
    "at://did:plc:other/app.bsky.feed.post/3lqz7abcd2k2x",
  );
});

test("returns undefined without a DID, or for a non-post URL", () => {
  assert.equal(
    bskyPostToAtUri(
      "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
      undefined,
    ),
    undefined,
  );
  assert.equal(
    bskyPostToAtUri("https://bsky.app/profile/thismonthinreact.com", DID),
    undefined,
  );
  assert.equal(bskyPostToAtUri("https://example.com/whatever", DID), undefined);
});
