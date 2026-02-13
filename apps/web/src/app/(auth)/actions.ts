"use server";

/**
 * Authentication Server Actions
 *
 * These actions handle login, logout, and password change operations.
 * They use the auth module for session management and the repository
 * layer for database operations.
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  login as sessionLogin,
  logout as sessionLogout,
  changePassword,
} from "@/lib/auth";
import { createRequestLogger, logAuthEvent } from "@/lib/logger";
import {
  assertOrigin,
  generateRequestId,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/csrf";
import { checkLoginRateLimit } from "@/lib/rate-limit";

/**
 * Login form schema
 */
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  totp: z
    .preprocess((value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }
      return value;
    }, z.string().optional()),
});

/**
 * Action result type
 */
export type ActionResult =
  | { success: true; message?: string; requiresMfa?: boolean }
  | { success: false; error: string; requiresMfa?: boolean };

/**
 * Login action
 * Note: Login cannot use assertOrigin() CSRF check as user is not authenticated.
 * CSRF protection for login relies on SameSite cookies and form-based submission.
 */
 
export async function loginAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp"),
  };

  // Validate input
  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    log.warn({ action: "auth.login", error: "validation_failed" });
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid input",
    };
  }

  const { email, password } = parsed.data;

  // Rate limit login attempts (keyed by IP+email) — correlate logs with requestId
  try {
    const rl = await checkLoginRateLimit(email, { requestId });
    if (!rl.success) {
      log.warn(
        {
          action: "auth.login",
          email: email.slice(0, 3) + "***",
          remaining: rl.remaining,
        },
        "Login rate limit exceeded",
      );
      return {
        success: false,
        error: "Too many login attempts. Try again later.",
      };
    }

    const [ipAddress, userAgent] = await Promise.all([
      getClientIp(),
      getUserAgent(),
    ]);

    const result = await sessionLogin(
      email,
      password,
      ipAddress,
      userAgent,
      parsed.data.totp || undefined,
    );

    if (!result.success) {
      logAuthEvent(log, "login_failed", email, false, {
        reason: result.error,
        ip: ipAddress,
      });
      return {
        success: false,
        error: result.error || "Login failed",
        requiresMfa: result.requiresMfa,
      };
    }

    logAuthEvent(log, "login", email, true, { ip: ipAddress });
  } catch (error) {
    log.error({ action: "auth.login", error: String(error) });
    return { success: false, error: "An unexpected error occurred" };
  }

  // Redirect to admin dashboard on success
  redirect("/admin/dashboard");
}

/**
 * Logout action
 * Note: Logout is an idempotent, low-risk operation that clears the session.
 * CSRF protection via SameSite cookies is sufficient.
 */
 
export async function logoutAction(): Promise<never> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();

    const [ipAddress, userAgent] = await Promise.all([
      getClientIp(),
      getUserAgent(),
    ]);

    await sessionLogout(ipAddress, userAgent);

    log.info({ action: "auth.logout", status: "success" });
  } catch (error) {
    log.error({ action: "auth.logout", error: String(error) });
  }

  redirect("/login");
}

/**
 * Change password schema
 */
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Change password action
 * Note: Uses assertOrigin() for CSRF protection.
 */
 
export async function changePasswordAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    log.warn({ action: "auth.password_change", error: "invalid_origin" });
    return { success: false, error: "Invalid request origin" };
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  // Validate input
  const parsed = changePasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid input",
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const result = await changePassword(currentPassword, newPassword);

    if (!result.success) {
      log.warn({ action: "auth.password_change", error: result.error });
      return {
        success: false,
        error: result.error || "Failed to change password",
      };
    }

    log.info({ action: "auth.password_change", status: "success" });
    return { success: true, message: "Password changed successfully" };
  } catch (error) {
    log.error({ action: "auth.password_change", error: String(error) });
    return { success: false, error: "An unexpected error occurred" };
  }
}
