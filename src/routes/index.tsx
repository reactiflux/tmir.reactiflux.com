import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { EpisodeHeader } from "../components/EpisodeHeader";
import {
  EmailSubscription,
  LiveRecording,
  PodcastLinks,
  PODCAST_FEED,
} from "../components/ShowSubscription";
import { SITE_NAME, SITE_URL, ogMeta } from "../content/site.ts";
import { jsonLd } from "../content/jsonld.ts";
import { shortDate } from "../content/time.ts";
import { cardTitle } from "../content/slug.ts";

const HOME_DESCRIPTION =
  "A monthly conversation about React, the web, and the work of building software, with Carl Vitullo and Mark Erikson. Follow the podcast, get new episodes by email, or listen live in Reactiflux.";

const STARTER_EPISODES = ["2026-05", "2025-09", "2024-12"];
const getHome = createServerFn().handler(async () => {
  const { loadEpisodes } = await import("../content/load.ts");
  const episodes = await loadEpisodes();
  return episodes.map((episode) => ({
    slug: episode.slug,
    title: episode.title,
    date: episode.date,
    series: episode.series,
    description: episode.description,
    audioUrl: episode.audioUrl,
    duration: episode.duration,
  }));
});

export const Route = createFileRoute("/")({
  loader: () => getHome(),
  head: () => ({
    meta: [
      { title: SITE_NAME },
      { name: "description", content: HOME_DESCRIPTION },
      ...ogMeta({
        title: SITE_NAME,
        description: HOME_DESCRIPTION,
        url: `${SITE_URL}/`,
      }),
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: Home,
});

function ArchiveList({
  episodes,
}: {
  episodes: Awaited<ReturnType<typeof getHome>>;
}) {
  return (
    <ul className="archive-list">
      {episodes.map((episode) => (
        <li key={episode.slug}>
          <time dateTime={episode.date}>{shortDate(episode.date)}</time>
          <div className="archive-copy">
            {episode.series && <p className="eyebrow">{episode.series}</p>}
            <h3>
              <a href={`/episodes/${episode.slug}`}>
                {cardTitle(episode.title)}
              </a>
            </h3>
            {episode.description && <p>{episode.description}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Home() {
  const archive = Route.useLoaderData();
  const [latest, ...recent] = archive;
  const starters = STARTER_EPISODES.flatMap((slug) => {
    const episode = archive.find((entry) => entry.slug === slug);
    return episode ? [episode] : [];
  });
  return (
    <div className="evergreen-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "PodcastSeries",
            name: SITE_NAME,
            description: HOME_DESCRIPTION,
            url: `${SITE_URL}/`,
            image: `${SITE_URL}/artwork.jpg`,
            webFeed: PODCAST_FEED,
          }),
        }}
      />
      <section className="show-intro" aria-labelledby="show-promise">
        <div>
          <p className="eyebrow">{SITE_NAME} · A monthly podcast</p>
          <h1 id="show-promise">
            Your monthly
            <br />
            <em>React catch-up.</em>
          </h1>
          <p className="lead">
            Step back from the day-to-day and catch up on React and the wider
            web with Carl Vitullo and Mark Erikson.
          </p>
          <p className="show-byline">
            <strong>Carl Vitullo</strong> · Reactiflux community leader
            <br />
            <strong>Mark Erikson</strong> · Redux maintainer
            <br />
            {/* react-doctor-disable-next-line react-doctor/tanstack-start-no-anchor-element -- /about renders a static document outside the router. */}
            <a href="/about">
              Meet the hosts <span aria-hidden="true">↗</span>
            </a>
          </p>
          <div className="follow-show">
            <h2>Follow the show.</h2>
            <PodcastLinks />
          </div>
        </div>
        <figure className="show-artwork">
          <picture>
            <source
              type="image/avif"
              srcSet="/artwork-600.avif 600w, /artwork-1200.avif 1200w"
              sizes="(max-width: 700px) 260px, 370px"
            />
            <source
              type="image/webp"
              srcSet="/artwork-600.webp 600w, /artwork-1200.webp 1200w"
              sizes="(max-width: 700px) 260px, 370px"
            />
            <img
              src="/artwork.jpg"
              alt="This Month in React cover artwork"
              width="600"
              height="600"
              fetchPriority="high"
            />
          </picture>
        </figure>
      </section>
      {latest && (
        <section
          className="home-latest"
          id="latest"
          aria-labelledby="latest-title"
        >
          <p className="eyebrow">Latest episode</p>
          <time dateTime={latest.date}>{shortDate(latest.date)}</time>
          <h2 id="latest-title">
            <a href={`/episodes/${latest.slug}`}>{cardTitle(latest.title)}</a>
          </h2>
          {latest.description && (
            <p className="latest-description">{latest.description}</p>
          )}
          <EpisodeHeader
            key={latest.slug}
            audioUrl={latest.audioUrl}
            title={latest.title}
            duration={latest.duration}
          />
          <a href={`/episodes/${latest.slug}`}>
            Notes, sources, and transcript ↗
          </a>
        </section>
      )}
      <div className="show-subscriptions">
        <EmailSubscription inputId="home-email" />
        <LiveRecording />
      </div>
      <section className="home-starters" aria-labelledby="starter-title">
        <p className="eyebrow">Start here</p>
        <h2 id="starter-title">A few good places to start.</h2>
        <p>Three episodes to get to know the show.</p>
        <div className="conversation-grid">
          {starters.map((episode) => (
            <article key={episode.slug}>
              <time dateTime={episode.date}>{shortDate(episode.date)}</time>
              <h3>
                <a href={`/episodes/${episode.slug}`}>
                  {cardTitle(episode.title)}
                </a>
              </h3>
              <a href={`/episodes/${episode.slug}`}>Listen to the episode ↗</a>
            </article>
          ))}
        </div>
      </section>
      <section className="archive" id="archive" aria-labelledby="archive-title">
        <div className="section-heading">
          <h2 id="archive-title">Recent episodes</h2>
          <p>{archive.length} conversations and counting.</p>
        </div>
        <ArchiveList episodes={recent.slice(0, 6)} />
        {recent.length > 6 && (
          <details className="archive-more">
            <summary>Explore {recent.length - 6} more episodes</summary>
            <ArchiveList episodes={recent.slice(6)} />
          </details>
        )}
        <div className="archive-tools">
          <Link to="/links">Explore the source library ↗</Link>
          <Link to="/search">Search the show ↗</Link>
        </div>
      </section>
    </div>
  );
}
