import { createFileRoute } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { Document, OgTags, SITE_NAME, SITE_URL } from "../components/Document";
import {
  COMMENTS_SCRIPT,
  EpisodeBody,
  OUTLINE_SCRIPT,
  SEEK_SCRIPT,
} from "../components/EpisodeBody";
import { bskyPostToAtUri } from "../content/atproto.ts";

const ATPROTO_DID = import.meta.env.VITE_ATPROTO_DID;

export const Route = createFileRoute("/episodes/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getEpisode } = await import("../content/load.ts");
        const episode = await getEpisode(params.slug);
        if (!episode) return new Response("Not found", { status: 404 });

        // Derived at build time; no network call during prerender.
        const threadUri = episode.bskyPostUrl
          ? bskyPostToAtUri(episode.bskyPostUrl, ATPROTO_DID)
          : undefined;

        const html = renderToStaticMarkup(
          <Document
            head={
              <>
                <title>{`${episode.title} — ${SITE_NAME}`}</title>
                <meta name="description" content={episode.description} />
                <link
                  rel="canonical"
                  href={`${SITE_URL}/episodes/${episode.slug}`}
                />
                <OgTags
                  title={`${episode.title} — ${SITE_NAME}`}
                  description={episode.description}
                  url={`${SITE_URL}/episodes/${episode.slug}`}
                  type="article"
                />
                {episode.atUri && (
                  <link rel="site.standard.document" href={episode.atUri} />
                )}
              </>
            }
            bodyClass="episode-page"
            scripts={
              <>
                <script dangerouslySetInnerHTML={{ __html: SEEK_SCRIPT }} />
                <script dangerouslySetInnerHTML={{ __html: OUTLINE_SCRIPT }} />
                {threadUri && (
                  <script
                    dangerouslySetInnerHTML={{ __html: COMMENTS_SCRIPT }}
                  />
                )}
              </>
            }
          >
            <header className="episode-header">
              <h1 title={episode.title}>{episode.title}</h1>
              {episode.audioUrl && (
                <div className="player" data-pagefind-ignore="">
                  <audio controls preload="none" src={episode.audioUrl} />
                </div>
              )}
            </header>
            <EpisodeBody episode={episode} />
            {episode.bskyPostUrl && (
              <section
                id="comments"
                data-thread={threadUri}
                data-pagefind-ignore=""
              >
                <h2>Comments</h2>
                <p>
                  <a href={episode.bskyPostUrl} rel="noreferrer">
                    Reply on Bluesky
                  </a>
                </p>
              </section>
            )}
          </Document>,
        );

        return new Response(`<!DOCTYPE html>${html}`, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
