export const SITE_NAME =
  import.meta.env.VITE_SITE_NAME || "This Month in React";
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://thismonthinreact.com"
).replace(/\/$/, "");

export const SITE_DESCRIPTION =
  "Monthly conversations about React, the web, and the work of building software, with Carl Vitullo and Mark Erikson.";

/** The navy of the wordmark and of the generated OG cards. */
export const THEME_COLOR = "#123F8C";

export interface Og {
  title: string;
  description: string;
  url: string;
  /** "article" for episodes, "website" for everything else. */
  type?: "article" | "website";
  /** Path under /og; the default card covers every non-episode page. */
  image?: string;
  imageAlt?: string;
  /** Episodes only. */
  publishedTime?: string;
  audioUrl?: string;
}

/**
 * Open Graph tags as router `head().meta` descriptors. Image URLs are absolute
 * because relative ones do not unfurl in Discord or Slack.
 */
export function ogMeta({
  title,
  description,
  url,
  type = "website",
  image = "default",
  imageAlt,
  publishedTime,
  audioUrl,
}: Og): { property?: string; name?: string; content: string }[] {
  const imageUrl = `${SITE_URL}/og/${image}.jpg`;
  return [
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: type },
    { property: "og:locale", content: "en_US" },
    { property: "og:image", content: imageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/jpeg" },
    { property: "og:image:alt", content: imageAlt ?? title },
    ...(publishedTime
      ? [{ property: "article:published_time", content: publishedTime }]
      : []),
    // Best-effort: standards-correct audio tags. Neither Discord nor Slack
    // grants an inline player to an arbitrary site.
    ...(audioUrl
      ? [
          { property: "og:audio", content: audioUrl },
          { property: "og:audio:secure_url", content: audioUrl },
          { property: "og:audio:type", content: "audio/mpeg" },
        ]
      : []),
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
  ];
}

/** The same tags as elements, for the routes that render their own <head>. */
export function OgTags(props: Og) {
  return (
    <>
      {ogMeta(props).map((m) => (
        <meta key={m.property ?? m.name} {...m} />
      ))}
    </>
  );
}

/**
 * Renders no <title> itself. The router shell passes <HeadContent/> here and the
 * static handlers pass their own <title>/<meta>/<link rel="canonical">. If the
 * shell emitted a <title> too, both would land in the HTML and browsers use the
 * first — silently overriding every route title. Verified in the risk-gate spike.
 */
export function Document({
  head,
  scripts,
  bodyClass,
  children,
}: {
  head: React.ReactNode;
  scripts?: React.ReactNode;
  bodyClass?: string;
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/styles.css" />
        <meta property="og:site_name" content={SITE_NAME} />
        {/* summary_large_image is what makes Discord render the card full-width. */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content={THEME_COLOR} />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={SITE_NAME}
          href={`${SITE_URL}/feed.xml`}
        />
        {head}
      </head>
      <body className={bodyClass}>
        <a className="skip-link" href="#main" data-pagefind-ignore="">
          Skip to content
        </a>
        <header className="site-header" data-pagefind-ignore="">
          <a className="site-name" href="/">
            <span className="masthead-mark" aria-hidden="true">
              TMiR
            </span>
            <span className="masthead-title">{SITE_NAME}</span>
          </a>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="/">Home</a>
            <a href="/#archive">Episodes</a>
            <a href="/links">Links</a>
            <a href="/search">Search</a>
            <a href="/about">About</a>
            <a className="nav-subscribe" href="/about#subscribe">
              Subscribe
            </a>
          </nav>
        </header>
        <main id="main" className={bodyClass ? `${bodyClass}-main` : undefined}>
          {children}
        </main>
        <footer className="site-footer" data-pagefind-ignore="">
          <div className="footer-brand">
            <strong>{SITE_NAME}</strong>
            <p>React, the web, and the work of building software.</p>
          </div>
          <div className="footer-links">
            <a href="/about#live">Recorded in Reactiflux</a>
            <a href="https://feeds.transistor.fm/this-month-in-react">
              Podcast RSS
            </a>
            <a href="/feed.xml">Show notes RSS</a>
          </div>
        </footer>
        {scripts}
      </body>
    </html>
  );
}
