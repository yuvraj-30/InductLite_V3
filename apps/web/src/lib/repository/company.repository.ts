/**
 * Company Repository
 *
 * Handles company-level compliance settings and identity controls.
 */

import { publicDb } from "@/lib/db/public-db";
import { Prisma } from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

const MAX_RETENTION_DAYS = 36500;

const companyComplianceSelect = {
  id: true,
  retention_days: true,
  induction_retention_days: true,
  audit_retention_days: true,
  incident_retention_days: true,
  emergency_drill_retention_days: true,
  compliance_legal_hold: true,
  compliance_legal_hold_reason: true,
  compliance_legal_hold_set_at: true,
} satisfies Prisma.CompanySelect;

const companySsoSelect = {
  id: true,
  name: true,
  slug: true,
  sso_config: true,
} satisfies Prisma.CompanySelect;

export interface CompanyComplianceSettings {
  id: string;
  retention_days: number;
  induction_retention_days: number;
  audit_retention_days: number;
  incident_retention_days: number;
  emergency_drill_retention_days: number;
  compliance_legal_hold: boolean;
  compliance_legal_hold_reason: string | null;
  compliance_legal_hold_set_at: Date | null;
}

export interface UpdateCompanyComplianceSettingsInput {
  retention_days: number;
  induction_retention_days: number;
  audit_retention_days: number;
  incident_retention_days: number;
  emergency_drill_retention_days: number;
  compliance_legal_hold: boolean;
  compliance_legal_hold_reason?: string | null;
}

export interface CompanySsoSettingsRecord {
  id: string;
  name: string;
  slug: string;
  sso_config: Prisma.JsonValue | null;
}

function normalizeRetentionDays(value: number, fieldName: string): number {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_RETENTION_DAYS
  ) {
    throw new RepositoryError(
      `${fieldName} must be an integer between 1 and ${MAX_RETENTION_DAYS}`,
      "VALIDATION",
    );
  }
  return value;
}

export async function findCompanyComplianceSettings(
  companyId: string,
): Promise<CompanyComplianceSettings | null> {
  requireCompanyId(companyId);

  try {
    const company = await publicDb.company.findFirst({
      where: { id: companyId },
      select: companyComplianceSelect,
    });

    if (!company) {
      return null;
    }

    return company;
  } catch (error) {
    handlePrismaError(error, "Company");
  }
}

export async function findCompanySsoSettings(
  companyId: string,
): Promise<CompanySsoSettingsRecord | null> {
  requireCompanyId(companyId);

  try {
    const company = await publicDb.company.findFirst({
      where: { id: companyId },
      select: companySsoSelect,
    });
    if (!company) return null;
    return company as CompanySsoSettingsRecord;
  } catch (error) {
    handlePrismaError(error, "Company");
  }
}

export async function findCompanySsoSettingsBySlug(
  slug: string,
): Promise<CompanySsoSettingsRecord | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    throw new RepositoryError("Company slug is required", "VALIDATION");
  }

  try {
    const company = await publicDb.company.findFirst({
      where: { slug: normalized },
      select: companySsoSelect,
    });
    if (!company) return null;
    return company as CompanySsoSettingsRecord;
  } catch (error) {
    handlePrismaError(error, "Company");
  }
}

export async function updateCompanySsoSettings(
  companyId: string,
  ssoConfig: Prisma.InputJsonValue | null,
): Promise<CompanySsoSettingsRecord> {
  requireCompanyId(companyId);

  try {
    const result = await publicDb.company.updateMany({
      where: { id: companyId },
      data: {
        sso_config: ssoConfig ?? Prisma.DbNull,
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Company not found", "NOT_FOUND");
    }

    const updated = await publicDb.company.findFirst({
      where: { id: companyId },
      select: companySsoSelect,
    });

    if (!updated) {
      throw new RepositoryError("Company not found", "NOT_FOUND");
    }

    return updated as CompanySsoSettingsRecord;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "Company");
  }
}

export async function updateCompanyComplianceSettings(
  companyId: string,
  input: UpdateCompanyComplianceSettingsInput,
): Promise<CompanyComplianceSettings> {
  requireCompanyId(companyId);

  const retentionDays = normalizeRetentionDays(
    input.retention_days,
    "retention_days",
  );
  const inductionRetentionDays = normalizeRetentionDays(
    input.induction_retention_days,
    "induction_retention_days",
  );
  const auditRetentionDays = normalizeRetentionDays(
    input.audit_retention_days,
    "audit_retention_days",
  );
  const incidentRetentionDays = normalizeRetentionDays(
    input.incident_retention_days,
    "incident_retention_days",
  );
  const emergencyDrillRetentionDays = normalizeRetentionDays(
    input.emergency_drill_retention_days,
    "emergency_drill_retention_days",
  );
  const legalHoldReason = input.compliance_legal_hold_reason?.trim() ?? "";

  if (input.compliance_legal_hold && legalHoldReason.length === 0) {
    throw new RepositoryError(
      "Legal hold reason is required when compliance legal hold is enabled",
      "VALIDATION",
    );
  }

  try {
    const existing = await publicDb.company.findFirst({
      where: { id: companyId },
      select: {
        compliance_legal_hold: true,
        compliance_legal_hold_set_at: true,
      },
    });

    if (!existing) {
      throw new RepositoryError("Company not found", "NOT_FOUND");
    }

    const legalHoldSetAt = input.compliance_legal_hold
      ? existing.compliance_legal_hold_set_at ?? new Date()
      : null;

    const result = await publicDb.company.updateMany({
      where: { id: companyId },
      data: {
        retention_days: retentionDays,
        induction_retention_days: inductionRetentionDays,
        audit_retention_days: auditRetentionDays,
        incident_retention_days: incidentRetentionDays,
        emergency_drill_retention_days: emergencyDrillRetentionDays,
        compliance_legal_hold: input.compliance_legal_hold,
        compliance_legal_hold_reason: input.compliance_legal_hold
          ? legalHoldReason
          : null,
        compliance_legal_hold_set_at: legalHoldSetAt,
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Company not found", "NOT_FOUND");
    }

    const updated = await publicDb.company.findFirst({
      where: { id: companyId },
      select: companyComplianceSelect,
    });

    if (!updated) {
      throw new RepositoryError("Company not found", "NOT_FOUND");
    }

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "Company");
  }
}
