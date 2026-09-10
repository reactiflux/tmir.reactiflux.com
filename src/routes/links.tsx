import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { LINK_SUBJECTS, type SubjectId } from "../content/link-subjects.ts";
import { SITE_NAME, SITE_URL, ogMeta } from "../content/site.ts";

const PAGE = 24;
const DESCRIPTION =
  "Explore React subjects through the resources and conversations collected across the show’s history.";

type LinkSearch = {
  q?: string;
  subject?: SubjectId;
  year?: string;
  sort?: "newest" | "oldest";
  view?: "all";
  page?: number;
};

const getLinks = createServerFn()
  .inputValidator((search: LinkSearch) => search)
  .handler(async ({ data }) => {
    const [
      { episodes },
      { buildLinkIndex, buildLinkResources, filterResources },
      { LinkResults },
      { renderServerComponent },
    ] = await Promise.all([
      import("../content/bundled.ts"),
      import("../content/links.ts"),
      import("../components/LinkResults.tsx"),
      import("@tanstack/react-start/rsc"),
    ]);
    const resources = buildLinkResources(buildLinkIndex(episodes));
    const matches = filterResources(resources, data);
    const limit =
      data.view === "all" ? matches.length : (data.page ?? 1) * PAGE;
    const mentions = resources.flatMap((resource) => resource.mentions);
    const years = [
      ...new Set(mentions.map((mention) => mention.date.slice(0, 4))),
    ].sort();
    return {
      // Only this page of rows is serialized; the rest never leaves the server.
      results: await renderServerComponent(
        <LinkResults matches={matches.slice(0, limit)} />,
      ),
      total: matches.length,
      shown: Math.min(limit, matches.length),
      years,
      resourceCount: resources.length,
      episodeCount: new Set(mentions.map((mention) => mention.episodeSlug))
        .size,
      subjectCounts: LINK_SUBJECTS.map(
        (subject) =>
          resources.filter((resource) => resource.subjects.includes(subject.id))
            .length,
      ),
    };
  });

export const Route = createFileRoute("/links")({
  validateSearch: (search: Record<string, unknown>): LinkSearch => ({
    q:
      typeof search.q === "string" && search.q.trim()
        ? search.q.trim()
        : undefined,
    subject: LINK_SUBJECTS.find((subject) => subject.id === search.subject)?.id,
    year:
      typeof search.year === "string" && /^\d{4}$/.test(search.year)
        ? search.year
        : undefined,
    sort: search.sort === "oldest" ? "oldest" : undefined,
    view: search.view === "all" ? "all" : undefined,
    page: Number(search.page) > 1 ? Math.floor(Number(search.page)) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getLinks({ data: deps }),
  head: () => ({
    meta: [
      { title: `Links — ${SITE_NAME}` },
      { name: "description", content: DESCRIPTION },
      ...ogMeta({
        title: `Links — ${SITE_NAME}`,
        description: DESCRIPTION,
        url: `${SITE_URL}/links`,
      }),
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/links` }],
  }),
  component: Links,
});

function Links() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const heading = useRef<HTMLHeadingElement>(null);
  const [q, setQ] = useState(search.q ?? "");
  const filtered = Boolean(
    search.q || search.subject || search.year || search.view,
  );

  useEffect(() => setQ(search.q ?? ""), [search.q]);
  useEffect(() => {
    const value = q.trim() || undefined;
    if (value === search.q) return;
    const timer = setTimeout(
      () =>
        navigate({
          search: (prev) => ({ ...prev, q: value, page: undefined }),
          replace: true,
        }),
      250,
    );
    return () => clearTimeout(timer);
  }, [q, search.q, navigate]);

  // Move focus to the results after a deliberate filter change — but not while
  // typing in the search box, which would take focus away from the input.
  const settled = useRef(false);
  useEffect(() => {
    if (settled.current) heading.current?.focus();
    settled.current = true;
  }, [search.subject, search.year, search.sort, search.view]);

  return (
    <div className={filtered ? "link-library has-selection" : "link-library"}>
      <header className="links-intro">
        <p className="eyebrow">The conversation, collected</p>
        <h1>Follow the ideas.</h1>
        <p className="lead">
          Explore the people, projects, and turning points discussed on This
          Month in React. Open a source, or return to the conversation around
          it.
        </p>
        <p className="library-stats">
          {data.resourceCount.toLocaleString("en-US")} resources ·{" "}
          {data.episodeCount} episodes · {data.years[0]}–{data.years.at(-1)}
        </p>
      </header>
      {/* A real GET form, so the filters still work with no JavaScript. */}
      <form
        method="get"
        action="/links"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({
            search: (prev) => ({
              ...prev,
              q: q.trim() || undefined,
              page: undefined,
            }),
          });
        }}
      >
        <div id="archive-search">
          <label htmlFor="link-filter">Search the archive</label>
          <input
            id="link-filter"
            name="q"
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Try RSC, Waku, Dan Abramov…"
            autoComplete="off"
            aria-controls="resource-list"
          />
          <p className="search-hint">
            Search names, projects, sources, or words from the show notes.
          </p>
        </div>
        <div className="library-filters">
          <label>
            Subject
            <select
              name="subject"
              value={search.subject ?? ""}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    subject: (event.target.value || undefined) as SubjectId,
                    view: "all",
                    page: undefined,
                  }),
                })
              }
            >
              <option value="">All subjects</option>
              {LINK_SUBJECTS.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Discussed in
            <select
              name="year"
              value={search.year ?? ""}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    year: event.target.value || undefined,
                    view: "all",
                    page: undefined,
                  }),
                })
              }
            >
              <option value="">All years</option>
              {data.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order
            <select
              name="sort"
              value={search.sort ?? "newest"}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    sort:
                      event.target.value === "oldest" ? "oldest" : undefined,
                    view: "all",
                    page: undefined,
                  }),
                })
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <input type="hidden" name="view" value="all" />
          <button type="submit" className="explore-subjects">
            Filter
          </button>
        </div>
      </form>
      {filtered ? (
        <Link className="explore-subjects" to="/links" search={{}}>
          ← Explore subjects
        </Link>
      ) : (
        <section id="subject-browser" aria-labelledby="subjects-heading">
          <div className="subject-heading">
            <h2 id="subjects-heading" tabIndex={-1}>
              Start with a subject
            </h2>
            <Link to="/links" search={{ view: "all" }}>
              Browse all resources ↗
            </Link>
          </div>
          <div className="subject-grid">
            {LINK_SUBJECTS.map((subject, index) => (
              <Link
                className="subject-card"
                key={subject.id}
                to="/links"
                search={{ subject: subject.id, view: "all" }}
              >
                <div className="subject-card-top">
                  <h3>{subject.title}</h3>
                  <span aria-hidden="true">↗</span>
                </div>
                <p>{subject.description}</p>
                <span className="subject-count">
                  {data.subjectCounts[index]} resources
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div id="link-results">
        <div className="library-results-heading">
          <h2 id="results-heading" tabIndex={-1} ref={heading}>
            {LINK_SUBJECTS.find((subject) => subject.id === search.subject)
              ?.title ?? "Explore the archive"}
          </h2>
          <p id="link-count" role="status" aria-live="polite">
            {data.total
              ? `${data.shown} of ${data.total} resources${search.year ? ` discussed in ${search.year}` : ""}`
              : "No resources match these filters"}
          </p>
        </div>
        <p className="archive-date-note">
          Dates show when we discussed a resource, not when it was published.
        </p>
        {data.total === 0 && (
          <div id="links-empty">
            <h3>No matches yet.</h3>
            <p>Try fewer words, another year, or a broader subject.</p>
            <Link to="/links" search={{}}>
              Clear filters and explore subjects
            </Link>
          </div>
        )}
        {data.results}
        {data.shown < data.total && (
          <Link
            id="load-links"
            to="/links"
            search={(prev) => ({ ...prev, page: (prev.page ?? 1) + 1 })}
          >
            Show {Math.min(PAGE, data.total - data.shown)} more
          </Link>
        )}
      </div>
    </div>
  );
}
