"use client";

import { useEffect, useState } from "react";
import {
  THEME_PREFERENCE_CHANGE_EVENT,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
  sanitizeThemePreference,
} from "./theme-preference";

type Option = {
  id: ThemePreference;
  label: string;
};

const OPTIONS: Option[] = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function ThemeSwitcher() {
  const [preference, setPreference] = useState<ThemePreference>("auto");

  useEffect(() => {
    try {
      setPreference(
        sanitizeThemePreference(
          window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY),
        ),
      );
    } catch {
      setPreference("auto");
    }
  }, []);

  const updatePreference = (next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors in restricted browser modes.
    }

    window.dispatchEvent(
      new CustomEvent(THEME_PREFERENCE_CHANGE_EVENT, {
        detail: { preference: next },
      }),
    );
    setPreference(next);
  };

  return (
    <aside
      aria-label="Theme controls"
      className="fixed bottom-4 right-4 z-[120] hidden rounded-xl border ring-soft bg-glass-strong p-1.5 shadow-float md:block"
    >
      <div
        className="inline-flex items-center gap-1 rounded-lg border ring-soft bg-glass px-1 py-1"
        role="group"
        aria-label="Theme mode"
      >
        {OPTIONS.map((option) => {
          const active = preference === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => updatePreference(option.id)}
              aria-pressed={active}
              className={`min-h-[36px] rounded-md px-2.5 text-xs font-semibold sm:text-sm ${
                active
                  ? "bg-[color:var(--accent-primary)] text-white"
                  : "text-secondary hover:bg-glass-strong hover:text-[color:var(--text-primary)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
