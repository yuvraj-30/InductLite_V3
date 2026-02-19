function parseOrigin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function getPublicBaseUrl(requestUrl?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  const envOrigin = envUrl ? parseOrigin(envUrl) : null;
  if (envOrigin) return envOrigin;

  const requestOrigin = requestUrl ? parseOrigin(requestUrl) : null;
  if (requestOrigin) return requestOrigin;

  if (envUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_APP_URL is invalid");
  }
  throw new Error(
    "NEXT_PUBLIC_APP_URL is not defined and request URL fallback is unavailable",
  );
}

export function buildPublicUrl(path: string, requestUrl?: string): URL {
  return new URL(path, getPublicBaseUrl(requestUrl));
}
