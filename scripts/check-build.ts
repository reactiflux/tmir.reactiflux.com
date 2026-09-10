import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, globSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseEpisode } from "../src/content/parse.ts";

const dist = "dist/client";

function file(path: string): string | null {
  const full = join(dist, path);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

function hasFile(path: string) {
  assert.ok(file(path) !== null, `${path} exists`);
}

function contains(path: string, needle: string) {
  const body = file(path);
  assert.ok(body !== null, `${path} exists (looking for ${needle})`);
  assert.ok(
    body.includes(needle),
    `${path} contains ${JSON.stringify(needle)}`,
  );
}

function slugs(): string[] {
  return globSync("*.md", { cwd: "content/episodes" })
    .map((f) => f.slice(0, -".md".length))
    .sort();
}

const allSlugs = slugs();
const newest = allSlugs.at(-1);

/** Vite hashes the bundled stylesheet, so the URL is discovered, not spelled. */
function stylesheetPath(): string {
  const assets = readdirSync(join(dist, "assets")).filter(
    (f) => f.startsWith("index-") && f.endsWith(".css"),
  );
  assert.equal(assets.length, 1, "exactly one bundled stylesheet");
  return `assets/${assets[0]}`;
}

test("Shell", () => {
  hasFile("index.html");
  contains("index.html", 'class="site-nav"');
  contains("index.html", `href="/${stylesheetPath()}"`);
  // The skip link must precede the header on both rendering paths — the router
  // shell and the static document handlers build their own markup.
  for (const path of ["index.html", "links/index.html"]) {
    const html = file(path) || "";
    assert.ok(
      html.includes('class="skip-link" href="#main"') &&
        html.includes('id="main"') &&
        html.indexOf("skip-link") < html.indexOf("site-header"),
      `${path} has a skip link before the header`,
    );
  }

  contains("index.html", 'class="archive"');
  contains("index.html", 'id="latest"');
  contains("index.html", 'id="archive"');
  contains("index.html", "Carl Vitullo");
  contains("index.html", "Mark Erikson");
  for (const slug of allSlugs) contains("index.html", `/episodes/${slug}`);
});

test("Episode documents", () => {
  assert.ok(allSlugs.length > 0, "content/episodes has at least one episode");
  for (const slug of allSlugs) hasFile(`episodes/${slug}/index.html`);
  if (!newest) return;
  const path = `episodes/${newest}/index.html`;
  contains(path, "data-pagefind-body");
  contains(path, 'class="outline"');
  contains(path, "data-seconds=");
  contains(path, "<audio");
  contains(path, 'class="episode-controls"');
  contains(path, 'property="og:title"');
  const md = readFileSync(join("content/episodes", `${newest}.md`), "utf8");

  // AT Protocol bits are conditional on front matter and env, so only assert
  // them when the inputs are actually present.
  if (/^atUri:/m.test(md)) contains(path, 'rel="site.standard.document"');
  if (/^bskyPostUrl:/m.test(md)) {
    contains(path, "Reply on Bluesky");
    // The DID reaches the page through Vite's .env loading, not this process's
    // environment — so a post URL that already carries a DID is the reliable
    // signal that data-thread must have been derived.
    if (
      /^bskyPostUrl:.*profile\/did:/m.test(md) ||
      process.env.VITE_ATPROTO_DID
    ) {
      contains(path, 'data-thread="at://');
    }
  }
});

// /links is a router route: the loader renders the matching page of rows as an
// RSC, so the default document carries one page of results, not all 1,200.
const LINKS_MAX_BYTES = 75_000;

test("Links document", () => {
  hasFile("links/index.html");
  const html = file("links/index.html")!;
  assert.ok(
    html.length < LINKS_MAX_BYTES,
    `links/index.html is ${html.length} B, under the ${LINKS_MAX_BYTES} B cap`,
  );
  contains("links/index.html", 'id="subject-browser"');
  contains("links/index.html", 'class="link-row"');
  contains("links/index.html", 'id="link-filter"');
  // With no JavaScript the filters still work, as a plain GET form.
  assert.ok(
    /<form[^>]*method="get"[^>]*>/.test(html),
    "links/index.html filters submit as a GET form without JavaScript",
  );
});

test("Feed and chapters", () => {
  hasFile("feed.xml");
  contains("feed.xml", '<rss version="2.0"');
  contains("feed.xml", "<item>");
  for (const slug of allSlugs) {
    const body = file(`episodes/${slug}/chapters.json`);
    const json: unknown = body === null ? null : JSON.parse(body);
    assert.ok(
      json !== null &&
        typeof json === "object" &&
        (json as Record<string, unknown>).version === "1.2.0" &&
        Array.isArray((json as Record<string, unknown>).chapters),
      `episodes/${slug}/chapters.json is valid Podcasting 2.0`,
    );
  }
  const xml = file("feed.xml") || "";
  assert.ok(
    xml.startsWith('<?xml version="1.0"'),
    "feed.xml has an XML declaration",
  );
  assert.equal(
    (xml.match(/<channel>/g) || []).length,
    1,
    "feed.xml has exactly one <channel>",
  );
  assert.equal(
    (xml.match(/<item>/g) || []).length,
    allSlugs.length,
    `feed.xml has ${allSlugs.length} <item> elements`,
  );
});

test("Search", () => {
  hasFile("search/index.html");
  contains("search/index.html", 'id="pagefind-ui"');
  assert.ok(
    existsSync(join(dist, "pagefind", "pagefind-ui.js")),
    "pagefind index built — run: npx pagefind --site dist/client",
  );
  // PagefindUI injects the <script src="/pagefind/pagefind-ui.js"> at runtime,
  // so it never appears literally in the prerendered HTML. Instead confirm
  // search/index.html loads a JS chunk that references the pagefind asset.
  const html = file("search/index.html") || "";
  const chunkSrc = /href="(\/assets\/search-[^"]+\.js)"/.exec(html)?.[1];
  assert.ok(
    chunkSrc,
    "search/index.html references a /assets/search-*.js chunk",
  );
  const chunk = readFileSync(join(dist, chunkSrc.slice(1)), "utf8");
  assert.ok(
    chunk.includes("pagefind-ui.js"),
    `${chunkSrc} references pagefind-ui.js`,
  );
});

test("About", () => {
  hasFile("about/index.html");
  contains("about/index.html", 'id="hosts-heading"');
  contains("about/index.html", 'id="live"');
  contains("about/index.html", 'id="subscribe"');
  contains(
    "about/index.html",
    "https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH",
  );
  contains(
    "about/index.html",
    "https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526",
  );
  contains(
    "about/index.html",
    "https://feeds.transistor.fm/this-month-in-react",
  );
  contains("about/index.html", "mailto:hello@reactiflux.com");
  if (process.env.VITE_BLUESKY_PROFILE_URL)
    contains("about/index.html", "Follow on Bluesky");

  const about = file("about/index.html") || "";
  const bdUser = process.env.VITE_BUTTONDOWN_USER;
  if (bdUser) {
    assert.ok(
      about.includes(
        `https://buttondown.com/api/emails/embed-subscribe/${bdUser}`,
      ),
      "newsletter form present when VITE_BUTTONDOWN_USER is set",
    );
  } else {
    assert.ok(
      !about.includes("buttondown.com"),
      "newsletter form absent when VITE_BUTTONDOWN_USER is unset",
    );
  }
});

test("Design specimen", () => {
  hasFile("specimen/index.html");
  const html = file("specimen/index.html") || "";
  assert.match(
    html,
    /<h1\b[^>]*>Design specimen<\/h1>/,
    "specimen/index.html has a Design specimen heading",
  );
  assert.match(
    html,
    /<meta\b(?=[^>]*\bname="robots")(?=[^>]*\bcontent="[^"]*\bnoindex\b)[^>]*>/i,
    "specimen/index.html is noindex",
  );
  for (const path of ["index.html", "about/index.html"]) {
    assert.doesNotMatch(
      file(path) || "",
      /\bhref=["']\/specimen(?:[/#?][^"']*)?["']/,
      `${path} has no link to /specimen`,
    );
  }
  assert.ok(
    !(file("sitemap.xml") || "").includes("/specimen"),
    "sitemap.xml omits /specimen",
  );
});

test("Stylesheet", () => {
  const cssSource = globSync("src/styles/**/*.css")
    .sort()
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  for (const needle of [
    "@layer reset, tokens, layout, components, utilities;",
    "@view-transition",
    "light-dark(",
    "@container",
    "@property --",
    "@container episode",
    "interpolate-size: allow-keywords",
    "view-transition-name:",
    ":user-invalid",
    "oklch(",
    "text-wrap: balance",
    "text-wrap: pretty",
  ]) {
    assert.ok(cssSource.includes(needle), `src/styles uses ${needle}`);
  }
  // The Pagefind overrides beat Pagefind's own sheet only while they stay
  // unlayered, so the bundle must not have swept them into @layer components.
  const bundled = file(stylesheetPath()) || "";
  const at = bundled.indexOf("#pagefind-ui .pagefind-ui__search-input");
  assert.ok(at !== -1, "bundle keeps the Pagefind overrides");
  const before = bundled.slice(0, at);
  const depth =
    before.split("{").length - before.split("}").length; /* 0 = top level */
  assert.equal(depth, 0, "Pagefind overrides are unlayered");
});

test("Prerender coverage", () => {
  const expected = [
    "index.html",
    "links/index.html",
    "search/index.html",
    "about/index.html",
    "specimen/index.html",
    "feed.xml",
    ...allSlugs.flatMap((s) => [
      `episodes/${s}/index.html`,
      `episodes/${s}/chapters.json`,
    ]),
  ];
  const missing = expected.filter((p) => file(p) === null);
  assert.deepEqual(
    missing,
    [],
    `prerendered all ${expected.length} expected outputs`,
  );
});

test("standard.site discovery", (t) => {
  const wellKnown = ".well-known/site.standard.publication";
  if (!process.env.VITE_ATPROTO_PUBLICATION_URI)
    return t.skip("VITE_ATPROTO_PUBLICATION_URI unset");
  hasFile(wellKnown);
  assert.ok(
    (file(wellKnown) || "").trim().startsWith("at://"),
    `${wellKnown} contains an at:// URI`,
  );
});

/**
 * Whether the source file actually carries a transcript. The Office Hours and
 * Spotlight archive imports never had one, so a page with no transcript is only
 * a failure when the markdown behind it has transcript text — this condition is
 * read from the source, not from the rendered page, so a transcript that
 * silently failed to render still fails the check.
 */
function hasTranscript(slug: string): boolean {
  const md = readFileSync(join("content/episodes", `${slug}.md`), "utf8");
  const marker = md.indexOf("\n# Transcript\n");
  return (
    marker !== -1 &&
    md.slice(marker + "\n# Transcript\n".length).trim().length > 0
  );
}

test("Transcript integrity", () => {
  for (const slug of allSlugs) {
    const html = file(`episodes/${slug}/index.html`);
    if (html === null) continue;
    assert.doesNotMatch(
      html,
      /\/assets\/[^"']*\.js/,
      `episodes/${slug}: references zero /assets/*.js`,
    );
    if (!hasTranscript(slug)) continue;
    const episode = parseEpisode(
      readFileSync(join("content/episodes", `${slug}.md`), "utf8"),
      slug,
    );
    let previousSpeaker = "";
    const labels = episode.sections.flatMap((section) =>
      section.segments.map((segment) => {
        const label =
          segment.speaker && segment.speaker !== previousSpeaker
            ? renderToStaticMarkup(
                createElement(
                  "span",
                  { className: "speaker" },
                  segment.speaker,
                ),
              )
            : "";
        if (segment.speaker) previousSpeaker = segment.speaker;
        return label;
      }),
    );
    const renderedLabels = [
      ...html.matchAll(
        /<div class="segment"><div class="segment-meta">([\s\S]*?)<\/div><p>/g,
      ),
    ].map(
      (match) =>
        match[1].match(/<span class="speaker">[\s\S]*?<\/span>/)?.[0] || "",
    );
    assert.deepEqual(
      renderedLabels,
      labels,
      `episodes/${slug}: labels only the first paragraph of each speaker turn`,
    );
    // The first transcript segment's text is the marker: it must appear exactly once.
    const m = html.match(
      /<div class="segment"><div class="segment-meta">[\s\S]*?<\/div><p>([^<]{40,120})/,
    );
    assert.ok(m, `episodes/${slug}: found a transcript segment to sample`);
    assert.equal(
      html.split(m[1]).length - 1,
      1,
      `episodes/${slug}: transcript marker appears exactly once`,
    );
  }
});

test("Episode header and outline state", () => {
  for (const slug of allSlugs) {
    const path = `episodes/${slug}/index.html`;
    const html = file(path);
    if (html === null) continue;
    contains(path, 'class="episode-header"');
    // The inline script names the attribute; no *markup* may carry it.
    assert.ok(
      !html.replace(/<script[\s\S]*?<\/script>/g, "").includes("aria-current"),
      `${path} sets no aria-current at build time — the outline script must set it at runtime only`,
    );
  }
});

test("Open Graph cards", () => {
  for (const slug of allSlugs) {
    assert.ok(
      existsSync(join(dist, "og", `${slug}.jpg`)),
      `og/${slug}.jpg exists — run: node scripts/og.ts`,
    );
  }
  assert.ok(
    existsSync(join(dist, "og", "default.jpg")),
    "og/default.jpg exists",
  );
});

test("Link previews", () => {
  const origin = (
    process.env.VITE_SITE_URL || "https://thismonthinreact.com"
  ).replace(/\/$/, "");
  for (const [path, slug] of [
    ["index.html", "default"],
    ["about/index.html", "default"],
    [`episodes/${newest}/index.html`, newest],
  ]) {
    contains(path!, `content="${origin}/og/${slug}.jpg"`);
    contains(path!, 'content="summary_large_image"');
    contains(path!, `<link rel="canonical"`);
    contains(path!, 'property="og:image:width" content="1200"');
    contains(path!, 'name="theme-color"');
  }
  const path = `episodes/${newest}/index.html`;
  contains(path, 'property="og:type" content="article"');
  contains(path, 'property="article:published_time"');
  const title = /<title>([^<]*)<\/title>/.exec(file(path) || "")?.[1] || "";
  assert.equal(
    (title.match(/This Month in React/g) || []).length,
    1,
    `${path} title names the site once: ${title}`,
  );
});

/** The first ld+json block in a document, parsed. */
function ldJson(path: string): Record<string, any> | null {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
    file(path) || "",
  );
  return m ? JSON.parse(m[1]) : null;
}

test("Robots, sitemap, JSON-LD", () => {
  hasFile("robots.txt");
  contains("robots.txt", "Sitemap:");
  contains("robots.txt", "/sitemap.xml");
  hasFile("sitemap.xml");
  contains("sitemap.xml", "<urlset");
  for (const slug of allSlugs) contains("sitemap.xml", `/episodes/${slug}<`);
  assert.ok(
    !(file("sitemap.xml") || "").includes("/search"),
    "sitemap.xml omits /search",
  );
  assert.equal(
    ldJson("index.html")?.["@type"],
    "PodcastSeries",
    "index.html has PodcastSeries JSON-LD",
  );
  const path = `episodes/${newest}/index.html`;
  const ld = ldJson(path);
  assert.equal(
    ld?.["@type"],
    "PodcastEpisode",
    `${path} has PodcastEpisode JSON-LD`,
  );
  assert.equal(
    ld?.partOfSeries?.["@type"],
    "PodcastSeries",
    `${path} JSON-LD names its series`,
  );
});

test("Sizes", () => {
  const assetsDir = join(dist, "assets");
  const jsFiles = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
    : [];
  let rawTotal = 0;
  let gzipTotal = 0;
  for (const f of jsFiles) {
    const buf = readFileSync(join(assetsDir, f));
    rawTotal += buf.length;
    gzipTotal += gzipSync(buf).length;
  }
  const lines = [
    "\nSizes",
    `  router-page JS (${jsFiles.length} files): ${rawTotal} B raw / ${gzipTotal} B gzip`,
  ];
  if (newest) {
    const html = readFileSync(join(dist, "episodes", newest, "index.html"));
    lines.push(
      `  episode document ${newest}/index.html: ${html.length} B raw / ${gzipSync(html).length} B gzip, 0 external scripts`,
    );
  }
  const linksHtml = readFileSync(join(dist, "links", "index.html"));
  const linksJs = [
    ...new Set(linksHtml.toString().match(/\/assets\/[^"']*\.js/g) ?? []),
  ].map((href) => readFileSync(join(dist, href.slice(1))));
  lines.push(
    `  links document links/index.html: ${linksHtml.length} B raw / ${gzipSync(linksHtml).length} B gzip (cap ${LINKS_MAX_BYTES} B)`,
    `  links page JS (${linksJs.length} files): ${linksJs.reduce((n, b) => n + b.length, 0)} B raw / ${linksJs.reduce((n, b) => n + gzipSync(b).length, 0)} B gzip`,
  );
  lines.push(
    "  spike baselines: router runtime 342267 B raw / 108613 B gzip; 100 KB fixture document 101837 B HTML",
    "  links baseline before RSC: 1610228 B raw / 151982 B gzip, 0 external scripts",
  );
  console.log(lines.join("\n"));
});
