import { createFileRoute } from "@tanstack/react-router";
import { PagefindUI } from "../components/PagefindUI";
import { SITE_NAME, SITE_URL, ogMeta } from "../content/site.ts";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: `Search — ${SITE_NAME}` },
      { name: "robots", content: "noindex" },
      ...ogMeta({
        title: `Search — ${SITE_NAME}`,
        description: `Search every ${SITE_NAME} transcript.`,
        url: `${SITE_URL}/search`,
      }),
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/search` }],
  }),
  component: Search,
});

function Search() {
  return (
    <section className="search-page" data-pagefind-ignore="">
      <header className="search-intro">
        <p className="eyebrow">The conversation, searchable</p>
        <h1>Search transcripts</h1>
        <p>Find the idea you remember. Discover the discussion you missed.</p>
      </header>
      <noscript>
        <p>
          Search needs JavaScript. Every transcript is on its episode page, and
          your browser&rsquo;s find-in-page works there.
        </p>
      </noscript>
      <PagefindUI />
    </section>
  );
}
