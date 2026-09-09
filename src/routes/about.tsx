import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SITE_NAME, SITE_URL, ogMeta } from "../components/Document";

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
  { name: "Carl Vitullo", role: "Host" },
  { name: "Mark Erikson", role: "Host" },
  { name: "Mo Javad", role: "Former co-host" },
];
// The episode data uses first names for some hosts ("Mo"), so match on that.
const firstName = (name: string) => name.split(" ")[0];

const ABOUT_DESCRIPTION = `Who makes ${SITE_NAME}, and how to subscribe.`;

const getAbout = createServerFn().handler(async () => {
  const { loadEpisodes } = await import("../content/load.ts");
  const episodes = await loadEpisodes();

  const byName = new Map<string, AboutPerson>();
  for (const episode of episodes) {
    for (const person of episode.people) {
      const entry = byName.get(person.name) ?? {
        name: person.name,
        role: "Guest",
      };
      entry.href ||= person.href;
      entry.img ||= person.img;
      byName.set(person.name, entry);
    }
  }

  const hostKeys = new Set(HOSTS.map((h) => firstName(h.name)));
  const people = [...byName.values()];
  const hosts = HOSTS.map((host) => {
    const data = people.find((p) => firstName(p.name) === firstName(host.name));
    return { ...host, href: data?.href, img: data?.img };
  });
  const guests = people.filter((p) => !hostKeys.has(firstName(p.name)));

  const latest = episodes[0];
  return { hosts, guests, time: latest?.time, location: latest?.location };
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
    <ul>
      {people.map((person) => (
        <li key={person.name}>
          {person.img && (
            <img
              src={person.img}
              alt={person.name}
              width="48"
              height="48"
              loading="lazy"
            />
          )}
          {person.href ? (
            <a href={person.href} rel="noreferrer">
              {person.name}
            </a>
          ) : (
            person.name
          )}
          <span className="role">{person.role}</span>
        </li>
      ))}
    </ul>
  );
}

function About() {
  const { hosts, guests, time, location } = Route.useLoaderData();
  return (
    <div className="about-page">
      <h1>About {SITE_NAME}</h1>
      <p>A monthly news podcast about React and its ecosystem.</p>

      {time && (
        <section className="schedule">
          <h2>Live</h2>
          <p>
            Recorded live at {time}
            {location ? ` in ${location}` : ""}.
          </p>
        </section>
      )}

      <section className="people">
        <h2>Hosts</h2>
        <PersonList people={hosts} />
        {guests.length > 0 && (
          <>
            <h2>Guests</h2>
            <PersonList people={guests} />
          </>
        )}
      </section>

      <section className="subscribe">
        <h2>Subscribe</h2>
        <ul>
          <li>
            <a
              href="https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH"
              rel="noreferrer"
            >
              Spotify
            </a>
          </li>
          <li>
            <a
              href="https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526"
              rel="noreferrer"
            >
              Apple Podcasts
            </a>
          </li>
          <li>
            <a href={TRANSISTOR_FEED} rel="noreferrer">
              RSS
            </a>
          </li>
          <li>
            <a href="/feed.xml">Show notes by email/RSS</a>
          </li>
          {BLUESKY_PROFILE_URL && (
            <li>
              <a href={BLUESKY_PROFILE_URL} rel="noreferrer">
                Follow on Bluesky
              </a>
            </li>
          )}
        </ul>
        <p>
          This site is an AT Protocol publication (
          <a href="https://standard.site/" rel="noreferrer">
            standard.site
          </a>
          ), so every episode is also a record on the open network.
        </p>
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
