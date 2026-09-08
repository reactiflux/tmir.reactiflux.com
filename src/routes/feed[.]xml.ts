import { createFileRoute } from "@tanstack/react-router";
import { SITE_NAME, SITE_URL } from "../components/Document";

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { loadEpisodes } = await import("../content/load.ts");
        const { renderFeed } = await import("../content/feed.ts");
        const xml = renderFeed(await loadEpisodes(), SITE_NAME, SITE_URL);
        return new Response(xml, {
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        });
      },
    },
  },
});
