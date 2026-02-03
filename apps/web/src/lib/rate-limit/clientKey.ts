import crypto from "crypto";

export interface ClientKeyOptions {
  trustProxy?: boolean;
}

/**
 * Derive a stable client key for rate-limiting purposes.
 * - If trustProxy is true, prefer the first IP in x-forwarded-for header when present
 * - Otherwise, fall back to a hash of the user-agent and accept headers
 */
export function getStableClientKey(
  headers: Record<string, string | undefined>,
  options: ClientKeyOptions = {},
): string {
  const trustProxy = Boolean(options.trustProxy);

  const xff = headers["x-forwarded-for"];
  if (trustProxy && xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }

  const ua = headers["user-agent"] ?? "";
  const accept = headers["accept"] ?? "";
  const raw = `${ua}|${accept}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  // Return a short form for readability
  return `ua:${hash.slice(0, 16)}`;
}
