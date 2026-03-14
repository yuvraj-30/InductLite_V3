export function parseBearerToken(header: string | null): string | null {
  const raw = (header ?? "").trim();
  if (!raw) return null;

  const [scheme, token] = raw.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  const normalized = token.trim();
  return normalized || null;
}
