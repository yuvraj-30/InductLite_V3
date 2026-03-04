import type { CompanyPlan, PlanChangeRequest, PlanChangeHistory } from "@prisma/client";
import { scopedDb } from "@/lib/db/scoped-db";
import {
  updateCompanyEntitlementSettings,
  updateSiteEntitlementOverrides,
  type FeatureCreditMap,
  type FeatureToggleMap,
} from "./plan-entitlement.repository";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface CreatePlanChangeRequestInput {
  requested_by?: string;
  target_plan: CompanyPlan;
  effective_at: Date;
  change_payload: Record<string, unknown>;
  rollback_payload?: Record<string, unknown>;
  status?: "DRAFT" | "SCHEDULED";
}

interface ParsedPlanChangePayload {
  targetPlan?: CompanyPlan;
  companyFeatureOverrides?: FeatureToggleMap;
  companyFeatureCreditOverrides?: FeatureCreditMap;
  siteOverrides?: Array<{
    siteId: string;
    featureOverrides?: FeatureToggleMap;
    featureCreditOverrides?: FeatureCreditMap;
  }>;
}

function parsePlanChangePayload(input: unknown): ParsedPlanChangePayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const value = input as Record<string, unknown>;
  const result: ParsedPlanChangePayload = {};
  if (
    value.targetPlan === "STANDARD" ||
    value.targetPlan === "PLUS" ||
    value.targetPlan === "PRO"
  ) {
    result.targetPlan = value.targetPlan;
  }
  if (
    value.companyFeatureOverrides &&
    typeof value.companyFeatureOverrides === "object" &&
    !Array.isArray(value.companyFeatureOverrides)
  ) {
    result.companyFeatureOverrides =
      value.companyFeatureOverrides as FeatureToggleMap;
  }
  if (
    value.companyFeatureCreditOverrides &&
    typeof value.companyFeatureCreditOverrides === "object" &&
    !Array.isArray(value.companyFeatureCreditOverrides)
  ) {
    result.companyFeatureCreditOverrides =
      value.companyFeatureCreditOverrides as FeatureCreditMap;
  }
  if (Array.isArray(value.siteOverrides)) {
    result.siteOverrides = value.siteOverrides
      .map((raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
        const row = raw as Record<string, unknown>;
        if (typeof row.siteId !== "string" || row.siteId.trim().length === 0) {
          return null;
        }
        return {
          siteId: row.siteId,
          featureOverrides:
            row.featureOverrides &&
            typeof row.featureOverrides === "object" &&
            !Array.isArray(row.featureOverrides)
              ? (row.featureOverrides as FeatureToggleMap)
              : undefined,
          featureCreditOverrides:
            row.featureCreditOverrides &&
            typeof row.featureCreditOverrides === "object" &&
            !Array.isArray(row.featureCreditOverrides)
              ? (row.featureCreditOverrides as FeatureCreditMap)
              : undefined,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  return result;
}

export async function createPlanChangeRequest(
  companyId: string,
  input: CreatePlanChangeRequestInput,
): Promise<PlanChangeRequest> {
  requireCompanyId(companyId);
  if (Number.isNaN(input.effective_at.getTime())) {
    throw new RepositoryError("effective_at is invalid", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.planChangeRequest.create({
      data: {
        requested_by: input.requested_by ?? null,
        target_plan: input.target_plan,
        effective_at: input.effective_at,
        status: input.status ?? "DRAFT",
        change_payload: input.change_payload,
        rollback_payload: input.rollback_payload ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PlanChangeRequest");
  }
}

export async function listPlanChangeRequests(
  companyId: string,
  status?: PlanChangeRequest["status"],
): Promise<PlanChangeRequest[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.planChangeRequest.findMany({
      where: {
        ...(status ? { status } : {}),
      },
      orderBy: [{ created_at: "desc" }],
      take: 200,
    });
  } catch (error) {
    handlePrismaError(error, "PlanChangeRequest");
  }
}

export async function createPlanChangeHistoryEntry(
  companyId: string,
  input: {
    plan_change_request_id: string;
    action: string;
    acted_by?: string;
    previous_state?: Record<string, unknown>;
    next_state?: Record<string, unknown>;
  },
): Promise<PlanChangeHistory> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.planChangeHistory.create({
      data: {
        plan_change_request_id: input.plan_change_request_id,
        action: input.action,
        acted_by: input.acted_by ?? null,
        previous_state: input.previous_state ?? null,
        next_state: input.next_state ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PlanChangeHistory");
  }
}

export async function schedulePlanChangeRequest(
  companyId: string,
  requestId: string,
): Promise<PlanChangeRequest> {
  requireCompanyId(companyId);
  if (!requestId.trim()) {
    throw new RepositoryError("requestId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const result = await db.planChangeRequest.updateMany({
      where: { id: requestId },
      data: { status: "SCHEDULED" },
    });
    if (result.count === 0) {
      throw new RepositoryError("Plan change request not found", "NOT_FOUND");
    }

    const updated = await db.planChangeRequest.findFirst({
      where: { id: requestId },
    });
    if (!updated) {
      throw new RepositoryError("Plan change request not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "PlanChangeRequest");
  }
}

export async function cancelPlanChangeRequest(
  companyId: string,
  requestId: string,
  actedBy?: string,
): Promise<PlanChangeRequest> {
  requireCompanyId(companyId);
  if (!requestId.trim()) {
    throw new RepositoryError("requestId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const result = await db.planChangeRequest.updateMany({
      where: { id: requestId },
      data: { status: "CANCELED" },
    });
    if (result.count === 0) {
      throw new RepositoryError("Plan change request not found", "NOT_FOUND");
    }

    const updated = await db.planChangeRequest.findFirst({
      where: { id: requestId },
    });
    if (!updated) {
      throw new RepositoryError("Plan change request not found", "NOT_FOUND");
    }

    await createPlanChangeHistoryEntry(companyId, {
      plan_change_request_id: requestId,
      action: "request.canceled",
      acted_by: actedBy,
      previous_state: { status: "SCHEDULED" },
      next_state: { status: "CANCELED" },
    });

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "PlanChangeRequest");
  }
}

export async function applyDuePlanChanges(
  companyId: string,
  options?: { now?: Date; acted_by?: string },
): Promise<{
  applied: number;
  failed: number;
  request_ids: string[];
}> {
  requireCompanyId(companyId);
  const now = options?.now ?? new Date();

  try {
    const db = scopedDb(companyId);
    const dueRequests = await db.planChangeRequest.findMany({
      where: {
        status: "SCHEDULED",
        effective_at: { lte: now },
      },
      orderBy: { effective_at: "asc" },
      take: 100,
    });

    let applied = 0;
    let failed = 0;
    const requestIds: string[] = [];

    for (const request of dueRequests) {
      requestIds.push(request.id);
      const parsed = parsePlanChangePayload(request.change_payload);

      try {
        await updateCompanyEntitlementSettings(companyId, {
          productPlan: parsed.targetPlan ?? request.target_plan,
          featureOverrides: parsed.companyFeatureOverrides,
          featureCreditOverrides: parsed.companyFeatureCreditOverrides,
        });

        if (parsed.siteOverrides?.length) {
          for (const siteOverride of parsed.siteOverrides) {
            await updateSiteEntitlementOverrides(companyId, siteOverride.siteId, {
              featureOverrides: siteOverride.featureOverrides,
              featureCreditOverrides: siteOverride.featureCreditOverrides,
            });
          }
        }

        await db.planChangeRequest.updateMany({
          where: { id: request.id },
          data: { status: "APPLIED" },
        });
        await createPlanChangeHistoryEntry(companyId, {
          plan_change_request_id: request.id,
          action: "request.applied",
          acted_by: options?.acted_by,
          previous_state: { status: "SCHEDULED" },
          next_state: {
            status: "APPLIED",
            target_plan: parsed.targetPlan ?? request.target_plan,
          },
        });
        applied += 1;
      } catch (error) {
        await db.planChangeRequest.updateMany({
          where: { id: request.id },
          data: { status: "FAILED" },
        });
        await createPlanChangeHistoryEntry(companyId, {
          plan_change_request_id: request.id,
          action: "request.failed",
          acted_by: options?.acted_by,
          previous_state: { status: "SCHEDULED" },
          next_state: {
            status: "FAILED",
            error:
              error instanceof Error
                ? error.message
                : "Unknown plan-change application error",
          },
        });
        failed += 1;
      }
    }

    return {
      applied,
      failed,
      request_ids: requestIds,
    };
  } catch (error) {
    handlePrismaError(error, "PlanChangeRequest");
  }
}

export async function listPlanChangeHistory(
  companyId: string,
  requestId: string,
): Promise<PlanChangeHistory[]> {
  requireCompanyId(companyId);
  if (!requestId.trim()) return [];

  try {
    const db = scopedDb(companyId);
    return await db.planChangeHistory.findMany({
      where: { plan_change_request_id: requestId },
      orderBy: [{ acted_at: "desc" }],
      take: 200,
    });
  } catch (error) {
    handlePrismaError(error, "PlanChangeHistory");
  }
}
