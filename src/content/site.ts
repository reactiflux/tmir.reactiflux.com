export const SITE_NAME =
  import.meta.env.VITE_SITE_NAME || "This Month in React";
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://thismonthinreact.com"
).replace(/\/$/, "");

export const SITE_DESCRIPTION =
  "Monthly conversations about React, the web, and the work of building software, with Carl Vitullo and Mark Erikson.";

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
