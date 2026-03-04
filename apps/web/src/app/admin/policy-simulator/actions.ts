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
  countPolicySimulationRunsSince,
  createPolicySimulation,
  createPolicySimulationResult,
  createPolicySimulationRun,
  estimatePolicySimulationImpact,
  findPolicySimulationById,
  updatePolicySimulationRunStatus,
} from "@/lib/repository/policy-simulator.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

const createSimulationSchema = z.object({
  name: z.string().min(2).max(120),
  lookbackDays: z.coerce.number().int().min(1).max(365).default(30),
  randomCheckPercentage: z.coerce.number().int().min(0).max(100).default(10),
  stricterQuizThresholdDelta: z.coerce.number().int().min(0).max(50).default(5),
  permitRequired: z.boolean().optional(),
});

const runSimulationSchema = z.object({
  simulationId: z.string().cuid(),
});

interface ParsedScenarioConfig {
  lookbackDays: number;
  randomCheckPercentage: number;
  stricterQuizThresholdDelta: number;
  permitRequired: boolean;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function readMaxPolicyRunsPerDay(): number {
  const raw = Number(process.env.MAX_POLICY_SIM_RUNS_PER_COMPANY_PER_DAY ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.max(1, Math.trunc(raw));
}

function parseScenarioConfig(value: unknown): ParsedScenarioConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      lookbackDays: 30,
      randomCheckPercentage: 10,
      stricterQuizThresholdDelta: 5,
      permitRequired: false,
    };
  }

  const row = value as Record<string, unknown>;
  const lookbackDays = Math.max(
    1,
    Math.min(365, Math.trunc(Number(row.lookbackDays ?? 30) || 30)),
  );
  const randomCheckPercentage = Math.max(
    0,
    Math.min(100, Math.trunc(Number(row.randomCheckPercentage ?? 10) || 10)),
  );
  const stricterQuizThresholdDelta = Math.max(
    0,
    Math.min(50, Math.trunc(Number(row.stricterQuizThresholdDelta ?? 5) || 5)),
  );

  return {
    lookbackDays,
    randomCheckPercentage,
    stricterQuizThresholdDelta,
    permitRequired: row.permitRequired === true,
  };
}

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/admin/policy-simulator?${params.toString()}`);
}

async function authorizePolicyMutation() {
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

  if (!isFeatureEnabled("POLICY_SIMULATOR_V1")) {
    statusRedirect("error", "Policy simulator is disabled (CONTROL_ID: FLAG-ROLLOUT-001)");
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      statusRedirect(
        "error",
        "Policy simulator is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      );
    }
    throw error;
  }

  return context;
}

export async function createPolicySimulationAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizePolicyMutation();

  const parsed = createSimulationSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    lookbackDays: formData.get("lookbackDays")?.toString() ?? "30",
    randomCheckPercentage: formData.get("randomCheckPercentage")?.toString() ?? "10",
    stricterQuizThresholdDelta:
      formData.get("stricterQuizThresholdDelta")?.toString() ?? "5",
    permitRequired: formData.get("permitRequired") === "on",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid simulation input");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/policy-simulator",
    method: "POST",
  });

  try {
    const simulation = await createPolicySimulation(context.companyId, {
      name: parsed.data.name,
      created_by: context.userId,
      scenario: {
        lookbackDays: parsed.data.lookbackDays,
        randomCheckPercentage: parsed.data.randomCheckPercentage,
        stricterQuizThresholdDelta: parsed.data.stricterQuizThresholdDelta,
        permitRequired: parsed.data.permitRequired === true,
      },
    });

    await createAuditLog(context.companyId, {
      action: "policy.simulation.create",
      entity_type: "PolicySimulation",
      entity_id: simulation.id,
      user_id: context.userId,
      details: {
        lookbackDays: parsed.data.lookbackDays,
        randomCheckPercentage: parsed.data.randomCheckPercentage,
        stricterQuizThresholdDelta: parsed.data.stricterQuizThresholdDelta,
        permitRequired: parsed.data.permitRequired === true,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Policy simulation scenario created");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create policy simulation");
    statusRedirect("error", "Failed to create policy simulation");
  }
}

export async function runPolicySimulationAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizePolicyMutation();

  const parsed = runSimulationSchema.safeParse({
    simulationId: formData.get("simulationId")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid simulation request");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/policy-simulator",
    method: "POST",
  });

  let runId: string | null = null;
  try {
    const maxRunsPerDay = readMaxPolicyRunsPerDay();
    const todaysRunCount = await countPolicySimulationRunsSince(
      context.companyId,
      startOfUtcDay(new Date()),
    );
    if (todaysRunCount >= maxRunsPerDay) {
      statusRedirect(
        "error",
        `Daily policy simulation limit reached (${maxRunsPerDay}/day, CONTROL_ID: SIM-001)`,
      );
    }

    const simulation = await findPolicySimulationById(
      context.companyId,
      parsed.data.simulationId,
    );
    if (!simulation) {
      statusRedirect("error", "Simulation not found");
    }

    const run = await createPolicySimulationRun(context.companyId, {
      policy_simulation_id: simulation.id,
      requested_by: context.userId,
      snapshot_generated_at: new Date(),
    });
    runId = run.id;

    await updatePolicySimulationRunStatus(context.companyId, run.id, {
      status: "RUNNING",
      started_at: new Date(),
    });

    const scenario = parseScenarioConfig(simulation.scenario);
    const estimate = await estimatePolicySimulationImpact(context.companyId, {
      lookback_days: scenario.lookbackDays,
      random_check_percentage: scenario.randomCheckPercentage,
      stricter_quiz_threshold_delta: scenario.stricterQuizThresholdDelta,
      permit_required: scenario.permitRequired,
    });

    await createPolicySimulationResult(context.companyId, {
      policy_simulation_run_id: run.id,
      summary: {
        scenario,
        generated_at: new Date().toISOString(),
      },
      breakdown: {
        blocked_entries_estimate: estimate.blocked_entries_estimate,
        approval_load_estimate: estimate.approval_load_estimate,
        false_positive_estimate: estimate.false_positive_estimate,
        sample_signins: estimate.sample_signins,
        sample_escalations: estimate.sample_escalations,
      },
      blocked_entries_estimate: estimate.blocked_entries_estimate,
      approval_load_estimate: estimate.approval_load_estimate,
      false_positive_estimate: estimate.false_positive_estimate,
    });

    await updatePolicySimulationRunStatus(context.companyId, run.id, {
      status: "SUCCEEDED",
      completed_at: new Date(),
    });

    await createAuditLog(context.companyId, {
      action: "policy.simulation.run",
      entity_type: "PolicySimulationRun",
      entity_id: run.id,
      user_id: context.userId,
      details: {
        policy_simulation_id: simulation.id,
        blocked_entries_estimate: estimate.blocked_entries_estimate,
        approval_load_estimate: estimate.approval_load_estimate,
        false_positive_estimate: estimate.false_positive_estimate,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Policy simulation run completed");
  } catch (error) {
    if (runId) {
      await updatePolicySimulationRunStatus(context.companyId, runId, {
        status: "FAILED",
        completed_at: new Date(),
        error_message: error instanceof Error ? error.message : "Simulation run failed",
      }).catch(() => undefined);
    }

    log.error({ error: String(error) }, "Failed to run policy simulation");
    statusRedirect("error", "Failed to run policy simulation");
  }
}
