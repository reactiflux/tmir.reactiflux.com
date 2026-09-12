# standard.site: where things stand

Last verified 2026-09-12 against the live site and the show account's PDS.

## What exists

The site is a [standard.site](https://standard.site) publication on the show's
Bluesky account (`did:plc:yfqlzwi66ubgasg5z6pjiudc`, PDS
`chaga.us-west.host.bsky.network`). Three pieces make that true:

| Piece                                                  | Where                              | State                                      |
| ------------------------------------------------------ | ---------------------------------- | ------------------------------------------ |
| `site.standard.publication` record                     | PDS, rkey `3mv7ywdzpzz2y`          | Live                                       |
| `/.well-known/site.standard.publication`               | `public/.well-known/`, committed   | Live, `text/plain`, matches the record     |
| `site.standard.document` record per episode            | PDS, one TID per episode           | Only 2026-08 so far                        |
| `<link rel="site.standard.document">` per episode page | Rendered from `atUri` front matter | None live yet                              |
| Bluesky reply thread as comments                       | `data-thread` on the episode page  | Live on every episode with a `bskyPostUrl` |

The publication URI is public and only changes if the record is deleted and
recreated, so the well-known file is a plain committed file rather than a
build-time artifact.

## How the pieces connect

`scripts/publish-atproto.ts` is the only writer. Per run it:

1. Reuses the account's existing publication record, or creates one.
2. For each episode, builds a document record from the markdown: title, date,
   description, outline as plain text, link hostnames as tags, and a strong
   ref to the announcement post when `bskyPostUrl` is set.
3. Finds the existing record by the `atUri` in front matter, or by `path` if
   front matter lost it, and updates it in place. Otherwise creates one.
4. Writes the record's URI back into the episode file as `atUri`.

Both lexicons use TID keys, so the PDS assigns rkeys. Idempotency comes from
those lookups, never from a fixed key.

The episode page emits the `<link>` tag only when `atUri` is present. So the
front matter write is what makes an episode discoverable, and it has to be
committed and deployed. Nothing on the site reads the PDS at build time.

## Starting to use it

Needs `ATPROTO_HANDLE`, `ATPROTO_APP_PASSWORD` and `VITE_SITE_URL` in `.env`.

1. **Backfill the archive once.** `npm run publish-atproto` with no argument
   publishes every episode and rewrites their front matter. Commit those
   files and push. After the deploy, every episode page carries its link tag.
2. **Per episode, after `npm run publish -- <yyyy-mm>`.** Run
   `npm run publish-atproto -- <yyyy-mm>` and commit the one-line change.
   Already step 7 in the README's release checklist.
3. **Set `VITE_ATPROTO_DID` in Netlify** to the DID above. Only the comments
   widget needs it, and only for episodes whose `bskyPostUrl` uses a handle
   instead of a DID. Recent episodes already carry the DID.

## Checking it

- Records: open `https://pdsls.dev/at://<uri>` for any URI, or list a
  collection directly from the PDS with `com.atproto.repo.listRecords`.
- Publication discovery: `curl https://tmir.reactiflux.com/.well-known/site.standard.publication`
  should print the publication URI.
- Document discovery: view source on an episode page and search for
  `site.standard.document`. The href should equal that episode's `atUri`.
- `npm run check` after a build asserts the well-known file exists and that
  every episode with `atUri` renders the link tag.

There is no official validator. Leaflet is the one consumer known to resolve
publications by domain.

## Open questions

- Document `path` is `/episodes/<slug>` but Netlify redirects to a trailing
  slash. Consumers that follow redirects are fine; strict ones will see a
  mismatch with `<link rel="canonical">`.
- `textContent` includes outline URLs. The lexicon asks for plain text with no
  formatting. Probably fine, but untested against any consumer.
- `contributors` is omitted because the lexicon requires a DID per person and
  the Transistor feed has none. Hand-maintaining the hosts' DIDs in
  `src/content/people.ts` would fill it.
