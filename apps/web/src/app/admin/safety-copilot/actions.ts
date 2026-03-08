"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { createCommunicationEvent, countCommunicationEventsSince } from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { generateSafetyCopilotResponse } from "@/lib/differentiation/safety-copilot";

export type SafetyCopilotActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const runSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  prompt: z.string().min(8).max(5000),
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
  return { success: true, message: "Safety copilot run completed" };
}
