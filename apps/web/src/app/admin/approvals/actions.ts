"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  createIdentityVerificationRecord,
  createVisitorWatchlistEntry,
  deactivateVisitorWatchlistEntry,
  transitionVisitorApprovalRequest,
  upsertVisitorApprovalPolicy,
} from "@/lib/repository/visitor-approval.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

export type ApprovalActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const approvalPolicySchema = z.object({
  siteId: z.string().cuid(),
  templateId: z.string().cuid().optional().or(z.literal("")),
  name: z.string().min(2).max(120),
  randomCheckPercentage: z.coerce.number().int().min(0).max(100).default(0),
  requireWatchlist: z.boolean().optional(),
  rulesJson: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

const watchlistSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  employerName: z.string().max(120).optional().or(z.literal("")),
  reason: z.string().max(500).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});

const approvalDecisionSchema = z.object({
  approvalRequestId: z.string().cuid(),
  status: z.enum(["APPROVED", "DENIED", "REVOKED"]),
  decisionNotes: z.string().max(1000).optional().or(z.literal("")),
});

const identityVerificationSchema = z.object({
  siteId: z.string().cuid(),
  approvalRequestId: z.string().cuid().optional().or(z.literal("")),
  signInRecordId: z.string().cuid().optional().or(z.literal("")),
  method: z.enum(["MANUAL_ID", "DOCUMENT_SCAN", "WATCHLIST_REVIEW", "RANDOM_CHECK"]),
  result: z.enum(["PASS", "FAIL", "NEEDS_REVIEW"]),
  evidencePointer: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

function parseOptionalIsoDate(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
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

async function ensureApprovalFeatures(companyId: string): Promise<ApprovalActionResult | null> {
  if (!isFeatureEnabled("ID_HARDENING_V1")) {
    return {
      success: false,
      error:
        "Approval/identity workflows are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
    };
  }

  try {
    await assertCompanyFeatureEnabled(companyId, "VISITOR_APPROVALS_V1");
    await assertCompanyFeatureEnabled(companyId, "ID_HARDENING_V1");
    return null;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Approval/identity workflows are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }
}

export async function upsertApprovalPolicyAction(
  _prevState: ApprovalActionResult | null,
  formData: FormData,
): Promise<ApprovalActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = approvalPolicySchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    templateId: formData.get("templateId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    randomCheckPercentage: formData.get("randomCheckPercentage")?.toString() ?? "0",
    requireWatchlist: formData.get("requireWatchlist") === "on",
    rulesJson: formData.get("rulesJson")?.toString() ?? "",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureApprovalFeatures(auth.companyId);
  if (featureError) return featureError;

  const log = createRequestLogger(auth.requestId, {
    path: "/admin/approvals",
    method: "POST",
  });

  try {
    const policy = await upsertVisitorApprovalPolicy(auth.companyId, {
      site_id: parsed.data.siteId,
      template_id: parsed.data.templateId || undefined,
      name: parsed.data.name,
      random_check_percentage: parsed.data.randomCheckPercentage,
      require_watchlist_screening: parsed.data.requireWatchlist !== false,
      rules: parseOptionalJson(parsed.data.rulesJson ?? ""),
      is_active: parsed.data.isActive !== false,
    });

    await createAuditLog(auth.companyId, {
      action: "visitor.approval_policy.upsert",
      entity_type: "VisitorApprovalPolicy",
      entity_id: policy.id,
      user_id: auth.userId,
      details: {
        site_id: policy.site_id,
        random_check_percentage: policy.random_check_percentage,
        require_watchlist_screening: policy.require_watchlist_screening,
        is_active: policy.is_active,
      },
      request_id: auth.requestId,
    });

    revalidatePath("/admin/approvals");
    return { success: true, message: "Approval policy updated" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to upsert approval policy");
    return { success: false, error: "Failed to update approval policy" };
  }
}

export async function addWatchlistEntryAction(
  _prevState: ApprovalActionResult | null,
  formData: FormData,
): Promise<ApprovalActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = watchlistSchema.safeParse({
    fullName: formData.get("fullName")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    employerName: formData.get("employerName")?.toString() ?? "",
    reason: formData.get("reason")?.toString() ?? "",
    expiresAt: formData.get("expiresAt")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureApprovalFeatures(auth.companyId);
  if (featureError) return featureError;

  const entry = await createVisitorWatchlistEntry(auth.companyId, {
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || undefined,
    email: parsed.data.email || undefined,
    employer_name: parsed.data.employerName || undefined,
    reason: parsed.data.reason || undefined,
    expires_at: parseOptionalIsoDate(parsed.data.expiresAt ?? ""),
  });

  await createAuditLog(auth.companyId, {
    action: "visitor.watchlist.create",
    entity_type: "VisitorWatchlistEntry",
    entity_id: entry.id,
    user_id: auth.userId,
    details: {
      full_name: entry.full_name,
      reason: entry.reason,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/approvals");
  return { success: true, message: "Watchlist entry added" };
}

export async function deactivateWatchlistEntryAction(
  entryId: string,
): Promise<ApprovalActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const featureError = await ensureApprovalFeatures(auth.companyId);
  if (featureError) return featureError;

  await deactivateVisitorWatchlistEntry(auth.companyId, entryId);
  await createAuditLog(auth.companyId, {
    action: "visitor.watchlist.deactivate",
    entity_type: "VisitorWatchlistEntry",
    entity_id: entryId,
    user_id: auth.userId,
    details: {},
    request_id: auth.requestId,
  });

  revalidatePath("/admin/approvals");
  return { success: true, message: "Watchlist entry removed" };
}

export async function decideVisitorApprovalRequestAction(
  _prevState: ApprovalActionResult | null,
  formData: FormData,
): Promise<ApprovalActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = approvalDecisionSchema.safeParse({
    approvalRequestId: formData.get("approvalRequestId")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "DENIED",
    decisionNotes: formData.get("decisionNotes")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureApprovalFeatures(auth.companyId);
  if (featureError) return featureError;

  const updated = await transitionVisitorApprovalRequest(auth.companyId, {
    approval_request_id: parsed.data.approvalRequestId,
    status: parsed.data.status,
    reviewed_by: auth.userId,
    decision_notes: parsed.data.decisionNotes || undefined,
  });

  await createAuditLog(auth.companyId, {
    action: "visitor.approval.decision",
    entity_type: "VisitorApprovalRequest",
    entity_id: updated.id,
    user_id: auth.userId,
    details: {
      status: updated.status,
      decision_notes: updated.decision_notes,
      site_id: updated.site_id,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/approvals");
  return { success: true, message: `Approval marked ${updated.status}` };
}

export async function createIdentityVerificationRecordAction(
  _prevState: ApprovalActionResult | null,
  formData: FormData,
): Promise<ApprovalActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = identityVerificationSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    approvalRequestId: formData.get("approvalRequestId")?.toString() ?? "",
    signInRecordId: formData.get("signInRecordId")?.toString() ?? "",
    method: formData.get("method")?.toString() ?? "MANUAL_ID",
    result: formData.get("result")?.toString() ?? "PASS",
    evidencePointer: formData.get("evidencePointer")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureApprovalFeatures(auth.companyId);
  if (featureError) return featureError;

  const record = await createIdentityVerificationRecord(auth.companyId, {
    site_id: parsed.data.siteId,
    visitor_approval_request_id: parsed.data.approvalRequestId || undefined,
    sign_in_record_id: parsed.data.signInRecordId || undefined,
    method: parsed.data.method,
    reviewer_user_id: auth.userId,
    evidence_pointer: parsed.data.evidencePointer || undefined,
    result: parsed.data.result,
    notes: parsed.data.notes || undefined,
  });

  await createAuditLog(auth.companyId, {
    action: "visitor.identity_verification.create",
    entity_type: "IdentityVerificationRecord",
    entity_id: record.id,
    user_id: auth.userId,
    details: {
      site_id: record.site_id,
      method: record.method,
      result: record.result,
      approval_request_id: record.visitor_approval_request_id,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/approvals");
  return { success: true, message: "Identity verification record saved" };
}
