"use client";
import { useEffect, useRef, useState } from "react";
import { enhanceSearchContext, prepareSearchResult } from "./search-results";

interface SearchUI {
  triggerSearch: (term: string) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    PagefindUI?: new (options: {
      element: string;
      showSubResults: boolean;
      showImages: boolean;
      resetStyles: boolean;
      excerptLength: number;
      processResult: typeof prepareSearchResult;
      translations: Record<string, string>;
    }) => SearchUI;
  }
}

export function PagefindUI() {
  const ui = useRef<SearchUI | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    const container = document.getElementById("pagefind-ui")!;
    const cleanupContext = enhanceSearchContext(container);

    function saveQuery(term: string) {
      const url = new URL(window.location.href);
      if (term.trim()) url.searchParams.set("q", term);
      else url.searchParams.delete("q");
      window.history.replaceState(window.history.state, "", url);
    }
    function restoreQuery() {
      const term = new URLSearchParams(window.location.search).get("q") || "";
      // Pagefind's triggerSearch ignores an empty term. Dispatch input so
      // restoring a URL without a query clears both the field and results.
      const input = container.querySelector("input");
      if (input) {
        input.value = term;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    function onInput(event: Event) {
      if (event.target instanceof HTMLInputElement)
        saveQuery(event.target.value);
    }
    function onClear(event: MouseEvent) {
      if ((event.target as Element).closest(".pagefind-ui__search-clear"))
        saveQuery("");
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && event.target instanceof HTMLInputElement)
        saveQuery("");
    }

    const script = document.createElement("script");
    script.src = "/pagefind/pagefind-ui.js";
    script.onload = () => {
      if (disposed) return;
      if (!window.PagefindUI) {
        setStatus("error");
        return;
      }
      ui.current = new window.PagefindUI({
        element: "#pagefind-ui",
        showSubResults: true,
        showImages: false,
        resetStyles: false,
        excerptLength: 160,
        processResult: prepareSearchResult,
        translations: {
          placeholder: "Search topics, tools, or people…",
          search_label: "Search transcripts",
          many_results: "[COUNT] episodes for “[SEARCH_TERM]”",
          one_result: "[COUNT] episode for “[SEARCH_TERM]”",
          zero_results:
            "No episodes found for “[SEARCH_TERM]”. Try fewer words or a different spelling.",
          load_more: "Show more episodes",
        },
      });
      const input = container.querySelector("input");
      input?.setAttribute("aria-label", "Search transcripts");
      input?.setAttribute("aria-describedby", "search-help");
      restoreQuery();
      setStatus("ready");
    };
    script.onerror = () => {
      if (!disposed) setStatus("error");
    };
    container.addEventListener("input", onInput);
    container.addEventListener("click", onClear);
    container.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", restoreQuery);
    document.head.appendChild(script);

    return () => {
      disposed = true;
      cleanupContext();
      container.removeEventListener("input", onInput);
      container.removeEventListener("click", onClear);
      container.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", restoreQuery);
      ui.current?.destroy();
      ui.current = null;
      script.remove();
    };
  }, [attempt]);

  function search(term: string) {
    ui.current?.triggerSearch(term);
    const url = new URL(window.location.href);
    url.searchParams.set("q", term);
    window.history.replaceState(window.history.state, "", url);
    document.querySelector<HTMLInputElement>("#pagefind-ui input")?.focus();
  }

  return (
    <div className="transcript-search">
      <link rel="stylesheet" href="/pagefind/pagefind-ui.css" precedence="default" />
      <p id="search-help" className="search-help">
        Results are grouped by episode. Choose a section to jump straight into
        the transcript. Hover over or focus a match to read more context. Use
        quotes for an exact phrase.
      </p>
      {status === "ready" && (
        <div className="search-suggestions" aria-label="Suggested searches">
          <span>Try a topic</span>
          {["React Compiler", "Server Components", "React Native"].map(
            (term) => (
              <button type="button" key={term} onClick={() => search(term)}>
                {term} <span aria-hidden="true">↗</span>
              </button>
            ),
          )}
        </div>
      )}
      <div id="pagefind-ui" />
      <div role="status">
        {status === "loading" && (
          <p className="search-loading">Loading search…</p>
        )}
        {status === "error" && (
          <p className="search-error">
            Search couldn’t load.{" "}
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>{" "}
            or <a href="/#archive">browse episodes</a>.
          </p>
        )}
      </div>
    </div>
  );
}
