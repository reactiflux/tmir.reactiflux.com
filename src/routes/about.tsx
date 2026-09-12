import { createFileRoute } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { Document, OgTags } from "../components/Document";
import { SITE_NAME, SITE_URL } from "../content/site.ts";

import {
  EmailSubscription,
  LiveRecording,
  PodcastLinks,
} from "../components/ShowSubscription";
import { PersonIdentity, ProfileLinks } from "../components/PersonIdentity";
import { canonicalPersonName, personProfile } from "../content/people.ts";

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

async function getAbout() {
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
}

const TITLE = `About — ${SITE_NAME}`;
const URL = `${SITE_URL}/about`;

export const Route = createFileRoute("/about")({
  server: {
    handlers: {
      GET: async () => {
        const html = renderToStaticMarkup(
          <Document>
            {/* React 19 hoists these into <head> during server rendering. */}
            <title>{TITLE}</title>
            <meta name="description" content={ABOUT_DESCRIPTION} />
            <link rel="canonical" href={URL} />
            <OgTags title={TITLE} description={ABOUT_DESCRIPTION} url={URL} />
            <About {...await getAbout()} />
          </Document>,
        );
        return new Response(`<!DOCTYPE html>${html}`, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
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

function About({
  hosts,
  formerHosts,
  guests,
}: Awaited<ReturnType<typeof getAbout>>) {
  return (
    <div className="evergreen-page">
      <div className="people-intro">
        <header>
          <p className="eyebrow">About {SITE_NAME}</p>
          <h1>
            React, with
            <br />
            <em>some perspective.</em>
          </h1>
          <p className="lead">
            A monthly conversation with a Redux maintainer and a Reactiflux
            community leader. Technical details, practical experience, and
            questions worth talking through.
          </p>
          <EmailSubscription inputId="bd-email" />
        </header>
        <section className="people-portraits" aria-labelledby="hosts-heading">
          <h2 className="sr-only" id="hosts-heading">
            Your hosts
          </h2>
          {hosts.toReversed().map((host) => (
            <article key={host.name}>
              <div className="people-portrait">
                {host.img && (
                  <img
                    src={host.img}
                    alt={host.name}
                    width="320"
                    height="320"
                  />
                )}
                <span className="role">{host.role}</span>
              </div>
              <h2>
                <a
                  className="person-name"
                  href={personProfile(host.name).episodesUrl}
                  title={`Hear ${host.name} on Transistor`}
                >
                  {host.name}
                </a>
              </h2>
              <ProfileLinks
                name={host.name}
                profile={personProfile(host.name, host.href)}
              />
              <p>{host.bio}</p>
            </article>
          ))}
        </section>
      </div>
      <div className="show-subscriptions">
        <section aria-labelledby="podcast-heading">
          <p className="eyebrow">Take the conversation with you</p>
          <h2 id="podcast-heading">Follow in your podcast app.</h2>
          <PodcastLinks />
        </section>
        <LiveRecording />
      </div>
      <section className="about-context" aria-labelledby="conversation-heading">
        <div>
          <h2 id="conversation-heading">
            A conversation worth keeping up with.
          </h2>
          <p>
            Each month, Carl Vitullo and Mark Erikson bring the releases,
            projects, posts, and debates they’ve been following into a
            conversation recorded live in Reactiflux. We connect new
            developments to the history behind them and the practical questions
            they raise—with room for disagreement and things we haven’t figured
            out yet.
          </p>
          <p>
            Bring your own experience and judgment. Chapters, transcripts, and
            source links let you follow a thread further and draw your own
            conclusions.
          </p>
        </div>
        <div className="about-contact">
          <h2>Keep in touch.</h2>
          <p>
            Have a topic, a useful link, or feedback? Write to{" "}
            <a href="mailto:hello@reactiflux.com">hello@reactiflux.com</a>.
          </p>
          <div className="about-community-links">
            <a
              href={`https://bsky.app/profile/${new globalThis.URL(SITE_URL).hostname}`}
            >
              Follow on Bluesky ↗
            </a>
            {/* react-doctor-disable-next-line react-doctor/tanstack-start-no-anchor-element -- This page uses renderToStaticMarkup without a router provider. */}
            <a href="/links">Explore the source library ↗</a>
          </div>
        </div>
      </section>
      <section className="contributors" aria-labelledby="contributors-heading">
        <h2 id="contributors-heading">More voices from the show</h2>
        <h3>Former hosts</h3>
        <PersonList people={formerHosts} />
        {guests.length > 0 && (
          <>
            <h3>Past guests</h3>
            <PersonList people={guests} />
          </>
        )}
      </section>
    </div>
  );
}
