# This Month in React: site design

Date: 2026-09-08
Status: approved for planning

## Executive summary

This Month in React (TMiR) is a monthly news podcast hosted by Carl Vitullo
and Mark Erikson. Its archive of roughly forty episodes lives today as
hand-edited markdown transcripts inside the reactiflux.com repository,
rendered by an aging Next.js site. Audio and episode metadata live on
Transistor. Editing happens in Descript.

This project gives the show a standalone site that is the canonical home
for every episode, its transcript, and the curated links discussed in it.
The site is built on TanStack Start with React Server Components and full
static prerendering, hand-written modern CSS, and no client JavaScript
except where a person interacts with something. The stack is chosen to
demonstrate, not just claim, fluency with the ecosystem the show covers.

### How publishing works in practice

1. Record and edit the episode in Descript, as today. Publish audio to
   Transistor, as today.
2. Write the outline in the episode's markdown file: a nested list of
   topics, each with a link and a timestamp. This is the same list that
   becomes the table of contents, the Transistor chapters, the link index,
   and the newsletter body.
3. Run one command with the Descript project ID. It exports the transcript
   with speaker labels, appends it to the markdown file, and pushes a
   speaker-labelled SRT to the Transistor episode so podcast apps get
   captions.
4. Run the ingest command. It reads the Transistor feed and fills in the
   episode's audio URL, duration, season, episode number, and people.
5. Commit and push. Netlify builds the site, prerenders every page, and
   regenerates the search index, link index, and RSS feed.

Nothing in that flow requires opening a text editor except step 2, and
step 2 is the editorial work the hosts already do.

### What a subscriber experiences

- A listener lands on an episode page and sees the player, the outline as
  a clickable table of contents, and the full transcript with speakers
  named. Clicking any timestamp seeks the audio. The page is static HTML
  and loads instantly with no JavaScript required for reading.
- A reader who wants "that library Mark mentioned three months ago" opens
  the link index, types a word, and sees every matching link across every
  episode with the episode and timestamp it came from.
- A searcher types a phrase into the search box and gets transcript hits
  across all episodes, served from a prebuilt index with no server.
- A subscriber enters an email address on the about page. When the next
  episode publishes, they receive its outline with links, sent
  automatically from the site's RSS feed by Buttondown. Podcast app
  listeners see chapters and captions in their app.
- Everyone can subscribe through Spotify, Apple Podcasts, or RSS from any
  page.

## Goals

- One canonical, standalone site for TMiR on its own domain.
- Every past episode migrated with transcript, outline, and links intact.
- A publish flow that is one or two commands after editorial work.
- A stack and visual execution that reads as expert to the show's audience.

## Non-goals for launch

- Audio-synced transcript highlighting as playback progresses.
- Office Hours, Community Spotlight, or other non-TMiR episodes.
- Analytics, comments, or any server-side runtime.
- Replacing Transistor as the podcast RSS host.

## Content model

Content is the source of truth and lives in this repository. One markdown
file per episode at `content/episodes/<yyyy>-<mm>.md`.

### Front matter

Hand-written fields:

| Field         | Type   | Notes                                                   |
| ------------- | ------ | ------------------------------------------------------- |
| `title`       | string | Episode title as published                              |
| `date`        | date   | Recording date, ISO                                     |
| `description` | string | One paragraph, used for meta tags and the archive list  |
| `time`        | string | Live show time, e.g. `2pm PT / 9pm GMT`, optional       |
| `location`    | string | Live show location, optional                            |

Fields written by the ingest script, never by hand:

| Field           | Type     | Source                                    |
| --------------- | -------- | ----------------------------------------- |
| `transistorId`  | string   | Share ID from the episode `link`          |
| `audioUrl`      | string   | Enclosure URL                             |
| `duration`      | number   | Seconds, from `itunes:duration`           |
| `season`        | number   | `podcast:season`                          |
| `episode`       | number   | `podcast:episode`                         |
| `people`        | list     | `podcast:person`: name, role, href, img   |

Ingest matches feed items to files by the `yyyy-mm` in the feed title,
which every TMiR title carries as `TMiR yyyy-mm:` or as a month name plus
year in older titles. Chapters are not ingested; the outline carries them.

### Body

Two sections in fixed order.

**Outline.** A nested markdown list. Each item is
`[[hh:mm:ss](#anchor)] [Title](url)` or a variant without a link or
without a timestamp. Nesting depth is arbitrary. Anchors are derived from
the title text by the same slug rule everywhere.

**Transcript.** Introduced by a level-one heading `# Transcript`. Level-two
headings mark sections and must match outline titles. Paragraphs begin
with `**Speaker Name:**` when the speaker changes and end with a
`[hh:mm:ss]` timestamp. Consecutive paragraphs by the same speaker omit
the name.

### Parsed structure

One parser module turns a file into:

```
Episode {
  slug, title, date, description, time?, location?,
  transistorId?, audioUrl?, duration?, season?, episode?, people[],
  outline: OutlineItem[]      // { title, url?, time?, anchor, children[] }
  sections: Section[]         // { title, anchor, time, segments[] }
}
Segment { speaker, time, text }
```

Every route, the link index, the search index, the RSS feed, chapters
JSON, and the SRT exporter consume this structure. Nothing else reads
markdown.

## Scripts

Plain TypeScript run with Node's native type stripping. No task runner.

### `migrate`

One-time. Reads every `tmir-*.md` in the reactiflux.com transcripts
directory and writes a canonical file. The historical files do not fall
into clean eras; each feature varies independently across the corpus:
embed and style blocks present or absent, outline present or absent with
`mm:ss` or `hh:mm:ss` anchors, timestamps leading or trailing a
paragraph, section headings at level one or two, and speaker labels as
full names, first names, or raw Descript identifiers. The script detects
each feature on its own rather than branching on a format version.

The transcript boundary is the first speaker paragraph, not the first
level-one heading, because one file has a level-one heading inside its
outline. One file, 2025-06, has an outline with no timestamps because
that month's recording failed; migrate carries it through with a warning.

The script strips embeds and style blocks, normalizes timestamps to
`hh:mm:ss`, promotes level-one section headings to level-two, re-derives
anchors from titles, synthesizes an outline from section headings when
none exists, and writes a report listing every file and any paragraph it
could not attribute to a speaker or timestamp. Unresolved cases are fixed
by hand.

### `ingest`

Fetches the Transistor feed, filters items to TMiR, matches each to an
episode file, and rewrites only the ingest-owned front matter fields.
Idempotent. Reports feed items with no matching file and files with no
matching feed item.

### `publish-transcript <yyyy-mm> <descript-project-id>`

1. Calls the Descript transcript export endpoint for Markdown with
   speaker labels on every paragraph and second-resolution timecodes.
2. Normalizes speaker names through a small map in the script, for
   example `1-vcarl` to `Carl Vitullo`.
3. Replaces everything below `# Transcript` in the episode file.
4. Generates SRT with speaker prefixes from the parsed transcript and
   sends it as the episode's transcript text through the Transistor API,
   which accepts transcript content as a string and has no separate
   caption file upload. The episode's numeric API id is resolved by
   listing the show's episodes and matching the share URL to
   `transistorId`.

Requires `DESCRIPT_TOKEN`, `TRANSISTOR_API_KEY`, and `TRANSISTOR_SHOW_ID`
in the environment.
Steps 3 and 4 can be run independently with flags so a hand-edited
transcript can still be pushed.

## Site

### Stack

- TanStack Start, React 19, Vite. RSC enabled through the Vite RSC plugin.
- Full static prerender of every route, with link crawling so a broken
  internal link fails the build.
- Netlify, deployed through the official Netlify TanStack Start plugin.
- Pagefind, run after build, for full-text search.
- Site name and canonical URL are read from environment at build time so
  the domain can be set when it is registered.

### Routes

| Route                 | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `/`                   | Latest episode with player and outline, then the archive     |
| `/episodes/<yyyy-mm>` | Player, outline as table of contents, transcript             |
| `/links`              | Every outline link across all episodes, grouped and filterable |
| `/search`             | Pagefind UI                                                  |
| `/about`              | Hosts, guests, subscribe links, live schedule, newsletter form |
| `/feed.xml`           | RSS of episode pages; item body is the rendered outline      |
| `/episodes/<yyyy-mm>/chapters.json` | Podcasting 2.0 chapters derived from the outline |

### Rendering split

Two rendering paths coexist in one TanStack Start build.

**Static documents** for content-heavy pages: `/episodes/<yyyy-mm>` and
`/links`. A server route handler renders a complete HTML document with
`renderToStaticMarkup` and the prerender step writes it to a file. The
content appears once in the HTML, there is no hydration, and the only
JavaScript is a small inline script: on episode pages it seeks the native
`<audio>` element when a timestamp is clicked; on the links page it
filters the already-rendered list by text. These pages sit outside the
router, so navigating into them is a full document load.

**Router pages** for `/`, `/about`, and `/search`. These are ordinary
TanStack Start routes, prerendered, with the framework runtime and
hydration. RSC stays enabled in the build so future supporting pages can
use server components. The player on `/` is a client component.

Both paths share one `Document` component for the head, stylesheet, and
navigation so the two kinds of page look identical.

**Why not RSC or loaders for transcripts.** Both inline a serialized copy
of the rendered data into the HTML for hydration, doubling an hour-long
transcript page from about 100 KB to about 200 KB. The router offers no
per-route way to keep server-rendered markup while omitting that copy.
Measured during the risk-gate spike on TanStack Start 1.168.

### Link index

Built at build time from every outline item with a URL. Each entry
records the link text, URL, hostname, episode slug, episode title, and
timestamp. The page groups by hostname, sorted by count, and offers a
client-side text filter over link text and hostname. Bare timestamps and
items without URLs are excluded.

### Newsletter

The site provides two things: the RSS feed at `/feed.xml` whose items
carry the full outline as HTML, and a plain HTML form on `/about` posting
to Buttondown's embed-subscribe endpoint. Buttondown's RSS-to-email
feature does the sending. Account setup and the Buttondown username are
outside this repository; the form action reads the username from
environment at build time.

### CSS

One hand-written stylesheet organized in cascade layers: reset, tokens,
layout, components, utilities. Techniques in use, each with a specific
job:

- Container queries for the episode page layout, so the outline sits
  beside the transcript when space allows and above it otherwise.
- Cross-document view transitions, so navigation between static
  documents and router pages animates the same way.
- Native light and dark color scheme through `light-dark()` with colors
  in oklch.
- Anchor positioning to pin the player relative to the transcript column.
- `text-wrap: balance` on headings and `text-wrap: pretty` on body copy.

No preprocessor, no utility framework, no CSS-in-JS.

## Risk gate

Completed 2026-09-08 as a throwaway spike, discarded. Findings on
TanStack Start 1.168.50, React 19.2.8, Vite 8.2.2:

- RSC plus prerender plus the Netlify plugin builds and emits static HTML.
- RSC and plain loader routes both duplicate content in the HTML; a
  server route handler emitting a static document does not. This drove
  the rendering split above.
- The framework runtime on router pages is about 109 KB gzipped.
- Dynamic routes need explicit prerender page entries or must be reachable
  by link crawling from `/`.

## Testing

- Parser: unit tests with one fixture per historical format and one
  canonical fixture. Assertions on section count, segment count, speaker
  attribution, timestamp normalization, and outline nesting.
- Migrate: runs against the fixtures and asserts the canonical output
  round-trips through the parser to identical structure.
- Ingest: unit test against a saved copy of the feed asserting field
  extraction and title matching for both title styles.
- SRT export: one test asserting cue numbering, time format, and speaker
  prefix.
- Site: the prerender crawl is the integration test. A build that emits
  every expected route with no broken internal links passes.
- No browser end-to-end suite at launch.

## Open items outside this repository

- Register the domain and set it in Netlify environment.
- Create the Buttondown account and point its RSS feature at `/feed.xml`.
- Generate a Descript API token and a Transistor API key.
- After launch, add redirects from reactiflux.com transcript URLs.
