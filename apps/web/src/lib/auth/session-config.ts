/**
 * Session configuration and types for iron-session
 *
 * SECURITY CONFIGURATION:
 * - HttpOnly: true - prevents JavaScript access to cookies (XSS protection)
 * - Secure: true in production - cookies only sent over HTTPS
 * - SameSite: 'lax' - provides CSRF protection while allowing normal navigation
 *   - 'lax' allows cookies on top-level navigations with safe methods (GET)
 *   - 'strict' would break links from external sites
 *   - Combined with Origin/Referer checks for state-changing operations
 */

import { SessionOptions } from "iron-session";

/**
 * User role enum matching Prisma schema
 */
export type UserRole = "ADMIN" | "SITE_MANAGER" | "VIEWER";

/**
 * Session user data stored in the encrypted cookie
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  companySlug: string;
}

/**
 * Full session data structure
 */
export interface SessionData {
  user?: SessionUser;
  csrfToken?: string;
  createdAt?: number;
  lastActivity?: number;
}

// Helper to get runtime env to avoid Next.js build-time inlining
function getRuntimeEnv(): Record<string, string | undefined> {
  try {
    return eval("process").env ?? {};
  } catch {
    return process.env;
  }
}

// Helper to determine if we should use secure cookies at runtime
function shouldUseSecureCookies(): boolean {
  const env = getRuntimeEnv();
  return env.NODE_ENV === "production";
}

function getSessionSecrets(): SessionOptions["password"] {
  const primary = process.env.SESSION_SECRET?.trim();
  const previousRaw = process.env.SESSION_SECRET_PREVIOUS || "";
  const previous = previousRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const secrets = [primary, ...previous].filter((value): value is string =>
    Boolean(value),
  );

  // Return a map of passwords for iron-session to support rotation
  if (secrets.length === 0) return "";
  if (secrets.length === 1) return secrets[0]!;

  return secrets.reduce<Record<string, string>>((acc, password, index) => {
    // Current password is always at index 0, but iron-session supports any key
    acc[String(index)] = password;
    return acc;
  }, {});
}

// Base session options (without secure flag which is computed at runtime)
const baseSessionOptions = {
  password: getSessionSecrets(),
  cookieName: "inductlite_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8,
    path: "/",
  },
  ttl: 60 * 60 * 8,
};

/**
 * Get session options with runtime-evaluated secure flag
 * This allows the secure flag to be determined at runtime based on environment
 */
export function getSessionOptions(): SessionOptions {
  return {
    ...baseSessionOptions,
    cookieOptions: {
      ...baseSessionOptions.cookieOptions,
      secure: shouldUseSecureCookies(),
    },
  };
}

/**
 * Session configuration (for backward compatibility)
 * Note: The 'secure' flag is evaluated at module load time.
 * For runtime evaluation, use getSessionOptions() instead.
 */
export const sessionOptions: SessionOptions = {
  ...baseSessionOptions,
  cookieOptions: {
    ...baseSessionOptions.cookieOptions,
    // For the static export, evaluate secure at module load time
    secure: shouldUseSecureCookies(),
  },
};

/**
 * Validate session secret is configured
 */
export function validateSessionConfig(): void {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }

  const previousRaw = process.env.SESSION_SECRET_PREVIOUS || "";
  const previous = previousRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const secret of previous) {
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET_PREVIOUS secrets must be at least 32 characters",
      );
    }
  }
}

/**
 * Session duration constants
 */
export const SESSION_DURATION = {
  /** Session max age in seconds */
  MAX_AGE_SECONDS: 60 * 60 * 8, // 8 hours
  /** Inactivity timeout in seconds */
  INACTIVITY_TIMEOUT: 60 * 60 * 2, // 2 hours
  /** Session renewal threshold (renew if less than this remaining) */
  RENEWAL_THRESHOLD: 60 * 60 * 1, // 1 hour
};
