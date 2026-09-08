import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Outline } from "../components/EpisodeBody";
import { Player } from "../components/Player";
import { SITE_NAME, SITE_URL, ogMeta } from "../components/Document";
import type { OutlineItem } from "../content/parse.ts";

const HOME_DESCRIPTION = `Every episode of ${SITE_NAME}, with transcripts and links.`;

const getHome = createServerFn().handler(async () => {
  const { loadEpisodes } = await import("../content/load.ts");
  const episodes = await loadEpisodes();
  const latest = episodes[0];
  return {
    latest: latest
      ? {
          slug: latest.slug,
          title: latest.title,
          audioUrl: latest.audioUrl,
          outline: latest.outline as OutlineItem[],
        }
      : null,
    archive: episodes.map((e) => ({
      slug: e.slug,
      title: e.title,
      date: e.date,
      description: e.description,
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

function Home() {
  const { latest, archive } = Route.useLoaderData();
  return (
    <>
      {latest && (
        <section className="latest">
          <h1>
            <a href={`/episodes/${latest.slug}`}>{latest.title}</a>
          </h1>
          <Player audioUrl={latest.audioUrl} title={latest.title} />
          <Outline items={latest.outline} />
        </section>
      )}
      <section className="archive">
        <h2>Archive</h2>
        <ul>
          {archive.map((e) => (
            <li key={e.slug}>
              <a href={`/episodes/${e.slug}`}>{e.title}</a>
              <time dateTime={e.date}>{e.date}</time>
              <p>{e.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
