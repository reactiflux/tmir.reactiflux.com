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
  const match = /^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(
    url.trim(),
  );
  if (!match) return undefined;
  const repo = match[1].startsWith("did:") ? match[1] : did;
  if (!repo) return undefined;
  return `at://${repo}/app.bsky.feed.post/${match[2]}`;
}
