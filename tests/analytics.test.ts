import test from "node:test";
import assert from "node:assert/strict";
import {
  clickEvent,
  episodeSlug,
  installListeners,
  outboundHost,
  optedOut,
  pageProps,
  payload,
  searchResultCount,
  track,
} from "../src/lib/analytics.ts";

const HOST = "tmir.reactiflux.com";

test("track without a PostHog key sends nothing", () => {
  // import.meta.env is undefined under `node --test`, so no key is configured.
  let sent = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    sent++;
    return Promise.resolve(new Response());
  }) as typeof fetch;
  try {
    track("newsletter_signup_submitted");
    assert.equal(sent, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("pageProps keeps only the site's own params, on the URL and the referrer", () => {
  const props = pageProps(
    "https://tmir.reactiflux.com/links?q=secret&subject=css&gclid=ad&utm_source=bsky&utm_term=secret#x",
    "https://tmir.reactiflux.com/search?q=secret",
  );
  assert.deepEqual(props, {
    utm_source: "bsky",
    $current_url:
      "https://tmir.reactiflux.com/links?subject=css&utm_source=bsky",
    $host: "tmir.reactiflux.com",
    $pathname: "/links",
    $referrer: "https://tmir.reactiflux.com/search",
    $referring_domain: "tmir.reactiflux.com",
  });
  assert.doesNotMatch(JSON.stringify(props), /secret|gclid/);
});

test("optedOut honours Do Not Track and Global Privacy Control", () => {
  assert.equal(optedOut({ doNotTrack: "1" }), true);
  assert.equal(optedOut({ globalPrivacyControl: true }), true);
  assert.equal(optedOut({ doNotTrack: "0" }), false);
  assert.equal(optedOut({}), false);
});

test("payload is a capture API body that creates no person profile", () => {
  const page = {
    location: new URL("https://tmir.reactiflux.com/links?q=secret&page=2"),
    document: { referrer: "", title: "Links — TMiR" },
    screen: { width: 1440, height: 900 },
    innerWidth: 1200,
    innerHeight: 800,
  };
  const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.assign(globalThis, page);
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "test-agent", language: "en-US" },
    configurable: true,
  });
  try {
    const body = payload("phc_test", "$pageview", { episode: "2026-08" });
    assert.deepEqual(Object.keys(body).sort(), [
      "api_key",
      "distinct_id",
      "event",
      "properties",
      "timestamp",
    ]);
    assert.equal(body.api_key, "phc_test");
    assert.equal(body.event, "$pageview");
    const uuidv7 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    assert.match(body.distinct_id, uuidv7);
    assert.match(body.properties.$session_id, uuidv7);
    assert.equal(body.properties.$process_person_profile, false);
    assert.equal(
      body.properties.$current_url,
      "https://tmir.reactiflux.com/links?page=2",
    );
    assert.equal(body.properties.$raw_user_agent, "test-agent");
    assert.equal(
      (body.properties as Record<string, unknown>).episode,
      "2026-08",
    );
    assert.doesNotMatch(JSON.stringify(body), /secret/);
    // Ids last the page load: a second event shares them.
    assert.equal(payload("phc_test", "x").distinct_id, body.distinct_id);
  } finally {
    for (const name of Object.keys(page)) delete (globalThis as any)[name];
    if (saved) Object.defineProperty(globalThis, "navigator", saved);
  }
});

test("pageProps marks a missing referrer as direct", () => {
  const props = pageProps("https://tmir.reactiflux.com/", "");
  assert.equal(props.$referrer, "$direct");
  assert.equal(props.$referring_domain, "$direct");
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
