# This Month in React

The podcast's content pipeline and website. Episode outlines and transcripts
live as markdown in `content/episodes/`; everything published — the site, the
RSS feed, the chapters, the newsletter body, the search index — is derived from
those files at build time.

## Setup

```bash
cp .env.example .env   # fill in what you need; every variable is optional for the site
npm install
npm run dev            # http://localhost:3000
```

## Site

TanStack Start, fully prerendered to static files. There is no server runtime in
production: `dist/client` is the whole deployment.

Two rendering paths share one `Document` component and one stylesheet:

- **Static documents** — `/episodes/<yyyy-mm>` and `/links`. A server route
  handler renders the whole page with `renderToStaticMarkup`. Content appears
  once in the HTML, there is no hydration, and the only JavaScript is a short
  inline script (timestamp seeking; link filtering).
- **Router pages** — `/`, `/about`, `/search`. Ordinary prerendered routes with
  the framework runtime, about 109 KB gzipped. RSC is enabled in the build for
  future supporting pages.

Transcripts are deliberately _not_ rendered through RSC or a router loader:
both inline a second serialized copy of the content for hydration, which
doubles an hour-long episode page.

### Commands

| Command                           | Effect                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                     | dev server on http://localhost:3000                                |
| `npm run build`                   | prerenders every route to `dist/client`, then runs Pagefind        |
| `npx pagefind --site dist/client` | rebuilds the search index by hand (`postbuild` does this normally) |
| `npm run check`                   | asserts the build output and prints sizes                          |
| `npm test`                        | unit tests                                                         |

### Environment variables

Every variable in this repo — build variables and script credentials alike —
lives in one gitignored `.env` at the repo root. Set it up with:

```bash
cp .env.example .env
```

`.env.example` is committed and is the authoritative list, one comment per
variable; this README does not duplicate it. Vite reads `.env` natively for the
`VITE_`-prefixed variables, and the npm scripts pass Node's
`--env-file-if-exists=.env` for the rest. There is no `dotenv` dependency.

The site's variables are all optional and all read at build time:
`VITE_SITE_NAME`, `VITE_SITE_URL`, `VITE_BUTTONDOWN_USER`,
`VITE_ATPROTO_PUBLICATION_URI`, `VITE_ATPROTO_DID`, `VITE_BLUESKY_PROFILE_URL`.
Each one that is unset simply omits its feature — the newsletter form, the
`/.well-known` file, the comments section, the Bluesky link.

Set the same values in Netlify's build environment (`.env` is not deployed).
`VITE_SITE_URL` must be set before launch or the feed will carry placeholder
URLs; it is also what `publish-atproto` writes as the publication `url`, so the
two can never disagree.

### Publishing an episode

1. Record and edit in Descript; publish the audio to Transistor.
2. Write the outline in `content/episodes/<yyyy>-<mm>.md` — a nested list of
   topics, each with a link and a timestamp. That one list becomes the table of
   contents, the chapters, the link index and the newsletter body.
3. `npm run publish-transcript <yyyy-mm> <descript-project-id>` — appends the
   speaker-labelled transcript and pushes an SRT to Transistor.
4. `npm run ingest` — fills in audio URL, duration, season, episode number and
   people from the Transistor feed.
5. Commit and push. Netlify builds the site, prerenders every page and
   regenerates the search index, link index and RSS feed. Buttondown picks up
   the new `/feed.xml` item and mails the outline to subscribers.
6. `npm run publish-atproto -- <yyyy-mm>` — writes the episode's
   `site.standard.document` record to the show's AT Protocol account, links it
   to the announcement post, and stores the record's AT URI in front matter as
   `atUri`. Commit that one-line change.

### AT Protocol

The site is a standard.site publication. `/.well-known/site.standard.publication`
carries the publication's AT URI, each episode page carries
`<link rel="site.standard.document">`, and — when the episode has an
announcement post — a "Reply on Bluesky" link plus a comments section that
fetches the reply thread from the public Bluesky API with a small inline
script. That fetch is the only external request an episode page makes, and the
page reads fine without it.

### Routes

`/` · `/episodes/<yyyy-mm>` · `/links` · `/search` · `/about` · `/feed.xml` ·
`/episodes/<yyyy-mm>/chapters.json`

Every one is a static file after the build. A broken internal link fails the
build, because the prerenderer crawls `<a href>` from `/`.

### Measured sizes

From a full production build of all 39 episodes on 2026-09-08
(`npm run build && npm run check`):

| Output                                           | Raw         | Gzip      |
| ------------------------------------------------ | ----------- | --------- |
| Router-page JS, all 5 chunks                     | 348,891 B   | 111,943 B |
| Largest episode document (`2025-12`)             | 202,568 B   | 52,362 B  |
| Newest episode document (`2026-07`)              | 140,274 B   | 37,407 B  |
| `/links`                                         | 517,905 B   | 77,456 B  |
| `/feed.xml`                                      | 192,573 B   | 55,130 B  |
| Pagefind index (`dist/client/pagefind`, on disk) | 2,609,725 B | —         |

Only the three router pages load the JS; episode and links documents reference
zero `/assets/*.js` — `npm run check` asserts that on every episode, along with
each transcript appearing exactly once.
