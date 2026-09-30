// Re-sets each transcript paragraph with justice, in the browser. Bundled to
// public/justify.js by the generated-public-files plugin in vite.config.ts.
import { prepare, solve, lineText } from "@kitlangton/justice";

const ps = [
  ...document.querySelectorAll<HTMLElement>(".transcript .segment > p"),
];
const canvas = document.createElement("canvas").getContext("2d")!;
const measure = (t: string) => canvas.measureText(t).width;
const originals = ps.map((p) => p.textContent ?? "");
let prepared: ReturnType<typeof prepare>[] = [];
let font = "";
let width = 0;

function run() {
  if (!ps.length) return;
  // Every segment shares one grid column and font, so one read covers them
  // all; reading each paragraph would force layout of content-visibility'd
  // sections and interleave reads with writes.
  const cs = getComputedStyle(ps[0]);
  const w = ps[0].clientWidth;
  const f = `${cs.fontSize} ${cs.fontFamily}`;
  if (f !== font) {
    // Word widths only depend on the font (it shrinks at the narrow breakpoint).
    font = canvas.font = f;
    prepared = originals.map((text) => prepare(text, measure));
  } else if (w === width) return; // height-only resize, e.g. mobile URL bar
  width = w;
  ps.forEach((p, i) => {
    const layout = solve(prepared[i], w);
    p.replaceChildren(
      ...layout.lines.map((line, n, all) => {
        const s = document.createElement("span");
        s.textContent =
          lineText(prepared[i], line) + (n < all.length - 1 ? " " : "");
        s.style.cssText = `display:block;white-space:nowrap;word-spacing:${line.wordSpacing}px;letter-spacing:${line.tracking}px;margin-left:${-line.opening}px`;
        return s;
      }),
    );
  });
}

let t: number;
document.fonts.ready.then(run);
addEventListener("resize", () => {
  clearTimeout(t);
  t = window.setTimeout(run, 100);
});
