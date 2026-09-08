import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/episodes/$slug/chapters.json")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getEpisode } = await import("../content/load.ts");
        const { outlineToChapters } = await import("../content/feed.ts");
        const episode = await getEpisode(params.slug);
        if (!episode) return new Response("Not found", { status: 404 });
        return Response.json({
          version: "1.2.0",
          chapters: outlineToChapters(episode.outline),
        });
      },
    },
  },
});
