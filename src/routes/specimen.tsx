import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SITE_NAME } from "../components/Document";

export const Route = createFileRoute("/specimen")({
  head: () => ({
    meta: [
      { title: `Design specimen — ${SITE_NAME}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Specimen,
});

const COLORS = [
  ["bg", "Background"],
  ["surface", "Surface"],
  ["text", "Primary text"],
  ["muted", "Muted text"],
  ["accent", "Primary / CTA"],
  ["rule", "Subtle border"],
  ["control-border", "Control border"],
  ["feature-bg", "Primary surface"],
  ["feature-text", "On-primary text"],
  ["warm-bg", "Secondary surface"],
  ["cool-bg", "Tertiary surface"],
];

// Only the specimen's presentation lives here. Examples use the production
// classes and tokens so changes to the site's design remain visible here.
const STYLES = `
  .specimen { display: grid; gap: 4rem; }
  .specimen > section { border-top: 1px solid var(--rule); padding-top: 2rem; }
  .specimen .specimen-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: 1.5rem; }
  .specimen .swatches { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 1rem; }
  .specimen .swatch { height: 5rem; border: 1px solid var(--control-border); margin-bottom: .5rem; }
  .specimen code { font: .8rem var(--mono); }
  .specimen .swatches code { display: block; }
  .specimen fieldset { border: 0; padding: 0; margin-top: 1.5rem; }
  .specimen .theme-options { display: flex; flex-wrap: wrap; gap: 1.5rem; }
  .specimen .theme-options label { display: flex; align-items: center; gap: .5rem; }
  .specimen .type-samples { display: grid; gap: 1.5rem; }
  .specimen .display-sample { font-family: var(--font-title); font-synthesis: none; font-size: clamp(2.25rem, 5.65vw, 4.75rem); font-weight: 400; line-height: 1.07; letter-spacing: -.06em; }
  .specimen .sample-label { color: var(--muted); font: .8rem var(--mono); margin-bottom: .5rem; }
  .specimen .sample-input { display: block; width: min(100%, 24rem); padding: .65rem; background: var(--surface); border: 1px solid var(--control-border); border-radius: var(--radius); }
  .specimen .spacing { display: grid; gap: .75rem; }
  .specimen .spacing li { display: flex; align-items: center; gap: 1rem; }
  .specimen .spacing code { width: 4rem; }
  .specimen .spacing span { height: .75rem; background: var(--accent); }
  .specimen .specimen-artwork { max-width: 20rem; }
  .specimen .specimen-artwork img { width: 100%; height: auto; }
  .specimen .specimen-details { margin-top: 1.5rem; }
`;

function Specimen() {
  const [theme, setTheme] = useState("system");
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.colorScheme;
    root.style.colorScheme = theme === "system" ? "light dark" : theme;
    return () => {
      root.style.colorScheme = previous;
    };
  }, [theme]);

  return (
    <div className="specimen" data-pagefind-ignore="">
      <style>{STYLES}</style>
      <header>
        <p className="eyebrow">This Month in React · Design reference</p>
        <h1>Design specimen</h1>
        <p className="lead">
          The live palette, type, and components in one place.
        </p>
        <fieldset>
          <legend>Preview theme</legend>
          <div className="theme-options">
            {["system", "light", "dark"].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                />
                {value[0].toUpperCase() + value.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
      </header>

      <section aria-labelledby="palette">
        <h2 id="palette">Color</h2>
        <p>
          Swatches use the shared CSS tokens and respond to the selected theme.
        </p>
        <div className="swatches action-row">
          {COLORS.map(([token, label]) => (
            <div key={token}>
              <div
                className="swatch"
                style={{ background: `var(--${token})` }}
              />
              <strong>{label}</strong>
              <code>--{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="typography">
        <h2 id="typography">Typography</h2>
        <div className="type-samples">
          <div>
            <p className="sample-label">Display · Sk-Modernist Regular</p>
            <p className="display-sample">What's changing in React.</p>
          </div>
          <div className="home-page">
            <div>
              <p className="sample-label">Section heading</p>
              <h2>Conversations to explore</h2>
              <h3>What are framework benchmarks measuring?</h3>
            </div>
          </div>
          <div>
            <p className="sample-label">Lead</p>
            <p className="lead">
              React, the web, and the work of building software.
            </p>
          </div>
          <div>
            <p className="sample-label">Body · Inter Regular</p>
            <p>
              We follow the releases, dig into the technical details, and talk
              through the tradeoffs and open questions. Chapters, transcripts,
              and source links let you follow a thread further.
            </p>
          </div>
          <div>
            <p className="eyebrow">Editorial label</p>
            <p className="episode-meta">Aug 12, 2026 · 1:10:27</p>
            <a
              className="chapter-link"
              href="/episodes/2026-07#cross-framework-benchmark-measuring-reactivity"
            >
              Explore the chapter ·{" "}
              <span className="chapter-time">00:32:22</span>
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="controls">
        <h2 id="controls">Links and controls</h2>
        <p>
          Hover or tab through these examples to inspect interaction states.
        </p>
        <div className="action-row">
          <a className="button" href="/">
            Primary action
          </a>
          <a className="button button-secondary" href="/about">
            Secondary action
          </a>
          <a href="/links">Text link</a>
        </div>
        <div className="specimen-details">
          <label htmlFor="sample-email">Email address</label>
          <input
            className="sample-input"
            id="sample-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="off"
          />
        </div>
        <details className="archive-more">
          <summary>Expandable archive</summary>
          <p>
            Older episodes remain available without adding a long list to the
            initial page.
          </p>
        </details>
      </section>

      <section aria-labelledby="surfaces">
        <h2 id="surfaces">Editorial surfaces</h2>
        <div className="latest-feature">
          <p className="eyebrow">Latest episode · Example</p>
          <h2>React-alikes, governance, and state management</h2>
          <p className="lead">
            The people shaping React, different approaches to reactivity, and
            the tradeoffs behind our tools.
          </p>
          <ul className="feature-topics">
            <li>
              <a href="/episodes/2026-07#react-org-updates">React governance</a>
            </li>
            <li>
              <a href="/episodes/2026-07#react-alikes">
                Approaches to reactivity
              </a>
            </li>
          </ul>
          <div className="player">
            <audio
              controls
              preload="none"
              aria-label="Audio control appearance sample; no recording attached"
            />
          </div>
          <p>Native audio controls shown without a recording.</p>
          <a className="button" href="/episodes/2026-07">
            Read the episode
          </a>
        </div>
        <div className="specimen-grid specimen-details">
          <div className="subscribe-panel">
            <p className="eyebrow">Subscribe</p>
            <h2>See you next month.</h2>
            <p>A warm surface for listening destinations.</p>
            <div className="action-row">
              <a className="button" href="/about#subscribe">
                Subscribe
              </a>
            </div>
          </div>
          <div className="community-panel">
            <p className="eyebrow">Reactiflux</p>
            <h2>Be part of the conversation.</h2>
            <p>A cool surface for community participation.</p>
            <a href="/about#live">Live recordings ↗</a>
          </div>
        </div>
      </section>

      <section aria-labelledby="editorial">
        <h2 id="editorial">Archive and transcript</h2>
        <div className="archive">
          <ul className="archive-list">
            <li>
              <time dateTime="2026-08-12">Aug 12, 2026</time>
              <div className="archive-copy">
                <h3>
                  <a href="/episodes/2026-07">
                    React-alikes, governance, and state management
                  </a>
                </h3>
                <p>
                  React governance, framework benchmarks, and state management.
                </p>
              </div>
            </li>
          </ul>
        </div>
        <div className="transcript specimen-details">
          <p className="sample-label">
            Transcript treatment · Illustrative text
          </p>
          <h2>Following the tradeoffs</h2>
          <p className="segment">
            <strong className="speaker">Speaker:</strong> A readable transcript
            keeps the discussion accessible, with clear speaker names and links
            back to the recording.{" "}
            <a className="ts" href="/episodes/2026-07#react-alikes">
              [00:21:30]
            </a>
          </p>
        </div>
      </section>

      <section aria-labelledby="details">
        <h2 id="details">Artwork and spacing</h2>
        <div className="specimen-grid">
          <figure className="hero-artwork specimen-artwork">
            <img
              src="/artwork.jpg"
              alt="This Month in React cover"
              width="600"
              height="600"
            />
            <figcaption>Original artwork in both themes.</figcaption>
          </figure>
          <div>
            <p className="sample-label">Spacing scale</p>
            <ul className="spacing">
              {[4, 8, 12, 16, 24, 32, 48, 64, 96].map((size) => (
                <li key={size}>
                  <code>{size}px</code>
                  <span style={{ width: size }} />
                </li>
              ))}
            </ul>
            <p>
              Body measure: <code>70ch</code>
              <br />
              Corner radius: <code>--radius · 0.25rem</code>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
