export function getPublicBaseUrl(_requestUrl?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!envUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not defined");
  }

  try {
    return new URL(envUrl).origin;
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL is invalid");
  }
}

export function buildPublicUrl(path: string, requestUrl?: string): URL {
  return new URL(path, getPublicBaseUrl(requestUrl));
}
