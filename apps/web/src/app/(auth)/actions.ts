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
  hashPassword,
} from "@/lib/auth";
import { createRequestLogger, logAuthEvent } from "@/lib/logger";
import {
  assertOrigin,
  generateRequestId,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/csrf";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import {
  ensureDefaultPublishedTemplate,
  registerCompanyWithAdmin,
  RepositoryError,
} from "@/lib/repository";

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

const registerSchema = z.object({
  companyName: z
    .string()
    .min(2, "Company name is required")
    .max(100, "Company name is too long"),
  name: z.string().min(2, "Your name is required").max(100, "Name is too long"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  siteName: z
    .string()
    .min(2, "First site name is required")
    .max(100, "Site name is too long"),
});

/**
 * Action result type
 */
export type ActionResult =
  | { success: true; message?: string; requiresMfa?: boolean }
  | { success: false; error: string; requiresMfa?: boolean };

export type RegisterActionResult =
  | { success: true; message?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

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
      error: parsed.error.issues[0]?.message || "Invalid input",
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
 * Self-serve registration action:
 * - creates company
 * - creates admin user
 * - creates first site + public link
 * - provisions default template
 * - signs user in
 */
export async function registerAction(
  _prevState: RegisterActionResult | null,
  formData: FormData,
): Promise<RegisterActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  const rawData = {
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    siteName: formData.get("siteName"),
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.issues.forEach((err) => {
      const field = err.path[0]?.toString() || "form";
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(err.message);
    });

    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
      fieldErrors,
    };
  }

  const { companyName, name, email, password, siteName } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const passwordHash = await hashPassword(password);
    const created = await registerCompanyWithAdmin({
      companyName,
      adminName: name,
      adminEmail: normalizedEmail,
      adminPasswordHash: passwordHash,
      firstSiteName: siteName,
      requestId,
    });

    try {
      await ensureDefaultPublishedTemplate(created.companyId);
    } catch (templateError) {
      log.warn(
        { error: String(templateError) },
        "Could not auto-provision default template during registration",
      );
    }

    const [ipAddress, userAgent] = await Promise.all([
      getClientIp(),
      getUserAgent(),
    ]);

    const loginResult = await sessionLogin(
      normalizedEmail,
      password,
      ipAddress,
      userAgent,
    );

    if (!loginResult.success) {
      log.error(
        { emailPrefix: normalizedEmail.slice(0, 3) + "***" },
        "Registration succeeded but auto-login failed",
      );
      return {
        success: false,
        error:
          "Account created, but sign-in failed. Please sign in from the login page.",
      };
    }
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "ALREADY_EXISTS") {
      return {
        success: false,
        error: "An account with this email already exists",
        fieldErrors: { email: ["An account with this email already exists"] },
      };
    }

    log.error({ error: String(error) }, "Registration failed");
    return { success: false, error: "Failed to create account" };
  }

  redirect("/admin/dashboard?welcome=1");
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
      error: parsed.error.issues[0]?.message || "Invalid input",
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
