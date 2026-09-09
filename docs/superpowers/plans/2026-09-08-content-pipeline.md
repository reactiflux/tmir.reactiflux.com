# TMiR Content Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the content model (parse, serialize, slug, SRT) and the four scripts (migrate, ingest, publish-transcript, publish-atproto) that turn `content/episodes/<yyyy>-<mm>.md` into the canonical source of truth for This Month in React.

**Architecture:** One markdown file per episode with YAML front matter, a nested outline list, and a `# Transcript` section. A single parser module (`src/content/parse.ts`) turns a file into an `Episode` object; everything downstream (SRT exporter, and later the site) consumes only that object. Four scripts sit on top: `migrate` converts the historical reactiflux.com transcripts, `ingest` fills feed-owned front matter from the Transistor RSS feed, `publish-transcript` pulls a Descript export into the file and pushes an SRT to Transistor, and `publish-atproto` writes the standard.site publication and document records to the show's AT Protocol account and stores each document's AT URI back in front matter. No build step, no bundler, no test framework — Node runs the TypeScript directly and `node:test` runs the tests.

**Tech Stack:** Node v24.15 (native TypeScript type stripping — plain `node file.ts`), `node:test` + `node:assert/strict`, `yaml` and `@atproto/api` (the only runtime dependencies), `prettier` (only dev dependency).

**Spec:** `docs/superpowers/specs/2026-09-08-tmir-site-design.md` — this plan covers the "Content model" and "Scripts" sections plus the SRT exporter. The "Site" section is out of scope.

## Global Constraints

- Node version floor: **22.18** (native type stripping without a flag). The dev machine runs **v24.15.0**, verified with `node --version`. Scripts are run as `node scripts/foo.ts`, never with `--experimental-strip-types`.
- Type stripping only erases types; it does **not** transform syntax. No `enum`, no `namespace`, no parameter properties (`constructor(private x)`), no `declare` fields. Relative imports must carry the `.ts` extension (`import { slug } from "./slug.ts"`).
- Dependencies: `yaml`, plus `@atproto/api` added in Task 7. Dev dependencies: `prettier` only. **Do not add** vitest, jest, tsx, ts-node, commander, yargs, winston, pino, gray-matter, remark, unified, or a markdown AST library. TypeScript itself is not installed — `tsconfig.json` exists to configure editors, and there is no `typecheck` npm script. Tradeoff: no CI type check; the tests are the check.
- `package.json` is `"type": "module"` and `"private": true`.
- Canonical episode files live at `content/episodes/<yyyy>-<mm>.md`. Slug is `<yyyy>-<mm>`.
- All timestamps in canonical files and in the parsed structure are `hh:mm:ss` (zero-padded, hours may exceed 2 digits only in theory; format with `padStart(2, "0")`).
- Anchor slugs are produced by exactly one function, `slug()`, whose rule is copied verbatim from `reactiflux.com/scripts/process-tmir.ts` so existing published anchors keep working.
- Every commit stages only named files. Never `git add -A`, `git add -u`, or `git add .`.
- Every commit message ends with the trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

## File Structure

| Path                                             | Responsibility                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `package.json`                                   | `type: module`, `private`, `test` script, deps                                                          |
| `tsconfig.json`                                  | Editor config only (`noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`)                       |
| `.gitignore`                                     | `node_modules`, `.DS_Store`, `*.m4a`                                                                    |
| `src/content/slug.ts`                            | `slug()`, `normalizeTime()`, `flattenLinks()` — the shared text rules                                   |
| `src/content/parse.ts`                           | Types (`Episode`, `OutlineItem`, `Section`, `Segment`), `splitFile()`, `parseEpisode()`                 |
| `src/content/serialize.ts`                       | `serializeEpisodeFile()` — front matter + untouched body back to a string                               |
| `src/content/srt.ts`                             | `toSrt(episode)`                                                                                        |
| `scripts/migrate.ts`                             | One-time conversion of `reactiflux.com/src/transcripts/tmir-*.md`                                       |
| `scripts/ingest.ts`                              | Transistor feed → ingest-owned front matter                                                             |
| `scripts/publish-transcript.ts`                  | Descript export → file body; SRT → Transistor                                                           |
| `scripts/publish-atproto.ts`                     | `site.standard.publication` + `site.standard.document` records → the show's PDS; `atUri` → front matter |
| `.env` (gitignored), `.env.example`              | every credential and build variable, loaded by `node --env-file-if-exists=.env`                         |
| `tests/*.test.ts`                                | One test file per module/script                                                                         |
| `tests/fixtures/*.md`, `tests/fixtures/feed.xml` | Short real excerpts of each historical format                                                           |

## Canonical Episode File Format

This is the target of `migrate` and the input of `parseEpisode`. Every task refers back to it.

```markdown
---
title: "TMiR 2026-05: Who even is on the Core team anymore, TanStack got pwn'd bad"
date: 2026-05-28
description: "Join Carl Vitullo and Mark Erikson as we discuss ..."
time: 2pm PT / 9pm GMT
location: Main Stage on Reactiflux
transistorId: dd8e79de
audioUrl: https://op3.dev/e/media.transistor.fm/dd8e79de/4c5d3ad7.mp3
duration: 4198
season: 3
episode: 5
people:
  - name: Mark Erikson
    role: Host
    href: https://blog.isquaredsoftware.com
    img: https://img.transistorcdn.com/...jpg
---

- [[00:00:55](#some-podcast-meta)] Some podcast meta
- [[00:01:49](#new-releases)] New Releases
  - [[00:01:51](#ts-v7-beta)] [TS v7 beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/)

# Transcript

## Some podcast meta

**Carl Vitullo:** Okay, let's get into it. [00:00:55]

Stuff has changed. Stuff will continue to change. [00:01:40]

## New Releases

**Carl Vitullo:** But yeah, okay, into some new releases. [00:01:49]
```

Rules:

- Front matter is delimited by a line that is exactly `---` at the start of file and the next line that is exactly `---`.
- The outline region is everything between the front matter and the line `# Transcript`. Only lines matching `^(\s*)- (.+)$` are outline items; anything else in that region is ignored by the parser.
- Outline nesting depth = leading spaces / 2.
- An outline item is `[[hh:mm:ss](#anchor)] <rest>`; the leading timestamp group is optional.
- Section headings are `## <title>` and may contain markdown links.
- A segment is a blank-line-delimited paragraph. It optionally starts with `**Speaker Name:** ` and optionally ends with ` [hh:mm:ss]`. A missing speaker inherits the previous segment's speaker.
- Segments before the first `## ` heading go into a synthesized section titled `Intro` with anchor `intro`.

---

### Task 1: Repo bootstrap and the shared text rules

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/content/slug.ts`
- Test: `tests/slug.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `slug(title: string): string`
  - `normalizeTime(raw: string): string` — `"1:23"` → `"00:01:23"`, `"72:15"` → `"01:12:15"`, `"00:00:55"` → `"00:00:55"`
  - `flattenLinks(text: string): string` — `"[TS v7](https://x)"` → `"TS v7"`
  - `secondsToTimestamp(total: number): string` — `4198` → `"01:09:58"`
  - `timestampToSeconds(ts: string): number` — `"01:09:58"` → `4198`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tmir",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "format": "prettier --write ."
  },
  "dependencies": {
    "yaml": "^2.5.0"
  },
  "devDependencies": {
    "prettier": "^3.3.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

This file is for editors only. `erasableSyntaxOnly` makes an editor flag any syntax Node's type stripper cannot handle.

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src", "scripts", "tests"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.DS_Store
*.m4a
*.srt
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 5: Write the failing test**

Create `tests/slug.test.ts`. The slug expectations are copied from anchors that exist in published reactiflux.com transcripts, so a change here would break live links.

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  slug,
  normalizeTime,
  flattenLinks,
  secondsToTimestamp,
  timestampToSeconds,
} from "../src/content/slug.ts";

test("slug strips markdown links down to their text", () => {
  assert.equal(
    slug("[TS v7 beta](https://devblogs.microsoft.com/typescript/)"),
    "ts-v7-beta",
  );
});

test("slug matches anchors published in existing transcripts", () => {
  assert.equal(slug("Layoffs (seems better!)"), "layoffs-seems-better");
  assert.equal(slug("Astro 4.5, AstroDB"), "astro-45-astrodb");
  assert.equal(slug("Some podcast meta"), "some-podcast-meta");
  assert.equal(
    slug(
      "Job market: [FRED data](https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE), [Layoffs.fyi](https://layoffs.fyi/)",
    ),
    "job-market-fred-data-layoffsfyi",
  );
});

test("slug keeps underscores and digits, drops everything else non-word", () => {
  assert.equal(
    slug("React Strict DOM, Why is it so Great?"),
    "react-strict-dom-why-is-it-so-great",
  );
  assert.equal(slug("Node.js v22"), "nodejs-v22");
});

test("flattenLinks reduces links to text and leaves plain text alone", () => {
  assert.equal(flattenLinks("[a](http://x) and [b](http://y)"), "a and b");
  assert.equal(flattenLinks("no links here"), "no links here");
});

test("normalizeTime pads mm:ss and rolls minutes past 60 into hours", () => {
  assert.equal(normalizeTime("00:16"), "00:00:16");
  assert.equal(normalizeTime("1:23"), "00:01:23");
  assert.equal(normalizeTime("72:15"), "01:12:15");
  assert.equal(normalizeTime("00:00:55"), "00:00:55");
  assert.equal(normalizeTime("1:09:58"), "01:09:58");
});

test("seconds and timestamps round-trip", () => {
  assert.equal(secondsToTimestamp(4198), "01:09:58");
  assert.equal(timestampToSeconds("01:09:58"), 4198);
  assert.equal(secondsToTimestamp(0), "00:00:00");
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/content/slug.ts'`.

- [ ] **Step 7: Write `src/content/slug.ts`**

The body of `slug` is copied from `reactiflux.com/scripts/process-tmir.ts` (the `extractSectionHeaders` anchor block) so published anchors keep resolving. Do not "improve" it — `\w` being ASCII-only is load-bearing.

```ts
/** Reduce `[text](url)` to `text`. */
export function flattenLinks(text: string): string {
  return text.replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

/**
 * Anchor slug. Rule copied verbatim from reactiflux.com/scripts/process-tmir.ts
 * so anchors already published on reactiflux.com keep working.
 */
export function slug(title: string): string {
  return flattenLinks(title)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function timestampToSeconds(ts: string): number {
  return ts.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

export function secondsToTimestamp(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** `mm:ss`, `m:ss`, `h:mm:ss` or `hh:mm:ss` -> `hh:mm:ss`. */
export function normalizeTime(raw: string): string {
  return secondsToTimestamp(timestampToSeconds(raw.trim()));
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore src/content/slug.ts tests/slug.test.ts
git commit -m "feat: bootstrap repo and add shared slug/timestamp rules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Episode parser and serializer

**Files:**

- Create: `src/content/parse.ts`
- Create: `src/content/serialize.ts`
- Create: `tests/fixtures/canonical-2026-05.md`
- Test: `tests/parse.test.ts`

**Interfaces:**

- Consumes: `slug`, `flattenLinks`, `normalizeTime` from `src/content/slug.ts`.
- Produces:

  ```ts
  export interface Person {
    name: string;
    role?: string;
    href?: string;
    img?: string;
  }
  export interface OutlineItem {
    title: string;
    url?: string;
    time?: string;
    anchor: string;
    children: OutlineItem[];
  }
  export interface Segment {
    speaker: string;
    time?: string;
    text: string;
  }
  export interface Section {
    title: string;
    anchor: string;
    time?: string;
    segments: Segment[];
  }
  export interface Episode {
    slug: string;
    title: string;
    date: string;
    description: string;
    time?: string;
    location?: string;
    transistorId?: string;
    audioUrl?: string;
    duration?: number;
    season?: number;
    episode?: number;
    people: Person[];
    bskyPostUrl?: string; // written by ingest (Task 4)
    atUri?: string; // written by publish-atproto (Task 7), never by ingest
    outline: OutlineItem[];
    sections: Section[];
  }
  export function splitFile(text: string): {
    frontMatter: Record<string, unknown>;
    body: string;
  };
  export function parseOutline(region: string): OutlineItem[];
  export function parseEpisode(text: string, epSlug: string): Episode;
  export function serializeEpisodeFile(
    frontMatter: Record<string, unknown>,
    body: string,
  ): string; // from serialize.ts
  ```

- [ ] **Step 1: Create the canonical fixture**

Create `tests/fixtures/canonical-2026-05.md` — a trimmed excerpt of the real `tmir-2026-05.md` in canonical shape:

```markdown
---
title: "TMiR 2026-05: Who even is on the Core team anymore, TanStack got pwn'd bad"
date: 2026-05-28
description: "Join Carl Vitullo and Mark Erikson as we discuss what the heck is going on at the React Core team."
time: 2pm PT / 9pm GMT
location: Main Stage on Reactiflux
transistorId: dd8e79de
audioUrl: https://op3.dev/e/media.transistor.fm/dd8e79de/4c5d3ad7.mp3
duration: 4198
season: 3
episode: 5
people:
  - name: Mark Erikson
    role: Host
    href: https://blog.isquaredsoftware.com
    img: https://img.transistorcdn.com/mark.jpg
  - name: Carl Vitullo
    role: Producer
    href: https://vcarl.com
    img: https://img.transistorcdn.com/carl.jpg
---

- [[00:00:55](#some-podcast-meta)] Some podcast meta
- [[00:01:49](#new-releases)] New Releases
  - [[00:01:51](#ts-v7-beta)] [TS v7 beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/)
  - [[00:05:15](#rolldown-10)] [Rolldown 1.0](https://voidzero.dev/posts/announcing-rolldown-1-0)
- Outro

# Transcript

**Carl Vitullo:** Thank you for joining us. We're coming to you live from Reactiflux. [00:00:00]

## Some podcast meta

**Carl Vitullo:** Okay, let's get into it. Before we go into, like, new releases and whatever. [00:00:55]

Stuff has changed. Stuff will continue to change. Just like life. [00:01:40]

**Mark Erikson:** Yeah, that sounds all too real. [00:01:44]

## New Releases

**Carl Vitullo:** But yeah, okay, into some new releases. [00:01:49]
```

- [ ] **Step 2: Write the failing test**

Create `tests/parse.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEpisode, splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";

const raw = readFileSync(
  new URL("./fixtures/canonical-2026-05.md", import.meta.url),
  "utf8",
);
const ep = parseEpisode(raw, "2026-05");

test("front matter fields land on the episode", () => {
  assert.equal(ep.slug, "2026-05");
  assert.match(ep.title, /^TMiR 2026-05:/);
  assert.equal(ep.date, "2026-05-28");
  assert.equal(ep.time, "2pm PT / 9pm GMT");
  assert.equal(ep.location, "Main Stage on Reactiflux");
  assert.equal(ep.transistorId, "dd8e79de");
  assert.equal(ep.duration, 4198);
  assert.equal(ep.season, 3);
  assert.equal(ep.episode, 5);
});

test("people is a list of objects", () => {
  assert.equal(ep.people.length, 2);
  assert.deepEqual(ep.people[0], {
    name: "Mark Erikson",
    role: "Host",
    href: "https://blog.isquaredsoftware.com",
    img: "https://img.transistorcdn.com/mark.jpg",
  });
});

test("outline nests by indentation and derives anchors from titles", () => {
  assert.equal(ep.outline.length, 3);
  assert.equal(ep.outline[0].title, "Some podcast meta");
  assert.equal(ep.outline[0].time, "00:00:55");
  assert.equal(ep.outline[0].anchor, "some-podcast-meta");
  assert.equal(ep.outline[0].url, undefined);
  assert.equal(ep.outline[0].children.length, 0);

  assert.equal(ep.outline[1].title, "New Releases");
  assert.equal(ep.outline[1].children.length, 2);
  assert.equal(ep.outline[1].children[0].title, "TS v7 beta");
  assert.equal(ep.outline[1].children[0].anchor, "ts-v7-beta");
  assert.equal(
    ep.outline[1].children[0].url,
    "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/",
  );

  assert.equal(ep.outline[2].title, "Outro");
  assert.equal(ep.outline[2].time, undefined);
});

test("segments before the first heading go into an Intro section", () => {
  assert.equal(ep.sections[0].title, "Intro");
  assert.equal(ep.sections[0].anchor, "intro");
  assert.equal(ep.sections[0].segments.length, 1);
  assert.equal(ep.sections[0].time, "00:00:00");
});

test("sections carry anchors and the time of their first segment", () => {
  assert.equal(ep.sections.length, 3);
  assert.equal(ep.sections[1].title, "Some podcast meta");
  assert.equal(ep.sections[1].anchor, "some-podcast-meta");
  assert.equal(ep.sections[1].time, "00:00:55");
  assert.equal(ep.sections[2].anchor, "new-releases");
});

test("speaker carries forward across consecutive paragraphs", () => {
  const segs = ep.sections[1].segments;
  assert.equal(segs.length, 3);
  assert.equal(segs[0].speaker, "Carl Vitullo");
  assert.equal(segs[0].time, "00:00:55");
  assert.equal(segs[1].speaker, "Carl Vitullo");
  assert.equal(
    segs[1].text,
    "Stuff has changed. Stuff will continue to change. Just like life.",
  );
  assert.equal(segs[2].speaker, "Mark Erikson");
});

test("serialize round-trips a file byte for byte", () => {
  const { frontMatter, body } = splitFile(raw);
  assert.equal(serializeEpisodeFile(frontMatter, body), raw);
});

test("serialize writes a changed field without disturbing the body", () => {
  const { frontMatter, body } = splitFile(raw);
  frontMatter.duration = 5000;
  const out = serializeEpisodeFile(frontMatter, body);
  assert.match(out, /^duration: 5000$/m);
  assert.ok(
    out.includes(
      "**Mark Erikson:** Yeah, that sounds all too real. [00:01:44]",
    ),
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/content/parse.ts'`.

- [ ] **Step 4: Write `src/content/serialize.ts`**

```ts
import YAML from "yaml";

/**
 * Re-emit front matter and splice the original body back on untouched.
 * `body` is exactly what splitFile() returned, so an unchanged front matter
 * object round-trips the file.
 */
export function serializeEpisodeFile(
  frontMatter: Record<string, unknown>,
  body: string,
): string {
  const yaml = YAML.stringify(frontMatter, { lineWidth: 0 });
  return `---\n${yaml}---\n${body}`;
}
```

- [ ] **Step 5: Write `src/content/parse.ts`**

```ts
import YAML from "yaml";
import { flattenLinks, normalizeTime, slug } from "./slug.ts";

export interface Person {
  name: string;
  role?: string;
  href?: string;
  img?: string;
}

export interface OutlineItem {
  title: string;
  url?: string;
  time?: string;
  anchor: string;
  children: OutlineItem[];
}

export interface Segment {
  speaker: string;
  time?: string;
  text: string;
}

export interface Section {
  title: string;
  anchor: string;
  time?: string;
  segments: Segment[];
}

export interface Episode {
  slug: string;
  title: string;
  date: string;
  description: string;
  time?: string;
  location?: string;
  transistorId?: string;
  audioUrl?: string;
  duration?: number;
  season?: number;
  episode?: number;
  people: Person[];
  /** Announcement post on Bluesky, captured by ingest from the feed description. */
  bskyPostUrl?: string;
  /** AT URI of this episode's site.standard.document record. Owned by
   *  scripts/publish-atproto.ts — ingest must never write it. */
  atUri?: string;
  outline: OutlineItem[];
  sections: Section[];
}

export const TRANSCRIPT_MARKER = "# Transcript";

/** Split a file into its parsed front matter and the raw body text after it. */
export function splitFile(text: string): {
  frontMatter: Record<string, unknown>;
  body: string;
} {
  if (!text.startsWith("---\n")) {
    throw new Error("file does not start with front matter");
  }
  const end = text.indexOf("\n---\n", 3);
  if (end === -1) throw new Error("unterminated front matter");
  const yaml = text.slice(4, end + 1);
  return {
    frontMatter: (YAML.parse(yaml) ?? {}) as Record<string, unknown>,
    body: text.slice(end + 5),
  };
}

const OUTLINE_LINE = /^(\s*)- (.+)$/;
const OUTLINE_TIME = /^\[\[(\d{1,3}(?::\d{2}){1,2})\]\(#[^)]*\)\]\s*/;
const FIRST_LINK = /\[[^\]]*\]\(([^)]+)\)/;

export function parseOutline(region: string): OutlineItem[] {
  const roots: OutlineItem[] = [];
  // stack[d] is the item most recently opened at depth d
  const stack: OutlineItem[] = [];

  for (const line of region.split("\n")) {
    const m = OUTLINE_LINE.exec(line);
    if (!m) continue;
    const depth = Math.floor(m[1].length / 2);

    let rest = m[2].trim();
    let time: string | undefined;
    const t = OUTLINE_TIME.exec(rest);
    if (t) {
      time = normalizeTime(t[1]);
      rest = rest.slice(t[0].length);
    }
    const link = FIRST_LINK.exec(rest);
    const title = flattenLinks(rest).trim();
    const item: OutlineItem = {
      title,
      url: link ? link[1] : undefined,
      time,
      anchor: slug(title),
      children: [],
    };

    if (depth === 0 || stack.length === 0) {
      roots.push(item);
      stack.length = 0;
      stack.push(item);
    } else {
      const parentDepth = Math.min(depth, stack.length) - 1;
      stack[parentDepth].children.push(item);
      stack.length = parentDepth + 1;
      stack.push(item);
    }
  }
  return roots;
}

const SPEAKER = /^\*\*(.+?):\*\*\s*/;
const TRAILING_TIME = /\s*\[(\d{1,3}(?::\d{2}){1,2})\]\s*$/;

function parseSegment(paragraph: string, lastSpeaker: string): Segment {
  let text = paragraph.trim();
  let speaker = lastSpeaker;

  const s = SPEAKER.exec(text);
  if (s) {
    speaker = s[1].trim();
    text = text.slice(s[0].length);
  }

  let time: string | undefined;
  const t = TRAILING_TIME.exec(text);
  if (t) {
    time = normalizeTime(t[1]);
    text = text.slice(0, t.index);
  }

  return { speaker, time, text: text.trim() };
}

function parseSections(region: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: "Intro", anchor: "intro", segments: [] };
  let lastSpeaker = "";

  // Blank-line-delimited blocks; a heading is always its own block.
  for (const block of region.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      if (current.segments.length > 0) sections.push(current);
      const title = trimmed.slice(3).trim();
      current = { title, anchor: slug(title), segments: [] };
      lastSpeaker = "";
      continue;
    }
    if (trimmed.startsWith("#")) continue; // stray heading, not a section

    const seg = parseSegment(trimmed, lastSpeaker);
    lastSpeaker = seg.speaker;
    current.segments.push(seg);
  }
  if (current.segments.length > 0) sections.push(current);

  for (const section of sections) {
    section.time = section.segments.find((s) => s.time)?.time;
  }
  return sections;
}

export function parseEpisode(text: string, epSlug: string): Episode {
  const { frontMatter, body } = splitFile(text);
  const marker = body.indexOf(`\n${TRANSCRIPT_MARKER}\n`);
  const outlineRegion = marker === -1 ? body : body.slice(0, marker);
  const transcriptRegion =
    marker === -1 ? "" : body.slice(marker + TRANSCRIPT_MARKER.length + 2);

  const fm = frontMatter as Record<string, any>;
  return {
    slug: epSlug,
    title: String(fm.title ?? ""),
    date: String(fm.date ?? ""),
    description: String(fm.description ?? ""),
    time: fm.time,
    location: fm.location,
    transistorId: fm.transistorId,
    audioUrl: fm.audioUrl,
    duration: fm.duration,
    season: fm.season,
    episode: fm.episode,
    people: Array.isArray(fm.people) ? (fm.people as Person[]) : [],
    bskyPostUrl: fm.bskyPostUrl,
    atUri: fm.atUri,
    outline: parseOutline(outlineRegion),
    sections: parseSections(transcriptRegion),
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS. If the round-trip test fails, the cause is almost always `YAML.stringify` quoting or date handling — `date: 2026-05-28` parses to a JS `Date` and re-emits as a timestamp. Fix by parsing dates as strings: pass `{ customTags: [] }`? No — instead call `YAML.parse(yaml, { schema: "core", customTags: [] })` and, if a `Date` still appears, use `YAML.parse(yaml, { keepSourceTokens: false, schema: "failsafe" })` for the round-trip path. The simplest correct fix, and the one to apply: in `splitFile`, call `YAML.parse(yaml)` and then coerce a `Date`-valued `date` back with `fm.date = String(fm.date).slice(0, 10)` **only inside `parseEpisode`**, leaving `splitFile`'s object untouched so serialize round-trips. Verify with the round-trip test.

- [ ] **Step 7: Commit**

```bash
git add src/content/parse.ts src/content/serialize.ts tests/parse.test.ts tests/fixtures/canonical-2026-05.md
git commit -m "feat: add episode parser and front-matter serializer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Migrate historical transcripts

**Files:**

- Create: `scripts/migrate.ts`
- Create: `tests/fixtures/legacy-2023-march.md`
- Create: `tests/fixtures/legacy-2024-03.md`
- Create: `tests/fixtures/legacy-2025-01.md`
- Create: `tests/fixtures/legacy-2025-06.md`
- Create: `tests/fixtures/legacy-2026-05.md`
- Test: `tests/migrate.test.ts`

**Where the transcript starts.** The boundary is the first _speaker paragraph_ — a block matching `^(\[\d…\]\s*)?\*\*[^*]+:\*\*`. But a `##` section heading can sit directly above that paragraph (as in `tmir-2024-03.md`, whose transcript opens with `## Layoffs (seems better!)` before the first `**Carl Vitullo:**` block in some months), so after finding the first speaker paragraph, walk _backwards_ over any contiguous `##` heading blocks and include them in the transcript. Walk back over `##` only, never `#`: a lone `#` heading immediately above the transcript is the old transcript-start marker (`# Interview`, `# This Month in React: June, 2025`, `# This Month in React 2023 April`) and is dropped silently, while an `#` heading anywhere else in the outline region (`# Main Content` in `tmir-2024-04.md`) is dropped with a warning.

**Interfaces:**

- Consumes: `normalizeTime`, `slug`, `flattenLinks` from `src/content/slug.ts`; `parseEpisode` from `src/content/parse.ts`; `serializeEpisodeFile` from `src/content/serialize.ts`.
- Produces:
  - `slugFromFilename(name: string): string | null` — `"tmir-march-2023.md"` → `"2023-03"`, `"tmir-2024-03.md"` → `"2024-03"`
  - `convert(raw: string): { text: string; warnings: string[] }`

**Historical format survey (derived by reading all 39 files in `/Users/vcarl/workspace/reactiflux.com/src/transcripts/`):**

There is no clean three-era split — the markers vary per file. Detect each feature independently rather than branching on an era:

| Feature               | Variants observed                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header block          | `<iframe …>` (36 files); `<style>…</style>` before it from 2025-01 on; three files have no iframe at all (`tmir-2025-09.md`, `tmir-dec-2023.md`, `tmir-nov-2023.md`) |
| Pre-outline link list | `- [Spotify](…)` / `- [Apple Podcasts](…)` / `- [RSS](…)` bullets before the iframe (2023–2024)                                                                      |
| Outline               | absent (all of 2023 except dec/nov, plus `tmir-2025-06.md`); `- [[mm:ss](#anchor)] …`; `- [[hh:mm:ss](#anchor)] …` (2026)                                            |
| Transcript start      | no marker at all; or an h1 like `# This Month in React: June, 2025` / `# Interview` / `# This Month in React 2023 April`                                             |
| Section headings      | `## Title` (most); `# Title` (`tmir-june-2023.md`, five of them); `## [00:52] title` (`tmir-2025-06.md`)                                                             |
| Paragraph timestamp   | trailing `… [00:16]`; leading `[01:23] **Carl Vitullo:** …`                                                                                                          |
| Speaker labels        | `**Carl Vitullo:**`, `**Carl:**`, raw Descript ids `**1-vcarl:**` (`tmir-2025-06.md`)                                                                                |

Two traps confirmed by reading the files:

- `tmir-2024-04.md` has `# Main Content` **inside the outline region** at line 44, before any speaker paragraph. So "the first h1 starts the transcript" is wrong. The reliable boundary is **the first speaker paragraph** — a paragraph matching `^(\[\d…\]\s*)?\*\*[^*]+:\*\*`. Everything before it is the outline region.
- `tmir-2025-06.md` has an outline with no timestamps and no anchors, and a prose apology line (`We had some problems with transcript generation this month…`) sitting between the iframe and the outline. Cause: that month's audio recording failed, so Descript produced no usable timecoded export and the outline was written by hand without timestamps. Migrate must not crash on it; it emits outline items with no `time` and warns.

Slug/anchor note: outline anchors written into the old files are sometimes wrong (`tmir-2024-03.md` has `#react-strict-dom-why-is-it-so-great?` with a stray `?`). Migrate **discards** the written anchor and re-derives it from the title text, which is what the parser does too.

- [ ] **Step 1: Create the five legacy fixtures**

Each is a real excerpt trimmed to 20–40 lines. Copy exactly.

`tests/fixtures/legacy-2023-march.md` (no outline, trailing `mm:ss`, `##` sections):

```markdown
---
title: This Month in React (March 2023)
date: 2023-03-29
time: 10am PT / 5PM GMT
location: Q&A Channel on Reactiflux
description: "Join Carl Vitullo, Mark Erikson, and Matt Pocock as we break down This Month in React."
people: "[Carl Vitullo](https://twitter.com/vcarl_), [Mark Erikson](https://twitter.com/acemarke), and [Matt Pocock](https://twitter.com/mattpocockuk)"
---

<iframe src="https://podcasters.spotify.com/pod/show/reactiflux/embed/episodes/This-Month-In-React--March-2023-e21n2om" height="102px" width="400px" frameborder="0" scrolling="no"></iframe>

**Carl Vitullo:** Thanks everyone for joining us for this month in React. [00:16]

**Mark Erikson:** Sure. Hi, I'm Mark Erickson. I maintain Redux. [00:53]

## Retire SPA and MPA?

**Carl Vitullo:** So I'll kick us off here. Dan Abramov tweeted about retiring terms. [02:10]

Yeah. What do you guys think about that? [02:38]

## Create React App no longer officially recommended

**Mark Erikson:** There definitely has been a shift in the discussion. [03:07]
```

`tests/fixtures/legacy-2024-03.md` (link list, outline with `mm:ss`, leading timestamps):

```markdown
---
title: "This Month in React, March 2024: React canary is 19"
date: 2024-03-27
time: 10am PT / 5PM GMT
location: Main Stage on Reactiflux
description: "Join Carl Vitullo and Mark Erikson as we break down This Month in React."
people: "[Carl Vitullo](https://twitter.com/vcarl_) and [Mark Erikson](https://twitter.com/acemarke)"
---

- [Spotify](https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH)
- [Apple Podcasts](https://podcasts.apple.com/us/podcast/reactiflux-events/id1661733526)
- [RSS](https://anchor.fm/s/a1f8a59c/podcast/rss)

<iframe src="https://podcasters.spotify.com/pod/show/reactiflux/embed/episodes/TMiR-2024-03-e2hsspd" height="102px" width="400px" frameborder="0" scrolling="no"></iframe>

- Quick Hits
  - [[00:39](#layoffs-seems-better)] [Layoffs.fyi](https://layoffs.fyi/)
  - [[01:20](#new-releases)] New releases
    - [[06:55](#astro-45-astrodb)] [Astro 4.5](https://astro.build/blog/astro-450/)

[00:22] **Carl Vitullo:** We got a lot of good stuff to discuss and digest here.

## Layoffs (seems better!)

[00:39] **Carl Vitullo:** I'm going to start off with some layoffs news.

[00:58] This month has about 7, 200 laid off so far.

## New releases

[01:20] On to some new releases. We have a pretty big list this month.

[01:23] **Carl Vitullo:** We've got some news from React Native.
```

`tests/fixtures/legacy-2025-01.md` (style block, outline with `mm:ss`, trailing timestamps, short speaker names):

```markdown
---
title: "TMiR 2025-01: Movement on CRA, Redwood.js dead?"
date: 2025-01-29
time: 10am PT / 5PM GMT
location: Main Stage on Reactiflux
description: "Join Carl, Mark, and Mo as we break down This Month in React."
people: "[Carl](https://twitter.com/vcarl_), [Mark](https://twitter.com/acemarke), and [Mo](https://twitter.com/mo__javad)"
---

<style>
iframe {
  width: 100%;
  height: 15rem;
}
html li p {
  margin-bottom: 0;
}
</style>

<iframe src="https://creators.spotify.com/pod/show/reactiflux/embed/episodes/TMiR-2025-01-e2u8ofd" height="102px" width="400px" frameborder="0" scrolling="no"></iframe>

- [[01:29](#job-market-fred-data-layoffsfyi)] Job market: [FRED data](https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE), [Layoffs.fyi](https://layoffs.fyi/)
- [[04:17](#new-releases)] New releases
  - [[04:26](#react-query-563)] [React query 5.63](https://bsky.app/profile/tkdodo.eu/post/3lfaeteulds2i)

**Mark:** am making the news. [01:26]

**Carl:** making the news and then reporting on it. Cool.

## Job market: [FRED data](https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE), [Layoffs.fyi](https://layoffs.fyi/)

**Carl:** Yeah, let's start off briefly, overview of the job market. [01:50]

But conferences still don't have a ton of queued up ones.
```

`tests/fixtures/legacy-2025-06.md` (no outline timestamps, h1 marker, timestamps inside headings, Descript speaker ids):

```markdown
---
title: "TMiR 2025-06: kinda quiet tbh. ES2025 finalized, new Safari"
date: 2025-06-30
time: 10am PT / 5PM GMT
location: Main Stage on Reactiflux
description: "Join Carl, Mark, and Mo as we break down This Month in React."
people: "[Carl](https://twitter.com/vcarl_), [Mark](https://twitter.com/acemarke), and [Mo](https://twitter.com/mo__javad)"
---

<style>
iframe {
  position: sticky;
  top: 0;
}
</style>

<iframe width="100%" height="180" frameborder="no" scrolling="no" seamless="" src="https://share.transistor.fm/e/feba4de9"></iframe>

We had some problems with transcript generation this month, downstream of the audio recording issues. Sorry! Fixed for July.

- Job market [FRED data](https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE), [Layoffs.fyi](https://layoffs.fyi/)
- New releases
  - [Recharts v3.0](https://github.com/recharts/recharts/releases/tag/v3.0.0)

# This Month in React: June, 2025

[00:00] **1-vcarl:** Hi, Carl here. Just a quick note before we get into this episode.

[00:51] **1-vcarl:** Endlessly!

## [00:52] job market

[00:52] **1-vcarl:** Start off with a little bit of job market news.

## [02:19] New Releases

[02:19] **1-vcarl:** Yeah. New releases.
```

`tests/fixtures/legacy-2026-05.md` (current format: `hh:mm:ss` outline, `# Interview` marker, trailing `hh:mm:ss`):

```markdown
---
title: "TMiR 2026-05: Who even is on the Core team anymore, TanStack got pwn'd bad"
date: 2026-05-28
time: 2pm PT / 9pm GMT
location: Main Stage on Reactiflux
description: "Join Carl Vitullo and Mark Erikson as we discuss what the heck is going on at the React Core team."
people: "[Carl](https://bsky.app/profile/vcarl.com), [Mark](https://bsky.app/profile/acemarke.dev)"
---

<style>
iframe {
  position: sticky;
  top: 0;
}
h2 {
  scroll-margin-top: 188px;
}
</style>

<iframe width="100%" height="180" frameborder="no" scrolling="no" seamless="" src="https://share.transistor.fm/e/dd8e79de"></iframe>

- [[00:00:55](#some-podcast-meta)] Some podcast meta
- [[00:01:49](#new-releases)] New Releases
  - [[00:01:51](#ts-v7-beta)] [TS v7 beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/)
- [[01:08:39](#outro)] Outro

# Interview

**Carl Vitullo:** Thank you for joining us. We're coming to you live from Reactiflux. [00:00:00]

## Some podcast meta

**Carl Vitullo:** Okay, let's get into it. [00:00:55]

Stuff has changed. Stuff will continue to change. Just like life. [00:01:40]

## New Releases

**Carl Vitullo:** But yeah, okay, into some new releases. [00:01:49]
```

- [ ] **Step 2: Write the failing test**

Create `tests/migrate.test.ts`. Each format asserts the exact converted output, then round-trips it through the parser.

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { convert, slugFromFilename } from "../scripts/migrate.ts";
import { parseEpisode } from "../src/content/parse.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("slugFromFilename maps both filename styles", () => {
  assert.equal(slugFromFilename("tmir-2024-03.md"), "2024-03");
  assert.equal(slugFromFilename("tmir-march-2023.md"), "2023-03");
  assert.equal(slugFromFilename("tmir-april-2023.md"), "2023-04");
  assert.equal(slugFromFilename("tmir-dec-2023.md"), "2023-12");
  assert.equal(slugFromFilename("tmir-nov-2023.md"), "2023-11");
  assert.equal(slugFromFilename("tmir-october-2023.md"), "2023-10");
  assert.equal(slugFromFilename("ali-spittel.md"), null);
});

test("2023 format: iframe stripped, outline synthesized from headings", () => {
  const { text, warnings } = convert(fixture("legacy-2023-march.md"));
  assert.ok(!text.includes("<iframe"));
  assert.ok(
    text.includes(
      "- [[00:02:10](#retire-spa-and-mpa)] Retire SPA and MPA?\n" +
        "- [[00:03:07](#create-react-app-no-longer-officially-recommended)] Create React App no longer officially recommended\n",
    ),
    text,
  );
  assert.ok(text.includes("\n# Transcript\n"));
  assert.ok(
    text.includes(
      "**Carl Vitullo:** Thanks everyone for joining us for this month in React. [00:00:16]",
    ),
  );
  assert.deepEqual(warnings, []);

  const ep = parseEpisode(text, "2023-03");
  assert.equal(ep.sections.length, 3); // Intro + 2
  assert.equal(ep.sections[0].title, "Intro");
  assert.equal(ep.outline.length, 2);
  assert.equal(ep.outline[0].anchor, ep.sections[1].anchor);
});

test("2024 format: link list dropped, leading timestamps moved to the end", () => {
  const { text } = convert(fixture("legacy-2024-03.md"));
  assert.ok(!text.includes("[Spotify]("));
  assert.ok(!text.includes("<iframe"));
  assert.ok(
    text.includes(
      "- Quick Hits\n  - [[00:00:39](#layoffsfyi)] [Layoffs.fyi](https://layoffs.fyi/)\n",
    ),
    text,
  );
  assert.ok(
    text.includes(
      "**Carl Vitullo:** I'm going to start off with some layoffs news. [00:00:39]",
    ),
  );
  assert.ok(
    text.includes("This month has about 7, 200 laid off so far. [00:00:58]"),
  );

  const ep = parseEpisode(text, "2024-03");
  assert.equal(ep.sections.length, 3); // Intro, Layoffs, New releases
  assert.equal(ep.sections[0].title, "Intro");
  assert.equal(ep.sections[0].segments[0].speaker, "Carl Vitullo");
  assert.equal(ep.sections[1].title, "Layoffs (seems better!)");
  assert.equal(ep.sections[1].time, "00:00:39");
  assert.equal(ep.sections.at(-1)?.title, "New releases");
});

test("2025-01 format: style block dropped, outline anchors re-derived", () => {
  const { text } = convert(fixture("legacy-2025-01.md"));
  assert.ok(!text.includes("<style>"));
  assert.ok(!text.includes("<iframe"));
  assert.ok(
    text.includes(
      "- [[00:01:29](#job-market-fred-data-layoffsfyi)] Job market: [FRED data](https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE), [Layoffs.fyi](https://layoffs.fyi/)\n",
    ),
    text,
  );
  const ep = parseEpisode(text, "2025-01");
  assert.equal(ep.outline[0].anchor, "job-market-fred-data-layoffsfyi");
  assert.equal(ep.sections[1].anchor, "job-market-fred-data-layoffsfyi");
});

test("2025-06 format: heading timestamps moved to the outline, missing times warned", () => {
  const { text, warnings } = convert(fixture("legacy-2025-06.md"));
  assert.ok(text.includes("## job market\n"), text);
  assert.ok(!text.includes("## [00:52]"));
  assert.ok(text.includes("- Job market [FRED data]("));
  assert.ok(
    warnings.some((w) => w.includes("outline item without timestamp")),
    JSON.stringify(warnings),
  );
  assert.ok(
    warnings.some((w) => w.includes("dropped prose before outline")),
    JSON.stringify(warnings),
  );

  const ep = parseEpisode(text, "2025-06");
  assert.equal(ep.sections[1].title, "job market");
  assert.equal(ep.sections[1].time, "00:00:52");
  assert.equal(ep.sections[1].segments[0].speaker, "1-vcarl");
  assert.equal(ep.outline[0].time, undefined);
});

test("2026-05 format: already canonical apart from the embed and marker", () => {
  const { text, warnings } = convert(fixture("legacy-2026-05.md"));
  assert.ok(!text.includes("<style>"));
  assert.ok(!text.includes("<iframe"));
  assert.ok(!text.includes("# Interview"));
  assert.ok(text.includes("\n# Transcript\n"));
  assert.deepEqual(warnings, []);

  const ep = parseEpisode(text, "2026-05");
  assert.equal(ep.outline.length, 3);
  assert.equal(ep.outline[1].children.length, 1);
  assert.equal(ep.sections.length, 3);
  assert.equal(ep.sections[0].title, "Intro");
});

test("converted output re-serializes to itself (idempotent)", () => {
  for (const name of [
    "legacy-2023-march.md",
    "legacy-2024-03.md",
    "legacy-2025-01.md",
    "legacy-2025-06.md",
    "legacy-2026-05.md",
  ]) {
    const once = convert(fixture(name)).text;
    assert.equal(convert(once).text, once, name);
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scripts/migrate.ts'`.

- [ ] **Step 4: Write `scripts/migrate.ts`**

```ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { flattenLinks, normalizeTime, slug } from "../src/content/slug.ts";
import { splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "tmir-2024-03.md" | "tmir-march-2023.md" | "tmir-dec-2023.md" -> "yyyy-mm" */
export function slugFromFilename(name: string): string | null {
  const iso = /^tmir-(\d{4})-(\d{2})\.md$/.exec(name);
  if (iso) return `${iso[1]}-${iso[2]}`;

  const named = /^tmir-([a-z]+)-(\d{4})\.md$/.exec(name);
  if (!named) return null;
  const idx = MONTHS.findIndex((m) => m.startsWith(named[1]));
  if (idx === -1) return null;
  return `${named[2]}-${String(idx + 1).padStart(2, "0")}`;
}

const SPEAKER_PARA = /^(?:\[\d{1,3}(?::\d{2}){1,2}\]\s*)?\*\*[^*]+:\*\*/;
const LEADING_TIME = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*/;
const TRAILING_TIME = /\s*\[(\d{1,3}(?::\d{2}){1,2})\]\s*$/;
const HEADING_TIME = /^(#{1,2})\s*\[(\d{1,3}(?::\d{2}){1,2})\]\s*(.*)$/;
const OUTLINE_LINE = /^(\s*)- (.+)$/;
const OUTLINE_TIME = /^\[\[(\d{1,3}(?::\d{2}){1,2})\]\(#[^)]*\)\]\s*/;

/** Remove <style>…</style> and <iframe …></iframe> blocks. */
function stripEmbeds(body: string): string {
  return body
    .replace(/<style>[\s\S]*?<\/style>\s*/g, "")
    .replace(/<iframe[\s\S]*?<\/iframe>\s*/g, "");
}

export function convert(raw: string): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  const { frontMatter, body } = splitFile(raw);
  const clean = stripEmbeds(body);
  const blocks = clean
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // The transcript starts at the first speaker paragraph, plus any `##`
  // section headings sitting directly above it. Walk back over `##` only:
  // a lone `#` there is the old transcript-start marker (`# Interview`), and
  // a `#` elsewhere in the region is outline structure (2024-04's
  // `# Main Content`).
  let start = blocks.findIndex((b) => SPEAKER_PARA.test(b));
  if (start === -1) {
    warnings.push(
      "no speaker paragraphs found; body left in the outline region",
    );
  }
  while (start > 0 && blocks[start - 1].startsWith("## ")) start -= 1;

  const head = start === -1 ? blocks : blocks.slice(0, start);
  const tail = start === -1 ? [] : blocks.slice(start);

  // --- outline ---
  const outlineLines: string[] = [];
  for (const [i, block] of head.entries()) {
    if (!OUTLINE_LINE.test(block.split("\n")[0])) {
      const isMarker = i === head.length - 1 && /^#\s/.test(block);
      if (isMarker) continue; // old transcript-start marker; drop silently
      if (block.startsWith("#"))
        warnings.push(
          `dropped heading before outline: ${block.split("\n")[0]}`,
        );
      else warnings.push(`dropped prose before outline: ${block.slice(0, 60)}`);
      continue;
    }
    for (const line of block.split("\n")) {
      const m = OUTLINE_LINE.exec(line);
      if (!m) continue;
      let rest = m[2].trim();
      // Drop the pre-iframe subscribe link list.
      if (
        /^\[(Spotify|Apple Podcasts|RSS|or anywhere you prefer)\]\(/.test(rest)
      )
        continue;

      let time: string | undefined;
      const t = OUTLINE_TIME.exec(rest);
      if (t) {
        time = normalizeTime(t[1]);
        rest = rest.slice(t[0].length);
      } else {
        warnings.push(`outline item without timestamp: ${rest.slice(0, 60)}`);
      }
      const anchor = slug(flattenLinks(rest).trim());
      const prefix = time ? `[[${time}](#${anchor})] ` : "";
      outlineLines.push(`${m[1]}- ${prefix}${rest}`);
    }
  }

  // --- transcript ---
  const out: string[] = [];
  const sectionTimes = new Map<string, string>();
  let pendingHeadingAnchor: string | null = null;

  for (const block of tail) {
    const h = HEADING_TIME.exec(block);
    if (h) {
      // `## [00:52] job market` -> heading loses the timestamp
      const title = h[3].trim();
      const anchor = slug(title);
      sectionTimes.set(anchor, normalizeTime(h[2]));
      pendingHeadingAnchor = anchor;
      out.push(`## ${title}`);
      continue;
    }
    if (block.startsWith("#")) {
      const level = /^#+/.exec(block)![0].length;
      const title = block.replace(/^#+\s*/, "").trim();
      // 2023 used h1 for sections; promote to h2.
      pendingHeadingAnchor = slug(title);
      out.push(`## ${title}`);
      if (level > 2)
        warnings.push(`heading deeper than h2 flattened: ${title}`);
      continue;
    }

    // Paragraph: move a leading timestamp to the end.
    let text = block;
    const lead = LEADING_TIME.exec(text);
    let time: string | undefined;
    if (lead) {
      time = normalizeTime(lead[1]);
      text = text.slice(lead[0].length);
    } else {
      const trail = TRAILING_TIME.exec(text);
      if (trail) {
        time = normalizeTime(trail[1]);
        text = text.slice(0, trail.index);
      }
    }
    if (!time)
      warnings.push(`paragraph without timestamp: ${text.slice(0, 60)}`);
    if (!/^\*\*[^*]+:\*\*/.test(text) && out.length === 0) {
      warnings.push(`paragraph without speaker: ${text.slice(0, 60)}`);
    }
    if (
      pendingHeadingAnchor &&
      time &&
      !sectionTimes.has(pendingHeadingAnchor)
    ) {
      sectionTimes.set(pendingHeadingAnchor, time);
      pendingHeadingAnchor = null;
    }
    out.push(time ? `${text.trim()} [${time}]` : text.trim());
  }

  // No outline in the source: synthesize one from the section headings.
  if (outlineLines.length === 0) {
    for (const line of out) {
      if (!line.startsWith("## ")) continue;
      const title = line.slice(3).trim();
      const anchor = slug(title);
      const time = sectionTimes.get(anchor);
      outlineLines.push(
        time ? `- [[${time}](#${anchor})] ${title}` : `- ${title}`,
      );
    }
  }

  const newBody = `\n${outlineLines.join("\n")}\n\n# Transcript\n\n${out.join("\n\n")}\n`;
  return { text: serializeEpisodeFile(frontMatter, newBody), warnings };
}

const SOURCE_DIR = resolve(
  process.env.TMIR_SOURCE_DIR ??
    "/Users/vcarl/workspace/reactiflux.com/src/transcripts",
);
const OUT_DIR = resolve("content/episodes");

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let files = 0;
  let warned = 0;
  for (const name of readdirSync(SOURCE_DIR).sort()) {
    const epSlug = slugFromFilename(name);
    if (!epSlug) continue;
    const { text, warnings } = convert(
      readFileSync(join(SOURCE_DIR, name), "utf8"),
    );
    writeFileSync(join(OUT_DIR, `${epSlug}.md`), text);
    files += 1;
    console.log(
      `${name} -> content/episodes/${epSlug}.md  (${warnings.length} warnings)`,
    );
    for (const w of warnings) {
      console.log(`    ${w}`);
      warned += 1;
    }
  }
  console.log(`\n${files} files migrated, ${warned} warnings.`);
}

if (import.meta.filename === process.argv[1]) main();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS. Adjust the fixture-derived expected strings only if a real rule was misread; never weaken an assertion to make it green.

- [ ] **Step 6: Run migrate against the real corpus**

Run: `node scripts/migrate.ts`
Expected: 39 lines of `tmir-*.md -> content/episodes/yyyy-mm.md`, then a summary. `tmir-october-2023.md` should warn heavily (it has an AI-generated bullet summary in place of a real outline); those are the hand-fix cases the spec expects.

- [ ] **Step 7: Sanity-check one converted file**

Run: `head -40 content/episodes/2026-05.md && node -e "import('./src/content/parse.ts').then(async m=>{const fs=await import('node:fs');const e=m.parseEpisode(fs.readFileSync('content/episodes/2026-05.md','utf8'),'2026-05');console.log(e.outline.length,e.sections.length,e.sections.reduce((n,s)=>n+s.segments.length,0))})"`
Expected: front matter intact, `# Transcript` present, and three non-zero counts.

- [ ] **Step 8: Commit**

Commit the script and fixtures; commit the migrated content separately so the conversion is reviewable on its own.

```bash
git add scripts/migrate.ts tests/migrate.test.ts tests/fixtures/legacy-2023-march.md tests/fixtures/legacy-2024-03.md tests/fixtures/legacy-2025-01.md tests/fixtures/legacy-2025-06.md tests/fixtures/legacy-2026-05.md
git commit -m "feat: add migrate script for historical transcripts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git add content/episodes
git commit -m "chore: migrate reactiflux.com transcripts to content/episodes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Ingest Transistor feed metadata

**Files:**

- Create: `scripts/ingest.ts`
- Create: `tests/fixtures/feed.xml`
- Test: `tests/ingest.test.ts`

**Interfaces:**

- Consumes: `splitFile` from `src/content/parse.ts`; `serializeEpisodeFile` from `src/content/serialize.ts`.
- Produces:
  - `interface FeedItem { slug: string; transistorId: string; audioUrl: string; duration: number; season?: number; episode?: number; people: Person[]; bskyPostUrl?: string }`
  - `parseFeed(xml: string): FeedItem[]`
  - `slugFromTitle(title: string): string | null`
  - `applyFeedItem(fileText: string, item: FeedItem): string`

**Ingest-owned fields:** `transistorId`, `audioUrl`, `duration`, `season`, `episode`, `people`, `bskyPostUrl`. **`atUri` is not one of them** — it is written by `scripts/publish-atproto.ts` (Task 7) and `applyFeedItem` must never read or write it. Since `applyFeedItem` only assigns named keys onto the object returned by `splitFile`, any existing `atUri` survives untouched; the idempotence test below asserts that.

**Feed shape (read from the live feed, saved copy verified):** `https://feeds.transistor.fm/this-month-in-react`. Relevant per-`<item>` tags:

```xml
<item>
  <title>TMiR 2026-05: Who even is on the Core team anymore, TanStack got pwn'd bad</title>
  <podcast:season>3</podcast:season>
  <podcast:episode>5</podcast:episode>
  <link>https://share.transistor.fm/s/dd8e79de</link>
  <enclosure url="https://op3.dev/e/media.transistor.fm/dd8e79de/4c5d3ad7.mp3" length="67205341" type="audio/mpeg"/>
  <itunes:duration>4198</itunes:duration>
  <description><![CDATA[<p>Show notes …</p><p><a href="https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x" title="Reply on Bluesky">Reply on Bluesky</a></p>]]></description>
  <podcast:person role="Host" href="https://blog.isquaredsoftware.com" img="https://img.transistorcdn.com/...jpg">Mark Erikson</podcast:person>
  <podcast:person role="Producer" href="https://vcarl.com" img="https://img.transistorcdn.com/...jpg">Carl Vitullo</podcast:person>
</item>
```

`transistorId` is the id after `/s/` in `<link>` (`dd8e79de`). The channel also carries `<podcast:person>` elements outside any `<item>`; splitting on `<item>` first avoids picking those up.

`bskyPostUrl` is the `href` of the anchor inside the `<description>` CDATA whose `title` attribute is `Reply on Bluesky`. Match on the `bsky.app/profile/…/post/…` shape rather than on the title text, so a renamed link still resolves; older items have no such link at all and leave the field unset.

Title styles actually present in the feed, and the non-TMiR titles that must be rejected:

- `TMiR 2026-05: …`, `TMiR 2023-10: …` → `2026-05`, `2023-10`
- `This Month in React – September 2023` (en dash U+2013) → `2023-09`
- `This Month In React – March 2023` (capital `In`) → `2023-03`
- `This Month in React (April 2023)` → `2023-04`
- Rejected: `Office Hours – …`, `Community Spotlight – …`, `Behind the React Documentary`, `Mark & Carl talk with Swizec Teller about using AI at work`

**XML parsing decision:** regex/line parsing, no `fast-xml-parser`. Tradeoff: a regex reader breaks on nested or attribute-ordered-differently XML, but this feed is machine-generated by Transistor with one tag per line and no nesting inside the tags we read. A dependency buys robustness we would not exercise, and the ingest script has a saved fixture guarding it. If Transistor ever changes generators, swap in `fast-xml-parser` then.

- [ ] **Step 1: Create the trimmed feed fixture**

Create `tests/fixtures/feed.xml` with three items — one current TMiR, one old-style TMiR, one Office Hours that must be filtered out:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>This Month in React</title>
    <podcast:person role="Host" href="https://blog.isquaredsoftware.com" img="https://img.transistorcdn.com/channel.jpg">Mark Erikson</podcast:person>
    <item>
      <title>TMiR 2026-05: Who even is on the Core team anymore, TanStack got pwn&apos;d bad</title>
      <podcast:season>3</podcast:season>
      <podcast:episode>5</podcast:episode>
      <link>https://share.transistor.fm/s/dd8e79de</link>
      <enclosure url="https://op3.dev/e/media.transistor.fm/dd8e79de/4c5d3ad7.mp3" length="67205341" type="audio/mpeg"/>
      <itunes:duration>4198</itunes:duration>
      <description><![CDATA[<p>Join Carl and Mark.</p><p><a href="https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x" title="Reply on Bluesky">Reply on Bluesky</a></p>]]></description>
      <podcast:person role="Host" href="https://blog.isquaredsoftware.com" img="https://img.transistorcdn.com/mark.jpg">Mark Erikson</podcast:person>
      <podcast:person role="Producer" href="https://vcarl.com" img="https://img.transistorcdn.com/carl.jpg">Carl Vitullo</podcast:person>
    </item>
    <item>
      <title>This Month in React &#8211; September 2023</title>
      <podcast:season>1</podcast:season>
      <podcast:episode>9</podcast:episode>
      <link>https://share.transistor.fm/s/aa11bb22</link>
      <enclosure url="https://media.transistor.fm/aa11bb22/ccdd.mp3" length="50000000" type="audio/mpeg"/>
      <itunes:duration>3600</itunes:duration>
      <podcast:person role="Host" href="https://vcarl.com" img="https://img.transistorcdn.com/carl.jpg">Carl Vitullo</podcast:person>
    </item>
    <item>
      <title>Office Hours &#8211; States of Burnout with Jenny Truong</title>
      <link>https://share.transistor.fm/s/99887766</link>
      <enclosure url="https://media.transistor.fm/99887766/eeff.mp3" length="40000000" type="audio/mpeg"/>
      <itunes:duration>3000</itunes:duration>
    </item>
  </channel>
</rss>
```

- [ ] **Step 2: Write the failing test**

Create `tests/ingest.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed, slugFromTitle, applyFeedItem } from "../scripts/ingest.ts";
import { parseEpisode } from "../src/content/parse.ts";

const xml = readFileSync(
  new URL("./fixtures/feed.xml", import.meta.url),
  "utf8",
);

test("slugFromTitle handles every TMiR title style and rejects the rest", () => {
  assert.equal(
    slugFromTitle("TMiR 2026-05: Who even is on the Core team anymore"),
    "2026-05",
  );
  assert.equal(
    slugFromTitle("TMiR 2023-10: React Forget, Canary Releases"),
    "2023-10",
  );
  assert.equal(
    slugFromTitle("This Month in React – September 2023"),
    "2023-09",
  );
  assert.equal(slugFromTitle("This Month In React – March 2023"), "2023-03");
  assert.equal(slugFromTitle("This Month in React (April 2023)"), "2023-04");
  assert.equal(
    slugFromTitle("Office Hours – States of Burnout with Jenny Truong"),
    null,
  );
  assert.equal(slugFromTitle("Behind the React Documentary"), null);
  assert.equal(
    slugFromTitle("Mark & Carl talk with Swizec Teller about using AI at work"),
    null,
  );
});

test("parseFeed extracts TMiR items only", () => {
  const items = parseFeed(xml);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    slug: "2026-05",
    transistorId: "dd8e79de",
    audioUrl: "https://op3.dev/e/media.transistor.fm/dd8e79de/4c5d3ad7.mp3",
    duration: 4198,
    season: 3,
    episode: 5,
    people: [
      {
        name: "Mark Erikson",
        role: "Host",
        href: "https://blog.isquaredsoftware.com",
        img: "https://img.transistorcdn.com/mark.jpg",
      },
      {
        name: "Carl Vitullo",
        role: "Producer",
        href: "https://vcarl.com",
        img: "https://img.transistorcdn.com/carl.jpg",
      },
    ],
    bskyPostUrl:
      "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
  });
  assert.equal(items[1].slug, "2023-09");
  assert.equal(items[1].people.length, 1);
  // The 2023 item has no description and therefore no announcement post.
  assert.equal(items[1].bskyPostUrl, undefined);
});

test("applyFeedItem writes only ingest-owned fields and is idempotent", () => {
  const file = [
    "---",
    'title: "TMiR 2026-05: Who even is on the Core team anymore"',
    "date: 2026-05-28",
    'description: "A description"',
    "time: 2pm PT / 9pm GMT",
    "atUri: at://did:plc:example/site.standard.document/2026-05",
    "---",
    "",
    "- [[00:00:55](#some-podcast-meta)] Some podcast meta",
    "",
    "# Transcript",
    "",
    "**Carl Vitullo:** Hello. [00:00:55]",
    "",
  ].join("\n");

  const item = parseFeed(xml)[0];
  const once = applyFeedItem(file, item);
  assert.equal(applyFeedItem(once, item), once);

  const ep = parseEpisode(once, "2026-05");
  assert.equal(ep.transistorId, "dd8e79de");
  assert.equal(ep.duration, 4198);
  assert.equal(ep.season, 3);
  assert.equal(ep.episode, 5);
  assert.equal(ep.people[1].name, "Carl Vitullo");
  assert.equal(
    ep.bskyPostUrl,
    "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
  );
  // hand-written fields untouched
  assert.equal(ep.time, "2pm PT / 9pm GMT");
  assert.equal(ep.description, "A description");
  assert.equal(ep.sections[0].segments[0].text, "Hello.");
  // atUri belongs to publish-atproto; ingest must leave it exactly as it found it
  assert.equal(ep.atUri, "at://did:plc:example/site.standard.document/2026-05");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scripts/ingest.ts'`.

- [ ] **Step 4: Write `scripts/ingest.ts`**

```ts
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Person } from "../src/content/parse.ts";
import { splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";

export const FEED_URL = "https://feeds.transistor.fm/this-month-in-react";

export interface FeedItem {
  slug: string;
  transistorId: string;
  audioUrl: string;
  duration: number;
  season?: number;
  episode?: number;
  people: Person[];
  bskyPostUrl?: string;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Feed title -> episode slug, or null for Office Hours / Spotlight / one-offs. */
export function slugFromTitle(title: string): string | null {
  const modern = /^TMiR (\d{4})-(\d{2}):/.exec(title);
  if (modern) return `${modern[1]}-${modern[2]}`;

  const legacy =
    /^This Month [Ii]n React\s*(?:[–—-]\s*|\()([A-Za-z]+)\s+(\d{4})\)?$/.exec(
      title.trim(),
    );
  if (!legacy) return null;
  const idx = MONTHS.indexOf(legacy[1].toLowerCase());
  if (idx === -1) return null;
  return `${legacy[2]}-${String(idx + 1).padStart(2, "0")}`;
}

function tag(item: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item);
  return m ? decode(m[1].trim()) : undefined;
}

function attr(fragment: string, name: string): string | undefined {
  const m = new RegExp(`${name}="([^"]*)"`).exec(fragment);
  return m ? decode(m[1]) : undefined;
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  // Split on <item> so channel-level <podcast:person> tags are not picked up.
  for (const chunk of xml.split("<item>").slice(1)) {
    const item = chunk.slice(0, chunk.indexOf("</item>"));
    const title = tag(item, "title");
    if (!title) continue;
    const epSlug = slugFromTitle(title);
    if (!epSlug) continue;

    const link = tag(item, "link") ?? "";
    const transistorId = /\/s\/([^/?#]+)/.exec(link)?.[1];
    const enclosure = /<enclosure\b[^>]*>/.exec(item)?.[0] ?? "";
    const audioUrl = attr(enclosure, "url");
    const duration = Number(tag(item, "itunes:duration") ?? NaN);
    if (!transistorId || !audioUrl || Number.isNaN(duration)) continue;

    const people: Person[] = [];
    for (const m of item.matchAll(
      /<podcast:person\b([^>]*)>([\s\S]*?)<\/podcast:person>/g,
    )) {
      people.push({
        name: decode(m[2].trim()),
        role: attr(m[1], "role"),
        href: attr(m[1], "href"),
        img: attr(m[1], "img"),
      });
    }

    const season = Number(tag(item, "podcast:season") ?? NaN);
    const episode = Number(tag(item, "podcast:episode") ?? NaN);
    // The "Reply on Bluesky" anchor inside the <description> CDATA. Matched on
    // the URL shape, not the link text, so a renamed link still resolves.
    const bskyPostUrl =
      /href="(https:\/\/bsky\.app\/profile\/[^/"]+\/post\/[^"]+)"/.exec(
        item,
      )?.[1];
    items.push({
      slug: epSlug,
      transistorId,
      audioUrl,
      duration,
      season: Number.isNaN(season) ? undefined : season,
      episode: Number.isNaN(episode) ? undefined : episode,
      people,
      bskyPostUrl: bskyPostUrl ? decode(bskyPostUrl) : undefined,
    });
  }
  return items;
}

/**
 * Rewrite only the ingest-owned front matter fields. `atUri` is deliberately
 * absent: it belongs to scripts/publish-atproto.ts and survives untouched
 * because we only assign named keys onto the parsed object.
 */
export function applyFeedItem(fileText: string, item: FeedItem): string {
  const { frontMatter, body } = splitFile(fileText);
  frontMatter.transistorId = item.transistorId;
  frontMatter.audioUrl = item.audioUrl;
  frontMatter.duration = item.duration;
  if (item.season !== undefined) frontMatter.season = item.season;
  if (item.episode !== undefined) frontMatter.episode = item.episode;
  frontMatter.people = item.people;
  if (item.bskyPostUrl !== undefined)
    frontMatter.bskyPostUrl = item.bskyPostUrl;
  return serializeEpisodeFile(frontMatter, body);
}

const EPISODE_DIR = resolve("content/episodes");

async function main() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  const items = parseFeed(await res.text());

  const seen = new Set<string>();
  for (const item of items) {
    const path = join(EPISODE_DIR, `${item.slug}.md`);
    if (!existsSync(path)) {
      console.log(`no file for feed item ${item.slug}`);
      continue;
    }
    seen.add(item.slug);
    const before = readFileSync(path, "utf8");
    const after = applyFeedItem(before, item);
    if (before !== after) {
      writeFileSync(path, after);
      console.log(`updated ${item.slug}`);
    }
  }

  for (const name of readdirSync(EPISODE_DIR)) {
    const epSlug = name.replace(/\.md$/, "");
    if (name.endsWith(".md") && !seen.has(epSlug)) {
      console.log(`no feed item for file ${epSlug}`);
    }
  }
  console.log(`\n${items.length} TMiR feed items, ${seen.size} matched.`);
}

if (import.meta.filename === process.argv[1]) await main();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Run ingest against the live feed**

Run: `node scripts/ingest.ts`
Expected: `updated <slug>` lines for every migrated episode, `no file for feed item` for any episode not yet in `content/episodes/`, and no `no feed item for file` lines except for months that never shipped.

- [ ] **Step 7: Verify idempotence against the live feed**

Run: `node scripts/ingest.ts`
Expected: zero `updated` lines the second time.

- [ ] **Step 8: Commit**

```bash
git add scripts/ingest.ts tests/ingest.test.ts tests/fixtures/feed.xml
git commit -m "feat: add ingest script for Transistor feed metadata

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git add content/episodes
git commit -m "chore: ingest feed metadata into episode front matter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: SRT exporter

**Files:**

- Create: `src/content/srt.ts`
- Test: `tests/srt.test.ts`

**Interfaces:**

- Consumes: `Episode` from `src/content/parse.ts`; `timestampToSeconds`, `secondsToTimestamp` from `src/content/slug.ts`.
- Produces: `toSrt(episode: Episode): string`

Rules: one cue per segment, flattened across all sections in order. Cue text is `Speaker: text`. Cue start is the segment's timestamp; cue end is the next segment's start; the last cue ends 5 seconds after its start. Segments with no timestamp are skipped. SRT time format is `hh:mm:ss,mmm` — always `,000` milliseconds, since the source resolution is one second.

- [ ] **Step 1: Write the failing test**

Create `tests/srt.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEpisode } from "../src/content/parse.ts";
import { toSrt } from "../src/content/srt.ts";

const raw = readFileSync(
  new URL("./fixtures/canonical-2026-05.md", import.meta.url),
  "utf8",
);

test("toSrt numbers cues, formats times, and prefixes the speaker", () => {
  const srt = toSrt(parseEpisode(raw, "2026-05"));
  assert.equal(
    srt,
    [
      "1",
      "00:00:00,000 --> 00:00:55,000",
      "Carl Vitullo: Thank you for joining us. We're coming to you live from Reactiflux.",
      "",
      "2",
      "00:00:55,000 --> 00:01:40,000",
      "Carl Vitullo: Okay, let's get into it. Before we go into, like, new releases and whatever.",
      "",
      "3",
      "00:01:40,000 --> 00:01:44,000",
      "Carl Vitullo: Stuff has changed. Stuff will continue to change. Just like life.",
      "",
      "4",
      "00:01:44,000 --> 00:01:49,000",
      "Mark Erikson: Yeah, that sounds all too real.",
      "",
      "5",
      "00:01:49,000 --> 00:01:54,000",
      "Carl Vitullo: But yeah, okay, into some new releases.",
      "",
    ].join("\n"),
  );
});

test("the last cue runs five seconds", () => {
  const srt = toSrt(parseEpisode(raw, "2026-05"));
  assert.ok(
    srt
      .trimEnd()
      .endsWith("Carl Vitullo: But yeah, okay, into some new releases."),
  );
  assert.ok(srt.includes("00:01:49,000 --> 00:01:54,000"));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/content/srt.ts'`.

- [ ] **Step 3: Write `src/content/srt.ts`**

```ts
import type { Episode } from "./parse.ts";
import { secondsToTimestamp, timestampToSeconds } from "./slug.ts";

const LAST_CUE_SECONDS = 5;

function cueTime(seconds: number): string {
  return `${secondsToTimestamp(seconds)},000`;
}

/** Episode -> SRT with `Speaker: text` cues, one cue per timestamped segment. */
export function toSrt(episode: Episode): string {
  const cues = episode.sections
    .flatMap((section) => section.segments)
    .filter((segment) => segment.time)
    .map((segment) => ({
      start: timestampToSeconds(segment.time!),
      text: segment.speaker
        ? `${segment.speaker}: ${segment.text}`
        : segment.text,
    }));

  return cues
    .map((cue, i) => {
      const end = cues[i + 1]?.start ?? cue.start + LAST_CUE_SECONDS;
      return `${i + 1}\n${cueTime(cue.start)} --> ${cueTime(end)}\n${cue.text}\n`;
    })
    .join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/srt.ts tests/srt.test.ts
git commit -m "feat: add SRT exporter with speaker-prefixed cues

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: publish-transcript script

**Files:**

- Create: `scripts/publish-transcript.ts`
- Test: `tests/publish-transcript.test.ts`

**Interfaces:**

- Consumes: `normalizeTime` from `src/content/slug.ts`; `splitFile`, `parseEpisode`, `TRANSCRIPT_MARKER` from `src/content/parse.ts`; `serializeEpisodeFile` from `src/content/serialize.ts`; `toSrt` from `src/content/srt.ts`.
- Produces:
  - `SPEAKERS: Record<string, string>`
  - `normalizeSpeaker(raw: string): string`
  - `descriptToCanonical(markdown: string): string`
  - `replaceTranscript(fileText: string, transcriptBody: string): string`
  - `fetchDescriptTranscript(projectId: string, token: string): Promise<string>`
  - `pushSrtToTranscript(transistorId: string, srt: string, apiKey: string, showId: string): Promise<void>`

**CLI:** `npm run publish-transcript -- <yyyy-mm> <descriptProjectId> [--skip-descript] [--skip-transistor]`. Argument handling is `process.argv.slice(2)` plus two `includes` checks — no CLI framework.

**Environment:** `DESCRIPT_TOKEN`, `TRANSISTOR_API_KEY`, `TRANSISTOR_SHOW_ID`, read from a gitignored `.env` at the repo root. Task 7 adds the npm scripts that pass `--env-file-if-exists=.env`; until that task lands, the exact equivalent is `node --env-file-if-exists=.env scripts/publish-transcript.ts …`, and every run command in this task can be written either way.

**Descript API (fetched from https://docs.descriptapi.com/, 2026-09-08):**

- Base URL `https://descriptapi.com/v1`
- Auth: `Authorization: Bearer <DESCRIPT_TOKEN>`
- `POST /export/transcript` with JSON body `{ project_id, format, include_speaker_labels, include_markers, timecodes }`; `format` is one of `txt|markdown|html|rtf|docx|srt`. The response is the raw transcript file with a `Content-Disposition: attachment` header, not JSON — so read it with `res.text()`.

**Descript markdown output shape — the one uncertainty in this plan.** The docs describe the endpoint and its parameters but not the exact markdown layout. The assumed shape is taken from `reactiflux.com/src/transcripts/tmir-2025-06.md`, which is a raw Descript markdown export pasted in unmodified:

```
[00:00] **1-vcarl:** Hi, Carl here. Just a quick note before we get into this episode.

[00:11] Hello everyone. Thank you for joining us for the June edition of this month in React.
```

Leading `[mm:ss]`, then optional `**speaker-id:**`, blank-line-separated paragraphs. `descriptToCanonical` converts that to canonical shape (timestamp moved to the end, speaker id mapped). **Verify against docs / a real export** before the first live run — capture one export with `--skip-transistor` and diff it against the assumption; if the shape differs (for example `hh:mm:ss` timecodes, or a `Speaker 1:` prefix without asterisks), the only function that needs changing is `descriptToCanonical`, and the regexes there already accept `mm:ss` and `hh:mm:ss`.

**Transistor API (fetched from https://developers.transistor.fm/, 2026-09-08):**

- Base URL `https://api.transistor.fm`
- Auth header: `x-api-key: <TRANSISTOR_API_KEY>`
- There is **no** dedicated SRT/caption upload endpoint. The documented route is `PATCH /v1/episodes/:id` with the form/JSON parameter `episode[transcript_text]` ("Full text of the episode transcript"). The SRT string is sent as that value.
- `PATCH` needs Transistor's numeric episode id, but our front matter carries the share id (`dd8e79de` from `https://share.transistor.fm/s/dd8e79de`). Resolve it with `GET /v1/episodes?show_id=<TRANSISTOR_SHOW_ID>&pagination[per]=100`, whose episode attributes include `share_url`; match the episode whose `share_url` ends with `/${transistorId}`. Page through until found.

- [ ] **Step 1: Write the failing test**

Only the pure functions are tested; the two HTTP functions are exercised by the live run in Step 6. Create `tests/publish-transcript.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSpeaker,
  descriptToCanonical,
  replaceTranscript,
} from "../scripts/publish-transcript.ts";
import { parseEpisode } from "../src/content/parse.ts";

test("normalizeSpeaker maps Descript ids and passes anything else through", () => {
  assert.equal(normalizeSpeaker("1-vcarl"), "Carl Vitullo");
  assert.equal(normalizeSpeaker("vcarl"), "Carl Vitullo");
  assert.equal(normalizeSpeaker("2-acemarke"), "Mark Erikson");
  assert.equal(normalizeSpeaker("acemarke"), "Mark Erikson");
  assert.equal(normalizeSpeaker("Mo Khazali"), "Mo Khazali");
  assert.equal(normalizeSpeaker("3-guest"), "3-guest");
});

test("descriptToCanonical moves timestamps to the end and maps speakers", () => {
  const input = [
    "[00:00] **1-vcarl:** Hi, Carl here. Just a quick note.",
    "",
    "[00:11] Hello everyone. Thank you for joining us.",
    "",
    "[01:02:03] **2-acemarke:** And I'm Mark.",
    "",
  ].join("\n");

  assert.equal(
    descriptToCanonical(input),
    [
      "**Carl Vitullo:** Hi, Carl here. Just a quick note. [00:00:00]",
      "",
      "Hello everyone. Thank you for joining us. [00:00:11]",
      "",
      "**Mark Erikson:** And I'm Mark. [01:02:03]",
    ].join("\n"),
  );
});

test("replaceTranscript keeps front matter and outline, replaces the body below the marker", () => {
  const file = [
    "---",
    'title: "TMiR 2026-05: test"',
    "date: 2026-05-28",
    'description: "d"',
    "transistorId: dd8e79de",
    "---",
    "",
    "- [[00:00:55](#some-podcast-meta)] Some podcast meta",
    "",
    "# Transcript",
    "",
    "**Old Speaker:** stale text [00:00:01]",
    "",
  ].join("\n");

  const out = replaceTranscript(
    file,
    "## Some podcast meta\n\n**Carl Vitullo:** Fresh text. [00:00:55]",
  );

  assert.ok(!out.includes("stale text"));
  assert.ok(
    out.includes("- [[00:00:55](#some-podcast-meta)] Some podcast meta"),
  );
  assert.ok(out.includes("transistorId: dd8e79de"));

  const ep = parseEpisode(out, "2026-05");
  assert.equal(ep.sections.length, 1);
  assert.equal(ep.sections[0].anchor, "some-podcast-meta");
  assert.equal(ep.sections[0].segments[0].speaker, "Carl Vitullo");
  assert.equal(ep.sections[0].segments[0].text, "Fresh text.");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scripts/publish-transcript.ts'`.

- [ ] **Step 3: Write `scripts/publish-transcript.ts`**

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeTime } from "../src/content/slug.ts";
import { parseEpisode, TRANSCRIPT_MARKER } from "../src/content/parse.ts";
import { toSrt } from "../src/content/srt.ts";

const DESCRIPT_BASE = "https://descriptapi.com/v1";
const TRANSISTOR_BASE = "https://api.transistor.fm";

/** Descript speaker ids -> published names. Anything else is kept as-is. */
export const SPEAKERS: Record<string, string> = {
  "1-vcarl": "Carl Vitullo",
  vcarl: "Carl Vitullo",
  "2-acemarke": "Mark Erikson",
  acemarke: "Mark Erikson",
};

export function normalizeSpeaker(raw: string): string {
  return SPEAKERS[raw.trim()] ?? raw.trim();
}

const LEADING_TIME = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*/;
const SPEAKER = /^\*\*(.+?):\*\*\s*/;

/**
 * Descript markdown export -> canonical transcript body.
 * Assumed input shape (see plan notes; verify against a real export):
 *   `[mm:ss] **1-vcarl:** text`
 */
export function descriptToCanonical(markdown: string): string {
  const out: string[] = [];
  for (const block of markdown.split(/\n{2,}/)) {
    let text = block.trim();
    if (!text) continue;

    let time: string | undefined;
    const t = LEADING_TIME.exec(text);
    if (t) {
      time = normalizeTime(t[1]);
      text = text.slice(t[0].length);
    }
    const s = SPEAKER.exec(text);
    if (s) {
      text = `**${normalizeSpeaker(s[1])}:** ${text.slice(s[0].length)}`;
    }
    out.push(time ? `${text.trim()} [${time}]` : text.trim());
  }
  return out.join("\n\n");
}

/** Swap everything below `# Transcript`, leaving front matter and outline alone. */
export function replaceTranscript(
  fileText: string,
  transcriptBody: string,
): string {
  const marker = fileText.indexOf(`\n${TRANSCRIPT_MARKER}\n`);
  if (marker === -1)
    throw new Error(`file has no "${TRANSCRIPT_MARKER}" heading`);
  const head = fileText.slice(0, marker + TRANSCRIPT_MARKER.length + 1);
  return `${head}\n${transcriptBody.trimEnd()}\n`;
}

export async function fetchDescriptTranscript(
  projectId: string,
  token: string,
): Promise<string> {
  const res = await fetch(`${DESCRIPT_BASE}/export/transcript`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project_id: projectId,
      format: "markdown",
      include_speaker_labels: true,
      include_markers: false,
      timecodes: true,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Descript export failed: ${res.status} ${await res.text()}`,
    );
  }
  return res.text();
}

async function findTransistorEpisodeId(
  transistorId: string,
  apiKey: string,
  showId: string,
): Promise<string> {
  for (let page = 1; page <= 20; page += 1) {
    const url = `${TRANSISTOR_BASE}/v1/episodes?show_id=${encodeURIComponent(showId)}&pagination[page]=${page}&pagination[per]=50`;
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok)
      throw new Error(
        `Transistor list failed: ${res.status} ${await res.text()}`,
      );
    const body = (await res.json()) as {
      data: { id: string; attributes: { share_url?: string } }[];
    };
    if (body.data.length === 0) break;
    const hit = body.data.find((e) =>
      (e.attributes.share_url ?? "").endsWith(`/${transistorId}`),
    );
    if (hit) return hit.id;
  }
  throw new Error(`no Transistor episode with share id ${transistorId}`);
}

export async function pushSrtToTranscript(
  transistorId: string,
  srt: string,
  apiKey: string,
  showId: string,
): Promise<void> {
  const id = await findTransistorEpisodeId(transistorId, apiKey, showId);
  const res = await fetch(`${TRANSISTOR_BASE}/v1/episodes/${id}`, {
    method: "PATCH",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ episode: { transcript_text: srt } }),
  });
  if (!res.ok) {
    throw new Error(
      `Transistor update failed: ${res.status} ${await res.text()}`,
    );
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const skipDescript = args.includes("--skip-descript");
  const skipTransistor = args.includes("--skip-transistor");
  const [epSlug, projectId] = args.filter((a) => !a.startsWith("--"));

  if (!epSlug || (!projectId && !skipDescript)) {
    console.error(
      "usage: npm run publish-transcript -- <yyyy-mm> <descriptProjectId> [--skip-descript] [--skip-transistor]",
    );
    process.exit(1);
  }

  const path = resolve("content/episodes", `${epSlug}.md`);
  let fileText = readFileSync(path, "utf8");

  if (!skipDescript) {
    const markdown = await fetchDescriptTranscript(
      projectId,
      requireEnv("DESCRIPT_TOKEN"),
    );
    fileText = replaceTranscript(fileText, descriptToCanonical(markdown));
    writeFileSync(path, fileText);
    console.log(`wrote transcript into ${path}`);
  }

  if (!skipTransistor) {
    const episode = parseEpisode(fileText, epSlug);
    if (!episode.transistorId) {
      throw new Error(`${epSlug} has no transistorId; run ingest first`);
    }
    const srt = toSrt(episode);
    await pushSrtToTranscript(
      episode.transistorId,
      srt,
      requireEnv("TRANSISTOR_API_KEY"),
      requireEnv("TRANSISTOR_SHOW_ID"),
    );
    console.log(
      `pushed ${srt.split("\n\n").length} SRT cues to Transistor episode ${episode.transistorId}`,
    );
  }
}

if (import.meta.filename === process.argv[1]) await main();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 5: Verify the local half of the CLI without network access**

Run: `node --env-file-if-exists=.env scripts/publish-transcript.ts 2026-05 dummy --skip-descript --skip-transistor`
Expected: exits 0 with no output and no file change (`git diff --stat` is empty).

- [ ] **Step 6: Verify the Descript assumption against a real export**

This is the one step in the plan that needs a credential and cannot be pre-verified. With `DESCRIPT_TOKEN` in `.env` (or the environment) and a real project id:

Run: `node --env-file-if-exists=.env scripts/publish-transcript.ts 2026-05 <realProjectId> --skip-transistor && git diff content/episodes/2026-05.md | head -60`
Expected: the transcript body is replaced with `**Carl Vitullo:** … [hh:mm:ss]` paragraphs. If the speakers come through unmapped or the timestamps land in the wrong place, the Descript export shape differs from the assumption — fix `descriptToCanonical` (and only it), add a test with the real shape pasted in, and rerun.

- [ ] **Step 7: Commit**

```bash
git add scripts/publish-transcript.ts tests/publish-transcript.test.ts
git commit -m "feat: add publish-transcript script for Descript and Transistor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: publish-atproto script, and one `.env` for every script

**Files:**

- Create: `scripts/publish-atproto.ts`
- Create: `.env.example`
- Modify: `.gitignore`, `package.json`
- Test: `tests/publish-atproto.test.ts`

**Interfaces:**

- Consumes: `Episode`, `OutlineItem`, `Person`, `parseEpisode`, `splitFile` from `src/content/parse.ts`; `serializeEpisodeFile` from `src/content/serialize.ts`.
- Produces:
  - `PUBLICATION_NAME: string`, `PUBLICATION_DESCRIPTION: string`
  - `PUBLICATION_COLLECTION = "site.standard.publication"`, `DOCUMENT_COLLECTION = "site.standard.document"`
  - `outlineToText(items: OutlineItem[], depth?: number): string`
  - `bskyUrlToParts(url: string): { actor: string; rkey: string } | null`
  - `buildDocumentRecord(episode: Episode, opts: { siteUri: string; bskyPostRef?: { uri: string; cid: string } }): Record<string, unknown>`

**CLI:** `npm run publish-atproto` publishes the publication record plus every episode; `npm run publish-atproto -- 2026-05` publishes the publication record plus that one episode.

**Environment:** `ATPROTO_HANDLE`, `ATPROTO_APP_PASSWORD`, `VITE_SITE_URL`. All three come from the gitignored `.env` at the repo root, loaded by Node itself (`--env-file-if-exists=.env`) — there is no `dotenv` dependency and no code that reads a file. `VITE_SITE_URL` is the same variable the site build reads, so the publication `url` and the site's canonical URLs can never drift apart.

**Record schemas, verified 2026-09-08 against https://standard.site/docs/lexicons/publication/ and https://standard.site/docs/lexicons/document/:**

- `site.standard.publication` — required `url` (string, the base URL) and `name` (string, ≤5000 chars); optional `description` (≤30000 chars), `icon` (blob), `basicTheme`, `labels`, `preferences`. Written at rkey `self`. (The docs show an alphanumeric rkey in their example and do not mandate `self`; `self` is this project's choice, per the spec, because there is exactly one publication per account and reruns must overwrite it.)
- `site.standard.document` — required `site` (a publication `at://` URI or `https://` URL), `title` (≤5000 chars), `publishedAt` (datetime); optional `path`, `description` (≤30000), `textContent` (plaintext of the contents), `tags` (array of strings), `contributors` (array), `bskyPostRef` (strong ref: `{ uri, cid }`), `links`, `labels`, `coverImage`, `content`, `updatedAt`. Written at rkey = the episode slug so reruns overwrite.
- **`content` is deliberately omitted.** It is an open union of structured content types; the transcript is already carried as `textContent` and lives canonically on the site, and encoding it a second time as a structured document buys nothing at launch.
- **One known conflict, carried deliberately.** The document lexicon marks `contributors[].did` as **required** (`string`, format `did`), and TMiR's `people` come from the Transistor feed, which carries names and URLs but no DIDs. This plan writes `{ displayName, role }` only, per the spec. If the live `putRecord` in Step 8 rejects the record for a missing `did`, the fix is one of: drop `contributors` entirely, or hardcode the two hosts' DIDs in a map beside `SPEAKERS`. Decide at that step; do not pre-build the map.

**`@atproto/api` usage, verified 2026-09-08 against https://www.npmjs.com/package/@atproto/api (latest published version **0.20.42**, read from `https://registry.npmjs.org/@atproto/api/latest`) and the package README at https://github.com/bluesky-social/atproto/tree/main/packages/api:**

```ts
const agent = new AtpAgent({ service: "https://bsky.social" });
await agent.login({ identifier, password });
const res = await agent.com.atproto.repo.putRecord({
  repo,
  collection,
  rkey,
  record,
});
// res.data.uri, res.data.cid
const who = await agent.com.atproto.identity.resolveHandle({ handle }); // who.data.did
const rec = await agent.com.atproto.repo.getRecord({ repo, collection, rkey }); // rec.data.uri, rec.data.cid
```

XRPC calls return `{ success, headers, data }`; the `uri`/`cid`/`did` live on `.data`. `agent.session.did` is the logged-in repo's DID after `login`.

- [ ] **Step 1: Add the dependency**

Run: `npm install @atproto/api@^0.20.42`
Expected: `package.json` gains `"@atproto/api": "^0.20.42"` under `dependencies`; `npm ls @atproto/api` prints a resolved version.

- [ ] **Step 2: Gitignore `.env` and add the npm scripts**

`.gitignore` currently holds exactly:

```
node_modules/
.DS_Store
*.m4a
*.srt
```

Append these two lines (keep `.env.example` tracked):

```
.env
!.env.example
```

Then add three scripts to `package.json`, beside the existing `test` and `format`. `--env-file-if-exists` is a Node 22+ flag, so no code reads `.env` — Node does:

```json
    "ingest": "node --env-file-if-exists=.env scripts/ingest.ts",
    "publish-transcript": "node --env-file-if-exists=.env scripts/publish-transcript.ts",
    "publish-atproto": "node --env-file-if-exists=.env scripts/publish-atproto.ts"
```

`migrate` gets no script — it is a one-time job that needs no credentials.

- [ ] **Step 3: Verify the flag exists on this Node**

Run: `node --version && node --help | grep env-file`
Expected: `v24.15.0` and two lines, `--env-file=...` and `--env-file-if-exists=...`. If `--env-file-if-exists` is absent, the Node is too old — stop, do not fall back to a `dotenv` dependency.

- [ ] **Step 4: Write `.env.example`**

Committed, and the authoritative list of every variable in the repo. `.env` is a copy of it with real values.

```sh
# Copy to .env and fill in. .env is gitignored; this file is not.

# --- scripts ---
# Descript API token, for exporting transcripts (publish-transcript)
DESCRIPT_TOKEN=
# Transistor API key, for pushing the SRT (publish-transcript)
TRANSISTOR_API_KEY=
# Transistor numeric show id, used to resolve a share id to an episode id
TRANSISTOR_SHOW_ID=
# Bluesky/AT Protocol handle that owns the publication (publish-atproto)
ATPROTO_HANDLE=
# App password for that account — not the account password (publish-atproto)
ATPROTO_APP_PASSWORD=

# --- site build (Vite reads these from .env automatically) ---
# Site name in the header, page titles and the feed
VITE_SITE_NAME=This Month in React
# Canonical site URL; also the publication `url` written by publish-atproto
VITE_SITE_URL=https://thismonthinreact.com
# Buttondown username; when unset the newsletter form is omitted entirely
VITE_BUTTONDOWN_USER=
# AT URI of the site.standard.publication record, for /.well-known
VITE_ATPROTO_PUBLICATION_URI=
# DID of the show account, used to build at:// URIs for the comments fetch
VITE_ATPROTO_DID=
# Bluesky profile URL, linked from /about
VITE_BLUESKY_PROFILE_URL=https://bsky.app/profile/thismonthinreact.com
```

- [ ] **Step 5: Write the failing test**

Only the pure functions are tested; `login`, `putRecord`, `resolveHandle` and `getRecord` are exercised by the live run in Step 8, exactly as Task 6 does for Descript and Transistor. Create `tests/publish-atproto.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  outlineToText,
  bskyUrlToParts,
  buildDocumentRecord,
} from "../scripts/publish-atproto.ts";
import { parseEpisode } from "../src/content/parse.ts";

const raw = readFileSync(
  new URL("./fixtures/canonical-2026-05.md", import.meta.url),
  "utf8",
);
const episode = parseEpisode(raw, "2026-05");

test("outlineToText flattens the outline to indented 'Title — url' lines", () => {
  assert.equal(
    outlineToText(episode.outline),
    [
      "Some podcast meta",
      "New Releases",
      "  TS v7 beta — https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/",
      "  Rolldown 1.0 — https://voidzero.dev/posts/announcing-rolldown-1-0",
      "Outro",
    ].join("\n"),
  );
});

test("bskyUrlToParts splits a post URL and rejects anything else", () => {
  assert.deepEqual(
    bskyUrlToParts(
      "https://bsky.app/profile/thismonthinreact.com/post/3lqz7abcd2k2x",
    ),
    { actor: "thismonthinreact.com", rkey: "3lqz7abcd2k2x" },
  );
  assert.deepEqual(
    bskyUrlToParts(
      "https://bsky.app/profile/did:plc:abc123/post/3lqz7abcd2k2x",
    ),
    { actor: "did:plc:abc123", rkey: "3lqz7abcd2k2x" },
  );
  assert.equal(
    bskyUrlToParts("https://bsky.app/profile/thismonthinreact.com"),
    null,
  );
  assert.equal(bskyUrlToParts("https://example.com/whatever"), null);
});

test("buildDocumentRecord matches the site.standard.document lexicon", () => {
  const record = buildDocumentRecord(episode, {
    siteUri: "at://did:plc:show/site.standard.publication/self",
    bskyPostRef: {
      uri: "at://did:plc:show/app.bsky.feed.post/3lqz7abcd2k2x",
      cid: "bafyreiexamplecid",
    },
  });

  assert.equal(record.$type, "site.standard.document");
  assert.equal(record.site, "at://did:plc:show/site.standard.publication/self");
  assert.equal(record.title, episode.title);
  assert.equal(record.publishedAt, "2026-05-28T00:00:00.000Z");
  assert.equal(record.path, "/episodes/2026-05");
  assert.equal(record.description, episode.description);
  assert.ok(String(record.textContent).startsWith("Some podcast meta\n"));
  assert.deepEqual(record.tags, ["devblogs.microsoft.com", "voidzero.dev"]);
  assert.deepEqual(record.contributors, [
    { displayName: "Mark Erikson", role: "Host" },
    { displayName: "Carl Vitullo", role: "Producer" },
  ]);
  assert.deepEqual(record.bskyPostRef, {
    uri: "at://did:plc:show/app.bsky.feed.post/3lqz7abcd2k2x",
    cid: "bafyreiexamplecid",
  });
  // `content` is deliberately omitted; textContent carries the outline.
  assert.equal("content" in record, false);
});

test("buildDocumentRecord omits bskyPostRef when there is no announcement post", () => {
  const record = buildDocumentRecord(episode, {
    siteUri: "at://did:plc:show/site.standard.publication/self",
  });
  assert.equal("bskyPostRef" in record, false);
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scripts/publish-atproto.ts'`.

- [ ] **Step 7: Write `scripts/publish-atproto.ts`**

```ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AtpAgent } from "@atproto/api";
import type { Episode, OutlineItem } from "../src/content/parse.ts";
import { parseEpisode, splitFile } from "../src/content/parse.ts";
import { serializeEpisodeFile } from "../src/content/serialize.ts";

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

/** `https://bsky.app/profile/<handle-or-did>/post/<rkey>` -> its two parts. */
export function bskyUrlToParts(
  url: string,
): { actor: string; rkey: string } | null {
  const m = /^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(
    url.trim(),
  );
  return m ? { actor: m[1], rkey: m[2] } : null;
}

function hostnames(items: OutlineItem[], into: Set<string>): Set<string> {
  for (const item of items) {
    if (item.url) {
      try {
        into.add(new URL(item.url).hostname);
      } catch {
        // A malformed outline URL is not worth failing a publish over.
      }
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
    contributors: episode.people.map((person) =>
      person.role
        ? { displayName: person.name, role: person.role }
        : { displayName: person.name },
    ),
  };
  if (opts.bskyPostRef) record.bskyPostRef = opts.bskyPostRef;
  return record;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
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
      url: requireEnv("VITE_SITE_URL").replace(/\/$/, ""),
      name: PUBLICATION_NAME,
      description: PUBLICATION_DESCRIPTION,
    },
  });
  const siteUri = publication.data.uri;
  console.log(`publication ${siteUri}`);

  const names = readdirSync(EPISODE_DIR)
    .filter((n) => n.endsWith(".md"))
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

if (import.meta.filename === process.argv[1]) await main();
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 9: Publish one episode live**

Needs real credentials in `.env` (`ATPROTO_HANDLE`, `ATPROTO_APP_PASSWORD`, `VITE_SITE_URL`). This is the step that exercises `login`, `putRecord`, `resolveHandle` and `getRecord`.

Run: `npm run publish-atproto -- 2026-05`
Expected: a `publication at://did:plc:…/site.standard.publication/self` line, then `2026-05 -> at://did:plc:…/site.standard.document/2026-05 (atUri written)`, and `git diff content/episodes/2026-05.md` shows exactly one added `atUri:` line.

If `putRecord` rejects the document, read the error before changing anything: a complaint about `contributors/*/did` is the known lexicon conflict above — drop `contributors` from `buildDocumentRecord` (and its assertion from the test) or add a name→DID map, then rerun. A complaint about any other field means the lexicon moved; re-read https://standard.site/docs/lexicons/document/ and match it exactly.

- [ ] **Step 10: Verify idempotence and then publish the rest**

Run: `npm run publish-atproto -- 2026-05 && git status --short content/episodes/2026-05.md`
Expected: the same AT URI, no `(atUri written)` suffix, and no change to the file.

Run: `npm run publish-atproto`
Expected: one line per episode, each with an AT URI.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example scripts/publish-atproto.ts tests/publish-atproto.test.ts
git commit -m "feat: publish standard.site publication and document records to AT Protocol

Adds a single gitignored .env, loaded by node --env-file-if-exists, for every
script credential.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git add content/episodes
git commit -m "chore: record document AT URIs in episode front matter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage.**

| Spec requirement                                                                                                                                                | Task                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `content/episodes/<yyyy>-<mm>.md` one file per episode                                                                                                          | Task 3 (migrate writes them), format defined in "Canonical Episode File Format" |
| Hand-written front matter: `title`, `date`, `description`, `time`, `location`                                                                                   | Task 2 (`Episode` fields, parser)                                               |
| Ingest-owned front matter: `transistorId`, `audioUrl`, `duration`, `season`, `episode`, `people`, `bskyPostUrl`                                                 | Task 4 (`applyFeedItem`)                                                        |
| `atUri` written by `publish-atproto`, never by ingest                                                                                                           | Task 7 (writer), Task 4 (asserted untouched)                                    |
| `site.standard.publication` at rkey `self`: `url`, `name`, `description`                                                                                        | Task 7                                                                          |
| `site.standard.document` per episode keyed by slug: `site`, `title`, `publishedAt`, `path`, `description`, `textContent`, `tags`, `contributors`, `bskyPostRef` | Task 7 (`buildDocumentRecord`)                                                  |
| `ATPROTO_HANDLE` / `ATPROTO_APP_PASSWORD`, `@atproto/api`                                                                                                       | Task 7 (Global Constraints dependency note, `.env.example`)                     |
| Ingest matches by `yyyy-mm` in the feed title, both title styles                                                                                                | Task 4 (`slugFromTitle`, tested against every real style)                       |
| Body: outline then `# Transcript`, `##` sections, `**Speaker:**`, trailing `[hh:mm:ss]`                                                                         | Task 2                                                                          |
| Parsed structure `Episode`/`OutlineItem`/`Section`/`Segment`                                                                                                    | Task 2 (interfaces block)                                                       |
| `migrate` detects formats, strips embeds and style blocks, normalizes timestamps, promotes h1 sections to h2, synthesizes an outline, writes a report           | Task 3                                                                          |
| `ingest` idempotent, reports both directions of mismatch                                                                                                        | Task 4 (idempotence test + Step 7, `no file for` / `no feed item for` lines)    |
| `publish-transcript` steps 1–4 with independent flags, `DESCRIPT_TOKEN` / `TRANSISTOR_API_KEY`                                                                  | Task 6                                                                          |
| SRT export with speaker prefixes                                                                                                                                | Task 5                                                                          |
| Testing: parser fixtures per historical format; migrate round-trips through the parser; ingest against a saved feed; SRT cue numbering/format/prefix            | Tasks 2–5                                                                       |
| `/.well-known/site.standard.publication`, `<link rel="site.standard.document">`, the comments section                                                           | **Site plan**, `docs/superpowers/plans/2026-09-08-site.md`                      |
| Site, routes, CSS, Pagefind, Netlify, newsletter, risk gate                                                                                                     | **Out of scope**, per the plan header                                           |

Two gaps found and closed while reviewing: `TRANSISTOR_SHOW_ID` is needed to resolve a share id to an episode id and is not in the spec's env list — added to Task 6's environment note. And the spec's "three historical formats" is not accurate to the corpus; Task 3 replaces it with a per-feature detection table derived from reading all 39 files, and calls out the two files (`tmir-2024-04.md`, `tmir-2025-06.md`) that break the naive rules.

**2. Placeholder scan.** No TBD/TODO, no "add error handling", no "similar to Task N". Every code step carries runnable code. The one deliberate uncertainty is the Descript markdown export shape, which is labelled as such, given a concrete assumed shape from a real pasted export, isolated to a single function, and paired with a verification step (Task 6, Step 6). Task 7 carries a second, equally explicit one: the document lexicon marks `contributors[].did` required and the feed gives us no DIDs, so the record is written without it and Step 9 names both fallbacks to take if the PDS rejects it.

**3. Type consistency.** Checked across tasks: `slug`/`flattenLinks`/`normalizeTime`/`secondsToTimestamp`/`timestampToSeconds` (Task 1) are used with the same names in Tasks 2, 3, 5, 6. `splitFile` returns `{ frontMatter, body }` in Task 2 and is destructured that way in Tasks 3 and 4. `serializeEpisodeFile(frontMatter, body)` has the same two-argument signature everywhere. `Person` is defined in `parse.ts` and imported by `ingest.ts` as a type-only import. `TRANSCRIPT_MARKER` is exported from `parse.ts` and consumed in Task 6. `toSrt(episode)` takes the `Episode` from `parseEpisode`.
Three problems found and fixed inline while reviewing:

1. Task 6 imported `splitFile` without using it — removed from the import list.
2. The "transcript starts at the first speaker paragraph" rule in Task 3 dropped a `##` section heading sitting directly above the first speaker paragraph. Fixed with a backward walk over contiguous `##` blocks, plus a `##`-only restriction so old `#` transcript markers are still dropped. The rule and its two counter-examples are documented above Task 3's steps.
3. Task 3's `legacy-2024-03.md` fixture omitted the intro paragraph present in the real file, making the section-count assertion ambiguous. The intro paragraph is now in the fixture and the assertions name each section.
