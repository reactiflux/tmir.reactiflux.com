import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "../components/Document";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { loadEpisodes } = await import("../content/load.ts");
        const episodes = await loadEpisodes();
        // /search is deliberately absent: it carries its own noindex.
        const urls: { path: string; lastmod?: string }[] = [
          ...["/", "/about", "/links"].map((path) => ({ path })),
          ...episodes.map((e) => ({
            path: `/episodes/${e.slug}`,
            lastmod: e.date.slice(0, 10),
          })),
        ];
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map(
            ({ path, lastmod }) =>
              `<url><loc>${SITE_URL}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
          ),
          "</urlset>",
        ].join("");
        return new Response(xml, {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
