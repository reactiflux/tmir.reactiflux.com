import test from "node:test";
import assert from "node:assert/strict";
import {
  clickEvent,
  episodeSlug,
  INIT_OPTIONS,
  installListeners,
  outboundHost,
  searchResultCount,
  scrubUrls,
} from "../src/lib/analytics.ts";

const HOST = "tmir.reactiflux.com";

test("INIT_OPTIONS keeps persistence cookieless and remote config off", () => {
  assert.equal(INIT_OPTIONS.persistence, "memory");
  assert.equal(INIT_OPTIONS.respect_dnt, true);
  assert.equal(INIT_OPTIONS.before_send, scrubUrls);
  assert.ok(INIT_OPTIONS.custom_personal_data_properties.includes("q"));
  // With flags off posthog-js skips remote config entirely, so the project's
  // settings cannot switch on replay, heatmaps or surveys.
  assert.equal(INIT_OPTIONS.advanced_disable_flags, true);
});

test("scrubUrls keeps only the site's own params on every URL, referrer included", () => {
  const cr = {
    uuid: "x",
    event: "$pageview",
    properties: {
      $current_url:
        "https://tmir.reactiflux.com/links?q=secret&subject=css&gclid=ad&utm_source=bsky&utm_term=secret",
      $referrer: "https://tmir.reactiflux.com/search?q=secret",
      $referring_domain: "tmir.reactiflux.com",
      ph_keyword: "secret",
      $session_entry_ph_keyword: "secret",
      utm_term: "secret",
      $session_entry_utm_term: "secret",
      li_fat_id: "secret",
      $initial_li_fat_id: "secret",
      gclid: "<masked>",
      query_length: 6,
    },
    $set_once: {
      $initial_referrer: "https://tmir.reactiflux.com/search?q=secret",
    },
  };
  // Heatmaps and web vitals nest URLs, as values and as keys.
  Object.assign(cr.properties, {
    $heatmap_data: {
      "https://tmir.reactiflux.com/search?q=secret": [
        { url: "https://tmir.reactiflux.com/search?q=secret" },
      ],
    },
  });
  scrubUrls(cr);
  assert.equal(
    cr.properties.$current_url,
    "https://tmir.reactiflux.com/links?subject=css&utm_source=bsky",
  );
  assert.equal(cr.properties.$referrer, "https://tmir.reactiflux.com/search");
  assert.equal(cr.properties.$referring_domain, "tmir.reactiflux.com");
  assert.equal(cr.properties.query_length, 6);
  assert.equal(
    cr.$set_once.$initial_referrer,
    "https://tmir.reactiflux.com/search",
  );
  assert.doesNotMatch(JSON.stringify(cr), /secret|gclid|masked/);
  assert.equal(scrubUrls(null), null);
});

test("outboundHost treats relative, same-host and non-http hrefs as internal", () => {
  assert.equal(outboundHost("/links", HOST), null);
  assert.equal(outboundHost("#comments", HOST), null);
  assert.equal(outboundHost("", HOST), null);
  assert.equal(outboundHost("https://tmir.reactiflux.com/about", HOST), null);
  assert.equal(outboundHost("mailto:hello@reactiflux.com", HOST), null);
  assert.equal(outboundHost("javascript:void 0", HOST), null);
});

test("outboundHost treats any other host as outbound", () => {
  assert.equal(outboundHost("https://bsky.app/profile/x", HOST), "bsky.app");
  assert.equal(outboundHost("http://example.com", HOST), "example.com");
  assert.equal(outboundHost("//example.com/x", HOST), "example.com");
  assert.equal(
    outboundHost("https://www.tmir.reactiflux.com/", HOST),
    "www.tmir.reactiflux.com",
  );
  assert.equal(
    outboundHost("https://tmir.reactiflux.com:8443/", HOST),
    "tmir.reactiflux.com:8443",
  );
});

test("episodeSlug names an episode page and nothing else", () => {
  assert.equal(episodeSlug("/episodes/2026-08"), "2026-08");
  assert.equal(episodeSlug("/episodes/2026-08/"), "2026-08");
  // The flat prerendered file is the same page; the data routes are not.
  assert.equal(episodeSlug("/episodes/2026-08.html"), "2026-08");
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

test("searchResultCount reads Pagefind's rendered message", () => {
  assert.equal(searchResultCount("12 episodes for “react compiler”"), 12);
  assert.equal(searchResultCount("1 episode for “waku”"), 1);
  assert.equal(searchResultCount("1,234 episodes for “react”"), 1234);
  assert.equal(
    searchResultCount(
      "No episodes found for “zzz”. Try fewer words or a different spelling.",
    ),
    0,
  );
  // Pagefind's interim message is not a finished search.
  assert.equal(searchResultCount("Searching for “waku”..."), null);
  assert.equal(searchResultCount(""), null);
});

test("installListeners reports clicks and drains window.tmirAnalytics, once", () => {
  const listeners = new Map<string, (event: unknown) => void>();
  let added = 0;
  const doc = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      added++;
      listeners.set(type, fn);
    },
  };
  const reported: unknown[][] = [];
  const report = (...args: unknown[]) => void reported.push(args);
  const queue: [string][] = [["early_event"]];
  Object.assign(globalThis, {
    document: doc,
    window: { tmirAnalytics: queue },
    location: { host: HOST },
  });
  const anchor = (href: string) => ({
    closest: () => ({
      getAttribute: (name: string) => (name === "href" ? href : null),
    }),
  });
  try {
    installListeners(report);
    assert.deepEqual(
      reported,
      [["early_event"]],
      "the queued entry was reported",
    );
    assert.equal(queue.length, 0);
    queue.push(["late_event"]);
    assert.deepEqual(
      reported.at(-1),
      ["late_event"],
      "a later push is reported",
    );
    assert.equal(queue.length, 0, "and not kept");

    reported.length = 0;
    listeners.get("click")!({ target: anchor("https://bsky.app/x") });
    listeners.get("auxclick")!({
      button: 1,
      target: anchor("https://bsky.app/y"),
    });
    listeners.get("auxclick")!({
      button: 2,
      target: anchor("https://bsky.app/z"),
    });
    assert.deepEqual(
      reported,
      [
        ["outbound_link_clicked", { host: "bsky.app" }],
        ["outbound_link_clicked", { host: "bsky.app" }],
      ],
      "click and middle-click report; a right-click does not",
    );

    reported.length = 0;
    const form = (selector: string) =>
      selector === 'form[data-analytics-form="newsletter"]' ? {} : null;
    listeners.get("submit")!({ target: { closest: form } });
    listeners.get("submit")!({ target: { closest: () => null } });
    assert.deepEqual(
      reported,
      [["newsletter_signup_submitted"]],
      "only the newsletter form reports a submit",
    );

    const count = added;
    installListeners(report);
    assert.equal(added, count, "a second call registers nothing");
  } finally {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
    delete (globalThis as any).location;
  }
});
