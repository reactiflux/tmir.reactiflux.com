import type { Episode, OutlineItem } from "./parse.ts";
import { toSeconds } from "./time.ts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap in CDATA, splitting any `]]>` so the content can't close the section. */
export function cdata(content: string): string {
  return `<![CDATA[${content.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export function outlineToHtml(items: OutlineItem[]): string {
  if (items.length === 0) return "";
  const lis = items.map((item) => {
    const title = escapeHtml(item.title);
    const label = item.url ? `<a href="${escapeHtml(item.url)}">${title}</a>` : title;
    return `<li>${label}${outlineToHtml(item.children)}</li>`;
  });
  return `<ul>${lis.join("")}</ul>`;
}

export function outlineToChapters(
  items: OutlineItem[],
): { startTime: number; title: string; url?: string }[] {
  const out: { startTime: number; title: string; url?: string }[] = [];
  const walk = (list: OutlineItem[]) => {
    for (const item of list) {
      const startTime = toSeconds(item.time);
      if (startTime !== undefined) {
        out.push(
          item.url
            ? { startTime, title: item.title, url: item.url }
            : { startTime, title: item.title },
        );
      }
      walk(item.children);
    }
  };
  walk(items);
  return out.sort((a, b) => a.startTime - b.startTime);
}

export function renderFeed(episodes: Episode[], siteName: string, siteUrl: string): string {
  const items = episodes
    .map((episode) => {
      const url = `${siteUrl}/episodes/${episode.slug}`;
      const body = `<p>${escapeHtml(episode.description)}</p>${outlineToHtml(episode.outline)}`;
      // No `length`: RSS wants the enclosure size in bytes and we only know
      // its duration in seconds — that lives on <itunes:duration> below.
      const enclosure = episode.audioUrl
        ? `<enclosure url="${escapeHtml(episode.audioUrl)}" type="audio/mpeg"/>`
        : "";
      const duration =
        episode.duration !== undefined
          ? `<itunes:duration>${episode.duration}</itunes:duration>`
          : "";
      return [
        "<item>",
        `<title>${escapeHtml(episode.title)}</title>`,
        `<link>${escapeHtml(url)}</link>`,
        `<guid isPermaLink="true">${escapeHtml(url)}</guid>`,
        `<pubDate>${new Date(episode.date).toUTCString()}</pubDate>`,
        `<description>${cdata(body)}</description>`,
        enclosure,
        duration,
        "</item>",
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>',
    `<title>${escapeHtml(siteName)}</title>`,
    `<link>${escapeHtml(siteUrl)}</link>`,
    `<description>${escapeHtml(siteName)} episodes, outlines and links.</description>`,
    `<atom:link href="${escapeHtml(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>`,
    items,
    "</channel></rss>",
  ].join("");
}
