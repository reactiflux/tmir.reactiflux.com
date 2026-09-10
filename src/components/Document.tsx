import stylesHref from "#/styles/index.css?url";
import { ogMeta, SITE_NAME, SITE_URL, type Og } from "../content/site.ts";

/** The navy of the wordmark and of the generated OG cards. */
const THEME_COLOR = "#123F8C";

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

/** Reserve the actual footer height, including wrapped links and open discussion. */
const FOOTER_SCRIPT = `(()=>{
const footer=document.querySelector(".site-footer");if(!footer)return;
const size=()=>document.documentElement.style.setProperty("--footer-block-size",footer.offsetHeight+"px");
size();new ResizeObserver(size).observe(footer);
const details=footer.querySelector("details");
const openHash=()=>{if(details&&location.hash==="#comments")details.open=true};
openHash();addEventListener("hashchange",openHash);
if(details){details.addEventListener("toggle",size);details.addEventListener("keydown",e=>{if(e.key==="Escape"&&details.open){details.open=false;details.querySelector("summary").focus()}})}
})();`;

/**
 * Renders no <title> itself. The router shell passes <HeadContent/> here; static
 * handlers render their own <title>/<meta>/<link> anywhere in the tree and React
 * 19 hoists them into this <head>. If the shell emitted a <title> too, both would
 * land in the HTML and browsers use the first — silently overriding every route
 * title. Verified in the risk-gate spike.
 */
export function Document({
  head,
  scripts,
  bodyClass,
  footerDiscussion,
  children,
}: {
  /** Only the router shell needs this, for <HeadContent/>. */
  head?: React.ReactNode;
  scripts?: React.ReactNode;
  bodyClass?: string;
  footerDiscussion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href={stylesHref} />
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
          <div className="footer-inner">
            {footerDiscussion && (
              <details className="footer-discussion">
                <summary>
                  Bluesky discussion <span data-reaction-count="" />
                </summary>
                <div className="footer-discussion-content">
                  {footerDiscussion}
                </div>
              </details>
            )}
            <div className="footer-bar">
              <div className="footer-brand">
                <strong>{SITE_NAME}</strong>
              </div>
              <div className="footer-links">
                <a href="/about#live">Recorded in Reactiflux</a>
                <a href="https://feeds.transistor.fm/this-month-in-react">
                  Podcast RSS
                </a>
                <a href="/feed.xml">Show notes RSS</a>
              </div>
            </div>
          </div>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: FOOTER_SCRIPT }} />
        {scripts}
      </body>
    </html>
  );
}
