# PostHog product analytics — design

**Date:** 2026-10-09
**Status:** approved for planning

## Goal

Answer two questions about thismonthinreact.com with data instead of guesses:

1. Is it working? Do search, comments, newsletter signup, and downloads succeed for real visitors?
2. What do people actually use? Which episodes land, which podcast apps they subscribe through, whether search and the link archive earn their keep.

## Decisions

| Decision         | Choice                                                 | Why                                                                                                                             |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Vendor           | PostHog Cloud US, existing project shared with mod-bot | No new account. TMIR events are distinguished by the automatic `$host` property; dashboards filter on it.                       |
| Consent          | Cookieless, no banner                                  | `persistence: "memory"`, no `identify()`. No cookie → no consent UI. Cost: no returning-visitor or retention metrics. Accepted. |
| Capture          | Client-side `posthog-js` only                          | Site is prerendered; the SSR function rarely sees a user. Server-side capture adds nothing.                                     |
| Ad-blocker proxy | Not in v1                                              | Netlify redirect proxying is flaky. Revisit if blocked-event loss (~20–30%) turns out to matter.                                |
| Autocapture      | Off                                                    | Explicit events only; autocapture on a content site is noise.                                                                   |
| Config           | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`                | Copied from mod-bot's `.env`. Key absent → analytics is a no-op (dev, previews, forks).                                         |

## Components

### `src/lib/analytics.ts`

The only file that imports `posthog-js`.

- `initAnalytics()` — called once, client-only, from the root layout. Returns early without a key. Options: `api_host` from env, `persistence: "memory"`, `capture_pageview: false`, `capture_pageleave: false`, `autocapture: false`, `disable_session_recording: true`.
- `track(event, props?)` — thin wrapper; no-op when not initialised. Components call this, never `posthog` directly.
- `trackPageview(path)` — captures `$pageview` with `$current_url` and, if the path matches `/episodes/:slug`, an `episode` property.

### Root layout (`src/routes/__root.tsx`)

- `useEffect` on mount: `initAnalytics()`, then subscribe to the router's `onResolved` event and call `trackPageview` on every resolved navigation, including the first. Unsubscribe on unmount.
- One delegated `click` listener on `document` for `outbound_link_clicked`: anchor with an `href` whose host differs from `location.host`. Property: `host`.

### Instrumented interactions

| Event                         | Props                                                        | Source                                         |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| `$pageview`                   | `episode?`                                                   | router `onResolved`                            |
| `newsletter_signup_submitted` | —                                                            | `NewsletterForm` `onSubmit`                    |
| `subscribe_link_clicked`      | `platform`                                                   | `ShowSubscription` link `onClick`              |
| `search_performed`            | `surface: "site" \| "links"`, `query_length`, `result_count` | `PagefindUI` on results; `links.tsx` on submit |
| `search_failed`               | `surface`, `attempt`                                         | `PagefindUI` error state                       |
| `transcript_downloaded`       | `episode`                                                    | episode page transcript link                   |
| `chapters_downloaded`         | `episode`                                                    | episode page chapters link                     |
| `comments_load_failed`        | `episode`                                                    | `EpisodeBody` fetch catch                      |
| `outbound_link_clicked`       | `host`                                                       | delegated listener in root                     |

Not captured: raw search query text, scroll depth, audio-player events (third-party embed, no hooks), anything identifying a person.

## Error handling

Analytics must never break the site. `initAnalytics` and `track` swallow their own errors; `track` before init is a silent no-op. `posthog-js` is loaded via a dynamic `import()` inside `initAnalytics` so an SSR/prerender pass never evaluates it and a CDN failure never blocks render.

## Testing

- `tests/analytics.test.ts` (node test runner, matching the existing suite): `track` is a no-op without a key; the outbound-link classifier treats same-host, relative, and `mailto:` hrefs as internal and foreign hosts as outbound. The classifier is a pure function exported from `analytics.ts` for this reason.
- `npm run check` (existing build validation) stays green — confirms prerender still succeeds with the analytics module present.
- Manual: after deploy, PostHog "Live events" filtered by `$host = thismonthinreact.com` shows a pageview and one of each custom event.

## Out of scope

Dashboards and insights (built in the PostHog UI, not code), session recording, feature flags, A/B tests, server-side capture, a consent banner.

## Amendments (as shipped, 2026-10-09)

Found during implementation; each is recorded with its reason in the plan's Deviations section and in a code comment at the site.

- **Two surfaces, not one.** `/about` and `/episodes/:slug` are `renderToStaticMarkup` server handlers with no hydration, so the root layout never runs there. A second entry, `src/client/analytics-page.ts`, is bundled to `public/analytics.js` by the existing `generated-public-files` Vite plugin (same mechanism as `justify.js`) and loaded by those pages. Both surfaces share `installListeners()` from `src/lib/analytics.ts`. The two surfaces are mutually exclusive per page, so no event double-fires.
- **Static-page bundle cost.** The IIFE build inlines `posthog-js`: ~309 KB raw (~100 KB gzip), deferred and cacheable, on `/about` and every episode page; ~1 KB when `VITE_POSTHOG_KEY` is unset. Accepted for v1. Upgrade path: build the entry as an ES module so PostHog splits into a lazy chunk.
- **`transcript_downloaded` / `chapters_downloaded` dropped.** Nothing on any page links to those endpoints; they exist only as podcast-feed targets. The real download affordance (Transistor audio) is already reported as `outbound_link_clicked {host: "media.transistor.fm"}`.
- **Newsletter and subscribe events via `data-analytics-*` attributes and the delegated listener**, not React handlers — `NewsletterForm` renders as static markup on `/about` where no handler could run. Known ceiling: an `/about` submit navigates cross-document, so that capture is best-effort.
- **`search_performed` on `/links` fires from an effect on the debounced `q` search param**, not `onSubmit` (the box navigates as you type). It also fires on direct navigation to `/links?q=…` and when a filter changes `result_count`; read the metric as "result sets observed", not "submits".
- **`comments_load_failed` comes from the inline `COMMENTS_SCRIPT`** via a `window.tmirAnalytics` queue that `installListeners()` drains and then replaces `push` on.
- **Vendor-attached properties.** PostHog adds `$current_url` to every capture, which would carry `?q=<query>` from both search surfaces. Init sets `mask_personal_data_properties: true` + `custom_personal_data_properties: ["q"]` so the query is masked in URL properties. Lesson for future vendor specs: list what the vendor attaches by default, not only what the code sends.
- **Build-time config.** `VITE_*` vars are inlined at build; without a key the bundles contain no PostHog code at all. Netlify's build environment must carry `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` (README already says so for all `VITE_` vars).
- **Post-deploy checklist additions:** enable "Discard client IP data" in PostHog project settings (the cookieless stance isn't complete without it); filter every saved insight on `$host` since the project is shared with mod-bot.
