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
export type UserRole = "ADMIN" | "VIEWER";

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

/**
 * Session configuration
 */
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "inductlite_session",
  cookieOptions: {
    // HttpOnly: Cookie cannot be accessed via JavaScript (XSS protection)
    httpOnly: true,
    // Secure: Only send cookie over HTTPS in production
    secure: process.env.NODE_ENV === "production",
    // SameSite: CSRF protection
    // 'lax' allows cookies on top-level GET navigations but blocks on cross-origin POST
    sameSite: "lax" as const,
    // Max age: 8 hours
    maxAge: 60 * 60 * 8,
    // Path: Cookie available for entire site
    path: "/",
  },
  // TTL in seconds (must match or exceed maxAge)
  ttl: 60 * 60 * 8,
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
