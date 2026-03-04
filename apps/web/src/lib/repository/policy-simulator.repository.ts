import { scopedDb } from "@/lib/db/scoped-db";
import type {
  PolicySimulation,
  PolicySimulationResult,
  PolicySimulationRun,
  PolicySimulationStatus,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface CreatePolicySimulationInput {
  name: string;
  scenario: Record<string, unknown>;
  created_by?: string;
}

export interface RunPolicySimulationInput {
  policy_simulation_id: string;
  requested_by?: string;
  snapshot_generated_at?: Date;
}

export interface PolicySimulationEstimate {
  blocked_entries_estimate: number;
  approval_load_estimate: number;
  false_positive_estimate: number;
  sample_signins: number;
  sample_escalations: number;
}

function clampNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export async function createPolicySimulation(
  companyId: string,
  input: CreatePolicySimulationInput,
): Promise<PolicySimulation> {
  requireCompanyId(companyId);
  if (!input.name.trim()) {
    throw new RepositoryError("Simulation name is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.policySimulation.create({
      data: {
        name: input.name.trim(),
        scenario: input.scenario,
        created_by: input.created_by ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PolicySimulation");
  }
}

export async function listPolicySimulations(
  companyId: string,
): Promise<PolicySimulation[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.policySimulation.findMany({
      orderBy: [{ created_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "PolicySimulation");
  }
}

export async function findPolicySimulationById(
  companyId: string,
  simulationId: string,
): Promise<PolicySimulation | null> {
  requireCompanyId(companyId);
  if (!simulationId.trim()) return null;

  try {
    const db = scopedDb(companyId);
    return await db.policySimulation.findFirst({
      where: { id: simulationId },
    });
  } catch (error) {
    handlePrismaError(error, "PolicySimulation");
  }
}

export async function createPolicySimulationRun(
  companyId: string,
  input: RunPolicySimulationInput,
): Promise<PolicySimulationRun> {
  requireCompanyId(companyId);
  if (!input.policy_simulation_id.trim()) {
    throw new RepositoryError("policy_simulation_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.policySimulationRun.create({
      data: {
        policy_simulation_id: input.policy_simulation_id,
        status: "QUEUED",
        snapshot_generated_at: input.snapshot_generated_at ?? new Date(),
        requested_by: input.requested_by ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PolicySimulationRun");
  }
}

export async function updatePolicySimulationRunStatus(
  companyId: string,
  runId: string,
  input: {
    status: PolicySimulationStatus;
    error_message?: string;
    started_at?: Date;
    completed_at?: Date;
  },
): Promise<PolicySimulationRun> {
  requireCompanyId(companyId);
  if (!runId.trim()) {
    throw new RepositoryError("runId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const result = await db.policySimulationRun.updateMany({
      where: { id: runId },
      data: {
        status: input.status,
        error_message: input.error_message?.trim() || null,
        started_at: input.started_at ?? undefined,
        completed_at: input.completed_at ?? undefined,
      },
    });
    if (result.count === 0) {
      throw new RepositoryError("Simulation run not found", "NOT_FOUND");
    }

    const run = await db.policySimulationRun.findFirst({
      where: { id: runId },
    });
    if (!run) {
      throw new RepositoryError("Simulation run not found", "NOT_FOUND");
    }
    return run;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "PolicySimulationRun");
  }
}

export async function createPolicySimulationResult(
  companyId: string,
  input: {
    policy_simulation_run_id: string;
    summary: Record<string, unknown>;
    breakdown: Record<string, unknown>;
    blocked_entries_estimate: number;
    approval_load_estimate: number;
    false_positive_estimate: number;
  },
): Promise<PolicySimulationResult> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const existing = await db.policySimulationResult.findFirst({
      where: { policy_simulation_run_id: input.policy_simulation_run_id },
    });

    if (existing) {
      await db.policySimulationResult.updateMany({
        where: { id: existing.id },
        data: {
          summary: input.summary,
          breakdown: input.breakdown,
          blocked_entries_estimate: clampNonNegativeInt(
            input.blocked_entries_estimate,
          ),
          approval_load_estimate: clampNonNegativeInt(
            input.approval_load_estimate,
          ),
          false_positive_estimate: clampNonNegativeInt(
            input.false_positive_estimate,
          ),
        },
      });
      const updated = await db.policySimulationResult.findFirst({
        where: { id: existing.id },
      });
      if (!updated) {
        throw new RepositoryError("Simulation result not found", "NOT_FOUND");
      }
      return updated;
    }

    return await db.policySimulationResult.create({
      data: {
        policy_simulation_run_id: input.policy_simulation_run_id,
        summary: input.summary,
        breakdown: input.breakdown,
        blocked_entries_estimate: clampNonNegativeInt(
          input.blocked_entries_estimate,
        ),
        approval_load_estimate: clampNonNegativeInt(input.approval_load_estimate),
        false_positive_estimate: clampNonNegativeInt(
          input.false_positive_estimate,
        ),
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "PolicySimulationResult");
  }
}

export async function listPolicySimulationRuns(
  companyId: string,
  options?: { policy_simulation_id?: string; limit?: number },
): Promise<PolicySimulationRun[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 500));

  try {
    const db = scopedDb(companyId);
    return await db.policySimulationRun.findMany({
      where: {
        ...(options?.policy_simulation_id
          ? { policy_simulation_id: options.policy_simulation_id }
          : {}),
      },
      orderBy: [{ created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "PolicySimulationRun");
  }
}

export async function findPolicySimulationResultByRunId(
  companyId: string,
  runId: string,
): Promise<PolicySimulationResult | null> {
  requireCompanyId(companyId);
  if (!runId.trim()) return null;

  try {
    const db = scopedDb(companyId);
    return await db.policySimulationResult.findFirst({
      where: { policy_simulation_run_id: runId },
    });
  } catch (error) {
    handlePrismaError(error, "PolicySimulationResult");
  }
}

export async function estimatePolicySimulationImpact(
  companyId: string,
  input: {
    lookback_days?: number;
    random_check_percentage?: number;
    stricter_quiz_threshold_delta?: number;
    permit_required?: boolean;
  },
): Promise<PolicySimulationEstimate> {
  requireCompanyId(companyId);
  const lookbackDays = Math.max(1, Math.min(input.lookback_days ?? 30, 365));
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const randomCheckPercentage = Math.max(
    0,
    Math.min(100, Math.trunc(input.random_check_percentage ?? 0)),
  );
  const stricterQuizThresholdDelta = Math.max(
    0,
    Math.min(50, Math.trunc(input.stricter_quiz_threshold_delta ?? 0)),
  );
  const permitRequired = input.permit_required === true;

  try {
    const db = scopedDb(companyId);
    const [signInCount, escalationCount, failedQuizAttempts] = await Promise.all([
      db.signInRecord.count({
        where: { sign_in_ts: { gte: since } },
      }),
      db.pendingSignInEscalation.count({
        where: { submitted_at: { gte: since } },
      }),
      db.inductionQuizAttempt.count({
        where: {
          last_attempt_at: { gte: since },
          last_passed: false,
        },
      }),
    ]);

    const randomCheckLoad = Math.round((signInCount * randomCheckPercentage) / 100);
    const stricterQuizImpact = Math.round(
      failedQuizAttempts * (stricterQuizThresholdDelta / 25),
    );
    const permitImpact = permitRequired ? Math.round(signInCount * 0.08) : 0;

    const blockedEntriesEstimate = Math.min(
      signInCount,
      escalationCount + stricterQuizImpact + permitImpact,
    );
    const approvalLoadEstimate = escalationCount + randomCheckLoad + permitImpact;
    const falsePositiveEstimate = Math.round(approvalLoadEstimate * 0.12);

    return {
      blocked_entries_estimate: clampNonNegativeInt(blockedEntriesEstimate),
      approval_load_estimate: clampNonNegativeInt(approvalLoadEstimate),
      false_positive_estimate: clampNonNegativeInt(falsePositiveEstimate),
      sample_signins: signInCount,
      sample_escalations: escalationCount,
    };
  } catch (error) {
    handlePrismaError(error, "PolicySimulationRun");
  }
}

export async function countPolicySimulationRunsSince(
  companyId: string,
  since: Date,
): Promise<number> {
  requireCompanyId(companyId);
  if (Number.isNaN(since.getTime())) return 0;

  try {
    const db = scopedDb(companyId);
    return await db.policySimulationRun.count({
      where: { created_at: { gte: since } },
    });
  } catch (error) {
    handlePrismaError(error, "PolicySimulationRun");
  }
}
