import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/episodes/$slug/transcript.srt")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const [{ getEpisode }, { toSrt }] = await Promise.all([
          import("../content/load.ts"),
          import("../content/srt.ts"),
        ]);
        const episode = await getEpisode(params.slug);
        if (!episode) return new Response("Not found", { status: 404 });
        // Episodes without a transcript get an empty 200 rather than a 404,
        // so this route's prerender list can reuse the chapters.json slug
        // list unchanged (a 404 during prerender fails the build).
        return new Response(toSrt(episode), {
          headers: { "content-type": "application/x-subrip; charset=utf-8" },
        });
      },
    },
  },
});
