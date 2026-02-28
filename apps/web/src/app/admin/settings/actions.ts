"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findCompanyComplianceSettings,
  updateCompanyComplianceSettings,
} from "@/lib/repository/company.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

const MAX_RETENTION_DAYS = 36500;

const updateComplianceSettingsSchema = z
  .object({
    retentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    inductionRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    auditRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    incidentRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    emergencyDrillRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    complianceLegalHold: z.coerce.boolean().default(false),
    complianceLegalHoldReason: z
      .string()
      .max(500, "Legal hold reason must be 500 characters or less")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const reason = value.complianceLegalHoldReason?.trim() ?? "";
    if (value.complianceLegalHold && reason.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["complianceLegalHoldReason"],
        message: "Legal hold reason is required when legal hold is enabled",
      });
    }
  });

export type ComplianceSettingsActionResult =
  | { success: true; message: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.errors) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] = fieldErrors[field] ?? [];
    fieldErrors[field].push(issue.message);
  }
  return fieldErrors;
}

function mapActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("not found")) {
    return "Company settings not found";
  }
  if (message.toLowerCase().includes("validation")) {
    return "Invalid compliance settings";
  }
  return "Failed to update compliance settings";
}

function toAuditSnapshot(
  settings:
    | Awaited<ReturnType<typeof findCompanyComplianceSettings>>
    | null,
) {
  if (!settings) {
    return null;
  }

  return {
    retention_days: settings.retention_days,
    induction_retention_days: settings.induction_retention_days,
    audit_retention_days: settings.audit_retention_days,
    incident_retention_days: settings.incident_retention_days,
    emergency_drill_retention_days: settings.emergency_drill_retention_days,
    compliance_legal_hold: settings.compliance_legal_hold,
    compliance_legal_hold_reason: settings.compliance_legal_hold_reason,
    compliance_legal_hold_set_at: settings.compliance_legal_hold_set_at
      ? settings.compliance_legal_hold_set_at.toISOString()
      : null,
  };
}

export async function updateComplianceSettingsAction(
  _prevState: ComplianceSettingsActionResult | null,
  formData: FormData,
): Promise<ComplianceSettingsActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/settings",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("settings:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsed = updateComplianceSettingsSchema.safeParse({
    retentionDays: formData.get("retentionDays"),
    inductionRetentionDays: formData.get("inductionRetentionDays"),
    auditRetentionDays: formData.get("auditRetentionDays"),
    incidentRetentionDays: formData.get("incidentRetentionDays"),
    emergencyDrillRetentionDays: formData.get("emergencyDrillRetentionDays"),
    complianceLegalHold: formData.get("complianceLegalHold") ?? false,
    complianceLegalHoldReason: formData.get("complianceLegalHoldReason"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const previous = await findCompanyComplianceSettings(context.companyId);
    const updated = await updateCompanyComplianceSettings(context.companyId, {
      retention_days: parsed.data.retentionDays,
      induction_retention_days: parsed.data.inductionRetentionDays,
      audit_retention_days: parsed.data.auditRetentionDays,
      incident_retention_days: parsed.data.incidentRetentionDays,
      emergency_drill_retention_days: parsed.data.emergencyDrillRetentionDays,
      compliance_legal_hold: parsed.data.complianceLegalHold,
      compliance_legal_hold_reason:
        parsed.data.complianceLegalHoldReason?.trim() || null,
    });

    await createAuditLog(context.companyId, {
      action: "settings.update",
      entity_type: "Company",
      entity_id: context.companyId,
      user_id: context.userId,
      details: {
        previous: toAuditSnapshot(previous),
        updated: toAuditSnapshot(updated),
      },
      request_id: requestId,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin");

    return {
      success: true,
      message: "Compliance settings updated",
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to update compliance settings");
    return { success: false, error: mapActionError(error) };
  }
}
