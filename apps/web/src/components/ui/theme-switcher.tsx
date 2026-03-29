"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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

interface ThemeSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeSwitcher({
  className = "",
  showLabel = true,
}: ThemeSwitcherProps) {
  const [preference, setPreference] = useState<ThemePreference>("auto");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

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

  const activeOptionLabel =
    OPTIONS.find((option) => option.id === preference)?.label ?? "Auto";

  if (!showLabel) {
    return (
      <div ref={containerRef} className={cn("relative inline-flex", className)}>
        <button
          type="button"
          aria-label={`Appearance settings, current mode ${activeOptionLabel}`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-[color:var(--bg-surface-strong)] hover:text-[color:var(--text-primary)]"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--border-soft)] text-secondary"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
            >
              <circle cx="8" cy="8" r="5.25" />
              <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" stroke="none" />
            </svg>
          </span>
        </button>

        {isOpen ? (
          <div
            role="menu"
            aria-label="Theme mode"
            className="absolute right-0 top-full z-20 mt-2 min-w-[11rem] rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-1.5 shadow-float"
          >
            {OPTIONS.map((option) => {
              const active = preference === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    updatePreference(option.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex min-h-[38px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold",
                    active
                      ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]"
                      : "text-secondary hover:bg-[color:var(--bg-surface-strong)] hover:text-[color:var(--text-primary)]",
                  )}
                >
                  <span>{option.label}</span>
                  {active ? (
                    <span className="text-[11px] uppercase tracking-[0.08em] text-accent">
                      Active
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-label="Theme controls"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2 py-1.5 shadow-soft",
        className,
      )}
    >
      {showLabel ? (
        <span className="pl-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
          Theme
        </span>
      ) : null}
      <div
        className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-1 py-1"
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
              className={`min-h-[34px] rounded-full px-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                active
                  ? "bg-[color:var(--accent-primary)] text-white"
                  : "text-secondary hover:bg-[color:var(--bg-surface)] hover:text-[color:var(--text-primary)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
