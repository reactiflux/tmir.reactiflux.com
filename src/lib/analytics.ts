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
