import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SITE_NAME, SITE_URL, ogMeta } from "../content/site.ts";

import { PersonIdentity, ProfileLinks } from "../components/PersonIdentity";
import { canonicalPersonName, personProfile } from "../content/people.ts";

const BUTTONDOWN_USER = import.meta.env.VITE_BUTTONDOWN_USER;
const BLUESKY_PROFILE_URL = import.meta.env.VITE_BLUESKY_PROFILE_URL;
const TRANSISTOR_FEED = "https://feeds.transistor.fm/this-month-in-react";

interface AboutPerson {
  name: string;
  role: string;
  href?: string;
  img?: string;
}

// Transistor's per-episode people data labels Carl "Producer" and lists guests
// sparsely, so who is a host is stated here rather than derived from it.
const HOSTS = [
  {
    name: "Carl Vitullo",
    role: "Product developer · Reactiflux community leader",
    bio: "Carl builds products and runs community programs at Reactiflux. He brings the perspective of a working developer and community organizer to questions about the tools we use and the people building them.",
  },
  {
    name: "Mark Erikson",
    role: "Redux maintainer · Software engineer",
    bio: "Mark maintains Redux and works on debugging and React analysis tools. He brings experience with library internals, performance, and the long-term work of maintaining software that other developers depend on.",
  },
];
const FORMER_HOSTS = [{ name: "Mo Javad", role: "Former co-host" }];
// The episode data uses first names for some hosts ("Mo"), so match on that.
const firstName = (name: string) => name.split(" ")[0];

const ABOUT_DESCRIPTION = `Meet Carl Vitullo and Mark Erikson, the hosts of ${SITE_NAME}: a monthly conversation about React, the web, and the work of building software.`;

const getAbout = createServerFn().handler(async () => {
  const { loadEpisodes } = await import("../content/load.ts");
  const episodes = await loadEpisodes();

  const byName = new Map<string, AboutPerson>();
  for (const episode of episodes) {
    for (const person of episode.people) {
      const name = canonicalPersonName(person.name);
      const entry = byName.get(name) ?? {
        name,
        role: "Guest",
      };
      entry.href ||= person.href;
      entry.img ||= person.img;
      byName.set(name, entry);
    }
    // Transistor tags no guests on the side series, so those names live in
    // front matter instead — carrying no link or photo, only a name.
    for (const guest of episode.guests) {
      const name = canonicalPersonName(guest);
      if (!byName.has(name)) byName.set(name, { name, role: "Guest" });
    }
  }

  const hostKeys = new Set(
    [...HOSTS, ...FORMER_HOSTS].map((h) => firstName(h.name)),
  );
  const people = [...byName.values()];
  const hosts = HOSTS.map((host) => {
    const data = people.find((p) => firstName(p.name) === firstName(host.name));
    return { ...host, href: data?.href, img: data?.img };
  });
  const formerHosts = FORMER_HOSTS.map((host) => {
    const data = people.find((p) => firstName(p.name) === firstName(host.name));
    return { ...host, href: data?.href, img: data?.img };
  });
  const guests = people.filter((p) => !hostKeys.has(firstName(p.name)));

  return { hosts, formerHosts, guests };
});

export const Route = createFileRoute("/about")({
  loader: () => getAbout(),
  head: () => ({
    meta: [
      { title: `About — ${SITE_NAME}` },
      { name: "description", content: ABOUT_DESCRIPTION },
      ...ogMeta({
        title: `About — ${SITE_NAME}`,
        description: ABOUT_DESCRIPTION,
        url: `${SITE_URL}/about`,
      }),
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/about` }],
  }),
  component: About,
});

function PersonList({ people }: { people: AboutPerson[] }) {
  return (
    <ul className="contributor-list">
      {people.map((person) => (
        <li key={person.name}>
          {person.img ? (
            <img
              src={person.img}
              alt=""
              width="48"
              height="48"
              loading="lazy"
            />
          ) : (
            <span className="contributor-avatar" aria-hidden="true">
              {person.name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
          )}
          <div>
            <PersonIdentity name={person.name} href={person.href} />
            {person.role !== "Guest" && (
              <span className="role">{person.role}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function About() {
  const { hosts, formerHosts, guests } = Route.useLoaderData();
  return (
    <div className="about-page">
      <header className="about-intro">
        <p className="eyebrow">About the show</p>
        <h1>A conversation worth keeping up with.</h1>
        <p className="lead">
          React and the web keep changing. {SITE_NAME} is a place to work
          through those changes together.
        </p>
        <p>
          Each month, Carl Vitullo and Mark Erikson bring the releases,
          projects, posts, and debates they’ve been following into a
          conversation recorded live in Reactiflux. We connect new developments
          to the history behind them and the practical questions they raise—with
          room for disagreement and things we haven’t figured out yet.
        </p>
        <p>
          Bring your own experience and judgment. Chapters, transcripts, and
          source links let you follow a thread further and draw your own
          conclusions.
        </p>
      </header>

      <section className="hosts-section" aria-labelledby="hosts-heading">
        <div className="section-heading">
          <h2 id="hosts-heading">Your hosts</h2>
        </div>
        <div className="host-grid">
          {hosts.map((host) => (
            <article className="host-profile" key={host.name}>
              {host.img && (
                <img
                  src={host.img}
                  alt={host.name}
                  width="320"
                  height="320"
                  loading="lazy"
                />
              )}
              <div className="host-bio">
                <h3>
                  <a
                    className="person-name"
                    href={personProfile(host.name).episodesUrl}
                    title={`Hear ${host.name} on Transistor`}
                  >
                    {host.name}
                  </a>
                </h3>
                <ProfileLinks
                  name={host.name}
                  profile={personProfile(host.name, host.href)}
                />
                <p className="role">{host.role}</p>
                <p>{host.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="community-panel"
        id="live"
        aria-labelledby="live-heading"
      >
        <p className="eyebrow">Recorded in Reactiflux</p>
        <h2 id="live-heading">Be part of the conversation.</h2>
        <p>
          We record live in the Reactiflux Discord community. Join us there for
          upcoming recording announcements and conversations with other
          developers working in React.
        </p>
        <a href="https://www.reactiflux.com/">Join Reactiflux ↗</a>
        <p>
          Have a topic, a useful link, or feedback? Write to{" "}
          <a href="mailto:hello@reactiflux.com">hello@reactiflux.com</a>.
        </p>
      </section>

      <section className="contributors" aria-labelledby="contributors-heading">
        <h2 id="contributors-heading">More voices from the show</h2>
        <h3>Former hosts</h3>
        <PersonList people={formerHosts} />
        {guests.length > 0 && (
          <>
            <h3>Past Guests</h3>
            <PersonList people={guests} />
          </>
        )}
      </section>

      <section
        className="subscribe-panel"
        id="subscribe"
        aria-labelledby="subscribe-heading"
      >
        <h2 id="subscribe-heading">See you next month.</h2>
        <p>
          Listen wherever you get podcasts, or follow the show notes for every
          episode’s outline and links.
        </p>
        <div className="action-row">
          <a
            className="button"
            href="https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH"
          >
            Spotify
          </a>
          <a
            className="button button-secondary"
            href="https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526"
          >
            Apple Podcasts
          </a>
          <a className="button button-secondary" href={TRANSISTOR_FEED}>
            Podcast RSS
          </a>
          <a className="button button-secondary" href="/feed.xml">
            Show notes RSS
          </a>
          {BLUESKY_PROFILE_URL && (
            <a className="button button-secondary" href={BLUESKY_PROFILE_URL}>
              Follow on Bluesky
            </a>
          )}
        </div>
      </section>

      {BUTTONDOWN_USER && (
        <section className="newsletter">
          <h2>Newsletter</h2>
          <p>Every episode&rsquo;s outline and links, in your inbox.</p>
          <form
            action={`https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USER}`}
            method="post"
          >
            <label htmlFor="bd-email">Email</label>
            <input
              id="bd-email"
              type="email"
              name="email"
              required
              autoComplete="email"
            />
            <button type="submit">Subscribe</button>
          </form>
        </section>
      )}
    </div>
  );
}
