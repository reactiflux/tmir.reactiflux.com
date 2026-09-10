import { test } from "node:test";
import assert from "node:assert/strict";
import { cardTitle, runtime } from "../scripts/og.ts";
import { monthYear } from "../src/content/time.ts";

test("strips the boilerplate from every title shape in the archive", () => {
  assert.equal(
    cardTitle("TMiR 2026-07: React-alikes, GOVERNANCE, and state management"),
    "React-alikes, GOVERNANCE, and state management",
  );
  assert.equal(
    cardTitle("This Month in React, May 2024: Updates from React Conf"),
    "Updates from React Conf",
  );
  assert.equal(
    cardTitle("This Month in React (March 2023)"),
    "This Month in React",
  );
  // Nothing to strip: an off-format title survives intact.
  assert.equal(
    cardTitle("Mark & Carl talk with Swizec Teller about using AI at work"),
    "Mark & Carl talk with Swizec Teller about using AI at work",
  );
});

test("formats runtime and publication month", () => {
  assert.equal(runtime(3252), "54m");
  assert.equal(runtime(4200), "1h 10m");
  assert.equal(runtime(undefined), "");
  // Late-in-month dates must not roll back a month through a local timezone.
  assert.equal(monthYear("2023-03-01"), "March 2023");
  assert.equal(monthYear("2023-03-31"), "March 2023");
});
