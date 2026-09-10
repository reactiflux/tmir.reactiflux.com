# This Month in React

The podcast's website and the pipeline that publishes it. Every episode is one
markdown file in `content/episodes/`; the site, the RSS feed, the chapters, the
link index, the search index and the share images are all derived from those
files at build time.

## Publishing an episode

One command. Run it again each time it stops — it picks a pass based on what
the file already has.

1. Record and edit in Descript; publish the audio to Transistor.

2. `npm run publish -- 2026-08` — creates `content/episodes/2026-08.md`,
   taking the title and date from the Transistor feed.

3. Fill that file in: paste your show notes as a nested bullet list of links
   and prose, write a one-sentence `description`, and put the Descript project
   id in `descriptProjectId`. **Timestamps are not your job.**

4. `npm run publish -- 2026-08` — pairs your list against the chapter marks
   in the Transistor feed and rewrites it as the finished outline, with
   timestamps and anchors. It prints
   any line it couldn't match and any chapter nothing claimed, then stops so
   you can look. That one outline becomes the table of contents, the chapters,
   the link index and the newsletter body.

5. `npm run publish -- 2026-08` — ingests the feed, checks the episode really
   has audio, pulls the transcript and pushes an SRT back to Transistor.

6. Commit and push. Netlify does the rest, and Buttondown mails the outline to
   subscribers when it sees the new `/feed.xml` item.

7. `npm run publish-atproto -- 2026-08` — posts the episode to the show's AT
   Protocol account and writes the record's URI back into the front matter.
   Commit that one-line change.

If only one step needs redoing, `npm run publish-transcript -- 2026-08 <id>`
(with `--skip-descript` / `--skip-transistor`) and `npm run ingest` still run on
their own.

`npm run ingest` also creates a file for any feed item that doesn't have one
yet. That is how the Reactiflux Office Hours and Reactiflux Spotlight episodes
reach the site: they are slugged `<yyyy-mm>-office-hours-<tail>` /
`<yyyy-mm>-spotlight-<tail>`, carry a `series` front matter field that labels
them everywhere they appear, and have no outline or transcript.

## Working on the site

```bash
cp .env.example .env   # the authoritative list of variables, one comment each
npm install
npm run dev            # http://localhost:3000
```

| Command             | Effect                                                   |
| ------------------- | -------------------------------------------------------- |
| `npm run build`     | prerenders every route, then the share images and search |
| `npm run check`     | asserts the built output and prints its sizes            |
| `npm test`          | unit tests                                               |
| `npm run typecheck` | TypeScript 7 (native tsc) over src, scripts, tests       |
| `npm run doctor`    | react-doctor; fails on warnings                          |
| `npm run format`    | Prettier                                                 |

Credentials and build variables share one gitignored `.env`; Vite reads the
`VITE_`-prefixed ones and the npm scripts pass `--env-file-if-exists`. Netlify
needs the same values set in its own build environment. Every `VITE_` variable
is optional — unset, it just omits its feature.

## How the site works

TanStack Start, prerendered to static files. There is no server in production:
`dist/client` is the entire deployment.

Episode pages and `/links` are rendered once to HTML and ship **zero
JavaScript** — no framework runtime, no hydration, just a little inline script
for timestamp seeking and link filtering. An hour-long transcript is heavy
enough that inlining a second copy of it for hydration, which a normal
component tree would do, roughly doubles the page. The home, about and search
pages are ordinary router pages and do load the runtime.

Each episode gets a 1200×630 share card generated at build time — artwork
beside the title, month, hosts and runtime — so links unfurl properly in
Discord and Slack, alongside the usual `og:`/`twitter:` tags and podcast
JSON-LD.

The site is also a standard.site publication: episodes carry a
`site.standard.document` link, and one with an announcement post gets a "Reply
on Bluesky" link and its reply thread fetched from the public API. That fetch is
the only external request an episode page makes, and the page reads fine
without it.

Routes: `/` · `/episodes/<yyyy-mm>` · `/links` · `/search` · `/about` ·
`/feed.xml` · `/sitemap.xml` · `/robots.txt` ·
`/episodes/<yyyy-mm>/chapters.json` · `/og/<yyyy-mm>.jpg`. A broken internal
link fails the build, because the prerenderer crawls from `/`; routes no link
reaches are listed in `vite.config.ts`.
