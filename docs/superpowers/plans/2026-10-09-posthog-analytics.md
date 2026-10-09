# PostHog Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture seven of the nine events in the spec's table from thismonthinreact.com (the two download events have no source in the codebase; see Deviations), cookielessly, so search, comments, newsletter signup and downloads can be seen working and the popular episodes and podcast apps can be named.

**Architecture:** One module, `src/lib/analytics.ts`, is the only importer of `posthog-js`; everything else calls `track()`. The site has two client surfaces and both have to report: the **router pages** (`/`, `/search`, `/links`, `/specimen`) hydrate, so `src/routes/__root.tsx` initialises analytics in an effect and reports a pageview per `onResolved`; the **static documents** (`/about`, `/episodes/<slug>`) render with `renderToStaticMarkup` outside the router and never hydrate, so they load a prebuilt `public/analytics.js` — the same module, bundled by the existing `generated-public-files` plugin that already produces `public/justify.js`. Interactions that exist on both surfaces are delegated document listeners inside `installListeners()` rather than React handlers, so one implementation covers both.

**Tech Stack:** React 19.3, TanStack Start 1.168 / Router 1.170, Vite 8.3, `posthog-js` (new), Pagefind. Tests: `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-09-posthog-analytics-design.md`

---

## Global Constraints

These apply to every task. Do not restate them; do not violate them.

- **React 19 / TanStack Start.** Hooks only in components that actually hydrate; the static-document routes (`/about`, `/episodes/$slug`) render through `renderToStaticMarkup` and must receive no new React hooks or event handlers.
- **`posthog-js` is the only new dependency.** Install it with `npm install --save-exact posthog-js` — this repo pins exact versions. No analytics wrapper library, no `dotenv`, no DOM-testing library.
- **No `identify()`, no user properties, no `distinct_id` manipulation.** Nothing that names a person.
- **No cookies.** `persistence: "memory"` is non-negotiable; it is what removes the need for a consent banner.
- **Config is `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`**, both optional. No key means analytics is a complete no-op (dev, deploy previews, forks). `.env.example` is the authoritative list and must stay in step.
- **Every file edit triggers the `.claude/settings.json` PostToolUse hooks** — `prettier --write` then `react-doctor --blocking warning` on the written file. A react-doctor warning fails the edit, so code must pass react-doctor as written. Do not disable a rule without an inline `react-doctor-disable-next-line <rule> -- <reason>` comment that states the reason, matching the existing uses in `src/routes/about.tsx` and `src/components/EpisodeBody.tsx`.
- **Tests run with `node --test "tests/**/*.test.ts"`** (`npm run test`), from the repo root, so a test may read a source file by its repo-relative path. Node strips the types and runs the `.ts` directly; tests import source with a relative specifier and an explicit extension (`../src/lib/analytics.ts`), matching `tests/search-url.test.ts`. Two verified limits: **`import.meta.env` is `undefined` under `node --test`**, so every read of it in code reachable from a test must be `import.meta.env?.VITE_…`; and **a `.tsx` module cannot be imported** (`Unknown file extension ".tsx"` — Node strips types, not JSX), so anything that needs to assert on a component file reads it as text.
- **Never `git add -A` or `git add -u`.** Every commit names its files explicitly.
- **Every commit message ends with these two lines**, preceded by a blank line:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
  ```
- **Do not deploy and do not push.** Stop at `npm run check`.

---

## Deviations from the spec, already decided

The spec assumed every page goes through `src/routes/__root.tsx`. Three of its statements do not survive contact with the codebase; these resolutions are part of the plan, not open questions.

1. **`/about` and `/episodes/<slug>` are static documents.** They have `server.handlers.GET` returning `renderToStaticMarkup` output and their own `<Document>`; `__root.tsx` never renders for them and no React hydrates. Episode pages are the site's main traffic, so a root-layout-only install would miss almost everything. Hence Task 5: `src/client/analytics-page.ts` bundled to `public/analytics.js`, loaded with `<script defer src="/analytics.js">`, exactly as `public/justify.js` already is.
2. **`transcript_downloaded` and `chapters_downloaded` have no source.** `/episodes/$slug/transcript.srt` and `/episodes/$slug/chapters.json` exist only as `podcast:transcript` / `podcast:chapters` targets in `src/content/feed.ts`; no page links to either. The only download affordance on an episode page is `.audio-download` in `src/components/EpisodeHeader.tsx`, pointing at the Transistor-hosted audio. Both events are dropped; the audio link reports as `outbound_link_clicked` with `host: media.transistor.fm` through the delegated listener, which answers the same question with no extra code.
3. **`newsletter_signup_submitted` and `subscribe_link_clicked` are delegated, not React handlers.** `NewsletterForm`'s `onSubmit` only exists on `/`; on `/about` the same form is static markup that POSTs to Buttondown. `PodcastLinks` is plain markup in a static document. So both are reported by `installListeners()` from `data-analytics-form` / `data-analytics-platform` attributes, which works identically on both surfaces. Known ceiling: a `/about` newsletter submit navigates away cross-document, so that capture may be dropped in flight; `/` is unaffected because its handler calls `preventDefault()`.

`search_performed` on `/links` is reported from an effect keyed on the settled query and total, not from `onSubmit`. The search box navigates on a 250 ms debounce as the visitor types and the `Filter` button is rarely used, so an `onSubmit`-only event would record almost no searches.

---

## File Structure

| File                                  | Responsibility                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `src/lib/analytics.ts`                | the only importer of `posthog-js`; init, `track`, pageviews, pure classifiers  |
| `tests/analytics.test.ts`             | `track` no-op without a key, outbound classifier, episode slug, Pagefind count |
| `src/client/analytics-page.ts`        | entry for the static documents, bundled to `public/analytics.js`               |
| `src/routes/__root.tsx`               | router-page install: init, `onResolved` pageviews, delegated listeners         |
| `src/components/NewsletterForm.tsx`   | `data-analytics-form="newsletter"` on the form                                 |
| `src/components/ShowSubscription.tsx` | `data-analytics-platform` on the three podcast links                           |
| `src/components/PagefindUI.tsx`       | `search_performed` and `search_failed` for the `site` surface                  |
| `src/routes/links.tsx`                | `search_performed` for the `links` surface                                     |
| `src/components/EpisodeBody.tsx`      | `comments_load_failed` pushed onto the `window.tmirAnalytics` queue            |
| `src/routes/episodes.$slug.tsx`       | `data-episode` on `#comments`, `<script defer src="/analytics.js">`            |
| `src/routes/about.tsx`                | `<script defer src="/analytics.js">`                                           |
| `vite.config.ts`                      | second `public/` bundle entry for the analytics page script                    |
| `.env.example`                        | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`                                        |
| `.gitignore`                          | `public/analytics.js`                                                          |

---

## Task 1: The analytics module and its tests

**Files:**

- Create: `src/lib/analytics.ts`, `tests/analytics.test.ts`
- Modify: `package.json` (via `npm install`), `package-lock.json` (via `npm install`), `.env.example` (append a `# --- analytics ---` block at the end)
- Test: `tests/analytics.test.ts`

**Interfaces:**

- Consumes: `posthog-js` (dynamically, inside the module), `import.meta.env.VITE_POSTHOG_KEY`, `import.meta.env.VITE_POSTHOG_HOST`.
- Produces, from `src/lib/analytics.ts`:

  ```ts
  function initAnalytics(): Promise<void>;
  function track(event: string, props?: Record<string, unknown>): void;
  function trackPageview(path: string): void;
  function episodeSlug(path: string): string | undefined;
  function isOutboundLink(href: string, currentHost: string): boolean;
  function clickEvent(
    href: string | null | undefined,
    platform: string | null | undefined,
    currentHost: string,
  ): { event: string; props: Record<string, unknown> } | null;
  function searchResultCount(message: string): number;
  ```

  `initAnalytics` is idempotent and never rejects. `track` chains onto the same promise, so a call made before init completes still lands, and a call with no key configured does nothing at all.

- [ ] **Step 1: Install the dependency**

```bash
npm install --save-exact posthog-js
```

- [ ] **Step 2: Write the failing test**

Create `tests/analytics.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it and watch it fail**

```bash
node --test "tests/analytics.test.ts"
```

Expected failure: `Cannot find module '…/src/lib/analytics.ts'` — the module does not exist yet, so every test in the file errors.

- [ ] **Step 4: Implement the module**

Create `src/lib/analytics.ts`:

```ts
/**
 * The only module that imports posthog-js. Cookieless and identity-free: the
 * persistence is in-memory and nothing calls identify(), which is what removes
 * the need for a consent banner. Every entry point swallows its own errors —
 * analytics must never break the site.
 *
 * posthog-js is reached through a dynamic import() so the prerender pass never
 * evaluates it and a blocked or failed CDN fetch never blocks render.
 */

type AnalyticsEntry = [event: string, props?: Record<string, unknown>];

declare global {
  interface Window {
    /**
     * The static documents (/about, /episodes/<slug>) have no module graph in
     * their inline scripts, so those report through this queue.
     * installListeners() drains it and replaces its push.
     */
    tmirAnalytics?: AnalyticsEntry[];
  }
}

let ph: typeof import("posthog-js").default | null = null;
let ready: Promise<void> | null = null;

async function load(): Promise<void> {
  // import.meta.env is undefined under `node --test`, hence the optional chain.
  const key = import.meta.env?.VITE_POSTHOG_KEY;
  if (!key) return;
  const host = import.meta.env?.VITE_POSTHOG_HOST;
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      ...(host ? { api_host: host } : {}),
      persistence: "memory",
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
    });
    ph = posthog;
  } catch {
    // A blocked script or a failed init is not worth reporting to anyone.
  }
}

/** Idempotent, safe from every entry point, and never rejects. */
export function initAnalytics(): Promise<void> {
  return (ready ??= load());
}

/**
 * Captures an event, or does nothing when no key is configured. Chaining onto
 * the init promise means a call made while posthog-js is still loading is not
 * lost, and the order of calls is preserved.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  void initAnalytics().then(() => {
    try {
      ph?.capture(event, props);
    } catch {
      // Analytics must never break the site.
    }
  });
}

/**
 * The episode a path identifies, or undefined. `[^/.]+` with an end anchor
 * excludes the flat prerendered `/episodes/<slug>.html` files as well as the
 * `/episodes/<slug>/chapters.json` and `/episodes/<slug>/transcript.srt` data
 * routes, none of which are an episode page view.
 */
export function episodeSlug(path: string): string | undefined {
  return /^\/episodes\/([^/.]+)\/?$/.exec(path)?.[1];
}

export function trackPageview(path: string): void {
  const slug = episodeSlug(path);
  track("$pageview", {
    $current_url: location.href,
    ...(slug ? { episode: slug } : {}),
  });
}

/**
 * Whether an href leaves the site. Relative paths, fragments, `mailto:` and
 * anything else that is not http(s) are internal; a different host — including
 * a different subdomain or port — is outbound.
 */
export function isOutboundLink(href: string, currentHost: string): boolean {
  try {
    const url = new URL(href, `https://${currentHost}`);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.host !== currentHost
    );
  } catch {
    return false;
  }
}

/**
 * What a click on an anchor should report, decided from strings alone so it is
 * testable without a DOM. `platform` is the anchor's data-analytics-platform;
 * a link that declares one is a podcast subscription, not just an outbound
 * link, so it wins.
 */
export function clickEvent(
  href: string | null | undefined,
  platform: string | null | undefined,
  currentHost: string,
): { event: string; props: Record<string, unknown> } | null {
  if (platform) return { event: "subscribe_link_clicked", props: { platform } };
  if (!href || !isOutboundLink(href, currentHost)) return null;
  return {
    event: "outbound_link_clicked",
    props: { host: new URL(href, `https://${currentHost}`).host },
  };
}

/**
 * Pagefind's result count, read back from the message it renders — the only
 * readout of a finished search, since Pagefind owns that DOM. The translations
 * in PagefindUI.tsx make it "<n> episodes for …", or "No episodes found for …"
 * when there are none.
 */
export function searchResultCount(message: string): number {
  const count = Number.parseInt(message, 10);
  return Number.isNaN(count) ? 0 : count;
}
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
node --test "tests/analytics.test.ts"
```

Expected: `pass 6`, `fail 0`.

- [ ] **Step 6: Document the environment variables**

Append to the end of `.env.example`:

```
# --- analytics ---
# PostHog project API key (the public, write-only one). When unset, analytics
# is a complete no-op — no script loaded, no events — which is what dev,
# deploy previews and forks get.
VITE_POSTHOG_KEY=
# PostHog ingestion host for the project's region
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/analytics.ts tests/analytics.test.ts .env.example package.json package-lock.json
git commit -m "$(cat <<'EOF'
Add the analytics module, cookieless and no-op without a key

posthog-js arrives through a dynamic import inside initAnalytics, so the
prerender pass never evaluates it. The outbound-link and episode-path
classifiers are pure and tested; everything else is a no-op without a key.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
EOF
)"
```

---

## Task 2: Install analytics on the router pages

**Files:**

- Modify: `src/lib/analytics.ts` (add `installListeners`, after `clickEvent`)
- Modify: `src/routes/__root.tsx` (the whole file, 16 lines)
- Test: `tests/analytics.test.ts` (extend)

**Interfaces:**

- Consumes: `initAnalytics`, `track`, `trackPageview`, `clickEvent` from `src/lib/analytics.ts`; `useRouter` from `@tanstack/react-router`; `router.subscribe("onResolved", (event) => void)` returning an unsubscribe function, with `event.toLocation.pathname: string`.
- Produces, from `src/lib/analytics.ts`:

  ```ts
  function installListeners(): () => void;
  ```

  One delegated `click` listener on `document` (`outbound_link_clicked`, `subscribe_link_clicked`) and one delegated `submit` listener (`newsletter_signup_submitted`). Returns a function that removes both. Called by `__root.tsx` for the router pages and by `src/client/analytics-page.ts` for the static documents.

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics.test.ts`:

```ts
test("installListeners is exported for both client surfaces", async () => {
  const analytics = await import("../src/lib/analytics.ts");
  assert.equal(typeof analytics.installListeners, "function");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test "tests/analytics.test.ts"
```

Expected failure: `installListeners is exported for both client surfaces` fails with `Expected values to be strictly equal: 'undefined' !== 'function'`.

- [ ] **Step 3: Implement `installListeners`**

In `src/lib/analytics.ts`, insert this immediately after the `clickEvent` function and before `searchResultCount`:

```ts
/**
 * Delegated listeners for the interactions that have to work on both client
 * surfaces: the hydrated router pages and the static documents (/about,
 * /episodes/<slug>), which render outside the router with no React on the
 * client at all. Delegation means one implementation covers both, and the
 * static pages need no event handlers in their markup.
 *
 * Returns a cleanup function.
 */
export function installListeners(): () => void {
  function onClick(event: MouseEvent) {
    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor) return;
    const found = clickEvent(
      anchor.getAttribute("href"),
      anchor.getAttribute("data-analytics-platform"),
      location.host,
    );
    if (found) track(found.event, found.props);
  }
  function onSubmit(event: SubmitEvent) {
    const target = event.target as Element | null;
    if (target?.closest?.('form[data-analytics-form="newsletter"]'))
      track("newsletter_signup_submitted");
  }
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  return () => {
    document.removeEventListener("click", onClick);
    document.removeEventListener("submit", onSubmit);
  };
}
```

- [ ] **Step 4: Install it in the root layout**

Replace the whole of `src/routes/__root.tsx` with:

```tsx
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Document } from "../components/Document";
import { SITE_NAME } from "../content/site.ts";
import {
  initAnalytics,
  installListeners,
  trackPageview,
} from "../lib/analytics.ts";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: SITE_NAME }] }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Router pages only. /about and /episodes/<slug> render through
  // renderToStaticMarkup outside the router and never hydrate, so this effect
  // never runs for them; public/analytics.js covers those.
  useEffect(() => {
    void initAnalytics();
    const removeListeners = installListeners();
    // The first navigation may have resolved before this effect ran, so send
    // it here and skip an immediate repeat of the same path.
    let last = "";
    const send = (path: string) => {
      if (path === last) return;
      last = path;
      trackPageview(path);
    };
    send(window.location.pathname);
    const unsubscribe = router.subscribe("onResolved", (event) =>
      send(event.toLocation.pathname),
    );
    return () => {
      unsubscribe();
      removeListeners();
    };
  }, [router]);

  return (
    <Document head={<HeadContent />} scripts={<Scripts />}>
      {children}
    </Document>
  );
}
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
node --test "tests/analytics.test.ts" && npm run typecheck
```

Expected: `pass 7`, `fail 0`, and `typecheck` exits 0 with no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics.ts src/routes/__root.tsx tests/analytics.test.ts
git commit -m "$(cat <<'EOF'
Report pageviews and link clicks from the router shell

The root layout initialises analytics once and reports a pageview per
resolved navigation, including the first. Outbound links and podcast
subscriptions are one delegated click listener, so the same code can serve
the static documents, which have no React on the client.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
EOF
)"
```

---

## Task 3: Newsletter and podcast subscription events

**Files:**

- Modify: `src/components/NewsletterForm.tsx` (the `<form>` element, line 60)
- Modify: `src/components/ShowSubscription.tsx` (the three anchors in `PodcastLinks`, lines 10–18)
- Test: `tests/analytics.test.ts` (extend)

**Interfaces:**

- Consumes: the delegated listeners from `installListeners()` in Task 2, which read `data-analytics-form` on a form and `data-analytics-platform` on an anchor.
- Produces: `newsletter_signup_submitted` with no props, and `subscribe_link_clicked` with `platform` one of `"apple"`, `"spotify"`, `"rss"`. No new exported functions.

These are attributes only. Neither component gains a hook or a handler, which is what lets the static `/about` rendering of both work exactly as the hydrated `/` rendering does.

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test "tests/analytics.test.ts"
```

Expected failure: `the newsletter form and the podcast links carry their attributes` fails on the first assertion, `The input did not match the regular expression /data-analytics-form="newsletter"/`. (`the podcast platforms are the three clickEvent reports` already passes — `clickEvent` landed in Task 1.)

- [ ] **Step 3: Mark the newsletter form**

In `src/components/NewsletterForm.tsx`, replace:

```tsx
    <form
      className={className}
      action={BUTTONDOWN_URL}
      method="post"
```

with:

```tsx
    <form
      className={className}
      action={BUTTONDOWN_URL}
      method="post"
      // Read by the delegated submit listener in src/lib/analytics.ts, not by
      // a handler here: on /about this form is static markup that POSTs to
      // Buttondown, so onSubmit never runs there.
      data-analytics-form="newsletter"
```

- [ ] **Step 4: Mark the podcast links**

In `src/components/ShowSubscription.tsx`, replace the body of `PodcastLinks`:

```tsx
export function PodcastLinks() {
  return (
    <div className="podcast-destinations">
      <a href="https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526">
        Apple Podcasts <span aria-hidden="true">↗</span>
      </a>
      <a href="https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH">
        Spotify <span aria-hidden="true">↗</span>
      </a>
      <a href={PODCAST_FEED}>
        Podcast RSS <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
```

with:

```tsx
export function PodcastLinks() {
  // data-analytics-platform is read by the delegated click listener in
  // src/lib/analytics.ts; it reports subscribe_link_clicked instead of a
  // bare outbound_link_clicked for these three.
  return (
    <div className="podcast-destinations">
      <a
        href="https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526"
        data-analytics-platform="apple"
      >
        Apple Podcasts <span aria-hidden="true">↗</span>
      </a>
      <a
        href="https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH"
        data-analytics-platform="spotify"
      >
        Spotify <span aria-hidden="true">↗</span>
      </a>
      <a href={PODCAST_FEED} data-analytics-platform="rss">
        Podcast RSS <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
node --test "tests/analytics.test.ts"
```

Expected: `pass 9`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/components/NewsletterForm.tsx src/components/ShowSubscription.tsx tests/analytics.test.ts
git commit -m "$(cat <<'EOF'
Mark the newsletter form and the podcast links for analytics

Attributes rather than handlers, because /about renders both as static
markup with no React on the client. The delegated listeners pick them up on
both surfaces.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
EOF
)"
```

---

## Task 4: Search events on both surfaces

**Files:**

- Modify: `src/components/PagefindUI.tsx` (the effect, lines 32–118, and the retry button, lines 164–175)
- Modify: `src/routes/links.tsx` (imports, and a new effect after the debounce effect at lines 104–116)
- Test: `tests/analytics.test.ts` (extend)

**Interfaces:**

- Consumes: `track`, `searchResultCount` from `src/lib/analytics.ts`. From `links.tsx`: `Route.useSearch().q`, and `Route.useLoaderData().total`, the full match count for the current filters.
- Produces: `search_performed` with `{ surface: "site" | "links", query_length: number, result_count: number }`, and `search_failed` with `{ surface: "site", attempt: number }`. No new exported functions.

Pagefind owns the result DOM and exposes no callback, so the completed-search readout is a `MutationObserver` on the container plus an 800 ms settle timer — one event per query the visitor stops typing, not one per keystroke. `searchResultCount` parses the message Pagefind renders, whose wording is fixed by the `translations` already configured in this file.

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test "tests/analytics.test.ts"
```

Expected failure: `both search surfaces report search_performed` fails with `The input did not match the regular expression /surface: "site"/`. (`searchResultCount reads Pagefind's rendered message` already passes — it landed in Task 1.)

- [ ] **Step 3: Report the `site` surface**

In `src/components/PagefindUI.tsx`, change the import block at lines 2–4 from:

```tsx
import { useEffect, useRef, useState } from "react";
import { enhanceSearchContext, prepareSearchResult } from "./search-results";
import { withPageUrls } from "./search-url";
```

to:

```tsx
import { useEffect, useRef, useState } from "react";
import { enhanceSearchContext, prepareSearchResult } from "./search-results";
import { withPageUrls } from "./search-url";
import { searchResultCount, track } from "../lib/analytics.ts";
```

Then, inside the effect, insert this block immediately after the `onKeyDown` function (line 65) and before `const script = document.createElement("script");`:

```tsx
// Pagefind owns the results DOM and offers no callback, so the only
// readout of a finished search is the message it renders. Observe it and
// report once the typing has settled, not once per keystroke.
let settle: ReturnType<typeof setTimeout> | undefined;
let reported = "";
const observer = new MutationObserver(() => {
  clearTimeout(settle);
  settle = setTimeout(() => {
    const term = container.querySelector("input")?.value.trim() ?? "";
    const message =
      container.querySelector(".pagefind-ui__message")?.textContent ?? "";
    if (!term || !message || term === reported) return;
    reported = term;
    track("search_performed", {
      surface: "site",
      query_length: term.length,
      result_count: searchResultCount(message),
    });
  }, 800);
});
observer.observe(container, {
  childList: true,
  subtree: true,
  characterData: true,
});
```

Replace the two failure paths. Lines 71–74:

```tsx
if (!window.PagefindUI) {
  setStatus("error");
  return;
}
```

become:

```tsx
if (!window.PagefindUI) {
  setStatus("error");
  track("search_failed", { surface: "site", attempt });
  return;
}
```

and lines 98–100:

```tsx
script.onerror = () => {
  if (!disposed) setStatus("error");
};
```

become:

```tsx
script.onerror = () => {
  if (disposed) return;
  setStatus("error");
  track("search_failed", { surface: "site", attempt });
};
```

Finally extend the cleanup at lines 107–117 from:

```tsx
return () => {
  disposed = true;
  cleanupContext();
  container.removeEventListener("input", onInput);
  container.removeEventListener("click", onClear);
  container.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("popstate", restoreQuery);
  ui.current?.destroy();
  ui.current = null;
  script.remove();
};
```

to:

```tsx
return () => {
  disposed = true;
  cleanupContext();
  clearTimeout(settle);
  observer.disconnect();
  container.removeEventListener("input", onInput);
  container.removeEventListener("click", onClear);
  container.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("popstate", restoreQuery);
  ui.current?.destroy();
  ui.current = null;
  script.remove();
};
```

- [ ] **Step 4: Report the `links` surface**

In `src/routes/links.tsx`, change the import at line 5 from:

```tsx
import { SITE_NAME, SITE_URL, ogMeta } from "../content/site.ts";
```

to:

```tsx
import { SITE_NAME, SITE_URL, ogMeta } from "../content/site.ts";
import { track } from "../lib/analytics.ts";
```

Then insert this effect immediately after the debounce effect that ends at line 116 (the one with deps `[q, search.q, navigate]`) and before the `const settled = useRef(false);` comment block:

```tsx
// One event per settled query, keyed on the query and its match count. The
// search box navigates on a debounce as the visitor types and the Filter
// button is rarely used, so reporting from onSubmit would see almost
// nothing. Paging does not change `total`, so it does not re-report.
useEffect(() => {
  if (!search.q) return;
  track("search_performed", {
    surface: "links",
    query_length: search.q.length,
    result_count: data.total,
  });
}, [search.q, data.total]);
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
node --test "tests/analytics.test.ts" && npm run typecheck
```

Expected: `pass 11`, `fail 0`, and `typecheck` exits 0 with no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/PagefindUI.tsx src/routes/links.tsx tests/analytics.test.ts
git commit -m "$(cat <<'EOF'
Report searches and search failures from both surfaces

Pagefind has no completion callback, so the site search reads back the
message it renders behind an 800ms settle timer. The link archive reports
from its settled query and match count rather than from onSubmit, which
almost nobody triggers.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
EOF
)"
```

---

## Task 5: The static-document surface

**Files:**

- Create: `src/client/analytics-page.ts`
- Modify: `src/lib/analytics.ts` (`installListeners`, to drain the queue)
- Modify: `vite.config.ts` (the `generated-public-files` plugin, lines 38–66)
- Modify: `src/routes/about.tsx` (the `<Document>` call, lines 89–97)
- Modify: `src/routes/episodes.$slug.tsx` (the `scripts` fragment, lines 111–132)
- Modify: `.gitignore`
- Test: `tests/analytics.test.ts` (extend)

**Interfaces:**

- Consumes: `initAnalytics`, `installListeners`, `trackPageview` from `src/lib/analytics.ts`; Vite's `build()`, already imported in `vite.config.ts`.
- Produces: `public/analytics.js`, a self-executing IIFE bundle, loaded by the static documents as `<script defer src="/analytics.js">`. It initialises analytics, installs the delegated listeners, reports the pageview, and drains `window.tmirAnalytics`.

`public/analytics.js` is generated and gitignored, exactly like `public/justify.js`. In an IIFE build Rollup cannot split chunks, so `posthog-js` is inlined into it rather than dynamically imported — acceptable, because the tag is `defer` and blocks nothing. The key is inlined too, which is correct: it is the public write-only project key.

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics.test.ts`:

```ts
test("the static documents load the generated analytics bundle", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const path of [
    "src/routes/about.tsx",
    "src/routes/episodes.$slug.tsx",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(
      source,
      /src="\/analytics\.js"/,
      `${path} loads /analytics.js`,
    );
  }
  const config = await readFile("vite.config.ts", "utf8");
  assert.match(config, /src\/client\/analytics-page\.ts/);
  const ignored = await readFile(".gitignore", "utf8");
  assert.match(ignored, /^public\/analytics\.js$/m);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test "tests/analytics.test.ts"
```

Expected failure: `the static documents load the generated analytics bundle` fails with `src/routes/about.tsx loads /analytics.js`.

- [ ] **Step 3: Drain the inline-script queue**

In `src/lib/analytics.ts`, replace the body of `installListeners` between `document.addEventListener("submit", onSubmit);` and `return () => {`, so the function reads:

```ts
export function installListeners(): () => void {
  function onClick(event: MouseEvent) {
    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor) return;
    const found = clickEvent(
      anchor.getAttribute("href"),
      anchor.getAttribute("data-analytics-platform"),
      location.host,
    );
    if (found) track(found.event, found.props);
  }
  function onSubmit(event: SubmitEvent) {
    const target = event.target as Element | null;
    if (target?.closest?.('form[data-analytics-form="newsletter"]'))
      track("newsletter_signup_submitted");
  }
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  // The static documents' inline scripts cannot import this module, so they
  // report through window.tmirAnalytics. They may push before or after this
  // runs, so drain what is there and turn later pushes into captures.
  const queue = (window.tmirAnalytics ??= []);
  for (const entry of queue.splice(0)) track(...entry);
  queue.push = (...entries: AnalyticsEntry[]) => {
    for (const entry of entries) track(...entry);
    return 0;
  };
  return () => {
    document.removeEventListener("click", onClick);
    document.removeEventListener("submit", onSubmit);
  };
}
```

- [ ] **Step 4: Write the page entry**

Create `src/client/analytics-page.ts`:

```ts
// The analytics entry for the static documents, /about and
// /episodes/<slug>, which render through renderToStaticMarkup outside the
// router and have no React on the client. Bundled to public/analytics.js by
// the generated-public-files plugin in vite.config.ts, alongside justify.js.
import {
  initAnalytics,
  installListeners,
  trackPageview,
} from "../lib/analytics.ts";

void initAnalytics();
// Before the pageview, so an inline script that already queued an event is
// drained rather than dropped.
installListeners();
trackPageview(location.pathname);
```

- [ ] **Step 5: Bundle it**

In `vite.config.ts`, replace the whole `generatedPublicFiles` block (the comment at lines 37–41 through the end of the plugin at line 66) with:

```ts
/**
 * Files that depend on the environment, written into public/ so Vite's normal
 * public copy emits them: robots.txt (its Sitemap line carries the site URL),
 * and the two browser bundles for pages that don't hydrate — justify.js, the
 * transcript justifier, and analytics.js, the analytics entry for the static
 * documents.
 */
const bundleToPublic = (entry: string, name: string) =>
  build({
    configFile: false,
    logLevel: "warn",
    publicDir: false,
    build: {
      lib: {
        entry,
        formats: ["iife"],
        name,
        fileName: () => `${name}.js`,
      },
      outDir: "public",
      emptyOutDir: false,
    },
  });

let bundlesBuilt: Promise<unknown> | undefined;
const generatedPublicFiles = (env: Record<string, string>) =>
  ({
    name: "generated-public-files",
    async buildStart() {
      // buildStart runs once per environment; bundle once.
      await (bundlesBuilt ??= Promise.all([
        bundleToPublic("src/client/justify-transcript.ts", "justify"),
        bundleToPublic("src/client/analytics-page.ts", "analytics"),
      ]));
      const siteUrl = env.VITE_SITE_URL || "https://thismonthinreact.com";
      writeFileSync(
        "public/robots.txt",
        `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      );
    },
  }) satisfies Plugin;
```

- [ ] **Step 6: Load it from `/about`**

In `src/routes/about.tsx`, replace:

```tsx
        const html = renderToStaticMarkup(
          <Document>
```

with:

```tsx
        const html = renderToStaticMarkup(
          <Document scripts={<script defer src="/analytics.js" />}>
```

- [ ] **Step 7: Load it from the episode pages**

In `src/routes/episodes.$slug.tsx`, replace this line inside the `scripts` fragment:

```tsx
<script defer src="/justify.js" />
```

with:

```tsx
                <script defer src="/justify.js" />
                <script defer src="/analytics.js" />
```

- [ ] **Step 8: Ignore the generated bundle**

In `.gitignore`, replace:

```
public/justify.js
```

with:

```
public/justify.js
public/analytics.js
```

- [ ] **Step 9: Run the test and watch it pass**

```bash
node --test "tests/analytics.test.ts" && npm run typecheck
```

Expected: `pass 12`, `fail 0`, and `typecheck` exits 0 with no output.

- [ ] **Step 10: Confirm the bundle builds and self-executes**

```bash
npm run build && ls -l public/analytics.js && head -c 200 public/analytics.js
```

Expected: the build succeeds, `public/analytics.js` exists and is non-empty, and `dist/client/analytics.js` has been copied alongside it. Without a `VITE_POSTHOG_KEY` in `.env` the bundle is a few hundred bytes and captures nothing — that is the no-op path, and it is correct.

- [ ] **Step 11: Commit**

```bash
git add src/client/analytics-page.ts src/lib/analytics.ts vite.config.ts src/routes/about.tsx "src/routes/episodes.\$slug.tsx" .gitignore tests/analytics.test.ts
git commit -m "$(cat <<'EOF'
Cover the static documents with a generated analytics bundle

/about and the episode pages render outside the router with no hydration, so
the root layout never reaches them — and the episode pages are most of the
traffic. They now load public/analytics.js, bundled from the same module by
the plugin that already produces justify.js.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
EOF
)"
```

---

## Task 6: Report a failed comments load

**Files:**

- Modify: `src/components/EpisodeBody.tsx` (`COMMENTS_SCRIPT`, lines 70–141)
- Modify: `src/routes/episodes.$slug.tsx` (the `#comments` section, lines 95–108)
- Test: `tests/analytics.test.ts` (extend)

**Interfaces:**

- Consumes: `window.tmirAnalytics`, the queue drained by `installListeners()` in Task 5; `el.dataset.episode` on `#comments`.
- Produces: `comments_load_failed` with `{ episode }`, pushed from the inline comments script when the Bluesky thread read rejects. No new exported functions.

`COMMENTS_SCRIPT` is a template string injected as an inline `<script>`, so it cannot import the analytics module. It pushes onto `window.tmirAnalytics` instead, which is why that queue exists and why draining it tolerates a push from either side of `installListeners()`. Only the replies read is reported: the quotes read is supplementary and already fails independently.

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics.test.ts`:

```ts
// node --test strips types but not JSX, so a .tsx module cannot be imported
// here — "Unknown file extension .tsx". These read the source as text, as the
// earlier attribute tests do.
test("a rejected comments thread read is queued for analytics", async () => {
  const { readFile } = await import("node:fs/promises");
  const body = await readFile("src/components/EpisodeBody.tsx", "utf8");
  assert.match(body, /comments_load_failed/);
  assert.match(body, /tmirAnalytics/);
  assert.match(body, /main\.status==="rejected"/);
  const route = await readFile("src/routes/episodes.$slug.tsx", "utf8");
  assert.match(route, /data-episode=\{episode\.slug\}/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test "tests/analytics.test.ts"
```

Expected failure: `a rejected comments thread read is queued for analytics` fails with `The input did not match the regular expression /comments_load_failed/`.

- [ ] **Step 3: Report the failure from the inline script**

In `src/components/EpisodeBody.tsx`, replace these three lines inside `COMMENTS_SCRIPT`:

```
const[main,quotes]=await Promise.allSettled([
  thread(uri,6),get(\`getQuotes?uri=\${encodeURIComponent(uri)}&limit=10\`)]);
const t=main.value?.thread;
```

with:

```
const[main,quotes]=await Promise.allSettled([
  thread(uri,6),get(\`getQuotes?uri=\${encodeURIComponent(uri)}&limit=10\`)]);
// This script cannot import src/lib/analytics.ts, so it reports through the
// queue that installListeners() drains. The quotes read is supplementary and
// is deliberately not reported.
if(main.status==="rejected")(window.tmirAnalytics=window.tmirAnalytics||[]).push(
  ["comments_load_failed",{episode:el.dataset.episode}]);
const t=main.value?.thread;
```

- [ ] **Step 4: Name the episode on the comments section**

In `src/routes/episodes.$slug.tsx`, replace:

```tsx
                <section
                  id="comments"
                  data-thread={threadUri}
                  data-pagefind-ignore=""
                >
```

with:

```tsx
                <section
                  id="comments"
                  data-thread={threadUri}
                  data-episode={episode.slug}
                  data-pagefind-ignore=""
                >
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
node --test "tests/analytics.test.ts"
```

Expected: `pass 13`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/components/EpisodeBody.tsx "src/routes/episodes.\$slug.tsx" tests/analytics.test.ts
git commit -m "$(cat <<'EOF'
Report a failed comments load from the episode pages

The comments script is an inline string with no module graph, so it queues
the event on window.tmirAnalytics for the analytics bundle to drain. Only
the replies read is reported; the quotes read is supplementary.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
EOF
)"
```

---

## Task 7: Verify the whole build

**Files:**

- Modify: none expected. Any fix this task uncovers is committed here.
- Test: `tests/analytics.test.ts`, `scripts/check-build.ts`

**Interfaces:**

- Consumes: `npm run test`, `npm run typecheck`, `npm run doctor`, `npm run check`.
- Produces: nothing new. This task proves the prerender still succeeds with the analytics module present, which is the spec's build-validation requirement.

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: every file passes, including `tests/analytics.test.ts` with `pass 13`, and `fail 0` overall.

- [ ] **Step 2: Typecheck and run react-doctor over the whole repo**

```bash
npm run typecheck && npm run doctor
```

Expected: `typecheck` exits 0 with no output; `doctor` reports no blocking issues. A warning in a file this plan touched must be fixed here, not suppressed, unless the suppression carries an inline reason the way the existing ones in `src/routes/about.tsx` do.

- [ ] **Step 3: Build and validate**

```bash
npm run check
```

Expected: `check-build.ts` passes every assertion. It runs the build and asserts the prerendered output, so a green run is the proof that prerendering still succeeds with the analytics module in the graph — the spec's build-validation criterion.

- [ ] **Step 4: Confirm the no-key path really is inert**

```bash
grep -c posthog public/analytics.js || echo "no posthog in the bundle (no key configured)"
```

Expected, with no `VITE_POSTHOG_KEY` in `.env`: the grep finds nothing and prints the fallback message, because `load()` returns before the dynamic import and Rollup drops the unreachable branch — or, if it is retained, the count is small and `posthog.init` is never reached. Either outcome is correct; what matters is that no network request is made. With a key configured, posthog is present and inlined, as expected.

- [ ] **Step 5: Confirm the shape of what will be captured**

```bash
git diff main --stat -- src/ vite.config.ts .env.example
grep -rn "track(" src/ | grep -v "src/lib/analytics.ts"
```

Expected: exactly the files this plan names, and `track(` call sites for `search_performed` ×2, `search_failed` ×1 — the rest (`$pageview`, `outbound_link_clicked`, `subscribe_link_clicked`, `newsletter_signup_submitted`, `comments_load_failed`) are emitted from inside `src/lib/analytics.ts`, so they do not appear here. Seven events total: the spec's table of nine less the two dropped download events.

- [ ] **Step 6: Commit any fix this task required**

Only if Steps 1–5 forced a change. Name the files explicitly:

```bash
git add <the files you actually changed>
git commit -m "$(cat <<'EOF'
Fix what full verification turned up in the analytics work

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017x2Vj4MEqPLt6jFdTMPBGt
EOF
)"
```

If nothing changed, skip the commit and record that Steps 1–5 were green.

---

## Manual verification, after Carl deploys

Not part of any task; the plan stops at the build artifact.

In PostHog, filter Live events on `$host = thismonthinreact.com` and confirm one of each: `$pageview` (with `episode` set on an episode page and absent on `/links`), `outbound_link_clicked`, `subscribe_link_clicked`, `newsletter_signup_submitted`, `search_performed` for both `site` and `links`. `search_failed` and `comments_load_failed` only appear when those requests actually fail.
