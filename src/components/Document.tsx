export const SITE_NAME =
  import.meta.env.VITE_SITE_NAME || "This Month in React";
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://thismonthinreact.com"
).replace(/\/$/, "");

export interface Og {
  title: string;
  description: string;
  url: string;
  /** "article" for episodes, "website" for everything else. */
  type?: "article" | "website";
}

/** Open Graph tags as router `head().meta` descriptors. No image: none exists yet. */
export function ogMeta({ title, description, url, type = "website" }: Og) {
  return [
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: type },
  ];
}

/** The same tags as elements, for the routes that render their own <head>. */
export function OgTags(props: Og) {
  return (
    <>
      {ogMeta(props).map((m) => (
        <meta key={m.property} property={m.property} content={m.content} />
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
        <meta name="twitter:card" content="summary" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={SITE_NAME}
          href={`${SITE_URL}/feed.xml`}
        />
        {head}
      </head>
      <body className={bodyClass}>
        <header className="site-header" data-pagefind-ignore="">
          <a className="site-name" href="/">
            {SITE_NAME}
          </a>
          <nav className="site-nav">
            <a href="/">Home</a>
            <a href="/">Episodes</a>
            <a href="/links">Links</a>
            <a href="/search">Search</a>
            <a href="/about">About</a>
          </nav>
        </header>
        <main className={bodyClass ? `${bodyClass}-main` : undefined}>
          {children}
        </main>
        <footer className="site-footer" data-pagefind-ignore="">
          <a href="/feed.xml">RSS</a>
        </footer>
        {scripts}
      </body>
    </html>
  );
}
