"use client";

declare global {
  interface Window {
    PagefindUI?: new (options: {
      element: string;
      showSubResults?: boolean;
    }) => unknown;
  }
}

export function PagefindUI() {
  return (
    <>
      <link
        rel="stylesheet"
        href="/pagefind/pagefind-ui.css"
        precedence="default"
      />
      {/* onLoad keeps this client-only, which is what we want: the prerendered
          document must not reference the Pagefind bundle. */}
      <script
        async
        src="/pagefind/pagefind-ui.js"
        onLoad={() => {
          new window.PagefindUI!({
            element: "#pagefind-ui",
            showSubResults: true,
          });
        }}
      />
      <div id="pagefind-ui" />
    </>
  );
}
