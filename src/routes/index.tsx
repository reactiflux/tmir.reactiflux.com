import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { NewsletterForm } from "../components/NewsletterForm";
import { Player } from "../components/Player";
import { SITE_NAME, SITE_URL, ogMeta } from "../content/site.ts";
import { jsonLd } from "../content/jsonld.ts";
import { BUTTONDOWN_URL } from "../content/newsletter.ts";
import { hms, isoDuration, shortDate } from "../content/time.ts";
import { cardTitle } from "../content/slug.ts";

const HOME_DESCRIPTION =
  "A monthly conversation about React, the web, and the work of building software, with Carl Vitullo and Mark Erikson. Releases, technical details, tradeoffs, and open questions.";

// Editorial selections point to parsed transcript sections so their anchors and
// timestamps stay consistent with the episode pages.
const CONVERSATIONS = [
  {
    slug: "2026-07",
    chapter: "Cross-framework benchmark measuring reactivity",
    title: "What are framework benchmarks actually measuring?",
    description:
      "Reactivity, DOM updates, and the gap between a benchmark and the application you're building.",
    label: "Performance · July 2026",
  },
  {
    slug: "2025-12",
    chapter: "Tech analysis: “Flight Protocol”",
    title: "How did React2Shell happen?",
    description:
      "A closer look at the Flight protocol, deserialization, and the security assumptions behind Server Components.",
    label: "React internals · December 2025",
  },
  {
    slug: "2026-02",
    chapter: "AI productivity and impacts on our attention",
    title: "What does working with AI do to our attention?",
    description:
      "Carl, Mark, and Mo work through the effects of coding agents on productivity, focus, and the shape of engineering work.",
    label: "Engineering work · February 2026",
  },
];

const getHome = createServerFn().handler(async () => {
  const [{ loadEpisodes }, { flattenLinks }] = await Promise.all([
    import("../content/load.ts"),
    import("../content/slug.ts"),
  ]);
  const episodes = await loadEpisodes();
  const latest = episodes[0];
  const mainTopics = latest?.outline.find((item) =>
    /^main content$/i.test(item.title),
  )?.children;
  const selectedTopics =
    latest?.slug === "2026-07"
      ? [
          "React org updates",
          "React-alikes",
          "TanStack removed RSCs from the website",
        ]
      : (mainTopics?.slice(0, 3).map((item) => item.title) ?? []);
  return {
    latest: latest
      ? {
          slug: latest.slug,
          title: latest.title,
          date: latest.date,
          duration: latest.duration,
          description: latest.description,
          audioUrl: latest.audioUrl,
          topics: selectedTopics
            .map((title) => {
              const section = latest.sections.find(
                (s) => flattenLinks(s.title) === title,
              );
              return section && { title, anchor: section.anchor };
            })
            .filter((topic) => topic !== undefined),
        }
      : null,
    conversations: CONVERSATIONS.map((selection) => {
      const episode = episodes.find((e) => e.slug === selection.slug);
      const section = episode?.sections.find(
        (s) => flattenLinks(s.title) === selection.chapter,
      );
      return (
        section && { ...selection, anchor: section.anchor, time: section.time }
      );
    }).filter((c) => c !== undefined),
    archive: episodes.map((e) => ({
      slug: e.slug,
      title: e.title,
      date: e.date,
      series: e.series,
      description: /^Join Carl, Mark/.test(e.description)
        ? e.outline
            .find((item) => /^main content$/i.test(item.title))
            ?.children.slice(0, 3)
            .map((item) => item.title)
            .join(" · ") || "Episode chapters, transcript, and source links."
        : e.description,
    })),
  };
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
  episodes: Awaited<ReturnType<typeof getHome>>["archive"];
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
  const { latest, archive, conversations } = Route.useLoaderData();
  return (
    <div className="home-page">
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
            webFeed: `${SITE_URL}/feed.xml`,
          }),
        }}
      />
      <section className="home-hero" aria-labelledby="show-promise">
        <div className="hero-copy">
          <p className="eyebrow">This Month in React</p>
          <h1 id="show-promise">
            What's changing in React. What it means for the web.
          </h1>
          <p className="lead">
            Join Carl Vitullo and Mark Erikson for a monthly conversation about
            React, the web, and the work of building software. Releases,
            technical details, tradeoffs, and open questions.
          </p>
          <div className="action-row">
            {latest && (
              <a className="button" href="#latest">
                Listen to the latest episode
              </a>
            )}
            <a className="button button-secondary" href="#subscribe">
              Subscribe
            </a>
          </div>
        </div>
        <div className="hero-artwork">
          <img
            src="/artwork.jpg"
            alt="This Month in React cover artwork"
            width="600"
            height="600"
            fetchPriority="high"
          />
        </div>
      </section>

      <ul className="show-facts" aria-label="About the show">
        <li>Monthly</li>
        <li>About an hour</li>
        <li>Recorded live in Reactiflux</li>
        <li>Chapters, transcripts &amp; source links</li>
      </ul>
      <div className="host-summary">
        <p>
          <strong>Carl Vitullo</strong> brings product development and
          Reactiflux community experience. <strong>Mark Erikson</strong> brings
          a Redux maintainer's perspective on React and its ecosystem.
        </p>
        <Link to="/about">
          Meet the hosts <span aria-hidden="true">↗</span>
        </Link>
      </div>

      {latest && (
        <section
          className="latest-feature"
          id="latest"
          aria-labelledby="latest-title"
        >
          <div className="feature-heading">
            <p className="eyebrow">Latest episode</p>
            <p className="episode-meta">
              <time dateTime={latest.date}>{shortDate(latest.date)}</time>
              {latest.duration != null && (
                <>
                  {" "}
                  ·{" "}
                  <time dateTime={isoDuration(latest.duration)}>
                    {hms(latest.duration)}
                  </time>
                </>
              )}
            </p>
          </div>
          <h2 id="latest-title">
            <a href={`/episodes/${latest.slug}`}>{cardTitle(latest.title)}</a>
          </h2>
          <p className="lead">{latest.description}</p>
          {latest.topics.length > 0 && (
            <ul className="feature-topics">
              {latest.topics.map((topic) => (
                <li key={topic.anchor}>
                  <a href={`/episodes/${latest.slug}#${topic.anchor}`}>
                    {topic.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Player audioUrl={latest.audioUrl} title={latest.title} />
          <a href={`/episodes/${latest.slug}`}>
            Full show notes, chapters &amp; transcript{" "}
            <span aria-hidden="true">↗</span>
          </a>
        </section>
      )}

      {conversations.length > 0 && (
        <section
          className="conversations"
          aria-labelledby="conversations-title"
        >
          <div className="section-heading">
            <h2 id="conversations-title">Conversations to explore</h2>
            <p>Pick a thread. Follow it further.</p>
          </div>
          <div className="conversation-grid">
            {conversations.map((conversation) => (
              <article key={conversation.slug}>
                <p className="eyebrow">{conversation.label}</p>
                <h3>
                  <a
                    href={`/episodes/${conversation.slug}#${conversation.anchor}`}
                  >
                    {conversation.title}
                  </a>
                </h3>
                <p>{conversation.description}</p>
                <a
                  className="chapter-link"
                  href={`/episodes/${conversation.slug}#${conversation.anchor}`}
                >
                  Explore the chapter
                  {conversation.time && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="chapter-time">{conversation.time}</span>
                    </>
                  )}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="archive" id="archive" aria-labelledby="archive-title">
        <div className="section-heading">
          <h2 id="archive-title">Recent episodes</h2>
          <p>{archive.length} conversations and counting.</p>
        </div>
        <ArchiveList episodes={archive.slice(0, 6)} />
        {archive.length > 6 && (
          <details className="archive-more">
            <summary>Explore all {archive.length} episodes</summary>
            <ArchiveList episodes={archive.slice(6)} />
          </details>
        )}
      </section>

      <section
        className="subscribe-panel"
        id="subscribe"
        aria-labelledby="subscribe-title"
      >
        <p className="eyebrow">Keep the conversation going</p>
        <h2 id="subscribe-title">Make room for a monthly catch-up.</h2>
        <p>
          Listen in your podcast app, dig into the source links, or join us live
          in Reactiflux.
        </p>
        <div className="action-row">
          <a
            className="button"
            href="https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526"
          >
            Apple Podcasts
          </a>
          <a
            className="button button-secondary"
            href="https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH"
          >
            Spotify
          </a>
          <a href="https://feeds.transistor.fm/this-month-in-react">
            Podcast RSS
          </a>
        </div>
        <p>
          <a href="/feed.xml">Show notes RSS</a> ·{" "}
          <Link to="/about" hash="live">
            Join a live recording
          </Link>
        </p>
        {BUTTONDOWN_URL && (
          <NewsletterForm
            className="newsletter"
            id="home-email"
            label="Get each episode's outline and links by email"
            placeholder="you@example.com"
            submitLabel="Subscribe by email"
            row
          />
        )}
      </section>
    </div>
  );
}
