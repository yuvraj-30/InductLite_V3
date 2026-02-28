"use client";

import { useEffect } from "react";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
const HIGH_CONTRAST_QUERY = "(prefers-contrast: more)";

function listenMediaQuery(
  mediaQuery: MediaQueryList,
  callback: () => void,
): () => void {
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  }

  mediaQuery.addListener(callback);
  return () => mediaQuery.removeListener(callback);
}

export function ThemeRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const darkMode = window.matchMedia(DARK_MODE_QUERY);
    const highContrast = window.matchMedia(HIGH_CONTRAST_QUERY);

    const applyMode = () => {
      root.dataset.theme =
        darkMode.matches || highContrast.matches
          ? "high-contrast-dark"
          : "warm-light";
    };

    applyMode();

    const unlistenDark = listenMediaQuery(darkMode, applyMode);
    const unlistenContrast = listenMediaQuery(highContrast, applyMode);

    let frame = 0;
    const updateScrollDepth = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const maxScrollable = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          1,
        );
        const depth = Math.min(1, Math.max(0, window.scrollY / maxScrollable));
        root.style.setProperty("--scroll-depth", depth.toFixed(3));
      });
    };

    updateScrollDepth();
    window.addEventListener("scroll", updateScrollDepth, { passive: true });
    window.addEventListener("resize", updateScrollDepth);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      unlistenDark();
      unlistenContrast();
      window.removeEventListener("scroll", updateScrollDepth);
      window.removeEventListener("resize", updateScrollDepth);
    };
  }, []);

  return null;
}
