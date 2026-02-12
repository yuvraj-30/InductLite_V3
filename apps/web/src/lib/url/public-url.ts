export function getPublicBaseUrl(requestUrl?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      // Fall through to request URL parsing.
    }
  }

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Fall through to localhost fallback.
    }
  }

  return "http://localhost:3000";
}

export function buildPublicUrl(path: string, requestUrl?: string): URL {
  return new URL(path, getPublicBaseUrl(requestUrl));
}
