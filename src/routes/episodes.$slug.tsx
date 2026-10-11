import { EpisodeHeader, PLAYER_SCRIPT } from "../components/EpisodeHeader";
import {
  EpisodeNavigation,
  EPISODE_NAVIGATION_SCRIPT,
} from "../components/EpisodeNavigation";
import { createFileRoute } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { Document, OgTags } from "../components/Document";
import {
  COMMENTS_SCRIPT,
  EpisodeBody,
  OUTLINE_SCRIPT,
  SEEK_SCRIPT,
} from "../components/EpisodeBody";
import { bskyPostToAtUri } from "../content/atproto.ts";
import { jsonLd } from "../content/jsonld.ts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../content/site.ts";
import { cardTitle } from "../content/slug.ts";
import { isoDuration, longDate, monthYear } from "../content/time.ts";

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
        // A title that reduces to just the show name ("This Month in React
        // (March 2023)") would give every such episode the same <title>, so
        // name it by its month instead.
        const stripped = cardTitle(episode.title);
        const generic = stripped === SITE_NAME;
        const name = generic
          ? `${SITE_NAME}, ${monthYear(episode.date)}`
          : stripped;
        const title = generic ? name : `${name} — ${SITE_NAME}`;
        // Without a written description, lead with the episode's own name so
        // no two pages share a meta description.
        const description =
          episode.description || `${name}. ${SITE_DESCRIPTION}`;
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
          inLanguage: "en",
          image: `${SITE_URL}/og/${episode.slug}.jpg`,
          ...(episode.people.length > 0
            ? {
                actor: episode.people.map((p) => ({
                  "@type": "Person",
                  name: p.name,
                  ...(p.href ? { url: p.href } : {}),
                })),
              }
            : {}),
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
            footerDiscussion={
              episode.bskyPostUrl && (
                <section
                  id="comments"
                  data-thread={threadUri}
                  data-episode={episode.slug}
                  data-pagefind-ignore=""
                >
                  <h2>Comments</h2>
                  <p>
                    <a href={episode.bskyPostUrl} rel="noreferrer">
                      Reply on Bluesky
                    </a>
                  </p>
                </section>
              )
            }
            bodyClass="episode-page"
            scripts={
              <>
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: structuredData }}
                />
                <script dangerouslySetInnerHTML={{ __html: PLAYER_SCRIPT }} />
                <script dangerouslySetInnerHTML={{ __html: SEEK_SCRIPT }} />
                <script defer src="/justify.js" />
                <script defer src="/analytics.js" />
                <script dangerouslySetInnerHTML={{ __html: OUTLINE_SCRIPT }} />
                <script
                  dangerouslySetInnerHTML={{
                    __html: EPISODE_NAVIGATION_SCRIPT,
                  }}
                />
                {threadUri && (
                  <script
                    dangerouslySetInnerHTML={{ __html: COMMENTS_SCRIPT }}
                  />
                )}
              </>
            }
          >
            {/* React 19 hoists these into <head> during server rendering. */}
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
            <header className="episode-intro">
              <p className="eyebrow">
                {episode.series || monthYear(episode.date)}
                {episode.season !== undefined && ` · Season ${episode.season}`}
                {episode.episode !== undefined &&
                  ` / Episode ${episode.episode}`}
              </p>
              <h1>{name}</h1>
              {episode.description && (
                <p className="lead">{episode.description}</p>
              )}
              <p className="episode-meta">
                {episode.people.length > 0 && (
                  <span>{episode.people.map((p) => p.name).join(" & ")}</span>
                )}
                <time dateTime={episode.date}>{longDate(episode.date)}</time>
                {episode.duration !== undefined && (
                  <time dateTime={isoDuration(episode.duration)}>
                    {Math.round(episode.duration / 60)} min
                  </time>
                )}
              </p>
            </header>
            <EpisodeHeader
              audioUrl={episode.audioUrl}
              title={name}
              duration={episode.duration}
            />
            <EpisodeBody episode={episode} />
            {episode.sections.length > 0 && <EpisodeNavigation />}
          </Document>,
        );

        return new Response(`<!DOCTYPE html>${html}`, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
