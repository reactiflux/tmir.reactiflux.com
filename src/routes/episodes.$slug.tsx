import { createFileRoute } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Document,
  OgTags,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "../components/Document";
import {
  COMMENTS_SCRIPT,
  EpisodeBody,
  OUTLINE_SCRIPT,
  SEEK_SCRIPT,
} from "../components/EpisodeBody";
import { bskyPostToAtUri } from "../content/atproto.ts";
import { jsonLd } from "../content/jsonld.ts";
import { cardTitle } from "../content/slug.ts";
import { isoDuration } from "../content/time.ts";

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

        // episode.title already carries the site name or a "TMiR <yyyy-mm>: "
        // prefix, so strip it before appending the site name.
        const name = cardTitle(episode.title);
        const title = `${name} — ${SITE_NAME}`;
        const description = episode.description || SITE_DESCRIPTION;
        const url = `${SITE_URL}/episodes/${episode.slug}`;
        const published = new Date(
          `${episode.date.slice(0, 10)}T00:00:00Z`,
        ).toISOString();

        const structuredData = jsonLd({
          "@context": "https://schema.org",
          "@type": "PodcastEpisode",
          name,
          description,
          url,
          datePublished: published,
          image: `${SITE_URL}/og/${episode.slug}.jpg`,
          partOfSeries: {
            "@type": "PodcastSeries",
            name: SITE_NAME,
            url: `${SITE_URL}/`,
          },
          ...(episode.audioUrl
            ? {
                associatedMedia: {
                  "@type": "AudioObject",
                  contentUrl: episode.audioUrl,
                  ...(episode.duration !== undefined
                    ? { duration: isoDuration(episode.duration) }
                    : {}),
                },
              }
            : {}),
        });

        const html = renderToStaticMarkup(
          <Document
            head={
              <>
                <title>{title}</title>
                <meta name="description" content={description} />
                <link rel="canonical" href={url} />
                <OgTags
                  title={title}
                  description={description}
                  url={url}
                  type="article"
                  image={episode.slug}
                  publishedTime={published}
                  audioUrl={episode.audioUrl}
                />
                {episode.atUri && (
                  <link rel="site.standard.document" href={episode.atUri} />
                )}
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: structuredData }}
                />
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
              <h1>{episode.title}</h1>
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
