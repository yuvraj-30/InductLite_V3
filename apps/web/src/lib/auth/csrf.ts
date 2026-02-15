/**
 * CSRF Protection Utilities
 *
 * CSRF PROTECTION STRATEGY:
 * We use a combination of defenses:
 *
 * 1. SameSite=Lax cookies (primary defense)
 *    - Browser won't send cookies on cross-origin POST requests
 *    - Provides solid protection for modern browsers
 *
 * 2. Origin/Referer header validation (defense in depth)
 *    - Verify requests come from our own origin
 *    - Catches edge cases where SameSite might not be enforced
 *
 * 3. CSRF tokens for high-risk operations (belt and suspenders)
 *    - Stored in session, validated on sensitive mutations
 *    - Extra protection for operations like password change
 *
 * This layered approach provides robust CSRF protection without
 * requiring tokens on every form.
 */

import { headers } from "next/headers";
import { randomBytes } from "crypto";

/**
 * Generate a random request ID for tracing
 */
export function generateRequestId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Get allowed origins for CSRF validation
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (appUrl) {
    try {
      origins.push(new URL(appUrl).origin);
    } catch {
      // Ignore invalid env URL here; startup validation handles hard failures.
    }
  }

  return Array.from(new Set(origins));
}

/**
 * Validate Origin/Referer header for CSRF protection
 * Returns true if the request origin is valid
 */
export async function validateOrigin(): Promise<boolean> {
  const headersList = await headers();
  const origin = headersList.get("origin");
  const referer = headersList.get("referer");
  const allowedOrigins = new Set(getAllowedOrigins());

  // Also trust the request's own host/proto as a same-origin baseline.
  const forwardedHost = headersList.get("x-forwarded-host");
  const host = forwardedHost ?? headersList.get("host");
  const forwardedProto = headersList.get("x-forwarded-proto");
  const protocol =
    forwardedProto ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  if (host) {
    allowedOrigins.add(`${protocol}://${host}`);
  }

  // Check Origin header first (preferred)
  if (origin) {
    return allowedOrigins.has(origin);
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.has(refererOrigin);
    } catch {
      return false;
    }
  }

  // No Origin or Referer - could be same-origin request without headers
  // In production, we should be strict; in development, allow for testing
  return process.env.NODE_ENV !== "production";
}

/**
 * Assert Origin is valid, throwing an error if not.
 * Use this in server actions to enforce origin checks.
 *
 * SECURITY: This provides defense-in-depth against CSRF attacks.
 * Combined with SameSite=Lax cookies, this protects against:
 * - Cross-origin form submissions
 * - Malicious third-party websites triggering actions
 *
 * @throws Error if origin is invalid
 */
export async function assertOrigin(): Promise<void> {
  const isValid = await validateOrigin();
  if (!isValid) {
    throw new Error("Invalid request origin");
  }
}

/**
 * Validate a CSRF token against the session token
 */
export function validateCsrfToken(
  providedToken: string | null | undefined,
  sessionToken: string | null | undefined,
): boolean {
  if (!providedToken || !sessionToken) {
    return false;
  }

  // Use timing-safe comparison
  if (providedToken.length !== sessionToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < providedToken.length; i++) {
    result |= providedToken.charCodeAt(i) ^ sessionToken.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Basic IP address format validation.
 * Validates IPv4 (e.g., 192.168.1.1) and IPv6 (e.g., ::1, 2001:db8::1) formats.
 * This is a security validation, not RFC-strict parsing.
 */
export function isValidIpFormat(ip: string): boolean {
  if (!ip || typeof ip !== "string") {
    return false;
  }

  const trimmed = ip.trim();

  // Reject empty or excessively long strings
  if (trimmed.length === 0 || trimmed.length > 45) {
    return false;
  }

  // Reject strings with dangerous characters (prevent injection)
  // Only allow: digits, dots, colons, hex letters (a-f, A-F)
  if (!/^[0-9a-fA-F.:]+$/.test(trimmed)) {
    return false;
  }

  // IPv4 pattern: 4 octets of 0-255
  const ipv4Pattern =
    /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  if (ipv4Pattern.test(trimmed)) {
    return true;
  }

  // IPv6 pattern: simplified validation (hex groups separated by colons)
  // Allows :: shorthand and standard 8-group format
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Pattern.test(trimmed)) {
    return true;
  }

  // IPv6 loopback
  if (trimmed === "::1") {
    return true;
  }

  return false;
}

/**
 * Check if TRUST_PROXY is enabled.
 * When false, x-forwarded-for and x-real-ip headers are ignored
 * to prevent rate-limit bypass via header spoofing.
 */
function isTrustProxyEnabled(): boolean {
  // Accept either the canonical "true" or the commonly-used "1" value to enable proxy trust.
  // This keeps behavior consistent across the codebase and CI/playwright envs which historically
  // set TRUST_PROXY="1".
  const v = process.env.TRUST_PROXY;
  return v === "true" || v === "1";
}

/**
 * Get client IP address from request headers.
 *
 * SECURITY: By default (TRUST_PROXY=false), proxy headers are ignored
 * to prevent rate-limit bypass attacks where attackers spoof x-forwarded-for.
 *
 * Set TRUST_PROXY=true only when running behind a trusted reverse proxy
 * (e.g., Vercel, Cloudflare, AWS ALB) that overwrites these headers.
 */
export async function getClientIp(): Promise<string | undefined> {
  const headersList = await headers();

  // Only trust proxy headers if explicitly enabled
  if (isTrustProxyEnabled()) {
    // Check x-forwarded-for (set by most proxies)
    const forwardedFor = headersList.get("x-forwarded-for");
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
      // The leftmost IP is the original client (if proxy is trusted)
      const firstIp = forwardedFor.split(",")[0]?.trim();
      if (firstIp && isValidIpFormat(firstIp)) {
        return firstIp;
      }
      // Invalid format - don't return potentially malicious data
      return undefined;
    }

    // Check x-real-ip (set by some proxies like nginx)
    const realIp = headersList.get("x-real-ip");
    if (realIp) {
      const trimmed = realIp.trim();
      if (isValidIpFormat(trimmed)) {
        return trimmed;
      }
      // Invalid format - don't return potentially malicious data
      return undefined;
    }
  }

  // No trusted IP found
  return undefined;
}

/**
 * Get user agent from request headers
 */
export async function getUserAgent(): Promise<string | undefined> {
  const headersList = await headers();
  return headersList.get("user-agent") || undefined;
}
