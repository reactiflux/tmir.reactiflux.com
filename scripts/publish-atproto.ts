import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AtpAgent } from "@atproto/api";
import type { Episode, OutlineItem } from "../src/content/parse.ts";
import { bskyUrlToParts } from "../src/content/atproto.ts";
import { parseEpisode, splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";
import { requireEnv } from "./env.ts";

export const PUBLICATION_COLLECTION = "site.standard.publication";
export const DOCUMENT_COLLECTION = "site.standard.document";
export const PUBLICATION_RKEY = "self";
export const PUBLICATION_NAME = "This Month in React";
export const PUBLICATION_DESCRIPTION =
  "A monthly news podcast about React and its ecosystem, hosted by Carl Vitullo and Mark Erikson.";

const SERVICE = "https://bsky.social";
const EPISODE_DIR = resolve("content/episodes");

/** Outline -> indented plain text, one `Title — url` line per item. */
export function outlineToText(items: OutlineItem[], depth = 0): string {
  const lines: string[] = [];
  for (const item of items) {
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${item.title}${item.url ? ` — ${item.url}` : ""}`);
    if (item.children.length > 0)
      lines.push(outlineToText(item.children, depth + 1));
  }
  return lines.join("\n");
}

function hostnames(items: OutlineItem[], into: Set<string>): Set<string> {
  for (const item of items) {
    if (item.url) {
      // A malformed outline URL is not worth failing a publish over.
      const url = URL.parse(item.url);
      if (url) into.add(url.hostname);
    }
    hostnames(item.children, into);
  }
  return into;
}

/** Episode -> a site.standard.document record. `content` is omitted by design. */
export function buildDocumentRecord(
  episode: Episode,
  opts: { siteUri: string; bskyPostRef?: { uri: string; cid: string } },
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    $type: DOCUMENT_COLLECTION,
    site: opts.siteUri,
    title: episode.title,
    publishedAt: new Date(`${episode.date}T00:00:00Z`).toISOString(),
    path: `/episodes/${episode.slug}`,
    description: episode.description,
    textContent: outlineToText(episode.outline),
    tags: [...hostnames(episode.outline, new Set<string>())],
    // contributors omitted: the lexicon requires contributors[].did and the
    // Transistor feed gives us no DIDs.
  };
  if (opts.bskyPostRef) record.bskyPostRef = opts.bskyPostRef;
  return record;
}

/** bsky.app post URL -> the strong ref the document record needs. */
async function resolvePostRef(
  agent: AtpAgent,
  url: string,
): Promise<{ uri: string; cid: string } | undefined> {
  const parts = bskyUrlToParts(url);
  if (!parts) {
    console.log(`  unrecognized bskyPostUrl, skipping ref: ${url}`);
    return undefined;
  }
  const did = parts.actor.startsWith("did:")
    ? parts.actor
    : (await agent.com.atproto.identity.resolveHandle({ handle: parts.actor }))
        .data.did;
  const res = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: "app.bsky.feed.post",
    rkey: parts.rkey,
  });
  if (!res.data.cid) return undefined;
  return { uri: res.data.uri, cid: res.data.cid };
}

async function main() {
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"));

  // Read every required env var before the network call, so a missing one
  // fails immediately instead of after a login round-trip.
  const siteUrl = requireEnv("VITE_SITE_URL").replace(/\/$/, "");

  const agent = new AtpAgent({ service: SERVICE });
  await agent.login({
    identifier: requireEnv("ATPROTO_HANDLE"),
    password: requireEnv("ATPROTO_APP_PASSWORD"),
  });
  const repo = agent.session!.did;

  const publication = await agent.com.atproto.repo.putRecord({
    repo,
    collection: PUBLICATION_COLLECTION,
    rkey: PUBLICATION_RKEY,
    record: {
      $type: PUBLICATION_COLLECTION,
      url: siteUrl,
      name: PUBLICATION_NAME,
      description: PUBLICATION_DESCRIPTION,
    },
  });
  const siteUri = publication.data.uri;
  console.log(`publication ${siteUri}`);

  const names = globSync("*.md", { cwd: EPISODE_DIR })
    .filter((n) => !only || n === `${only}.md`)
    .sort();
  if (only && names.length === 0)
    throw new Error(`no episode file for ${only}`);

  for (const name of names) {
    const path = join(EPISODE_DIR, name);
    const fileText = readFileSync(path, "utf8");
    const epSlug = name.slice(0, -3);
    const episode = parseEpisode(fileText, epSlug);

    const bskyPostRef = episode.bskyPostUrl
      ? await resolvePostRef(agent, episode.bskyPostUrl)
      : undefined;

    const res = await agent.com.atproto.repo.putRecord({
      repo,
      collection: DOCUMENT_COLLECTION,
      rkey: epSlug,
      record: buildDocumentRecord(episode, { siteUri, bskyPostRef }),
    });

    const { frontMatter, body } = splitFile(fileText);
    if (frontMatter.atUri !== res.data.uri) {
      frontMatter.atUri = res.data.uri;
      writeFileSync(path, serializeEpisodeFile(frontMatter, body));
      console.log(`${epSlug} -> ${res.data.uri} (atUri written)`);
    } else {
      console.log(`${epSlug} -> ${res.data.uri}`);
    }
  }
}

if (import.meta.main) await main();
