import { scopedDb } from "@/lib/db/scoped-db";
import type {
  CompetencyCertificationStatus,
  CompetencyDecision,
  CompetencyDecisionStatus,
  CompetencyEvidenceType,
  CompetencyRequirement,
  Prisma,
  WorkerCertification,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface CompetencyRequirementFilter {
  site_id?: string;
  role_key?: string;
  is_active?: boolean;
}

export interface CreateCompetencyRequirementInput {
  site_id?: string | null;
  role_key?: string | null;
  name: string;
  description?: string | null;
  evidence_type?: CompetencyEvidenceType;
  validity_days?: number | null;
  is_blocking?: boolean;
  sort_order?: number;
}

export interface WorkerCertificationFilter {
  site_id?: string;
  requirement_id?: string;
  visitor_phone?: string;
  status?: CompetencyCertificationStatus | CompetencyCertificationStatus[];
}

export interface CreateWorkerCertificationInput {
  site_id?: string | null;
  requirement_id?: string | null;
  visitor_phone: string;
  visitor_email?: string | null;
  worker_name: string;
  employer_name?: string | null;
  status?: CompetencyCertificationStatus;
  issued_at?: Date | null;
  expires_at?: Date | null;
  evidence_refs?: Prisma.InputJsonValue | null;
  verified_by_user_id?: string | null;
}

export interface EvaluateCompetencyInput {
  site_id: string;
  visitor_phone: string;
  visitor_email?: string | null;
  role_key?: string | null;
}

export interface EvaluatedRequirement {
  requirement: CompetencyRequirement;
  certification: WorkerCertification | null;
  state: "CURRENT" | "EXPIRING" | "BLOCKED" | "MISSING";
  message: string;
}

export interface CompetencyEvaluation {
  status: CompetencyDecisionStatus;
  blockedReason: string | null;
  requirements: EvaluatedRequirement[];
  requirementCount: number;
  missingCount: number;
  expiringCount: number;
}

export interface CompetencySummary {
  requirements: number;
  current: number;
  expiring: number;
  blocked: number;
  pending_verification: number;
}

function normalizeOptionalDate(value?: Date | null): Date | null {
  if (!value) return null;
  if (Number.isNaN(value.getTime())) {
    throw new RepositoryError("Invalid date value", "VALIDATION");
  }
  return value;
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RepositoryError("visitor_phone is required", "VALIDATION");
  }
  return trimmed;
}

function normalizeEmail(value?: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function normalizeRoleKey(value?: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || null;
}

function determineCertificationState(
  certification: WorkerCertification | null,
  now: Date,
): {
  state: "CURRENT" | "EXPIRING" | "BLOCKED" | "MISSING";
  message: string;
} {
  if (!certification) {
    return {
      state: "MISSING",
      message: "No certification recorded for this requirement.",
    };
  }

  if (certification.status === "PENDING_VERIFICATION") {
    return {
      state: "BLOCKED",
      message: "Certification is pending verification.",
    };
  }

  if (certification.status === "EXPIRED") {
    return {
      state: "BLOCKED",
      message: "Certification is already marked as expired.",
    };
  }

  if (certification.expires_at && certification.expires_at <= now) {
    return {
      state: "BLOCKED",
      message: "Certification has expired.",
    };
  }

  if (certification.expires_at) {
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (certification.expires_at <= thirtyDaysFromNow) {
      return {
        state: "EXPIRING",
        message: "Certification expires within 30 days.",
      };
    }
  }

  return {
    state: "CURRENT",
    message: "Certification is current.",
  };
}

export async function listCompetencyRequirements(
  companyId: string,
  filter?: CompetencyRequirementFilter,
): Promise<CompetencyRequirement[]> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);
  const scopeClauses: Prisma.CompetencyRequirementWhereInput[] = [];

  if (filter?.site_id) {
    scopeClauses.push({
      OR: [{ site_id: filter.site_id }, { site_id: null }],
    });
  }

  if (filter?.role_key) {
    scopeClauses.push({
      OR: [{ role_key: normalizeRoleKey(filter.role_key) }, { role_key: null }],
    });
  }

  try {
    return await db.competencyRequirement.findMany({
      where: {
        company_id: companyId,
        ...(scopeClauses.length > 0 ? { AND: scopeClauses } : {}),
        ...(filter?.is_active !== undefined ? { is_active: filter.is_active } : {}),
      },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      take: 300,
    });
  } catch (error) {
    handlePrismaError(error, "CompetencyRequirement");
  }
}

export async function createCompetencyRequirement(
  companyId: string,
  input: CreateCompetencyRequirementInput,
): Promise<CompetencyRequirement> {
  requireCompanyId(companyId);
  if (!input.name?.trim()) {
    throw new RepositoryError("Requirement name is required", "VALIDATION");
  }

  const db = scopedDb(companyId);
  try {
    return await db.competencyRequirement.create({
      data: {
        site_id: input.site_id ?? null,
        role_key: normalizeRoleKey(input.role_key),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        evidence_type: input.evidence_type ?? "CERTIFICATION",
        validity_days: input.validity_days ?? null,
        is_blocking: input.is_blocking !== false,
        sort_order: input.sort_order ?? 0,
        is_active: true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "CompetencyRequirement");
  }
}

export async function listWorkerCertifications(
  companyId: string,
  filter?: WorkerCertificationFilter,
): Promise<WorkerCertification[]> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.workerCertification.findMany({
      where: {
        company_id: companyId,
        ...(filter?.site_id ? { OR: [{ site_id: filter.site_id }, { site_id: null }] } : {}),
        ...(filter?.requirement_id ? { requirement_id: filter.requirement_id } : {}),
        ...(filter?.visitor_phone ? { visitor_phone: filter.visitor_phone } : {}),
        ...(filter?.status
          ? {
              status: Array.isArray(filter.status)
                ? { in: filter.status }
                : filter.status,
            }
          : {}),
      },
      orderBy: [{ expires_at: "asc" }, { created_at: "desc" }],
      take: 500,
    });
  } catch (error) {
    handlePrismaError(error, "WorkerCertification");
  }
}

export async function createWorkerCertification(
  companyId: string,
  input: CreateWorkerCertificationInput,
): Promise<WorkerCertification> {
  requireCompanyId(companyId);
  if (!input.worker_name?.trim()) {
    throw new RepositoryError("worker_name is required", "VALIDATION");
  }

  const db = scopedDb(companyId);
  try {
    return await db.workerCertification.create({
      data: {
        site_id: input.site_id ?? null,
        requirement_id: input.requirement_id ?? null,
        visitor_phone: normalizePhone(input.visitor_phone),
        visitor_email: normalizeEmail(input.visitor_email),
        worker_name: input.worker_name.trim(),
        employer_name: input.employer_name?.trim() || null,
        status: input.status ?? "CURRENT",
        issued_at: normalizeOptionalDate(input.issued_at),
        expires_at: normalizeOptionalDate(input.expires_at),
        evidence_refs: (input.evidence_refs ?? null) as Prisma.InputJsonValue | null,
        verified_by_user_id: input.verified_by_user_id ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "WorkerCertification");
  }
}

export async function recordCompetencyDecision(
  companyId: string,
  input: {
    site_id: string;
    sign_in_record_id?: string | null;
    visitor_phone: string;
    status: CompetencyDecisionStatus;
    blocked_reason?: string | null;
    summary?: Prisma.InputJsonValue | null;
  },
): Promise<CompetencyDecision> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.competencyDecision.create({
      data: {
        site_id: input.site_id,
        sign_in_record_id: input.sign_in_record_id ?? null,
        visitor_phone: normalizePhone(input.visitor_phone),
        status: input.status,
        blocked_reason: input.blocked_reason?.trim() || null,
        summary: (input.summary ?? null) as Prisma.InputJsonValue | null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "CompetencyDecision");
  }
}

export async function evaluateCompetencyForWorker(
  companyId: string,
  input: EvaluateCompetencyInput,
  now: Date = new Date(),
): Promise<CompetencyEvaluation> {
  requireCompanyId(companyId);
  const phone = normalizePhone(input.visitor_phone);
  const requirements = await listCompetencyRequirements(companyId, {
    site_id: input.site_id,
    role_key: normalizeRoleKey(input.role_key) ?? undefined,
    is_active: true,
  });

  if (requirements.length === 0) {
    return {
      status: "CLEAR",
      blockedReason: null,
      requirements: [],
      requirementCount: 0,
      missingCount: 0,
      expiringCount: 0,
    };
  }

  const certifications = await listWorkerCertifications(companyId, {
    site_id: input.site_id,
    visitor_phone: phone,
  });
  const certificationByRequirementId = new Map<string, WorkerCertification>();
  for (const certification of certifications) {
    if (!certification.requirement_id) continue;
    if (!certificationByRequirementId.has(certification.requirement_id)) {
      certificationByRequirementId.set(certification.requirement_id, certification);
    }
  }

  const evaluatedRequirements = requirements.map((requirement) => {
    const certification = certificationByRequirementId.get(requirement.id) ?? null;
    const evaluation = determineCertificationState(certification, now);
    return {
      requirement,
      certification,
      state: evaluation.state,
      message: evaluation.message,
    };
  });

  const blockingFailures = evaluatedRequirements.filter(
    (entry) =>
      entry.requirement.is_blocking &&
      (entry.state === "BLOCKED" || entry.state === "MISSING"),
  );
  const expiringCount = evaluatedRequirements.filter(
    (entry) => entry.state === "EXPIRING",
  ).length;
  const missingCount = evaluatedRequirements.filter(
    (entry) => entry.state === "MISSING",
  ).length;

  if (blockingFailures.length > 0) {
    return {
      status: "BLOCKED",
      blockedReason: blockingFailures
        .slice(0, 2)
        .map((entry) => `${entry.requirement.name}: ${entry.message}`)
        .join(" "),
      requirements: evaluatedRequirements,
      requirementCount: requirements.length,
      missingCount,
      expiringCount,
    };
  }

  if (expiringCount > 0) {
    return {
      status: "EXPIRING",
      blockedReason: null,
      requirements: evaluatedRequirements,
      requirementCount: requirements.length,
      missingCount,
      expiringCount,
    };
  }

  return {
    status: "CLEAR",
    blockedReason: null,
    requirements: evaluatedRequirements,
    requirementCount: requirements.length,
    missingCount,
    expiringCount,
  };
}

export async function getCompetencySummary(
  companyId: string,
  now: Date = new Date(),
): Promise<CompetencySummary> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [requirements, current, expiring, blocked, pendingVerification] =
      await Promise.all([
        db.competencyRequirement.count({
          where: { company_id: companyId, is_active: true },
        }),
        db.workerCertification.count({
          where: {
            company_id: companyId,
            status: "CURRENT",
            OR: [{ expires_at: null }, { expires_at: { gt: thirtyDaysFromNow } }],
          },
        }),
        db.workerCertification.count({
          where: {
            company_id: companyId,
            OR: [
              { status: "EXPIRING" },
              {
                status: "CURRENT",
                expires_at: { gt: now, lte: thirtyDaysFromNow },
              },
            ],
          },
        }),
        db.competencyDecision.count({
          where: {
            company_id: companyId,
            status: "BLOCKED",
            decided_at: { gte: thirtyDaysAgo },
          },
        }),
        db.workerCertification.count({
          where: {
            company_id: companyId,
            status: "PENDING_VERIFICATION",
          },
        }),
      ]);

    return {
      requirements,
      current,
      expiring,
      blocked,
      pending_verification: pendingVerification,
    };
  } catch (error) {
    handlePrismaError(error, "CompetencyRequirement");
  }
}
