import { globSync, writeFileSync } from "node:fs";
import { build, defineConfig, loadEnv, type Plugin } from "vite";
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

const pages = [
  ...slugs.map((slug) => ({
    path: `/episodes/${slug}`,
    prerender: { enabled: true },
  })),
  { path: "/feed.xml", prerender: { enabled: true } },
  { path: "/sitemap.xml", prerender: { enabled: true } },
  { path: "/specimen", prerender: { enabled: true } },
  { path: "/about", prerender: { enabled: true } },
  ...slugs.map((slug) => ({
    path: `/episodes/${slug}/chapters.json`,
    prerender: { enabled: true },
  })),
  ...slugs.map((slug) => ({
    path: `/episodes/${slug}/transcript.srt`,
    prerender: { enabled: true },
  })),
];

/**
 * Files that depend on the environment, written into public/ so Vite's normal
 * public copy emits them: robots.txt (its Sitemap line carries the site URL),
 * and justify.js, the transcript justifier bundled for pages that don't hydrate.
 */
let justifyBuilt: Promise<unknown> | undefined;
const generatedPublicFiles = (env: Record<string, string>) =>
  ({
    name: "generated-public-files",
    async buildStart() {
      // buildStart runs once per environment; bundle once.
      await (justifyBuilt ??= build({
        configFile: false,
        logLevel: "warn",
        publicDir: false,
        build: {
          lib: {
            entry: "src/client/justify-transcript.ts",
            formats: ["iife"],
            name: "justify",
            fileName: () => "justify.js",
          },
          outDir: "public",
          emptyOutDir: false,
        },
      }));
      const siteUrl = env.VITE_SITE_URL || "https://thismonthinreact.com";
      writeFileSync(
        "public/robots.txt",
        `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      );
    },
  }) satisfies Plugin;

export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    generatedPublicFiles(loadEnv(mode, process.cwd(), "VITE_")),
    // RSC is on for /links; the episode documents deliberately do not use it.
    tanstackStart({
      rsc: { enabled: true },
      prerender: {
        enabled: true,
        crawlLinks: true,
        // /links renders its own filter permutations as links. Prerendering
        // them is unbounded and pointless — the Netlify function renders them.
        filter: (page) => !page.path.includes("?"),
      },
      pages,
    }),
    netlify(),
    rsc(),
    viteReact({ compiler: true }),
  ],
}));
