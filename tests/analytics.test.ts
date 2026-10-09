import test from "node:test";
import assert from "node:assert/strict";
import {
  clickEvent,
  episodeSlug,
  isOutboundLink,
  track,
} from "../src/lib/analytics.ts";

const HOST = "thismonthinreact.com";

test("track without a PostHog key is a silent no-op", () => {
  // import.meta.env is undefined under `node --test`, so no key is configured:
  // nothing is imported, nothing is captured, nothing throws.
  assert.equal(track("newsletter_signup_submitted"), undefined);
  assert.equal(track("search_performed", { surface: "site" }), undefined);
});

test("isOutboundLink treats relative, same-host and non-http hrefs as internal", () => {
  assert.equal(isOutboundLink("/links", HOST), false);
  assert.equal(isOutboundLink("#comments", HOST), false);
  assert.equal(isOutboundLink("", HOST), false);
  assert.equal(
    isOutboundLink("https://thismonthinreact.com/about", HOST),
    false,
  );
  assert.equal(isOutboundLink("mailto:hello@reactiflux.com", HOST), false);
  assert.equal(isOutboundLink("javascript:void 0", HOST), false);
});

test("isOutboundLink treats any other host as outbound", () => {
  assert.equal(isOutboundLink("https://bsky.app/profile/x", HOST), true);
  assert.equal(isOutboundLink("http://example.com", HOST), true);
  assert.equal(isOutboundLink("//example.com/x", HOST), true);
  assert.equal(isOutboundLink("https://www.thismonthinreact.com/", HOST), true);
  assert.equal(
    isOutboundLink("https://thismonthinreact.com:8443/", HOST),
    true,
  );
});

test("episodeSlug names an episode page and nothing else", () => {
  assert.equal(episodeSlug("/episodes/2026-08"), "2026-08");
  assert.equal(episodeSlug("/episodes/2026-08/"), "2026-08");
  // The flat prerendered file and the two data routes are not episode pages.
  assert.equal(episodeSlug("/episodes/2026-08.html"), undefined);
  assert.equal(episodeSlug("/episodes/2026-08/chapters.json"), undefined);
  assert.equal(episodeSlug("/episodes/2026-08/transcript.srt"), undefined);
  assert.equal(episodeSlug("/links"), undefined);
  assert.equal(episodeSlug("/"), undefined);
});

test("clickEvent prefers a declared platform over the outbound host", () => {
  assert.deepEqual(
    clickEvent("https://open.spotify.com/show/x", "spotify", HOST),
    { event: "subscribe_link_clicked", props: { platform: "spotify" } },
  );
});

test("clickEvent reports an outbound host and ignores internal links", () => {
  assert.deepEqual(clickEvent("https://feeds.transistor.fm/x", null, HOST), {
    event: "outbound_link_clicked",
    props: { host: "feeds.transistor.fm" },
  });
  assert.deepEqual(
    clickEvent("https://media.transistor.fm/a.mp3", null, HOST),
    {
      event: "outbound_link_clicked",
      props: { host: "media.transistor.fm" },
    },
  );
  assert.equal(clickEvent("/about", null, HOST), null);
  assert.equal(clickEvent("#comments", null, HOST), null);
  assert.equal(clickEvent(null, null, HOST), null);
});

test("installListeners is exported for both client surfaces", async () => {
  const analytics = await import("../src/lib/analytics.ts");
  assert.equal(typeof analytics.installListeners, "function");
});

test("the podcast platforms are the three clickEvent reports", () => {
  for (const platform of ["apple", "spotify", "rss"]) {
    assert.deepEqual(clickEvent("https://example.com/show", platform, HOST), {
      event: "subscribe_link_clicked",
      props: { platform },
    });
  }
});

test("the newsletter form and the podcast links carry their attributes", async () => {
  const { readFile } = await import("node:fs/promises");
  const form = await readFile("src/components/NewsletterForm.tsx", "utf8");
  assert.match(form, /data-analytics-form="newsletter"/);
  const subscription = await readFile(
    "src/components/ShowSubscription.tsx",
    "utf8",
  );
  for (const platform of ["apple", "spotify", "rss"])
    assert.match(
      subscription,
      new RegExp(`data-analytics-platform="${platform}"`),
    );
});

test("searchResultCount reads Pagefind's rendered message", async () => {
  const { searchResultCount } = await import("../src/lib/analytics.ts");
  assert.equal(searchResultCount("12 episodes for “react compiler”"), 12);
  assert.equal(searchResultCount("1 episode for “waku”"), 1);
  assert.equal(
    searchResultCount(
      "No episodes found for “zzz”. Try fewer words or a different spelling.",
    ),
    0,
  );
  assert.equal(searchResultCount(""), 0);
});

test("both search surfaces report search_performed", async () => {
  const { readFile } = await import("node:fs/promises");
  const pagefind = await readFile("src/components/PagefindUI.tsx", "utf8");
  assert.match(pagefind, /surface: "site"/);
  assert.match(pagefind, /search_failed/);
  const links = await readFile("src/routes/links.tsx", "utf8");
  assert.match(links, /surface: "links"/);
});
