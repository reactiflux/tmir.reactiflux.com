// The analytics entry for the static documents, /about and
// /episodes/<slug>, which render through renderToStaticMarkup outside the
// router and have no React on the client. Bundled to public/analytics.js by
// the generated-public-files plugin in vite.config.ts, alongside justify.js.
// ponytail: IIFE inlines posthog-js (~309 KB raw / ~100 KB gzip, deferred +
// cacheable) on the static pages; 1 KB when VITE_POSTHOG_KEY is unset.
// Upgrade path if it matters: formats:["es"] + <script type="module"> so
// posthog splits into a lazy chunk.
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
