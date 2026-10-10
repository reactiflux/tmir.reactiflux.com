/**
 * The only module that imports posthog-js. Cookieless and identity-free: the
 * persistence is in-memory and nothing calls identify(), which is what removes
 * the need for a consent banner. (posthog-js still probes localStorage at init
 * by writing and removing a test key; nothing is kept.) Every entry point swallows its own errors —
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
 * params, if it is an absolute URL. That removes the search query, ad click
 * IDs (gclid, fbclid, …) and anything else a link might carry.
 */
function scrubUrl(value: string): string {
  if (!/^https?:\/\//.test(value)) return value;
  try {
    const url = new URL(value);
    for (const name of [...url.searchParams.keys()])
      if (!SITE_PARAMS.has(name) && !isCampaignParam(name))
        url.searchParams.delete(name);
    return url.href;
  } catch {
    return value;
  }
}

/**
 * Property names (and their $initial_/$session_entry_ variants) that carry a
 * search query or an ad click ID outside any URL: posthog's ph_keyword (a
 * search engine's query, from a full referrer), utm_term (paid search fills
 * it with the keyword) and li_fat_id (LinkedIn's click ID, read from a
 * cookie). Click IDs posthog reads from the URL arrive as "<masked>" under
 * mask_personal_data_properties; those are dropped as well.
 */
const DROPPED_KEYS = ["ph_keyword", "utm_term", "li_fat_id"];

function scrub(bag: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(bag)) {
    if (
      DROPPED_KEYS.some((suffix) => key.endsWith(suffix)) ||
      value === "<masked>"
    ) {
      delete bag[key];
      continue;
    }
    const clean = scrubUrl(key);
    if (clean !== key) delete bag[key];
    if (typeof value === "string") bag[clean] = scrubUrl(value);
    else {
      if (value && typeof value === "object")
        scrub(value as Record<string, unknown>);
      bag[clean] = value;
    }
  }
}

/**
 * posthog-js masks a fixed list of params on the URLs it builds itself, but
 * $referrer is sent raw from document.referrer and trackPageview stamps its
 * own $current_url, so neither is covered. This scrubs every absolute URL
 * anywhere in an event, keys included, and drops the DROPPED_KEYS properties.
 */
export function scrubUrls(
  cr: import("posthog-js").CaptureResult | null,
): import("posthog-js").CaptureResult | null {
  if (cr) scrub(cr as unknown as Record<string, unknown>);
  return cr;
}

/**
 * Exported so a test can assert on it directly. `persistence: "memory"` is what
 * makes this cookieless. Everything posthog-js would otherwise let the project
 * settings switch on remotely is pinned off here: those features (flags,
 * heatmaps, surveys, …) send or store data that before_send never sees.
 */
export const INIT_OPTIONS = {
  persistence: "memory",
  // Do Not Track and Global Privacy Control both opt the visitor out.
  respect_dnt: true,
  // Pins identity-free in config: a stray identify() is a logged no-op.
  person_profiles: "never",
  capture_pageview: false,
  capture_pageleave: false,
  autocapture: false,
  disable_session_recording: true,
  mask_personal_data_properties: true,
  custom_personal_data_properties: ["q"],
  before_send: scrubUrls,
  advanced_disable_flags: true,
  disable_external_dependency_loading: true,
  capture_heatmaps: false,
  capture_dead_clicks: false,
  capture_performance: false,
  capture_exceptions: false,
  disable_surveys: true,
  disable_product_tours: true,
  disable_conversations: true,
  disable_web_experiments: true,
} satisfies Partial<import("posthog-js").PostHogConfig>;

async function load(): Promise<void> {
  // import.meta.env is undefined under `node --test`, hence the optional chain.
  const key = import.meta.env?.VITE_POSTHOG_KEY;
  if (!key) return;
  const host = import.meta.env?.VITE_POSTHOG_HOST;
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      ...(host ? { api_host: host } : {}),
      ...INIT_OPTIONS,
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
 *
 * ponytail: on router pages posthog-js is a lazy chunk, so a same-tab outbound
 * click or submit in the moment before it loads is lost when the page unloads.
 * Static pages inline it and are unaffected. Upgrade path if it matters:
 * modulepreload the chunk from the router head.
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
 * The episode a path identifies, or undefined. The flat prerendered
 * `/episodes/<slug>.html` is the same page, so it counts; the
 * `/episodes/<slug>/chapters.json` and `/episodes/<slug>/transcript.srt` data
 * routes are not page views.
 */
export function episodeSlug(path: string): string | undefined {
  return /^\/episodes\/([^/.]+)(?:\.html|\/)?$/.exec(path)?.[1];
}

/**
 * The URL is stamped now: posthog-js would otherwise read it when the capture
 * runs, after the lazy import, by which time a quick visitor may already be on
 * another page. (The title cannot be stamped — posthog-js always overwrites it
 * from document.title at capture.)
 */
export function trackPageview(path: string): void {
  track("$pageview", {
    $current_url: location.href,
    $pathname: path,
    episode: episodeSlug(path),
  });
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
