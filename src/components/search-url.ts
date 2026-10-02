/**
 * Pages are prerendered as flat files (`episodes/2026-08.html`), so Pagefind
 * records `.html` URLs. The pages live at the extensionless URL, which is the
 * one every canonical and sitemap entry names; link there directly instead of
 * through Netlify's `.html` redirect.
 */
export function pageUrl(url: string): string {
  return url.replace(/\.html(?=$|[#?])/, "");
}

export function withPageUrls<
  T extends { url: string; sub_results?: { [key: string]: unknown }[] },
>(result: T): T {
  return {
    ...result,
    url: pageUrl(result.url),
    sub_results: result.sub_results?.map((section) =>
      typeof section.url === "string"
        ? { ...section, url: pageUrl(section.url) }
        : section,
    ),
  };
}
