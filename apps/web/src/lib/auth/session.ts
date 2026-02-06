/**
 * Session management utilities
 *
 * Provides server-side session handling with iron-session
 */

import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  SessionData,
  SessionUser,
  sessionOptions,
  SESSION_DURATION,
} from "./session-config";
import { publicDb } from "@/lib/db/public-db";
import { scopedDb } from "@/lib/db/scoped-db";
import { verifyPassword, hashPassword, needsRehash } from "./password";
import { decryptTotpSecret, verifyTotpCode } from "./mfa";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId, generateCsrfToken } from "./csrf";

/**
 * Get the current session (cached per request)
 */
export const getSession = cache(async (): Promise<IronSession<SessionData>> => {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
});

/**
 * Get current session user (read-only version for Server Components)
 * Does NOT update lastActivity to avoid cookie modification.
 * Use this in pages/layouts that only need to check authentication.
 */
export async function getSessionUserReadOnly(): Promise<SessionUser | null> {
  const session = await getSession();

  if (!session.user) {
    return null;
  }

  // Check for session expiry/inactivity (read-only check)
  const now = Date.now();
  if (session.lastActivity) {
    const inactiveTime = (now - session.lastActivity) / 1000;
    if (inactiveTime > SESSION_DURATION.INACTIVITY_TIMEOUT) {
      // Session expired - return null (can't destroy in Server Component)
      return null;
    }
  }

  return session.user;
}

/**
 * Get current session user or null if not authenticated.
 * Updates lastActivity - use only in Server Actions or Route Handlers.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();

  if (!session.user) {
    return null;
  }

  // Check for session expiry/inactivity
  const now = Date.now();
  if (session.lastActivity) {
    const inactiveTime = (now - session.lastActivity) / 1000;
    if (inactiveTime > SESSION_DURATION.INACTIVITY_TIMEOUT) {
      // Session expired due to inactivity
      await destroySession();
      return null;
    }
  }

  // Update last activity
  session.lastActivity = now;
  await session.save();

  return session.user;
}

/**
 * Login result type
 */
export interface LoginResult {
  success: boolean;
  error?: string;
  user?: SessionUser;
  requiresPasswordChange?: boolean;
  requiresMfa?: boolean;
}

/**
 * Brute force protection constants
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Attempt to log in a user
 */
export async function login(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
  totpCode?: string,
): Promise<LoginResult> {
  const requestId = generateRequestId();
  const logger = createRequestLogger(requestId, {
    path: "/api/auth/login",
    method: "POST",
  });

  // Find user by email (this is auth bootstrap - allowed without company_id)
  const user = await publicDb.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    include: { company: true },
  });

  if (!user) {
    logger.warn({ email }, "Login attempt for non-existent user");
    // Use same error message to prevent user enumeration
    return { success: false, error: "Invalid email or password" };
  }

  // Check if account is locked
  if (user.locked_until && user.locked_until > new Date()) {
    const remainingMinutes = Math.ceil(
      (user.locked_until.getTime() - Date.now()) / (1000 * 60),
    );
    logger.warn({ email, userId: user.id }, "Login attempt on locked account");
    return {
      success: false,
      error: `Account is locked. Try again in ${remainingMinutes} minutes.`,
    };
  }

  // Check if user is active
  if (!user.is_active) {
    logger.warn(
      { email, userId: user.id },
      "Login attempt on inactive account",
    );
    return { success: false, error: "Account is disabled" };
  }

  // Verify password
  const passwordValid = await verifyPassword(user.password_hash, password);

  if (!passwordValid) {
    // Increment failed login count
    const newFailedLogins = user.failed_logins + 1;
    const shouldLock = newFailedLogins >= MAX_FAILED_ATTEMPTS;

    const db = scopedDb(user.company_id);
    await db.user.updateMany({
      where: { id: user.id, company_id: user.company_id },
      data: {
        failed_logins: newFailedLogins,
        locked_until: shouldLock
          ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
          : null,
      },
    });

    // Audit log failed attempt
    await db.auditLog.create({
      data: {
        user_id: user.id,
        action: "auth.login_failed",
        details: {
          reason: "invalid_password",
          failedAttempts: newFailedLogins,
          locked: shouldLock,
        } as object,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });

    logger.warn(
      { email, userId: user.id, failedAttempts: newFailedLogins },
      "Failed login attempt",
    );

    if (shouldLock) {
      return {
        success: false,
        error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
      };
    }

    return { success: false, error: "Invalid email or password" };
  }

  const db = scopedDb(user.company_id);

  if (user.totp_secret) {
    const secret = decryptTotpSecret(user.totp_secret);
    if (!secret) {
      logger.error({ userId: user.id }, "Failed to decrypt MFA secret");
      return { success: false, error: "MFA configuration error" };
    }

    if (!totpCode) {
      return { success: false, error: "MFA code required", requiresMfa: true };
    }

    const valid = verifyTotpCode(secret, totpCode);
    if (!valid) {
      const newFailedLogins = user.failed_logins + 1;
      const shouldLock = newFailedLogins >= MAX_FAILED_ATTEMPTS;

      await db.user.updateMany({
        where: { id: user.id, company_id: user.company_id },
        data: {
          failed_logins: newFailedLogins,
          locked_until: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
            : null,
        },
      });

      await db.auditLog.create({
        data: {
          user_id: user.id,
          action: "auth.login_failed",
          details: {
            reason: "invalid_totp",
            failedAttempts: newFailedLogins,
            locked: shouldLock,
          } as object,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });

      return {
        success: false,
        error: shouldLock
          ? `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`
          : "Invalid MFA code",
        requiresMfa: true,
      };
    }
  }

  // Successful login - reset failed attempts and update last login
  const updateData: {
    failed_logins: number;
    locked_until: null;
    last_login_at: Date;
    password_hash?: string;
  } = {
    failed_logins: 0,
    locked_until: null,
    last_login_at: new Date(),
  };

  // Check if password needs rehashing (if we've upgraded our hash parameters)
  if (needsRehash(user.password_hash)) {
    updateData.password_hash = await hashPassword(password);
  }

  await db.user.updateMany({
    where: { id: user.id, company_id: user.company_id },
    data: updateData,
  });

  // Create session
  const session = await getSession();
  const now = Date.now();

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.company_id,
    companyName: user.company.name,
    companySlug: user.company.slug,
  };

  session.user = sessionUser;
  session.csrfToken = generateCsrfToken();
  session.createdAt = now;
  session.lastActivity = now;
  await session.save();

  // Audit log successful login
  await db.auditLog.create({
    data: {
      user_id: user.id,
      action: "auth.login_success",
      details: { method: "email_password" } as object,
      ip_address: ipAddress,
      user_agent: userAgent,
    },
  });

  logger.info(
    { userId: user.id, companyId: user.company_id },
    "User logged in successfully",
  );

  return { success: true, user: sessionUser };
}

/**
 * Destroy the current session (logout)
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

/**
 * Logout and redirect to login page
 */
export async function logout(
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const session = await getSession();

  if (session.user) {
    // Audit log logout
    const db = scopedDb(session.user.companyId);
    await db.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "auth.logout",
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  }

  session.destroy();
}

/**
 * Change password for current user
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return { success: false, error: "Not authenticated" };
  }

  // Get user from database
  const db = scopedDb(sessionUser.companyId);
  const user = await db.user.findFirst({
    where: { id: sessionUser.id, company_id: sessionUser.companyId },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Verify current password
  const currentPasswordValid = await verifyPassword(
    user.password_hash,
    currentPassword,
  );
  if (!currentPasswordValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  // Hash and save new password
  const newPasswordHash = await hashPassword(newPassword);
  await db.user.updateMany({
    where: { id: user.id, company_id: sessionUser.companyId },
    data: { password_hash: newPasswordHash },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      user_id: user.id,
      action: "auth.password_changed",
    },
  });

  return { success: true };
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components and pages
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Require admin role - redirects to dashboard with error if not admin
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();

  if (user.role !== "ADMIN") {
    redirect("/dashboard?error=unauthorized");
  }

  return user;
}
