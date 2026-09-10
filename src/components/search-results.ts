let contextId = 0;

interface SearchResult {
  url: string;
  meta: { title?: string; [key: string]: unknown };
  excerpt: string;
  sub_results?: { excerpt: string; [key: string]: unknown }[];
}

/** Pagefind supplies escaped excerpt HTML with <mark> elements. Build a short
 * window around its first highlight without cutting markup or losing context. */
function contextExcerpt(excerpt: string) {
  const source = document.createElement("span");
  source.innerHTML = excerpt;
  let text = "";
  const highlights: { start: number; end: number }[] = [];
  function collect(node: Node, marked = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      const start = text.length;
      text += node.textContent || "";
      if (marked) highlights.push({ start, end: text.length });
    } else {
      for (const child of node.childNodes)
        collect(
          child,
          marked || (node instanceof Element && node.tagName === "MARK"),
        );
    }
  }
  collect(source);
  const words = Array.from(text.matchAll(/\S+/g), (match) => ({
    text: match[0],
    marked: highlights.some(
      ({ start, end }) =>
        start < match.index + match[0].length && end > match.index,
    ),
  }));
  if (words.length <= 18) return excerpt;

  // Prefer a highlighted match near the excerpt's middle so Pagefind's
  // surrounding text can supply a comparable amount on either side.
  const matches = words.flatMap((word, index) => (word.marked ? [index] : []));
  const match = matches.reduce(
    (best, index) =>
      Math.abs(index - words.length / 2) < Math.abs(best - words.length / 2)
        ? index
        : best,
    matches[0] ?? 0,
  );
  const start = Math.min(Math.max(0, match - 8), words.length - 18);
  const context = document.createElement("span");
  context.className = "search-context";
  const short = document.createElement("span");
  short.className = "search-context-short";
  if (start) short.append("… ");
  words.slice(start, start + 18).forEach((word, index) => {
    if (index) short.append(" ");
    if (word.marked) {
      const mark = document.createElement("mark");
      mark.textContent = word.text;
      short.append(mark);
    } else short.append(word.text);
  });
  if (start + 18 < words.length) short.append(" …");
  const full = document.createElement("span");
  full.className = "search-context-full";
  full.id = `search-context-${++contextId}`;
  full.hidden = true;
  full.setAttribute("role", "region");
  full.setAttribute("aria-label", "Surrounding transcript context");
  function surrounding(className: string, slice: typeof words) {
    const span = document.createElement("span");
    span.className = className;
    slice.forEach((word, index) => {
      if (index) span.append(" ");
      if (word.marked) {
        const mark = document.createElement("mark");
        mark.textContent = word.text;
        span.append(mark);
      } else span.append(word.text);
    });
    return span;
  }
  const availableBefore = start;
  const availableAfter = words.length - start - 18;
  // Trim both sides together so a match near a boundary doesn't get a
  // lopsided preview. At the boundary itself, show the available side.
  const sideWords =
    availableBefore && availableAfter
      ? Math.min(40, availableBefore, availableAfter)
      : 40;
  const before = surrounding(
    "search-context-before",
    words.slice(Math.max(0, start - sideWords), start),
  );
  const anchor = document.createElement("span");
  anchor.className = "search-context-anchor";
  const readable = document.createElement("span");
  readable.className = "search-context-readable";
  readable.textContent = words
    .slice(start, start + 18)
    .map((word) => word.text)
    .join(" ");
  anchor.append(readable);
  const after = surrounding(
    "search-context-after",
    words.slice(start + 18, start + 18 + sideWords),
  );
  full.append(before, anchor, after);
  short.tabIndex = 0;
  short.setAttribute("aria-describedby", full.id);
  context.append(short, full);
  return context.outerHTML;
}

export function prepareSearchResult(result: SearchResult): SearchResult {
  const month = result.url.match(/\/episodes\/(\d{4}-\d{2})(?:[-/#?]|$)/)?.[1];
  const title = result.meta.title || "Episode";
  return {
    ...result,
    meta: {
      ...result.meta,
      title:
        month && !title.startsWith(`${month} · `)
          ? `${month} · ${title}`
          : title,
    },
    excerpt: contextExcerpt(result.excerpt),
    sub_results: result.sub_results?.map((section) => ({
      ...section,
      excerpt: contextExcerpt(section.excerpt),
    })),
  };
}

/** The original snippet never leaves normal flow. Only its surrounding panel
 * is positioned and clipped; no text is translated or scaled during reveal. */
export function enhanceSearchContext(container: HTMLElement) {
  let active: HTMLElement | null = null;
  let animation: Animation | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function contextFor(target: EventTarget | null) {
    return target instanceof Element
      ? target.closest<HTMLElement>(".search-context")
      : null;
  }
  function close() {
    clearTimeout(closeTimer);
    animation?.cancel();
    animation = null;
    if (!active) return;
    active.querySelector<HTMLElement>(".search-context-full")!.hidden = true;
    delete active.dataset.open;
    active = null;
  }
  function open(context: HTMLElement) {
    clearTimeout(closeTimer);
    if (active === context) return;
    close();
    active = context;
    const panel = context.querySelector<HTMLElement>(".search-context-full")!;
    const before = panel.querySelector<HTMLElement>(".search-context-before")!;
    const after = panel.querySelector<HTMLElement>(".search-context-after")!;
    const anchor = panel.querySelector<HTMLElement>(".search-context-anchor")!;
    const rect = context.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = (viewport?.offsetTop || 0) + 12;
    const viewportBottom =
      (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight);
    const footer = document
      .querySelector(".site-footer")
      ?.getBoundingClientRect();
    const bottom = Math.min(viewportBottom, footer?.top ?? viewportBottom) - 12;
    // Reserve independently above and below the fixed anchor. Long context
    // scrolls inside these regions instead of displacing the source snippet.
    const aboveSpace = Math.max(0, rect.top - viewportTop - 12);
    const belowSpace = Math.max(0, bottom - rect.bottom - 12);
    before.style.maxHeight = `${aboveSpace}px`;
    after.style.maxHeight = `${belowSpace}px`;
    before.style.paddingBottom =
      before.textContent && aboveSpace >= 12 ? "12px" : "0";
    after.style.paddingTop =
      after.textContent && belowSpace >= 12 ? "12px" : "0";
    anchor.style.height = `${rect.height}px`;
    panel.hidden = false;
    const above = before.getBoundingClientRect().height + 12;
    const below = after.getBoundingClientRect().height + 12;
    panel.style.top = `${-above}px`;
    before.scrollTop = before.scrollHeight;
    for (const [region, label] of [
      [before, "Earlier transcript context"],
      [after, "Later transcript context"],
    ] as const) {
      const scrollable = region.scrollHeight > region.clientHeight;
      region.tabIndex = scrollable ? 0 : -1;
      region.setAttribute("role", "region");
      region.setAttribute(
        "aria-label",
        label + (scrollable ? "; scroll for more" : ""),
      );
    }
    context.dataset.open = "true";
    if (!reducedMotion.matches) {
      animation = panel.animate(
        [
          { clipPath: `inset(${above}px 0 ${below}px 0 round 8px)` },
          { clipPath: "inset(0px 0px 0px 0px round 8px)" },
        ],
        { duration: 200, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    }
  }
  function enter(event: MouseEvent) {
    if (!hover.matches) return;
    const context = contextFor(event.target);
    if (!context) return;
    if (
      event.relatedTarget instanceof Node &&
      context.contains(event.relatedTarget)
    )
      return;
    open(context);
  }
  function leave(event: MouseEvent | FocusEvent) {
    const context = contextFor(event.target);
    if (!context || context !== active) return;
    if (
      event.relatedTarget instanceof Node &&
      context.contains(event.relatedTarget)
    )
      return;
    if (event instanceof MouseEvent && context.querySelector(":focus-visible"))
      return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (active === context) close();
    }, 120);
  }
  function focus(event: FocusEvent) {
    const context = contextFor(event.target);
    if (context) open(context);
  }
  function outside(event: PointerEvent) {
    if (
      active &&
      event.target instanceof Node &&
      !active.contains(event.target)
    )
      close();
  }
  function escape(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }
  function scroll(event: Event) {
    // Internal context scrolling is allowed; page scrolling invalidates the
    // available space above/below the anchor, so dismiss the preview.
    if (active && event.target instanceof Node && active.contains(event.target))
      return;
    close();
  }
  function input() {
    close();
  }
  container.addEventListener("mouseover", enter);
  container.addEventListener("mouseout", leave);
  container.addEventListener("focusout", leave);
  container.addEventListener("focusin", focus);
  container.addEventListener("input", input);
  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", escape);
  window.addEventListener("scroll", scroll, true);
  window.addEventListener("resize", close);
  window.visualViewport?.addEventListener("resize", close);
  window.visualViewport?.addEventListener("scroll", close);
  return () => {
    close();
    container.removeEventListener("mouseover", enter);
    container.removeEventListener("mouseout", leave);
    container.removeEventListener("focusout", leave);
    container.removeEventListener("focusin", focus);
    container.removeEventListener("input", input);
    document.removeEventListener("pointerdown", outside);
    document.removeEventListener("keydown", escape);
    window.removeEventListener("scroll", scroll, true);
    window.removeEventListener("resize", close);
    window.visualViewport?.removeEventListener("resize", close);
    window.visualViewport?.removeEventListener("scroll", close);
  };
}
