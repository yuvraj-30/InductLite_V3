"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  createContractor,
  updateContractor,
  deactivateContractor,
  purgeInactiveContractor,
  findContractorById,
} from "@/lib/repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

const createContractorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Contractor name must be at least 2 characters")
    .max(120, "Contractor name must be less than 120 characters"),
  contactName: z
    .string()
    .trim()
    .max(120, "Contact name must be less than 120 characters")
    .optional()
    .or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .email("Invalid contact email")
    .max(160, "Contact email must be less than 160 characters")
    .optional()
    .or(z.literal("")),
  contactPhone: z
    .string()
    .trim()
    .max(30, "Contact phone must be less than 30 characters")
    .optional()
    .or(z.literal("")),
  trade: z
    .string()
    .trim()
    .max(120, "Trade must be less than 120 characters")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be less than 500 characters")
    .optional()
    .or(z.literal("")),
});

const updateContractorSchema = createContractorSchema;

export type ContractorActionResult =
  | { success: true; contractorId?: string; message: string }
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
  const parsed = z.string().cuid("Invalid contractor ID").safeParse(value);
  return parsed.success ? parsed.data : null;
}

function mapRepositoryError(error: unknown): string {
  const message = String(error);
  if (message.includes("already exists")) {
    return "A contractor with this name already exists";
  }
  if (message.includes("Invalid phone number")) {
    return "Please enter a valid NZ phone number";
  }
  if (message.includes("not found")) {
    return "Contractor not found";
  }
  return "Unable to complete request";
}

function normalizeOptional(value?: string): string | undefined {
  if (!value) return undefined;
  return value.trim() ? value.trim() : undefined;
}

function normalizeOptionalNullable(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createContractorAction(
  _prevState: ContractorActionResult | null,
  formData: FormData,
): Promise<ContractorActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("contractor:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsed = createContractorSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    trade: formData.get("trade"),
    notes: formData.get("notes"),
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
    const contractor = await createContractor(context.companyId, {
      name: parsed.data.name,
      contact_name: normalizeOptional(parsed.data.contactName),
      contact_email: normalizeOptional(parsed.data.contactEmail),
      contact_phone: normalizeOptional(parsed.data.contactPhone),
      trade: normalizeOptional(parsed.data.trade),
      notes: normalizeOptional(parsed.data.notes),
      is_active: true,
    });

    await createAuditLog(context.companyId, {
      action: "contractor.create",
      entity_type: "Contractor",
      entity_id: contractor.id,
      user_id: context.userId,
      details: {
        name: contractor.name,
        trade: contractor.trade,
      },
      request_id: requestId,
    });

    revalidatePath("/admin/contractors");
    log.info({ contractorId: contractor.id }, "Contractor created");

    return {
      success: true,
      contractorId: contractor.id,
      message: "Contractor created successfully",
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create contractor");
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function updateContractorAction(
  contractorId: string,
  _prevState: ContractorActionResult | null,
  formData: FormData,
): Promise<ContractorActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("contractor:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(contractorId);
  if (!parsedId) {
    return { success: false, error: "Invalid contractor ID" };
  }

  const parsed = updateContractorSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    trade: formData.get("trade"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findContractorById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "Contractor not found" };
  }

  try {
    const contractor = await updateContractor(context.companyId, parsedId, {
      name: parsed.data.name,
      contact_name: normalizeOptionalNullable(parsed.data.contactName),
      contact_email: normalizeOptionalNullable(parsed.data.contactEmail),
      contact_phone: normalizeOptionalNullable(parsed.data.contactPhone),
      trade: normalizeOptionalNullable(parsed.data.trade),
      notes: normalizeOptionalNullable(parsed.data.notes),
    });

    await createAuditLog(context.companyId, {
      action: "contractor.update",
      entity_type: "Contractor",
      entity_id: contractor.id,
      user_id: context.userId,
      details: {
        name: contractor.name,
        trade: contractor.trade,
      },
      request_id: requestId,
    });

    revalidatePath("/admin/contractors");
    revalidatePath(`/admin/contractors/${parsedId}`);
    log.info({ contractorId: contractor.id }, "Contractor updated");

    return {
      success: true,
      contractorId: contractor.id,
      message: "Contractor updated successfully",
    };
  } catch (error) {
    log.error(
      { error: String(error), contractorId: parsedId },
      "Failed to update contractor",
    );
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function deactivateContractorAction(
  contractorId: string,
): Promise<ContractorActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("contractor:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(contractorId);
  if (!parsedId) {
    return { success: false, error: "Invalid contractor ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findContractorById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "Contractor not found" };
  }

  try {
    await deactivateContractor(context.companyId, parsedId);

    await createAuditLog(context.companyId, {
      action: "contractor.deactivate",
      entity_type: "Contractor",
      entity_id: parsedId,
      user_id: context.userId,
      details: { name: existing.name },
      request_id: requestId,
    });

    revalidatePath("/admin/contractors");
    revalidatePath(`/admin/contractors/${parsedId}`);
    log.info({ contractorId: parsedId }, "Contractor deactivated");

    return {
      success: true,
      contractorId: parsedId,
      message: "Contractor deactivated",
    };
  } catch (error) {
    log.error(
      { error: String(error), contractorId: parsedId },
      "Failed to deactivate contractor",
    );
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function reactivateContractorAction(
  contractorId: string,
): Promise<ContractorActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("contractor:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(contractorId);
  if (!parsedId) {
    return { success: false, error: "Invalid contractor ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findContractorById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "Contractor not found" };
  }

  try {
    const contractor = await updateContractor(context.companyId, parsedId, {
      is_active: true,
    });

    await createAuditLog(context.companyId, {
      action: "contractor.update",
      entity_type: "Contractor",
      entity_id: parsedId,
      user_id: context.userId,
      details: {
        name: contractor.name,
        status: "active",
      },
      request_id: requestId,
    });

    revalidatePath("/admin/contractors");
    revalidatePath(`/admin/contractors/${parsedId}`);
    log.info({ contractorId: parsedId }, "Contractor reactivated");

    return {
      success: true,
      contractorId: parsedId,
      message: "Contractor reactivated",
    };
  } catch (error) {
    log.error(
      { error: String(error), contractorId: parsedId },
      "Failed to reactivate contractor",
    );
    return { success: false, error: mapRepositoryError(error) };
  }
}

export async function purgeContractorAction(
  contractorId: string,
): Promise<ContractorActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("contractor:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsedId = parseId(contractorId);
  if (!parsedId) {
    return { success: false, error: "Invalid contractor ID" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findContractorById(context.companyId, parsedId);
  if (!existing) {
    return { success: false, error: "Contractor not found" };
  }

  if (existing.is_active) {
    return {
      success: false,
      error: "Archive the contractor before permanent deletion",
    };
  }

  try {
    const deleted = await purgeInactiveContractor(context.companyId, parsedId);
    if (!deleted) {
      return { success: false, error: "Contractor not found" };
    }

    await createAuditLog(context.companyId, {
      action: "contractor.delete",
      entity_type: "Contractor",
      entity_id: parsedId,
      user_id: context.userId,
      details: { name: existing.name },
      request_id: requestId,
    });

    revalidatePath("/admin/contractors");
    revalidatePath(`/admin/contractors/${parsedId}`);
    log.info({ contractorId: parsedId }, "Contractor permanently deleted");

    return {
      success: true,
      contractorId: parsedId,
      message: "Contractor permanently deleted",
    };
  } catch (error) {
    log.error(
      { error: String(error), contractorId: parsedId },
      "Failed to permanently delete contractor",
    );
    return { success: false, error: mapRepositoryError(error) };
  }
}
