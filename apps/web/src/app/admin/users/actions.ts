"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkAdmin, hashPassword } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  purgeInactiveUser,
  findUserById,
} from "@/lib/repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

const roleSchema = z.enum(["ADMIN", "SITE_MANAGER", "VIEWER"]);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be less than 120 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(160, "Email must be less than 160 characters"),
  role: roleSchema,
  password: passwordSchema,
});

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be less than 120 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(160, "Email must be less than 160 characters"),
  role: roleSchema,
  newPassword: z
    .union([passwordSchema, z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type UserActionResult =
  | {
      success: true;
      message: string;
      userId?: string;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  error.errors.forEach((issue) => {
    const field = issue.path[0]?.toString() ?? "form";
    if (!fieldErrors[field]) {
      fieldErrors[field] = [];
    }
    fieldErrors[field].push(issue.message);
  });
  return fieldErrors;
}

function parseId(value: string): string | null {
  const parsed = z.string().cuid("Invalid user ID").safeParse(value);
  return parsed.success ? parsed.data : null;
}

function mapRepositoryError(error: unknown): string {
  const message = String(error);
  if (message.includes("already exists")) {
    return "A user with this email already exists";
  }
  if (message.includes("not found")) {
    return "User not found";
  }
  return "Unable to complete request";
}

export async function createUserAction(
  _prevState: UserActionResult | null,
  formData: FormData,
): Promise<UserActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const passwordHash = await hashPassword(parsed.data.password);

    const user = await createUser(context.companyId, {
      name: parsed.data.name,
      email: parsed.data.email,
      password_hash: passwordHash,
      role: parsed.data.role,
      is_active: true,
    });

    await createAuditLog(context.companyId, {
      action: "user.create",
      entity_type: "User",
      entity_id: user.id,
      user_id: context.userId,
      details: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
      request_id: requestId,
    });

    revalidatePath("/admin/users");
    log.info({ userId: user.id }, "User created");

    return {
      success: true,
      userId: user.id,
      message: "User created successfully",
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create user");
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function updateUserAction(
  userId: string,
  _prevState: UserActionResult | null,
  formData: FormData,
): Promise<UserActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(userId);
  if (!parsedId) {
    return { success: false, error: "Invalid user ID" };
  }

  const parsed = updateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findUserById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "User not found" };
  }

  if (existing.id === context.userId && parsed.data.role !== existing.role) {
    return {
      success: false,
      error: "You cannot change your own role",
    };
  }

  try {
    const passwordHash = parsed.data.newPassword
      ? await hashPassword(parsed.data.newPassword)
      : undefined;

    const updated = await updateUser(context.companyId, parsedId, {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      ...(passwordHash ? { password_hash: passwordHash } : {}),
    });

    await createAuditLog(context.companyId, {
      action: "user.update",
      entity_type: "User",
      entity_id: updated.id,
      user_id: context.userId,
      details: {
        name: updated.name,
        email: updated.email,
        role: updated.role,
        password_reset: Boolean(passwordHash),
      },
      request_id: requestId,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${parsedId}`);
    log.info({ userId: updated.id }, "User updated");

    return {
      success: true,
      userId: updated.id,
      message: "User updated successfully",
    };
  } catch (error) {
    log.error({ error: String(error), userId: parsedId }, "Failed to update user");
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function deactivateUserAction(
  userId: string,
): Promise<UserActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(userId);
  if (!parsedId) {
    return { success: false, error: "Invalid user ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findUserById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "User not found" };
  }

  if (existing.id === context.userId) {
    return { success: false, error: "You cannot deactivate your own account" };
  }

  try {
    await deactivateUser(context.companyId, parsedId);

    await createAuditLog(context.companyId, {
      action: "user.deactivate",
      entity_type: "User",
      entity_id: parsedId,
      user_id: context.userId,
      details: { email: existing.email, name: existing.name },
      request_id: requestId,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${parsedId}`);
    log.info({ userId: parsedId }, "User deactivated");

    return { success: true, userId: parsedId, message: "User deactivated" };
  } catch (error) {
    log.error(
      { error: String(error), userId: parsedId },
      "Failed to deactivate user",
    );
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function reactivateUserAction(
  userId: string,
): Promise<UserActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(userId);
  if (!parsedId) {
    return { success: false, error: "Invalid user ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findUserById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "User not found" };
  }

  try {
    await reactivateUser(context.companyId, parsedId);

    await createAuditLog(context.companyId, {
      action: "user.reactivate",
      entity_type: "User",
      entity_id: parsedId,
      user_id: context.userId,
      details: { email: existing.email, name: existing.name },
      request_id: requestId,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${parsedId}`);
    log.info({ userId: parsedId }, "User reactivated");

    return { success: true, userId: parsedId, message: "User reactivated" };
  } catch (error) {
    log.error(
      { error: String(error), userId: parsedId },
      "Failed to reactivate user",
    );
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function purgeUserAction(
  userId: string,
): Promise<UserActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(userId);
  if (!parsedId) {
    return { success: false, error: "Invalid user ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findUserById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "User not found" };
  }

  if (existing.id === context.userId) {
    return {
      success: false,
      error: "You cannot permanently delete your own account",
    };
  }

  if (existing.is_active) {
    return {
      success: false,
      error: "Archive the user before permanent deletion",
    };
  }

  try {
    const deleted = await purgeInactiveUser(context.companyId, parsedId);
    if (!deleted) {
      return { success: false, error: "User not found" };
    }

    await createAuditLog(context.companyId, {
      action: "user.delete",
      entity_type: "User",
      entity_id: parsedId,
      user_id: context.userId,
      details: { email: existing.email, name: existing.name },
      request_id: requestId,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${parsedId}`);
    log.info({ userId: parsedId }, "User permanently deleted");

    return {
      success: true,
      userId: parsedId,
      message: "User permanently deleted",
    };
  } catch (error) {
    log.error(
      { error: String(error), userId: parsedId },
      "Failed to permanently delete user",
    );
    return { success: false, error: mapRepositoryError(error) };
  }
}
