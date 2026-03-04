"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createRequestLogger } from "@/lib/logger";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  applyDuePlanChanges,
  cancelPlanChangeRequest,
  createPlanChangeHistoryEntry,
  createPlanChangeRequest,
  schedulePlanChangeRequest,
} from "@/lib/repository/plan-change.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

const createChangeSchema = z.object({
  targetPlan: z.enum(["STANDARD", "PLUS", "PRO"]),
  effectiveAt: z.string().min(1),
  companyFeatureOverridesJson: z.string().optional().or(z.literal("")),
  companyFeatureCreditOverridesJson: z.string().optional().or(z.literal("")),
  siteOverridesJson: z.string().optional().or(z.literal("")),
  rollbackPayloadJson: z.string().optional().or(z.literal("")),
});

const requestIdSchema = z.object({
  requestId: z.string().cuid(),
});

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/admin/plan-configurator?${params.toString()}`);
}

function parseOptionalObjectJson(value: string | undefined): Record<string, unknown> | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

function parseOptionalArrayJson(value: string | undefined): unknown[] | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array");
  }
  return parsed;
}

async function authorizePlanMutation() {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const permission = await checkPermission("settings:manage");
  if (!permission.success) {
    statusRedirect("error", permission.error);
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    statusRedirect("error", "Too many admin updates right now. Please retry in a minute.");
  }

  if (!isFeatureEnabled("SELF_SERVE_CONFIG_V1")) {
    statusRedirect("error", "Plan configurator is disabled (CONTROL_ID: FLAG-ROLLOUT-001)");
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "SELF_SERVE_CONFIG_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      statusRedirect(
        "error",
        "Plan configurator is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      );
    }
    throw error;
  }

  return context;
}

export async function createScheduledPlanChangeAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizePlanMutation();
  const parsed = createChangeSchema.safeParse({
    targetPlan: formData.get("targetPlan")?.toString() ?? "STANDARD",
    effectiveAt: formData.get("effectiveAt")?.toString() ?? "",
    companyFeatureOverridesJson:
      formData.get("companyFeatureOverridesJson")?.toString() ?? "",
    companyFeatureCreditOverridesJson:
      formData.get("companyFeatureCreditOverridesJson")?.toString() ?? "",
    siteOverridesJson: formData.get("siteOverridesJson")?.toString() ?? "",
    rollbackPayloadJson: formData.get("rollbackPayloadJson")?.toString() ?? "",
  });

  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid plan change request");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/plan-configurator",
    method: "POST",
  });

  try {
    const effectiveAt = new Date(parsed.data.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) {
      statusRedirect("error", "effectiveAt must be a valid date/time");
    }

    const companyFeatureOverrides = parseOptionalObjectJson(
      parsed.data.companyFeatureOverridesJson ?? "",
    );
    const companyFeatureCreditOverrides = parseOptionalObjectJson(
      parsed.data.companyFeatureCreditOverridesJson ?? "",
    );
    const siteOverrides = parseOptionalArrayJson(parsed.data.siteOverridesJson ?? "");
    const rollbackPayload = parseOptionalObjectJson(parsed.data.rollbackPayloadJson ?? "");

    const changePayload: Record<string, unknown> = {
      targetPlan: parsed.data.targetPlan,
      ...(companyFeatureOverrides ? { companyFeatureOverrides } : {}),
      ...(companyFeatureCreditOverrides ? { companyFeatureCreditOverrides } : {}),
      ...(siteOverrides ? { siteOverrides } : {}),
    };

    const created = await createPlanChangeRequest(context.companyId, {
      requested_by: context.userId,
      target_plan: parsed.data.targetPlan,
      effective_at: effectiveAt,
      change_payload: changePayload,
      rollback_payload: rollbackPayload,
      status: "DRAFT",
    });

    await createPlanChangeHistoryEntry(context.companyId, {
      plan_change_request_id: created.id,
      action: "request.created",
      acted_by: context.userId,
      previous_state: {},
      next_state: {
        status: "DRAFT",
        target_plan: parsed.data.targetPlan,
        effective_at: effectiveAt.toISOString(),
      },
    });

    const scheduled = await schedulePlanChangeRequest(context.companyId, created.id);
    await createPlanChangeHistoryEntry(context.companyId, {
      plan_change_request_id: scheduled.id,
      action: "request.scheduled",
      acted_by: context.userId,
      previous_state: { status: "DRAFT" },
      next_state: {
        status: "SCHEDULED",
        effective_at: scheduled.effective_at.toISOString(),
      },
    });

    await createAuditLog(context.companyId, {
      action: "plan.change.request.create",
      entity_type: "PlanChangeRequest",
      entity_id: scheduled.id,
      user_id: context.userId,
      details: {
        target_plan: scheduled.target_plan,
        effective_at: scheduled.effective_at.toISOString(),
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Plan change scheduled");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to schedule plan change");
    statusRedirect("error", "Failed to schedule plan change request");
  }
}

export async function cancelScheduledPlanChangeAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizePlanMutation();
  const parsed = requestIdSchema.safeParse({
    requestId: formData.get("requestId")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid request ID");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/plan-configurator",
    method: "POST",
  });

  try {
    const canceled = await cancelPlanChangeRequest(
      context.companyId,
      parsed.data.requestId,
      context.userId,
    );

    await createAuditLog(context.companyId, {
      action: "plan.change.request.cancel",
      entity_type: "PlanChangeRequest",
      entity_id: canceled.id,
      user_id: context.userId,
      details: {
        status: canceled.status,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Plan change request canceled");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to cancel plan change request");
    statusRedirect("error", "Failed to cancel plan change request");
  }
}

export async function applyDuePlanChangesNowAction(): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizePlanMutation();
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/plan-configurator",
    method: "POST",
  });

  try {
    const result = await applyDuePlanChanges(context.companyId, {
      acted_by: context.userId,
      now: new Date(),
    });

    await createAuditLog(context.companyId, {
      action: "plan.change.apply.run",
      entity_type: "PlanChangeRequest",
      user_id: context.userId,
      details: {
        applied: result.applied,
        failed: result.failed,
        request_ids: result.request_ids,
      },
      request_id: requestId,
    });

    statusRedirect("ok", `Plan apply run complete (applied ${result.applied}, failed ${result.failed})`);
  } catch (error) {
    log.error({ error: String(error) }, "Failed to apply due plan changes");
    statusRedirect("error", "Failed to apply due plan changes");
  }
}
