"use client";

import { useEffect } from "react";
import {
  DARK_MODE_QUERY,
  HIGH_CONTRAST_QUERY,
  THEME_PREFERENCE_CHANGE_EVENT,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
  resolveThemePreference,
  sanitizeThemePreference,
} from "./theme-preference";

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
    let preference: ThemePreference = "auto";

    try {
      preference = sanitizeThemePreference(
        window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY),
      );
    } catch {
      preference = "auto";
    }

    const applyMode = () => {
      const resolvedTheme = resolveThemePreference(
        preference,
        darkMode.matches,
        highContrast.matches,
      );
      root.dataset.theme = resolvedTheme;
      root.classList.toggle("dark", resolvedTheme === "high-contrast-dark");
    };

    const handlePreferenceChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ preference?: string }>;
      preference = sanitizeThemePreference(customEvent.detail?.preference);
      applyMode();
    };

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== THEME_PREFERENCE_STORAGE_KEY) return;
      preference = sanitizeThemePreference(event.newValue);
      applyMode();
    };

    const handleMediaChange = () => {
      if (preference !== "auto") return;
      applyMode();
    };

    applyMode();

    const unlistenDark = listenMediaQuery(darkMode, handleMediaChange);
    const unlistenContrast = listenMediaQuery(highContrast, handleMediaChange);
    window.addEventListener(THEME_PREFERENCE_CHANGE_EVENT, handlePreferenceChange);
    window.addEventListener("storage", handleStorageSync);

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
      window.removeEventListener(
        THEME_PREFERENCE_CHANGE_EVENT,
        handlePreferenceChange,
      );
      window.removeEventListener("storage", handleStorageSync);
      window.removeEventListener("scroll", updateScrollDepth);
      window.removeEventListener("resize", updateScrollDepth);
    };
  }, []);

  return null;
}
