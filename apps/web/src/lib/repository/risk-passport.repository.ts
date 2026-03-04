import { scopedDb } from "@/lib/db/scoped-db";
import type { ContractorRiskScore, RiskScoreHistory } from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface ContractorRiskComputation {
  contractor_id: string;
  site_id?: string;
  score: number;
  components: {
    expired_documents: number;
    expiring_documents_30d: number;
    permit_breaches: number;
    prequalification_penalty: number;
  };
  threshold_state: "LOW" | "MEDIUM" | "HIGH";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

function computeThreshold(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score < 40) return "HIGH";
  if (score < 70) return "MEDIUM";
  return "LOW";
}

export async function computeContractorRiskScore(
  companyId: string,
  input: { contractor_id: string; site_id?: string },
): Promise<ContractorRiskComputation> {
  requireCompanyId(companyId);
  if (!input.contractor_id.trim()) {
    throw new RepositoryError("contractor_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [expiredDocuments, expiringDocuments, permitBreaches, latestPrequal] =
      await Promise.all([
        db.contractorDocument.count({
          where: {
            contractor_id: input.contractor_id,
            expires_at: { lt: now },
          },
        }),
        db.contractorDocument.count({
          where: {
            contractor_id: input.contractor_id,
            expires_at: { gte: now, lte: in30Days },
          },
        }),
        db.permitRequest.count({
          where: {
            contractor_id: input.contractor_id,
            ...(input.site_id ? { site_id: input.site_id } : {}),
            status: { in: ["SUSPENDED", "DENIED"] },
          },
        }),
        // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
        db.contractorPrequalification.findFirst({
          where: {
            contractor_id: input.contractor_id,
            ...(input.site_id ? { site_id: input.site_id } : {}),
          },
          orderBy: { updated_at: "desc" },
        }),
      ]);

    const prequalificationPenalty =
      latestPrequal?.status === "DENIED"
        ? 25
        : latestPrequal?.status === "EXPIRED"
          ? 15
          : latestPrequal?.status === "PENDING"
            ? 8
            : 0;

    const deductions =
      expiredDocuments * 14 +
      expiringDocuments * 4 +
      permitBreaches * 10 +
      prequalificationPenalty;
    const rawScore = 100 - deductions;
    const score = clampScore(rawScore);

    return {
      contractor_id: input.contractor_id,
      site_id: input.site_id,
      score,
      components: {
        expired_documents: expiredDocuments,
        expiring_documents_30d: expiringDocuments,
        permit_breaches: permitBreaches,
        prequalification_penalty: prequalificationPenalty,
      },
      threshold_state: computeThreshold(score),
    };
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ContractorRiskScore");
  }
}

export async function upsertContractorRiskScore(
  companyId: string,
  computation: ContractorRiskComputation,
): Promise<ContractorRiskScore> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const existing = await db.contractorRiskScore.findFirst({
      where: {
        contractor_id: computation.contractor_id,
        site_id: computation.site_id ?? null,
      },
    });

    if (!existing) {
      const created = await db.contractorRiskScore.create({
        data: {
          contractor_id: computation.contractor_id,
          site_id: computation.site_id ?? null,
          current_score: computation.score,
          components: computation.components as unknown as object,
          threshold_state: computation.threshold_state,
          last_calculated_at: new Date(),
        },
      });
      await db.riskScoreHistory.create({
        data: {
          contractor_risk_score_id: created.id,
          score: computation.score,
          components: computation.components as unknown as object,
          calculated_at: new Date(),
        },
      });
      return created;
    }

    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    await db.contractorRiskScore.updateMany({
      where: { id: existing.id },
      data: {
        current_score: computation.score,
        components: computation.components as unknown as object,
        threshold_state: computation.threshold_state,
        last_calculated_at: new Date(),
      },
    });
    await db.riskScoreHistory.create({
      data: {
        contractor_risk_score_id: existing.id,
        score: computation.score,
        components: computation.components as unknown as object,
        calculated_at: new Date(),
      },
    });

    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const updated = await db.contractorRiskScore.findFirst({
      where: { id: existing.id },
    });
    if (!updated) {
      throw new RepositoryError("Contractor risk score not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ContractorRiskScore");
  }
}

export async function refreshContractorRiskScore(
  companyId: string,
  input: { contractor_id: string; site_id?: string },
): Promise<ContractorRiskScore> {
  requireCompanyId(companyId);
  const computation = await computeContractorRiskScore(companyId, input);
  return upsertContractorRiskScore(companyId, computation);
}

export async function refreshAllContractorRiskScores(
  companyId: string,
  siteId?: string,
  maxCount?: number,
): Promise<ContractorRiskScore[]> {
  requireCompanyId(companyId);
  const safeMaxCount =
    maxCount !== undefined
      ? Math.max(1, Math.min(Math.trunc(maxCount), 5000))
      : undefined;

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const contractors = await db.contractor.findMany({
      where: { is_active: true },
      select: { id: true },
      ...(safeMaxCount ? { take: safeMaxCount } : {}),
    });

    const refreshed: ContractorRiskScore[] = [];
    for (const contractor of contractors) {
      const result = await refreshContractorRiskScore(companyId, {
        contractor_id: contractor.id,
        site_id: siteId,
      });
      refreshed.push(result);
    }
    return refreshed;
  } catch (error) {
    handlePrismaError(error, "ContractorRiskScore");
  }
}

export async function listContractorRiskScores(
  companyId: string,
  options?: { site_id?: string; limit?: number },
): Promise<ContractorRiskScore[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 1000));

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    return await db.contractorRiskScore.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
      },
      orderBy: [{ current_score: "asc" }, { updated_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "ContractorRiskScore");
  }
}

export async function listContractorRiskHistory(
  companyId: string,
  contractorRiskScoreId: string,
  limit: number = 50,
): Promise<RiskScoreHistory[]> {
  requireCompanyId(companyId);
  const safeLimit = Math.max(1, Math.min(limit, 500));

  try {
    const db = scopedDb(companyId);
    return await db.riskScoreHistory.findMany({
      where: { contractor_risk_score_id: contractorRiskScoreId },
      orderBy: [{ calculated_at: "desc" }],
      take: safeLimit,
    });
  } catch (error) {
    handlePrismaError(error, "RiskScoreHistory");
  }
}

export async function countRiskScoreHistorySince(
  companyId: string,
  since: Date,
): Promise<number> {
  requireCompanyId(companyId);
  if (Number.isNaN(since.getTime())) return 0;

  try {
    const db = scopedDb(companyId);
    return await db.riskScoreHistory.count({
      where: { calculated_at: { gte: since } },
    });
  } catch (error) {
    handlePrismaError(error, "RiskScoreHistory");
  }
}
