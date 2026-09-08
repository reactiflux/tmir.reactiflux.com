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

console.log("Task 1: shell");
hasFile("index.html");
hasFile("styles.css");
contains("index.html", 'class="site-nav"');
contains("index.html", 'href="/styles.css"');

// --- Task 4: home route (appended) ---
contains("index.html", 'class="archive"');
contains("index.html", 'class="outline"');
for (const slug of slugs()) contains("index.html", `/episodes/${slug}`);
// --- end Task 4 ---

function slugs() {
  return readdirSync("content/episodes")
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -".md".length))
    .sort();
}

console.log("\nTask 3: episode documents");
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
  const html = file(path) || "";
  check(
    `${path} references no bundled JS`,
    !/\/assets\/[^"']*\.js/.test(html),
    "static documents must ship zero external scripts",
  );
  // The transcript must appear exactly once — a second copy means a loader or
  // RSC payload has been reintroduced.
  const md = readFileSync(join("content/episodes", `${newest}.md`), "utf8");
  const phrase = (md.split("\n# Transcript\n")[1] || "")
    .split("\n")
    .map((line) => /[A-Za-z][A-Za-z ]{29,59}[A-Za-z]/.exec(line)?.[0])
    .find(Boolean);
  if (phrase) {
    const copies = (file(path) || "").split(phrase).length - 1;
    check(
      `${path} contains the transcript exactly once`,
      copies === 1,
      `found ${copies}`,
    );
  }

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

// --- Task 5: links document (appended) ---
console.log("\nTask 5: links document");
hasFile("links/index.html");
contains("links/index.html", 'class="link-row"');
contains("links/index.html", "data-text=");
contains("links/index.html", 'id="link-filter"');
check(
  "links/index.html references no bundled JS",
  !/\/assets\/[^"']*\.js/.test(file("links/index.html") || ""),
);
// --- end Task 5 ---

console.log("\nTask 6: feed and chapters");
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

console.log("\nTask 7: search");
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

console.log("\nTask 8: about");
hasFile("about/index.html");
contains("about/index.html", 'class="people"');
contains(
  "about/index.html",
  "https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH",
);
contains(
  "about/index.html",
  "https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526",
);
contains("about/index.html", "https://feeds.transistor.fm/this-month-in-react");
contains("about/index.html", "AT Protocol publication");
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

console.log("\nTask 9: stylesheet");
const cssSource = readFileSync("public/styles.css", "utf8");
for (const needle of [
  "@layer reset, tokens, layout, components, utilities;",
  "@view-transition",
  "light-dark(",
  "oklch(",
  "@container",
  "anchor-name:",
  "text-wrap: balance",
  "text-wrap: pretty",
]) {
  check(`styles.css uses ${needle}`, cssSource.includes(needle));
}
const lineCount = cssSource.split("\n").length;
check("styles.css is under 250 lines", lineCount < 250, `${lineCount} lines`);
check("styles.css is served verbatim", file("styles.css") === cssSource);

console.log("\nTask 10: prerender coverage");
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
for (const path of expected) hasFile(path);
check(
  `prerendered all ${expected.length} expected outputs`,
  expected.every((p) => file(p) !== null),
);

console.log("\nTask 10: standard.site discovery");
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

console.log("\nTask 10: no duplicated transcript");
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

// --- Adjustments: sticky episode header + runtime outline highlighting ---
console.log("\nAdjustments: episode header and outline state");
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
// --- end Adjustments ---

// --- Task 11: Open Graph cards ---
console.log("\nTask 11: Open Graph cards");
for (const slug of allSlugs) {
  check(
    `og/${slug}.png exists`,
    existsSync(join(dist, "og", `${slug}.png`)),
    "run: node scripts/og.ts",
  );
}
check("og/default.png exists", existsSync(join(dist, "og", "default.png")));
// --- end Task 11 ---

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
