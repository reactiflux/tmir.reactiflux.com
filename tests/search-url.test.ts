import assert from "node:assert/strict";
import test from "node:test";
import { pageUrl, withPageUrls } from "../src/components/search-url.ts";

test("pageUrl drops the .html Pagefind records for flat prerendered files", () => {
  assert.equal(pageUrl("/episodes/2026-08.html"), "/episodes/2026-08");
  assert.equal(
    pageUrl("/episodes/2026-08.html#bun-14"),
    "/episodes/2026-08#bun-14",
  );
  assert.equal(pageUrl("/"), "/");
  assert.equal(pageUrl("/episodes/2026-08"), "/episodes/2026-08");
});

test("withPageUrls rewrites the result and its sub-results", () => {
  const out = withPageUrls({
    url: "/episodes/2025-09.html",
    sub_results: [{ url: "/episodes/2025-09.html#intro" }, {}],
  });
  assert.equal(out.url, "/episodes/2025-09");
  assert.deepEqual(out.sub_results, [{ url: "/episodes/2025-09#intro" }, {}]);
});
