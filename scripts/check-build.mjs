import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const dist = "dist/client";
let failures = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function file(path) {
  const full = join(dist, path);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

function hasFile(path) {
  check(`${path} exists`, file(path) !== null);
}

function contains(path, needle) {
  const body = file(path);
  check(
    `${path} contains ${JSON.stringify(needle)}`,
    body !== null && body.includes(needle),
    body === null ? "file missing" : "needle absent",
  );
}

console.log("Shell");
hasFile("index.html");
hasFile("styles.css");
contains("index.html", 'class="site-nav"');
contains("index.html", 'href="/styles.css"');
// The skip link must precede the header on both rendering paths — the router
// shell and the static document handlers build their own markup.
for (const path of ["index.html", "links/index.html"]) {
  const html = file(path) || "";
  check(
    `${path} has a skip link before the header`,
    html.includes('class="skip-link" href="#main"') &&
      html.includes('id="main"') &&
      html.indexOf("skip-link") < html.indexOf("site-header"),
  );
}

contains("index.html", 'class="archive"');
contains("index.html", 'id="latest"');
contains("index.html", 'id="archive"');
contains("index.html", "Carl Vitullo");
contains("index.html", "Mark Erikson");
for (const slug of slugs()) contains("index.html", `/episodes/${slug}`);

function slugs() {
  return readdirSync("content/episodes")
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -".md".length))
    .sort();
}

console.log("\nEpisode documents");
const episodeSlugs = slugs();
check("content/episodes has at least one episode", episodeSlugs.length > 0);
for (const slug of episodeSlugs) hasFile(`episodes/${slug}/index.html`);
const newest = episodeSlugs.at(-1);
if (newest) {
  const path = `episodes/${newest}/index.html`;
  contains(path, "data-pagefind-body");
  contains(path, 'class="outline"');
  contains(path, "data-seconds=");
  contains(path, "<audio");
  contains(path, 'class="player"');
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
}

console.log("\nLinks document");
hasFile("links/index.html");
contains("links/index.html", 'class="link-row"');
contains("links/index.html", "data-text=");
contains("links/index.html", 'id="link-filter"');
check(
  "links/index.html references no bundled JS",
  !/\/assets\/[^"']*\.js/.test(file("links/index.html") || ""),
);

console.log("\nFeed and chapters");
hasFile("feed.xml");
contains("feed.xml", '<rss version="2.0"');
contains("feed.xml", "<item>");
for (const slug of slugs()) {
  const body = file(`episodes/${slug}/chapters.json`);
  check(
    `episodes/${slug}/chapters.json is valid Podcasting 2.0`,
    (() => {
      if (body === null) return false;
      try {
        const json = JSON.parse(body);
        return json.version === "1.2.0" && Array.isArray(json.chapters);
      } catch {
        return false;
      }
    })(),
  );
}
{
  const xml = file("feed.xml") || "";
  check(
    "feed.xml has an XML declaration",
    xml.startsWith('<?xml version="1.0"'),
  );
  check(
    "feed.xml has exactly one <channel>",
    (xml.match(/<channel>/g) || []).length === 1,
  );
  const itemCount = (xml.match(/<item>/g) || []).length;
  check(
    `feed.xml has ${slugs().length} <item> elements`,
    itemCount === slugs().length,
    `found ${itemCount}`,
  );
}

console.log("\nSearch");
hasFile("search/index.html");
contains("search/index.html", 'id="pagefind-ui"');
check(
  "pagefind index built",
  existsSync(join(dist, "pagefind", "pagefind-ui.js")),
  "run: npx pagefind --site dist/client",
);
if (existsSync(join(dist, "pagefind", "pagefind-ui.js"))) {
  // PagefindUI injects the <script src="/pagefind/pagefind-ui.js"> at runtime,
  // so it never appears literally in the prerendered HTML. Instead confirm
  // search/index.html loads a JS chunk that references the pagefind asset.
  const html = file("search/index.html") || "";
  const chunkSrc = /href="(\/assets\/search-[^"]+\.js)"/.exec(html)?.[1];
  check(
    "search/index.html references a JS chunk",
    Boolean(chunkSrc),
    "no /assets/search-*.js reference found",
  );
  if (chunkSrc) {
    const chunk = readFileSync(join(dist, chunkSrc.slice(1)), "utf8");
    check(
      `${chunkSrc} references pagefind-ui.js`,
      chunk.includes("pagefind-ui.js"),
    );
  }
}

console.log("\nAbout");
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
contains("about/index.html", "https://feeds.transistor.fm/this-month-in-react");
contains("about/index.html", "mailto:hello@reactiflux.com");
if (process.env.VITE_BLUESKY_PROFILE_URL)
  contains("about/index.html", "Follow on Bluesky");
{
  const about = file("about/index.html") || "";
  const bdUser = process.env.VITE_BUTTONDOWN_USER;
  check(
    bdUser
      ? "newsletter form present when VITE_BUTTONDOWN_USER is set"
      : "newsletter form absent when VITE_BUTTONDOWN_USER is unset",
    bdUser
      ? about.includes(
          `https://buttondown.com/api/emails/embed-subscribe/${bdUser}`,
        )
      : !about.includes("buttondown.com"),
  );
}

console.log("\nStylesheet");
const cssSource = readFileSync("public/styles.css", "utf8");
for (const needle of [
  "@layer reset, tokens, layout, components, utilities;",
  "@view-transition",
  "light-dark(",
  "@container",
  "anchor-name:",
  "text-wrap: balance",
  "text-wrap: pretty",
]) {
  check(`styles.css uses ${needle}`, cssSource.includes(needle));
}
check("styles.css is served verbatim", file("styles.css") === cssSource);

console.log("\nPrerender coverage");
const allSlugs = slugs();
const expected = [
  "index.html",
  "styles.css",
  "links/index.html",
  "search/index.html",
  "about/index.html",
  "feed.xml",
  ...allSlugs.flatMap((s) => [
    `episodes/${s}/index.html`,
    `episodes/${s}/chapters.json`,
  ]),
];
check(
  `prerendered all ${expected.length} expected outputs`,
  expected.every((p) => file(p) !== null),
  `missing: ${expected.filter((p) => file(p) === null).join(", ")}`,
);

console.log("\nstandard.site discovery");
const wellKnown = ".well-known/site.standard.publication";
if (process.env.VITE_ATPROTO_PUBLICATION_URI) {
  hasFile(wellKnown);
  check(
    `${wellKnown} contains an at:// URI`,
    (file(wellKnown) || "").trim().startsWith("at://"),
    JSON.stringify((file(wellKnown) || "").trim()),
  );
} else {
  console.log(`  skip  ${wellKnown} (VITE_ATPROTO_PUBLICATION_URI unset)`);
}

console.log("\nTranscript integrity");
for (const slug of allSlugs) {
  const html = file(`episodes/${slug}/index.html`);
  if (html === null) continue;
  // The first transcript segment's text is the marker: it must appear exactly once.
  const m = html.match(
    /<p class="segment">(?:<strong class="speaker">[^<]*<\/strong>)?([^<]{40,120})/,
  );
  if (!m) {
    check(`episodes/${slug}: found a transcript segment to sample`, false);
    continue;
  }
  const marker = m[1];
  const count = html.split(marker).length - 1;
  check(
    `episodes/${slug}: transcript marker appears exactly once`,
    count === 1,
    `appears ${count}x`,
  );
  check(
    `episodes/${slug}: references zero /assets/*.js`,
    !/\/assets\/[^"']*\.js/.test(html),
  );
}

console.log("\nEpisode header and outline state");
for (const slug of allSlugs) {
  const path = `episodes/${slug}/index.html`;
  const html = file(path);
  if (html === null) continue;
  contains(path, 'class="episode-header"');
  // The inline script names the attribute; no *markup* may carry it.
  check(
    `${path} sets no aria-current at build time`,
    !html.replace(/<script[\s\S]*?<\/script>/g, "").includes("aria-current"),
    "the outline script must set it at runtime only",
  );
}

console.log("\nOpen Graph cards");
for (const slug of allSlugs) {
  check(
    `og/${slug}.jpg exists`,
    existsSync(join(dist, "og", `${slug}.jpg`)),
    "run: node scripts/og.ts",
  );
}
check("og/default.jpg exists", existsSync(join(dist, "og", "default.jpg")));

console.log("\nLink previews");
const origin = (
  process.env.VITE_SITE_URL || "https://thismonthinreact.com"
).replace(/\/$/, "");
for (const [path, slug] of [
  ["index.html", "default"],
  ["about/index.html", "default"],
  [`episodes/${allSlugs.at(-1)}/index.html`, allSlugs.at(-1)],
]) {
  contains(path, `content="${origin}/og/${slug}.jpg"`);
  contains(path, 'content="summary_large_image"');
  contains(path, `<link rel="canonical"`);
  contains(path, 'property="og:image:width" content="1200"');
  contains(path, 'name="theme-color"');
}
{
  const path = `episodes/${allSlugs.at(-1)}/index.html`;
  contains(path, 'property="og:type" content="article"');
  contains(path, 'property="article:published_time"');
  const title = /<title>([^<]*)<\/title>/.exec(file(path) || "")?.[1] || "";
  check(
    `${path} title names the site once`,
    (title.match(/This Month in React/g) || []).length === 1,
    title,
  );
}

console.log("\nRobots, sitemap, JSON-LD");
hasFile("robots.txt");
contains("robots.txt", "Sitemap:");
contains("robots.txt", "/sitemap.xml");
hasFile("sitemap.xml");
contains("sitemap.xml", "<urlset");
for (const slug of allSlugs) contains("sitemap.xml", `/episodes/${slug}<`);
check(
  "sitemap.xml omits /search",
  !(file("sitemap.xml") || "").includes("/search"),
);

/** The first ld+json block in a document, parsed. */
function ldJson(path) {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
    file(path) || "",
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
check(
  "index.html has PodcastSeries JSON-LD",
  ldJson("index.html")?.["@type"] === "PodcastSeries",
);
{
  const path = `episodes/${allSlugs.at(-1)}/index.html`;
  const ld = ldJson(path);
  check(
    `${path} has PodcastEpisode JSON-LD`,
    ld?.["@type"] === "PodcastEpisode",
  );
  check(
    `${path} JSON-LD names its series`,
    ld?.partOfSeries?.["@type"] === "PodcastSeries",
  );
}

console.log("\nSizes");
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
console.log(
  `  router-page JS (${jsFiles.length} files): ${rawTotal} B raw / ${gzipTotal} B gzip`,
);
const sampleSlug = allSlugs.at(-1);
if (sampleSlug) {
  const html = readFileSync(join(dist, "episodes", sampleSlug, "index.html"));
  console.log(
    `  episode document ${sampleSlug}/index.html: ${html.length} B raw / ${gzipSync(html).length} B gzip, 0 external scripts`,
  );
}
console.log(
  "  spike baselines: router runtime 342267 B raw / 108613 B gzip; 100 KB fixture document 101837 B HTML",
);

process.exit(failures === 0 ? 0 : 1);
