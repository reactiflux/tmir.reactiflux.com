import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonLd } from "../src/content/jsonld.ts";

test("a </script> in the data cannot close the block", () => {
  const out = jsonLd({
    description: "beware </script><script>alert(1)</script>",
  });
  assert.ok(!out.includes("<"));
  assert.equal(
    JSON.parse(out).description,
    "beware </script><script>alert(1)</script>",
  );
});
