import { test } from "node:test";
import assert from "node:assert/strict";
import { hms, isoDuration, toSeconds } from "../src/content/time.ts";

test("hms formats seconds", () => {
  assert.equal(hms(30), "0:30");
  assert.equal(hms(123), "2:03");
  assert.equal(hms(3723), "1:02:03");
});

test("toSeconds accepts numbers and both string shapes", () => {
  assert.equal(toSeconds(90), 90);
  assert.equal(toSeconds("00:01:30"), 90);
  assert.equal(toSeconds("01:30"), 90);
  assert.equal(toSeconds(undefined), undefined);
  assert.equal(toSeconds("nonsense"), undefined);
});

test("isoDuration formats seconds as an ISO 8601 duration", () => {
  assert.equal(isoDuration(30), "PT30S");
  assert.equal(isoDuration(123), "PT2M3S");
  assert.equal(isoDuration(3723), "PT1H2M3S");
  assert.equal(isoDuration(3600), "PT1H0S");
  assert.equal(isoDuration(0), "PT0S");
});

test("toSeconds rejects empty and over-long values", () => {
  assert.equal(toSeconds(""), undefined);
  assert.equal(toSeconds("   "), undefined);
  assert.equal(toSeconds("00::30"), undefined);
  assert.equal(toSeconds("1:2:3:4"), undefined);
});
