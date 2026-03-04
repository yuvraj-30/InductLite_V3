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
  countRiskScoreHistorySince,
  refreshAllContractorRiskScores,
  refreshContractorRiskScore,
} from "@/lib/repository/risk-passport.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

const refreshAllSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
});

const refreshSingleSchema = z.object({
  contractorId: z.string().cuid(),
  siteId: z.string().cuid().optional().or(z.literal("")),
});

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function readMaxRiskRecalcPerDay(): number {
  const raw = Number(process.env.MAX_RISK_SCORE_RECALC_JOBS_PER_DAY ?? 300);
  if (!Number.isFinite(raw)) return 300;
  return Math.max(1, Math.trunc(raw));
}

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/admin/risk-passport?${params.toString()}`);
}

async function authorizeRiskMutation() {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    statusRedirect("error", permission.error);
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    statusRedirect("error", "Too many admin updates right now. Please retry in a minute.");
  }

  if (!isFeatureEnabled("RISK_PASSPORT_V1")) {
    statusRedirect("error", "Risk passport is disabled (CONTROL_ID: FLAG-ROLLOUT-001)");
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "RISK_PASSPORT_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      statusRedirect(
        "error",
        "Risk passport is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      );
    }
    throw error;
  }

  return context;
}

async function getDailyRemainingRecalcs(companyId: string): Promise<{ used: number; remaining: number; max: number }> {
  const max = readMaxRiskRecalcPerDay();
  const used = await countRiskScoreHistorySince(companyId, startOfUtcDay(new Date()));
  const remaining = Math.max(0, max - used);
  return { used, remaining, max };
}

export async function refreshAllRiskScoresAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeRiskMutation();
  const parsed = refreshAllSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid refresh input");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/risk-passport",
    method: "POST",
  });

  try {
    const quota = await getDailyRemainingRecalcs(context.companyId);
    if (quota.remaining <= 0) {
      statusRedirect(
        "error",
        `Daily risk recalculation limit reached (${quota.max}/day, CONTROL_ID: RISK-001)`,
      );
    }

    const refreshed = await refreshAllContractorRiskScores(
      context.companyId,
      parsed.data.siteId || undefined,
      quota.remaining,
    );

    await createAuditLog(context.companyId, {
      action: "risk.passport.refresh_all",
      entity_type: "ContractorRiskScore",
      user_id: context.userId,
      details: {
        site_id: parsed.data.siteId || null,
        refreshed_count: refreshed.length,
        daily_limit: quota.max,
        used_before: quota.used,
      },
      request_id: requestId,
    });

    statusRedirect("ok", `Refreshed ${refreshed.length} contractor risk scores`);
  } catch (error) {
    log.error({ error: String(error) }, "Failed to refresh all risk scores");
    statusRedirect("error", "Failed to refresh contractor risk scores");
  }
}

export async function refreshSingleRiskScoreAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeRiskMutation();
  const parsed = refreshSingleSchema.safeParse({
    contractorId: formData.get("contractorId")?.toString() ?? "",
    siteId: formData.get("siteId")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid contractor refresh input");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/risk-passport",
    method: "POST",
  });

  try {
    const quota = await getDailyRemainingRecalcs(context.companyId);
    if (quota.remaining <= 0) {
      statusRedirect(
        "error",
        `Daily risk recalculation limit reached (${quota.max}/day, CONTROL_ID: RISK-001)`,
      );
    }

    const refreshed = await refreshContractorRiskScore(context.companyId, {
      contractor_id: parsed.data.contractorId,
      site_id: parsed.data.siteId || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "risk.passport.refresh",
      entity_type: "ContractorRiskScore",
      entity_id: refreshed.id,
      user_id: context.userId,
      details: {
        contractor_id: refreshed.contractor_id,
        site_id: refreshed.site_id,
        current_score: refreshed.current_score,
        threshold_state: refreshed.threshold_state,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Contractor risk score refreshed");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to refresh contractor risk score");
    statusRedirect("error", "Failed to refresh contractor risk score");
  }
}
