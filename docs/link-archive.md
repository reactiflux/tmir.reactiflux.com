# Links archive

The Links page helps developers follow subjects through the show's history.
It opens with subjects and search, then shows dated resources with a compact
link to the relevant episode discussion. Dates are episode dates, not source
publication dates. Oldest-first is the default; readers can reverse it, filter
by year, and share their current filters through the URL.

`src/content/link-subjects.ts` defines the initial subjects and their matching
rules. Rules use link titles, source URLs, and parent outline headings. Resources
can belong to multiple subjects. Search also uses this context, expands RSC to
React Server Components and React Forget to React Compiler, and requires all
entered words to match. It is text search, not question answering.

Subject coverage is a starting point, not an exhaustive classification of the
archive. No tagging step is required when publishing. To correct a specific
link, add its original URL to `SUBJECT_CORRECTIONS`, for example:

```ts
"https://example.com/article": {
  add: ["server-components"],
  remove: ["frameworks"],
},
```

For recurring terminology, update a subject's pattern instead. Keep associations
specific: a mention of Next.js alone does not establish that a link is about RSCs.
Rules do not inspect fetched article content or infer the source's author.

`buildLinkResources` groups repeated URLs, removing only known tracking
parameters. Meaningful query parameters and fragments stay distinct. Every
distinct discussion is retained, with alternate outline titles available to
search. Filtering by year applies to appearances in that year, including later
mentions of older resources.

Discussion links use verified transcript anchors, including parent headings and
unique equivalent headings with RSC abbreviations expanded. Timed entries can
fall back to the preceding transcript section. Entries without a reliable
anchor open the episode and are labeled accordingly.

The page remains static HTML with a small inline script. It shows 24 resources
at a time, with an explicit Show more button. Without JavaScript, the complete
archive is available in a native disclosure for browser Find and ordinary links.
