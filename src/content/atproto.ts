/** `https://bsky.app/profile/<handle-or-did>/post/<rkey>` -> its two parts. */
export function bskyUrlToParts(
  url: string,
): { actor: string; rkey: string } | null {
  const m = /^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(
    url.trim(),
  );
  return m ? { actor: m[1], rkey: m[2] } : null;
}

/**
 * `https://bsky.app/profile/<handle-or-did>/post/<rkey>` -> `at://<did>/app.bsky.feed.post/<rkey>`.
 * Build-time only: a handle cannot be resolved without a network call, so the
 * caller passes the show account's DID (VITE_ATPROTO_DID). Returns undefined
 * when the URL is not a post URL, or when a handle URL has no DID to pair with.
 */
export function bskyPostToAtUri(
  url: string,
  did: string | undefined,
): string | undefined {
  const parts = bskyUrlToParts(url);
  if (!parts) return undefined;
  const repo = parts.actor.startsWith("did:") ? parts.actor : did;
  if (!repo) return undefined;
  return `at://${repo}/app.bsky.feed.post/${parts.rkey}`;
}
