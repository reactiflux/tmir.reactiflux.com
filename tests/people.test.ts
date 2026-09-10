import test from "node:test";
import assert from "node:assert/strict";
import { personProfile } from "../src/content/people.ts";

test("speaker names target Transistor while icons prioritize website, Bluesky and GitHub", () => {
  const profile = personProfile(
    "Mark Erikson",
    "https://blog.isquaredsoftware.com/",
  );
  assert.equal(
    profile.episodesUrl,
    "https://tmir.transistor.fm/people/mark-erikson",
  );
  assert.deepEqual(
    profile.links.map((link) => link.label),
    ["Website", "Bluesky", "GitHub"],
  );
  assert.equal(new Set(profile.links.map((link) => link.href)).size, 3);
});

test("Transistor profile URLs never become social icons", () => {
  const profile = personProfile(
    "Mo",
    "https://tmir.transistor.fm/people/mo-javad",
  );
  assert.equal(
    profile.episodesUrl,
    "https://tmir.transistor.fm/people/mo-javad",
  );
  assert.equal(profile.links.length, 3);
  assert.ok(
    profile.links.every((link) => !link.href.includes("transistor.fm")),
  );
});

test("unknown speakers keep available links without inventing Transistor destinations", () => {
  assert.deepEqual(personProfile("New guest", "https://example.com"), {
    episodesUrl: undefined,
    links: [{ label: "Website", href: "https://example.com" }],
  });
  assert.deepEqual(personProfile("New guest"), {
    episodesUrl: undefined,
    links: [],
  });
  assert.equal(
    personProfile("New guest", "https://tmir.transistor.fm/people/new-guest")
      .episodesUrl,
    "https://tmir.transistor.fm/people/new-guest",
  );
});

test("guest aliases resolve to the same verified profiles", () => {
  assert.deepEqual(
    personProfile("Josh Comeau"),
    personProfile("Joshua Comeau"),
  );
  assert.deepEqual(personProfile("MapleLeaf"), personProfile("itsMapleLeaf"));
});

test("guests without person profiles link to their verified Transistor appearance", () => {
  assert.equal(
    personProfile("Elizabeth Woolf").episodesUrl,
    "https://share.transistor.fm/s/1d256264",
  );
  assert.equal(
    personProfile("Omer Kenet").episodesUrl,
    "https://share.transistor.fm/s/002daf8d",
  );
});
