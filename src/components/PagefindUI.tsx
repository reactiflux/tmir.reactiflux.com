"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    PagefindUI?: new (options: {
      element: string;
      showSubResults?: boolean;
    }) => unknown;
  }
}

export function PagefindUI() {
  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/pagefind/pagefind-ui.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "/pagefind/pagefind-ui.js";
    script.onload = () => {
      if (window.PagefindUI) {
        new window.PagefindUI({ element: "#pagefind-ui", showSubResults: true });
      }
    };
    document.head.appendChild(script);

    return () => {
      css.remove();
      script.remove();
    };
  }, []);

  return <div id="pagefind-ui" />;
}
