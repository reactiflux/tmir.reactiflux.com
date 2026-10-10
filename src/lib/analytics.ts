/**
 * Product analytics: a handful of hand-built events POSTed to PostHog's
 * capture API. No SDK — posthog-js was ~100 KB gzip for features this site
 * turns off. Cookieless and identity-free: nothing is stored, the ids below
 * last only as long as the page, and every event opts out of person profiles,
 * which is what removes the need for a consent banner. Only the properties
 * built here are sent, so the search query and ad click IDs never leave (see
 * scrubUrl). Sending swallows its own errors — analytics must never break the
 * site.
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

// import.meta.env is undefined under `node --test`, hence the optional chain.
const KEY: string | undefined = import.meta.env?.VITE_POSTHOG_KEY;
const HOST: string =
  import.meta.env?.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * The query params the site's own routes use (see validateSearch in
 * links.tsx). `q` is deliberately absent: it is the visitor's search text.
 */
const SITE_PARAMS = new Set(["subject", "year", "sort", "view", "page"]);

/** utm_* except utm_term, which paid search fills with the visitor's keyword. */
function isCampaignParam(name: string): boolean {
  return name.startsWith("utm_") && name !== "utm_term";
}

/**
 * `value` with every query param dropped except the site's own and campaign
 * params. That removes the search query, ad click IDs (gclid, fbclid, …) and
 * anything else a link might carry. The hash goes too.
 */
function scrubUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const name of [...url.searchParams.keys()])
      if (!SITE_PARAMS.has(name) && !isCampaignParam(name))
        url.searchParams.delete(name);
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

/**
 * Every property derived from the page's URL and referrer — the only ones that
 * could carry the search query or a click ID, so they are built in one place.
 * PostHog reads utm_* as top-level properties for its channel breakdowns.
 */
export function pageProps(href: string, referrer: string) {
  const url = new URL(href);
  let referringDomain = "$direct";
  try {
    if (referrer) referringDomain = new URL(referrer).host;
  } catch {
    // An unparseable referrer is no referrer.
  }
  return {
    ...Object.fromEntries(
      [...url.searchParams].filter(([name]) => isCampaignParam(name)),
    ),
    $current_url: scrubUrl(href),
    $host: url.host,
    $pathname: url.pathname,
    $referrer: referrer ? scrubUrl(referrer) : "$direct",
    $referring_domain: referringDomain,
  };
}

/**
 * A UUIDv7, which PostHog requires for $session_id: 48 bits of millisecond
 * timestamp, then random bits, with the version and variant set.
 */
function uuidv7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let time = Date.now();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// One page load is one visitor and one session; nothing carries across loads.
let ids: { visitor: string; session: string } | undefined;

/** Do Not Track and Global Privacy Control both opt the visitor out. */
export function optedOut(
  nav: {
    doNotTrack?: string | null;
    globalPrivacyControl?: boolean;
  } = navigator,
): boolean {
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** The capture API body for one event, built from the current page. */
export function payload(
  key: string,
  event: string,
  props?: Record<string, unknown>,
) {
  ids ??= { visitor: uuidv7(), session: uuidv7() };
  return {
    api_key: key,
    event,
    distinct_id: ids.visitor,
    timestamp: new Date().toISOString(),
    properties: {
      ...pageProps(location.href, document.referrer),
      title: document.title,
      $session_id: ids.session,
      // PostHog derives browser and OS from this server-side.
      $raw_user_agent: navigator.userAgent,
      $browser_language: navigator.language,
      $screen_width: screen.width,
      $screen_height: screen.height,
      $viewport_width: innerWidth,
      $viewport_height: innerHeight,
      $lib: "tmir",
      $process_person_profile: false,
      ...props,
    },
  };
}

/**
 * Sends an event, or does nothing when no key is configured or the visitor
 * opted out. The body goes as text/plain, which keeps the request CORS-simple
 * (no preflight) and lets sendBeacon deliver it even as the page unloads — an
 * outbound click, or the /about form POSTing to Buttondown.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!KEY) return;
  try {
    if (optedOut()) return;
    const body = JSON.stringify(payload(KEY, event, props));
    const url = `${HOST}/i/v0/e/`;
    if (!navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" })))
      void fetch(url, {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "text/plain" },
      }).catch(() => {});
  } catch {
    // Analytics must never break the site.
  }
}

/**
 * The episode a path identifies, or undefined. The flat prerendered
 * `/episodes/<slug>.html` is the same page, so it counts; the
 * `/episodes/<slug>/chapters.json` and `/episodes/<slug>/transcript.srt` data
 * routes are not page views.
 */
export function episodeSlug(path: string): string | undefined {
  return /^\/episodes\/([^/.]+)(?:\.html|\/)?$/.exec(path)?.[1];
}

export function trackPageview(path: string): void {
  track("$pageview", { episode: episodeSlug(path) });
}

/**
 * The host an href leaves the site for, or null. Relative paths, fragments,
 * `mailto:` and anything else that is not http(s) are internal; a different
 * host — including a different subdomain or port — is outbound.
 */
export function outboundHost(href: string, currentHost: string): string | null {
  try {
    const url = new URL(href, `https://${currentHost}`);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.host !== currentHost
      ? url.host
      : null;
  } catch {
    return null;
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
  const host = href ? outboundHost(href, currentHost) : null;
  return host ? { event: "outbound_link_clicked", props: { host } } : null;
}

/**
 * Delegated listeners for the interactions that have to work on both client
 * surfaces: the hydrated router pages and the static documents (/about,
 * /episodes/<slug>), which render outside the router with no React on the
 * client at all. Delegation means one implementation covers both, and the
 * static pages need no event handlers in their markup.
 * Idempotent: installs once per page and is never removed.
 */
let installed = false;

export function installListeners(report: typeof track = track): void {
  if (installed) return;
  installed = true;
  function onClick(event: MouseEvent) {
    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor) return;
    const found = clickEvent(
      anchor.getAttribute("href"),
      anchor.getAttribute("data-analytics-platform"),
      location.host,
    );
    if (found) report(found.event, found.props);
  }
  function onSubmit(event: SubmitEvent) {
    const target = event.target as Element | null;
    if (target?.closest?.('form[data-analytics-form="newsletter"]'))
      report("newsletter_signup_submitted");
  }
  document.addEventListener("click", onClick);
  // A middle-click opens the link in a new tab and fires auxclick, not click.
  document.addEventListener("auxclick", (event) => {
    if (event.button === 1) onClick(event);
  });
  document.addEventListener("submit", onSubmit);
  // The static documents' inline scripts cannot import this module, so they
  // report through window.tmirAnalytics. They may push before or after this
  // runs, so drain what is there and turn later pushes into captures.
  const queue = (window.tmirAnalytics ??= []);
  for (const entry of queue.splice(0)) report(...entry);
  queue.push = (...entries: AnalyticsEntry[]) => {
    for (const entry of entries) report(...entry);
    return queue.length;
  };
}

/** How long a search query must sit unchanged before it counts as a search. */
export const SEARCH_SETTLE_MS = 800;

/**
 * Pagefind's result count, read back from the message it renders — the only
 * readout of a finished search, since Pagefind owns that DOM. The translations
 * in PagefindUI.tsx make it "<n> episodes for …", or "No episodes found for …"
 * when there are none. Anything else (Pagefind's interim "Searching for …") is
 * not a finished search: null.
 */
export function searchResultCount(message: string): number | null {
  // Pagefind formats the count with Intl.NumberFormat: "1,234", "1.234".
  const count = Number.parseInt(message.replace(/[.,\s]/g, ""), 10);
  if (!Number.isNaN(count)) return count;
  return message.startsWith("No episodes found") ? 0 : null;
}
