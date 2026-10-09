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
