/**
 * Build-time Open Graph cards: one 1200x630 PNG per episode at
 * dist/client/og/<slug>.png, plus dist/client/og/default.png for every other
 * page. Runs offline — fonts and artwork are committed in this repo.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadEpisodes } from "../src/content/load.ts";
import type { Episode } from "../src/content/parse.ts";

const W = 1200;
const H = 630;
const PANEL = W - H; // 570px of text to the right of the square artwork

// Sampled from public/artwork.jpg: the wordmark navy and a cream pulled from
// the top-left of the gradient.
const NAVY = "#123F8C";
const CREAM = "#FAF1E2";
const MUTED = "#6A7BA0";

const OUT = "dist/client/og";

/**
 * Episode titles carry boilerplate — a "TMiR 2026-07: " prefix on recent ones,
 * a "This Month in React, July 2024: " prefix on older ones, and a trailing
 * "(March 2023)" on the oldest — that wastes card space and duplicates the
 * date printed underneath.
 */
export function cardTitle(title: string): string {
  const stripped = title
    .replace(/^TMiR\s+\d{4}-\d{2}:\s*/, "")
    .replace(/^This Month in React,[^:]*:\s*/, "")
    .replace(/\s*\([A-Z][a-z]+ \d{4}\)$/, "")
    .trim();
  return stripped || title;
}

export function runtime(seconds: number | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function monthYear(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, props: Record<string, unknown>): Node => ({
  type,
  props,
});

function card(artwork: string, title: string, meta: string[]): Node {
  // Long titles get a smaller face so three lines still say something useful.
  const size = title.length > 58 ? 34 : title.length > 34 ? 40 : 46;
  return el("div", {
    style: { display: "flex", width: W, height: H, backgroundColor: CREAM },
    children: [
      el("img", { src: artwork, width: H, height: H }),
      el("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: PANEL,
          height: H,
          padding: "56px 48px",
        },
        children: [
          el("div", {
            style: {
              display: "-webkit-box",
              "-webkit-box-orient": "vertical",
              "-webkit-line-clamp": 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: NAVY,
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: size,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            },
            children: title,
          }),
          el("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              color: MUTED,
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: 21,
              lineHeight: 1.45,
            },
            children: meta
              .filter(Boolean)
              .map((line) =>
                el("div", { style: { display: "flex" }, children: line }),
              ),
          }),
        ],
      }),
    ],
  });
}

async function main() {
  const root = process.cwd();
  const [regular, bold, artworkBytes, episodes] = await Promise.all([
    readFile(join(root, "assets/fonts/Inter-Regular.woff")),
    readFile(join(root, "assets/fonts/Inter-Bold.woff")),
    readFile(join(root, "public/artwork.jpg")),
    loadEpisodes(),
  ]);
  const artwork = `data:image/jpeg;base64,${artworkBytes.toString("base64")}`;
  const fonts = [
    {
      name: "Inter",
      data: regular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Inter",
      data: bold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];

  await mkdir(join(root, OUT), { recursive: true });

  const render = async (name: string, node: Node) => {
    const svg = await satori(node as never, { width: W, height: H, fonts });
    // ponytail: ~700 KB per card — the artwork's film grain defeats PNG's
    // filters. Quantize (or emit WebP) if the deploy size starts to matter.
    const png = new Resvg(svg).render().asPng();
    await writeFile(join(root, OUT, `${name}.png`), png);
  };

  const hosts = (ep: Episode) =>
    ep.people
      .map((p) => p.name)
      .slice(0, 3)
      .join(", ");

  const started = Date.now();
  for (const ep of episodes) {
    await render(
      ep.slug,
      card(artwork, cardTitle(ep.title), [
        monthYear(ep.date),
        hosts(ep),
        runtime(ep.duration),
      ]),
    );
  }
  await render(
    "default",
    card(artwork, "This Month in React", [
      "Monthly React news, with full transcripts",
    ]),
  );
  console.log(
    `og: ${episodes.length + 1} cards in ${Date.now() - started}ms -> ${OUT}/`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
