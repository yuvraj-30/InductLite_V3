"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createPermitTemplate,
  createPermitCondition,
  createPermitRequest,
  transitionPermitRequest,
  upsertContractorPrequalification,
} from "@/lib/repository/permit.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";

export type PermitActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const createPermitTemplateSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  name: z.string().min(2).max(120),
  permitType: z.string().min(2).max(80),
  description: z.string().max(1000).optional().or(z.literal("")),
  requiredForSignIn: z.boolean().optional(),
});

const createPermitConditionSchema = z.object({
  permitTemplateId: z.string().cuid(),
  stage: z.string().min(2).max(80),
  conditionType: z.string().min(2).max(80),
  title: z.string().min(2).max(160),
  details: z.string().max(1000).optional().or(z.literal("")),
  isRequired: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

const createPermitRequestSchema = z.object({
  siteId: z.string().cuid(),
  permitTemplateId: z.string().cuid(),
  contractorId: z.string().cuid().optional().or(z.literal("")),
  assigneeUserId: z.string().cuid().optional().or(z.literal("")),
  visitorName: z.string().min(2).max(120).optional().or(z.literal("")),
  visitorPhone: z.string().min(6).max(40).optional().or(z.literal("")),
  visitorEmail: z.string().email().optional().or(z.literal("")),
  employerName: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  validityStart: z.string().optional().or(z.literal("")),
  validityEnd: z.string().optional().or(z.literal("")),
});

const transitionPermitRequestSchema = z.object({
  permitRequestId: z.string().cuid(),
  status: z.enum([
    "DRAFT",
    "REQUESTED",
    "APPROVED",
    "ACTIVE",
    "SUSPENDED",
    "CLOSED",
    "DENIED",
  ]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

const prequalificationSchema = z.object({
  contractorId: z.string().cuid(),
  siteId: z.string().cuid().optional().or(z.literal("")),
  score: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(["PENDING", "APPROVED", "EXPIRED", "DENIED"]),
  checklistJson: z.string().optional().or(z.literal("")),
  evidenceJson: z.string().optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});

async function ensurePermitFeatures(companyId: string): Promise<PermitActionResult | null> {
  try {
    await assertCompanyFeatureEnabled(companyId, "PERMITS_V1");
    return null;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Permit workflows are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }
}

async function authorizeMutation(): Promise<
  | { success: true; companyId: string; userId: string; requestId: string }
  | { success: false; error: string }
> {
  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    return {
      success: false,
      error: "Too many admin updates right now. Please retry in a minute.",
    };
  }

  return {
    success: true,
    companyId: context.companyId,
    userId: context.userId,
    requestId: generateRequestId(),
  };
}

function parseOptionalIsoDate(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseOptionalJson(
  value: string,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export async function createPermitTemplateAction(
  _prevState: PermitActionResult | null,
  formData: FormData,
): Promise<PermitActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = createPermitTemplateSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    permitType: formData.get("permitType")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    requiredForSignIn: formData.get("requiredForSignIn") === "on",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const log = createRequestLogger(auth.requestId, {
    path: "/admin/permits",
    method: "POST",
  });

  const featureError = await ensurePermitFeatures(auth.companyId);
  if (featureError) return featureError;

  try {
    const created = await createPermitTemplate(auth.companyId, {
      site_id: parsed.data.siteId || undefined,
      name: parsed.data.name,
      permit_type: parsed.data.permitType,
      description: parsed.data.description || undefined,
      approval_policy: {
        approvalStages: 1,
        createdFrom: "admin.permits",
      },
      is_required_for_signin: parsed.data.requiredForSignIn === true,
    });

    await createAuditLog(auth.companyId, {
      action: "permit.template.create",
      entity_type: "PermitTemplate",
      entity_id: created.id,
      user_id: auth.userId,
      details: {
        site_id: created.site_id,
        permit_type: created.permit_type,
        required_for_signin: created.is_required_for_signin,
      },
      request_id: auth.requestId,
    });

    revalidatePath("/admin/permits");
    revalidatePath("/admin/permits/templates");
    return { success: true, message: "Permit template created" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create permit template");
    return { success: false, error: "Failed to create permit template" };
  }
}

export async function createPermitConditionAction(
  _prevState: PermitActionResult | null,
  formData: FormData,
): Promise<PermitActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = createPermitConditionSchema.safeParse({
    permitTemplateId: formData.get("permitTemplateId")?.toString() ?? "",
    stage: formData.get("stage")?.toString() ?? "",
    conditionType: formData.get("conditionType")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    details: formData.get("details")?.toString() ?? "",
    isRequired: formData.get("isRequired") === "on",
    sortOrder: formData.get("sortOrder")?.toString() ?? "0",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensurePermitFeatures(auth.companyId);
  if (featureError) return featureError;

  const created = await createPermitCondition(auth.companyId, {
    permit_template_id: parsed.data.permitTemplateId,
    stage: parsed.data.stage,
    condition_type: parsed.data.conditionType,
    title: parsed.data.title,
    details: parsed.data.details || undefined,
    is_required: parsed.data.isRequired !== false,
    sort_order: parsed.data.sortOrder,
  });

  await createAuditLog(auth.companyId, {
    action: "permit.condition.create",
    entity_type: "PermitCondition",
    entity_id: created.id,
    user_id: auth.userId,
    details: {
      permit_template_id: created.permit_template_id,
      stage: created.stage,
      condition_type: created.condition_type,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/permits");
  revalidatePath("/admin/permits/templates");
  return { success: true, message: "Permit condition added" };
}

export async function createPermitRequestAction(
  _prevState: PermitActionResult | null,
  formData: FormData,
): Promise<PermitActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = createPermitRequestSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    permitTemplateId: formData.get("permitTemplateId")?.toString() ?? "",
    contractorId: formData.get("contractorId")?.toString() ?? "",
    assigneeUserId: formData.get("assigneeUserId")?.toString() ?? "",
    visitorName: formData.get("visitorName")?.toString() ?? "",
    visitorPhone: formData.get("visitorPhone")?.toString() ?? "",
    visitorEmail: formData.get("visitorEmail")?.toString() ?? "",
    employerName: formData.get("employerName")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    validityStart: formData.get("validityStart")?.toString() ?? "",
    validityEnd: formData.get("validityEnd")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensurePermitFeatures(auth.companyId);
  if (featureError) return featureError;

  const created = await createPermitRequest(auth.companyId, {
    site_id: parsed.data.siteId,
    permit_template_id: parsed.data.permitTemplateId,
    contractor_id: parsed.data.contractorId || undefined,
    requestor_user_id: auth.userId,
    assignee_user_id: parsed.data.assigneeUserId || undefined,
    visitor_name: parsed.data.visitorName || undefined,
    visitor_phone: parsed.data.visitorPhone || undefined,
    visitor_email: parsed.data.visitorEmail || undefined,
    employer_name: parsed.data.employerName || undefined,
    notes: parsed.data.notes || undefined,
    validity_start: parseOptionalIsoDate(parsed.data.validityStart ?? ""),
    validity_end: parseOptionalIsoDate(parsed.data.validityEnd ?? ""),
  });

  await createAuditLog(auth.companyId, {
    action: "permit.request.create",
    entity_type: "PermitRequest",
    entity_id: created.id,
    user_id: auth.userId,
    details: {
      site_id: created.site_id,
      permit_template_id: created.permit_template_id,
      status: created.status,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/permits");
  return { success: true, message: "Permit request created" };
}

export async function transitionPermitRequestAction(
  permitRequestId: string,
  status: "DRAFT" | "REQUESTED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CLOSED" | "DENIED",
  notes?: string,
): Promise<PermitActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = transitionPermitRequestSchema.safeParse({
    permitRequestId,
    status,
    notes: notes ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensurePermitFeatures(auth.companyId);
  if (featureError) return featureError;

  const updated = await transitionPermitRequest(auth.companyId, {
    permit_request_id: parsed.data.permitRequestId,
    status: parsed.data.status,
    actor_user_id: auth.userId,
    notes: parsed.data.notes || undefined,
  });

  await createAuditLog(auth.companyId, {
    action: "permit.request.transition",
    entity_type: "PermitRequest",
    entity_id: updated.id,
    user_id: auth.userId,
    details: {
      status: updated.status,
      site_id: updated.site_id,
      notes: parsed.data.notes || null,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/permits");
  return { success: true, message: `Permit request marked ${updated.status}` };
}

export async function upsertContractorPrequalificationAction(
  _prevState: PermitActionResult | null,
  formData: FormData,
): Promise<PermitActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = prequalificationSchema.safeParse({
    contractorId: formData.get("contractorId")?.toString() ?? "",
    siteId: formData.get("siteId")?.toString() ?? "",
    score: formData.get("score")?.toString() ?? "0",
    status: formData.get("status")?.toString() ?? "PENDING",
    checklistJson: formData.get("checklistJson")?.toString() ?? "",
    evidenceJson: formData.get("evidenceJson")?.toString() ?? "",
    expiresAt: formData.get("expiresAt")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensurePermitFeatures(auth.companyId);
  if (featureError) return featureError;

  try {
    await assertCompanyFeatureEnabled(auth.companyId, "PREQUALIFICATION_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Contractor prequalification is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }

  const updated = await upsertContractorPrequalification(auth.companyId, {
    contractor_id: parsed.data.contractorId,
    site_id: parsed.data.siteId || undefined,
    score: parsed.data.score,
    status: parsed.data.status,
    checklist: parseOptionalJson(parsed.data.checklistJson ?? ""),
    evidence_refs: parseOptionalJson(parsed.data.evidenceJson ?? ""),
    expires_at: parseOptionalIsoDate(parsed.data.expiresAt ?? ""),
    reviewed_by: auth.userId,
  });

  await createAuditLog(auth.companyId, {
    action: "contractor.prequalification.upsert",
    entity_type: "ContractorPrequalification",
    entity_id: updated.id,
    user_id: auth.userId,
    details: {
      contractor_id: updated.contractor_id,
      site_id: updated.site_id,
      status: updated.status,
      score: updated.score,
      expires_at: updated.expires_at?.toISOString() ?? null,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/permits");
  return { success: true, message: "Prequalification updated" };
}
