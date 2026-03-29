"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createCompetencyRequirement,
  createWorkerCertification,
} from "@/lib/repository/competency.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({
    flashStatus: status,
    flashMessage: message,
  });
  redirect(`/admin/competency?${params.toString()}`);
}

const createRequirementSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  roleKey: z.string().max(80).optional().or(z.literal("")),
  name: z.string().min(3).max(160),
  description: z.string().max(2000).optional().or(z.literal("")),
  evidenceType: z.enum(["INDUCTION", "CERTIFICATION", "DOCUMENT", "LMS", "OTHER"]),
  validityDays: z.coerce.number().int().min(1).max(3650).optional(),
  isBlocking: z.coerce.boolean().default(true),
});

const createCertificationSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  requirementId: z.string().cuid().optional().or(z.literal("")),
  visitorPhone: z.string().min(5).max(32),
  visitorEmail: z.string().email().optional().or(z.literal("")),
  workerName: z.string().min(2).max(160),
  employerName: z.string().max(160).optional().or(z.literal("")),
  status: z.enum(["CURRENT", "EXPIRING", "EXPIRED", "PENDING_VERIFICATION"]),
  issuedAt: z.string().optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});

export async function createCompetencyRequirementAction(
  formData: FormData,
): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const parsed = createRequirementSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    roleKey: formData.get("roleKey")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    evidenceType: formData.get("evidenceType")?.toString() ?? "CERTIFICATION",
    validityDays: formData.get("validityDays")?.toString() ?? undefined,
    isBlocking: formData.get("isBlocking") ?? true,
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid requirement");
  }

  if (parsed.data.siteId) {
    const guard = await checkSitePermission("site:manage", parsed.data.siteId);
    if (!guard.success) {
      statusRedirect("error", guard.error);
    }
  }

  const context = await requireAuthenticatedContextReadOnly();

  let requirementId: string | null = null;

  try {
    const requirement = await createCompetencyRequirement(context.companyId, {
      site_id: parsed.data.siteId || null,
      role_key: parsed.data.roleKey || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      evidence_type: parsed.data.evidenceType,
      validity_days: parsed.data.validityDays ?? null,
      is_blocking: parsed.data.isBlocking,
    });

    await createAuditLog(context.companyId, {
      action: "competency.requirement.create",
      entity_type: "CompetencyRequirement",
      entity_id: requirement.id,
      user_id: context.userId,
      details: {
        site_id: requirement.site_id,
        role_key: requirement.role_key,
        evidence_type: requirement.evidence_type,
      },
    });
    requirementId = requirement.id;
  } catch (error) {
    statusRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to create requirement",
    );
  }

  if (!requirementId) {
    statusRedirect("error", "Failed to create requirement");
  }

  statusRedirect("ok", "Competency requirement created");
}

export async function createWorkerCertificationAction(
  formData: FormData,
): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const parsed = createCertificationSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    requirementId: formData.get("requirementId")?.toString() ?? "",
    visitorPhone: formData.get("visitorPhone")?.toString() ?? "",
    visitorEmail: formData.get("visitorEmail")?.toString() ?? "",
    workerName: formData.get("workerName")?.toString() ?? "",
    employerName: formData.get("employerName")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "CURRENT",
    issuedAt: formData.get("issuedAt")?.toString() ?? "",
    expiresAt: formData.get("expiresAt")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid certification");
  }

  if (parsed.data.siteId) {
    const guard = await checkSitePermission("site:manage", parsed.data.siteId);
    if (!guard.success) {
      statusRedirect("error", guard.error);
    }
  }

  const issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null;
  if (issuedAt && Number.isNaN(issuedAt.getTime())) {
    statusRedirect("error", "Issued date is invalid");
  }
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    statusRedirect("error", "Expiry date is invalid");
  }

  const context = await requireAuthenticatedContextReadOnly();

  let certificationId: string | null = null;

  try {
    const certification = await createWorkerCertification(context.companyId, {
      site_id: parsed.data.siteId || null,
      requirement_id: parsed.data.requirementId || null,
      visitor_phone: parsed.data.visitorPhone,
      visitor_email: parsed.data.visitorEmail || null,
      worker_name: parsed.data.workerName,
      employer_name: parsed.data.employerName || null,
      status: parsed.data.status,
      issued_at: issuedAt,
      expires_at: expiresAt,
      verified_by_user_id: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "competency.certification.create",
      entity_type: "WorkerCertification",
      entity_id: certification.id,
      user_id: context.userId,
      details: {
        site_id: certification.site_id,
        requirement_id: certification.requirement_id,
        visitor_phone: certification.visitor_phone,
        status: certification.status,
      },
    });
    certificationId = certification.id;
  } catch (error) {
    statusRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to save certification",
    );
  }

  if (!certificationId) {
    statusRedirect("error", "Failed to save certification");
  }

  statusRedirect("ok", "Worker certification recorded");
}
