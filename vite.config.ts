import { globSync, mkdirSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import netlify from "@netlify/vite-plugin-tanstack-start";

// Explicit prerender list for routes the crawler cannot reach from links.
// Prerendering a path with no route 404s and fails the build, so each entry is
// restored by the task that adds its route.
const slugs = globSync("*.md", { cwd: "content/episodes" })
  .map((f) => f.slice(0, -".md".length))
  .sort();

const pages: { path: string; prerender: { enabled: boolean } }[] = [
  ...slugs.map((slug) => ({
    path: `/episodes/${slug}`,
    prerender: { enabled: true },
  })),
  { path: "/feed.xml", prerender: { enabled: true } },
  { path: "/sitemap.xml", prerender: { enabled: true } },
  { path: "/specimen", prerender: { enabled: true } },
  ...slugs.map((slug) => ({
    path: `/episodes/${slug}/chapters.json`,
    prerender: { enabled: true },
  })),
];

/**
 * standard.site discovery file. Written into public/ so Vite's normal public
 * copy puts it at dist/client/.well-known/site.standard.publication.
 */
const wellKnownPublication = {
  name: "well-known-publication",
  buildStart() {
    const uri = process.env.VITE_ATPROTO_PUBLICATION_URI;
    if (!uri) return;
    mkdirSync("public/.well-known", { recursive: true });
    writeFileSync("public/.well-known/site.standard.publication", `${uri}\n`);
  },
};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    wellKnownPublication,
    // RSC stays enabled for future supporting pages; the episode and links
    // documents deliberately do not use it.
    tanstackStart({
      rsc: { enabled: true },
      prerender: { enabled: true, crawlLinks: true },
      pages,
    }),
    netlify(),
    rsc(),
    viteReact({ compiler: true }),
  ],
});
