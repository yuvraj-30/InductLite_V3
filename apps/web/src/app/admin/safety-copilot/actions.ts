"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  createCommunicationEvent,
  countCommunicationEventsSince,
  findCommunicationEventById,
} from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { generateSafetyCopilotResponse } from "@/lib/differentiation/safety-copilot";

export type SafetyCopilotActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const runSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  prompt: z.string().min(8).max(5000),
});

const decisionSchema = z.object({
  runEventId: z.string().cuid(),
  recommendationIndex: z.coerce.number().int().min(0).max(20),
  decision: z.enum(["ACCEPTED", "REJECTED", "EDITED"]),
  reasonCode: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => value ?? ""),
  noteLength: z.coerce.number().int().min(0).max(8000).optional(),
});

function readMaxDailyRuns(): number {
  const raw = Number(process.env.MAX_POLICY_SIM_RUNS_PER_COMPANY_PER_DAY ?? 25);
  if (!Number.isFinite(raw)) return 25;
  return Math.max(1, Math.trunc(raw));
}

export async function runSafetyCopilotAction(
  _prevState: SafetyCopilotActionResult | null,
  formData: FormData,
): Promise<SafetyCopilotActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rateLimit = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rateLimit.success) {
    return {
      success: false,
      error: "Too many admin updates right now. Please retry in a minute.",
    };
  }

  if (!isFeatureEnabled("POLICY_SIMULATOR_V1")) {
    return {
      success: false,
      error: "Safety copilot is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
    };
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error: "Safety copilot is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }

  const parsed = runSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    prompt: formData.get("prompt")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid prompt" };
  }

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const usedToday = await countCommunicationEventsSince(context.companyId, {
    since,
    event_type: "ai.copilot.run",
  });
  const maxDailyRuns = readMaxDailyRuns();
  if (usedToday >= maxDailyRuns) {
    return {
      success: false,
      error: `Daily safety copilot quota reached (${maxDailyRuns}) (CONTROL_ID: QUOTA-COPILOT-001)`,
    };
  }

  const response = await generateSafetyCopilotResponse({
    companyId: context.companyId,
    siteId: parsed.data.siteId || undefined,
    prompt: parsed.data.prompt,
  });

  await createCommunicationEvent(context.companyId, {
    site_id: parsed.data.siteId || undefined,
    direction: "SYSTEM",
    event_type: "ai.copilot.run",
    status: "COMPLETED",
    payload: {
      prompt: parsed.data.prompt,
      summary: response.summary,
      recommendations: response.recommendations,
      signals: response.signals,
      model: "rules-v1",
    },
  });

  await createAuditLog(context.companyId, {
    action: "ai.copilot.run",
    entity_type: "Company",
    entity_id: context.companyId,
    user_id: context.userId,
    details: {
      site_id: parsed.data.siteId || null,
      prompt_length: parsed.data.prompt.length,
      recommendations: response.recommendations.length,
      model: "rules-v1",
    },
  });

  revalidatePath("/admin/safety-copilot");
  revalidatePath("/admin/benchmarks");
  return { success: true, message: "Safety copilot run completed" };
}

export async function recordSafetyCopilotDecisionAction(
  _prevState: SafetyCopilotActionResult | null,
  formData: FormData,
): Promise<SafetyCopilotActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rateLimit = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rateLimit.success) {
    return {
      success: false,
      error: "Too many admin updates right now. Please retry in a minute.",
    };
  }

  if (!isFeatureEnabled("POLICY_SIMULATOR_V1")) {
    return {
      success: false,
      error: "Safety copilot is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
    };
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error: "Safety copilot is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }

  const parsed = decisionSchema.safeParse({
    runEventId: formData.get("runEventId")?.toString() ?? "",
    recommendationIndex: formData.get("recommendationIndex")?.toString() ?? "",
    decision: formData.get("decision")?.toString() ?? "",
    reasonCode: formData.get("reasonCode")?.toString() ?? "",
    noteLength: formData.get("noteLength")?.toString() ?? "0",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid decision input" };
  }

  const runEvent = await findCommunicationEventById(context.companyId, parsed.data.runEventId);
  if (!runEvent || runEvent.event_type !== "ai.copilot.run") {
    return { success: false, error: "Copilot run not found" };
  }

  const payload =
    runEvent.payload && typeof runEvent.payload === "object" && !Array.isArray(runEvent.payload)
      ? (runEvent.payload as Record<string, unknown>)
      : {};
  const recommendations = Array.isArray(payload.recommendations)
    ? payload.recommendations
    : [];
  const recommendation =
    parsed.data.recommendationIndex < recommendations.length
      ? recommendations[parsed.data.recommendationIndex]
      : null;
  const row =
    recommendation && typeof recommendation === "object" && !Array.isArray(recommendation)
      ? (recommendation as Record<string, unknown>)
      : {};
  const sourceSignals = Array.isArray(row.sourceSignals)
    ? row.sourceSignals
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return "";
          const key = (item as Record<string, unknown>).key;
          return typeof key === "string" ? key : "";
        })
        .filter((key) => key.length > 0)
        .slice(0, 8)
    : [];
  const confidenceBand =
    typeof row.confidenceBand === "string" ? row.confidenceBand : "unknown";

  await createCommunicationEvent(context.companyId, {
    site_id: runEvent.site_id ?? undefined,
    direction: "SYSTEM",
    event_type: "ai.copilot.decision",
    status: parsed.data.decision,
    payload: {
      run_event_id: runEvent.id,
      recommendation_index: parsed.data.recommendationIndex,
      recommendation_title:
        typeof row.title === "string" ? row.title.slice(0, 180) : "Recommendation",
      recommendation_severity:
        typeof row.severity === "string" ? row.severity : "unknown",
      confidence_band: confidenceBand,
      source_signal_keys: sourceSignals,
      reason_code: parsed.data.reasonCode.slice(0, 64) || "unspecified",
      note_length: parsed.data.noteLength ?? 0,
    },
  });

  await createAuditLog(context.companyId, {
    action: "ai.copilot.decision",
    entity_type: "CommunicationEvent",
    entity_id: runEvent.id,
    user_id: context.userId,
    details: {
      decision: parsed.data.decision,
      recommendation_index: parsed.data.recommendationIndex,
      confidence_band: confidenceBand,
      source_signal_keys: sourceSignals,
      reason_code: parsed.data.reasonCode.slice(0, 64) || "unspecified",
      note_length: parsed.data.noteLength ?? 0,
    },
  });

  revalidatePath("/admin/safety-copilot");
  revalidatePath("/admin/benchmarks");

  return { success: true, message: "Decision recorded" };
}
