export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = "warm-light" | "high-contrast-dark";

export const THEME_PREFERENCE_STORAGE_KEY = "inductlite-theme-preference";
export const THEME_PREFERENCE_CHANGE_EVENT = "inductlite-theme-preference-change";

export const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
export const HIGH_CONTRAST_QUERY = "(prefers-contrast: more)";

export function sanitizeThemePreference(
  value: string | null | undefined,
): ThemePreference {
  if (value === "light" || value === "dark" || value === "auto") {
    return value;
  }
  return "auto";
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
  prefersHighContrast: boolean,
): ResolvedTheme {
  if (preference === "light") return "warm-light";
  if (preference === "dark") return "high-contrast-dark";
  return prefersDark || prefersHighContrast ? "high-contrast-dark" : "warm-light";
}

