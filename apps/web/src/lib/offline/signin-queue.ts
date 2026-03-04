const REDACTED_BROWSER_STORAGE_KEYS = new Set(["employerName"]);

function serializeForBrowserStorage(value: unknown): string {
  return JSON.stringify(value, (key, nestedValue) => {
    if (REDACTED_BROWSER_STORAGE_KEYS.has(key)) {
      return undefined;
    }
    return nestedValue;
  });
}

export function hasQueuedSignIn(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(storageKey));
}

export function loadQueuedSignIn<T>(storageKey: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function saveQueuedSignIn<T>(storageKey: string, payload: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, serializeForBrowserStorage(payload));
}

export function clearQueuedSignIn(storageKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
