# This Month in React: visual design direction

Date: 2026-09-09

Status: proposed design reference

Scope: homepage and about page, with shared visual foundations for the site

## Intent

An independent technical magazine: confident typography, warm color, and
an editorial layout that makes the show's substance visible. Treat visitors
as peers by foregrounding specific conversations, sources, and host experience.

The central promise: **Keep up with where React and web development are
going—and think through what those changes mean with people doing the work.**

This extends the [original site design](2026-09-08-tmir-site-design.md),
replacing its homepage and about composition without changing the publishing
or rendering architecture.

## Identity and overall cues

Build from the [cover artwork](../../../public/artwork.jpg): deep blue
lettering, cream, peach, teal, grain, and overlapping orbital shapes.

- Large headlines and generous whitespace establish the opening.
- Fine rules and aligned dates organize episodes and sources.
- The cover and real host portraits provide the principal imagery.
- Occasional orbital curves and oversized month labels add character.

Concentrate decoration in the introduction and latest-episode feature.
Keep archives and transcripts quiet. Avoid decorative code, terminal
simulations, glass effects, and stock technology imagery.

## Color system

Use the same semantic roles in both themes. These hex values are the
implementation starting point. Brand assets retain blue `#123F8C`;
interactive blue changes with the theme.

| Role / token                        | Light     | Dark      | Use                                 |
| ----------------------------------- | --------- | --------- | ----------------------------------- |
| Background / `--bg`                 | `#FAF7F0` | `#141C26` | Warm paper / blue charcoal canvas   |
| Surface / `--surface`               | `#F0EADF` | `#1E2A38` | Panels, inputs, player surroundings |
| Primary text / `--text`             | `#202A35` | `#F3EEE5` | Headings and body                   |
| Muted text / `--muted`              | `#59616B` | `#B0BAC6` | Dates, durations, supporting labels |
| Primary / CTA / `--accent`          | `#123F8C` | `#9DBFFF` | Links, primary buttons, selection   |
| Subtle border / `--rule`            | `#D8D1C5` | `#394757` | Decorative dividers                 |
| Control border / `--control-border` | `#7A8086` | `#7F91A6` | Essential control boundaries        |
| Primary surface / `--feature-bg`    | `#123F8C` | `#203F70` | Latest episode                      |
| On-primary text / `--feature-text`  | `#F3EEE5` | `#F3EEE5` | Text and links on blue              |
| Secondary surface / `--warm-bg`     | `#F4D8C8` | `#3B2D2B` | Subscribe / participation           |
| Tertiary surface / `--cool-bg`      | `#D9E9E4` | `#203936` | Community emphasis                  |

### Light mode

Cream occupies most of the page, with dark ink for reading and blue for
emphasis. Use one substantial blue feature and at most one peach or teal
supporting section per page, separated by neutral space. Peach and teal
serve as backgrounds, not small text colors.

### Dark mode

Use blue charcoal and warm white, with pale blue links. The episode feature
stays visibly blue; peach and teal become muted brown and green surfaces.
Avoid bright glowing blocks and shadows.

Keep artwork and portraits in their original colors. Integrate the bright
cover through neutral framing and space rather than dimming or inversion.

### Pairing and interaction rules

- On neutral surfaces, use primary or secondary text and accent links.
  On warm or cool fields, use primary text and underlined primary-color links.
- On blue, use feature text for all copy and underlined links.
- Primary buttons use accent fill with page-color text. In the blue feature,
  use feature-text fill with feature-background text.
- Hover strengthens an underline or border. Selection also changes a marker
  or weight. Avoid reducing text opacity.
- Focus uses a 2px offset outline: accent on neutral, feature text on blue,
  primary text on warm or cool fields.
- Keep grain and gradients away from text and controls.

Calculated contrast for the proposed solid colors:

| Pair                               | Light   | Dark    |
| ---------------------------------- | ------- | ------- |
| Primary text on page               | 13.59:1 | 14.85:1 |
| Secondary text on surface          | 5.24:1  | 7.40:1  |
| Accent on surface                  | 8.29:1  | 7.85:1  |
| Control boundary on surface        | 3.33:1  | 4.51:1  |
| Feature text on feature background | 8.59:1  | 9.06:1  |

Target 4.5:1 for ordinary text and 3:1 for essential control boundaries and
focus indicators. Recheck rendered states and any transparency during implementation.

### Theme behavior

Follow the operating-system preference using the existing CSS color-scheme
foundation. Keep layout and content identical across themes. Native audio
and inputs should match their local surface, including the blue feature.

A manual selector is optional future scope. If added, offer System, Light,
and Dark; persist the choice and apply it before first paint on both router
pages and static documents.

## Typography

Start with the existing Inter regular and bold assets, self-hosted. Use
system monospace for dates, durations, chapter times, and short labels.

| Element              | Starting size and treatment                                 |
| -------------------- | ----------------------------------------------------------- |
| Homepage headline    | 48–76px desktop, 36–44px mobile; bold; 1.05–1.1 line height |
| Page / feature title | 32–48px desktop, 28–36px mobile; bold                       |
| Section heading      | 24–32px                                                     |
| Body                 | 17–18px; 1.55–1.7 line height; 60–70ch measure              |
| Metadata             | 13–14px monospace                                           |

Use fluid sizing, left-aligned body copy, and uppercase only for short
labels. Test headline wrapping with actual episode titles. Keep the
navigation wordmark compact; the cover retains its own lettering.

## Layout and spacing

Center the page in an approximately 1200px container. Use 20px mobile
gutters and 32–48px desktop gutters. Spacing scale: 4, 8, 12, 16, 24, 32,
48, 64, 96px. Major sections get 64–96px separation on desktop and 40–56px
on mobile; metadata stays close to its title.

Use a two-thirds / one-third split for the opening, collapsing when content
gets cramped. Align headings, dates, and rules across sections. Keep corners
slightly rounded and shadows minimal or absent.

## Homepage composition

1. **Header:** compact wordmark, navigation, and clear subscription access.
2. **Introduction:** large promise and listening actions beside the square
   cover, with text taking two-thirds of the width. Proposed headline:
   “What's changing in React. What it means for the web.” On mobile, put
   the promise and listening action before the artwork.
3. **Show facts and hosts:** monthly, about an hour, live in Reactiflux,
   chapters, transcripts, and source links. Include Carl and Mark with
   brief relevant experience. Use a compact row that wraps naturally.
4. **Latest episode:** blue feature containing title, publication date,
   duration, short summary, three or four topics, native player, and a
   link to the full notes and transcript.
5. **Conversations to explore:** three technical questions drawn from real
   segments, with context and chapter links. Use columns separated by
   fine rules; stack on mobile.
6. **Recent episodes:** narrow date column beside titles and descriptions;
   dates above titles on mobile. Preserve full archive access and `#archive`.
7. **Subscribe and participate:** warm field with listening destinations,
   show-note subscription when configured, and live-recording information.

Keep the opening compact enough to reach episode content quickly.

## About page composition

Open with the show's purpose and conversational approach. Follow with
substantial host portraits and bios: Carl's product and community experience,
and Mark's Redux and engineering experience. Verify biographical copy before publication.

Use consistent portrait frames and scale; retain original image colors.
Pair each portrait with its bio on mobile.

Give Reactiflux and live participation a separate, optionally teal section.
Use confirmed schedule information, not the latest episode's historical
recording time. Follow with former hosts, contributors, contact, and subscription
options at a smaller visual scale.

## Graphics, motion, and reading surfaces

- Echo the cover's orbital curves at section edges, clear of text and controls.
- Oversized month labels refer to the episode month, distinct from publication date.
- Decorative elements stay out of the accessibility tree and never intercept input.
- Use brief interaction feedback, respect reduced motion, and avoid continuous animation.
- Keep native audio controls initially; establish identity in the surrounding layout.
- Carry shared colors, type, and focus treatment into search, links, and
  episode pages while preserving transcript widths and chapter navigation.

## Review criteria for implementation

- Topic, format, hosts, and a specific reason to listen are apparent at a glance.
- Both themes retain the artwork's identity and a clear section hierarchy.
- Long titles, navigation, and audio controls work on mobile and at 200% zoom.
- Text, links, and keyboard focus remain legible on every background.
- Listening actions, chapters, transcripts, and sources are easy to find.

Prototype the homepage and about page with real content in both themes.
Review headline wrapping, artwork scale, feature density, and portraits
before extending the styling across the site.
