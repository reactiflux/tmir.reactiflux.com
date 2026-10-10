import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Document } from "../components/Document";
import { SITE_NAME } from "../content/site.ts";
import { installListeners, trackPageview } from "../lib/analytics.ts";

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
    installListeners();
    // The first navigation may have resolved before this effect ran, so send
    // it here and skip an immediate repeat of the same path. Keying on the
    // pathname also means paging, filters and search params are deliberately
    // not pageviews; search_performed covers the searches.
    let last = "";
    const send = (path: string) => {
      if (path === last) return;
      last = path;
      trackPageview(path);
    };
    send(window.location.pathname);
    return router.subscribe("onResolved", (event) =>
      send(event.toLocation.pathname),
    );
  }, [router]);

  return (
    <Document head={<HeadContent />} scripts={<Scripts />}>
      {children}
    </Document>
  );
}
