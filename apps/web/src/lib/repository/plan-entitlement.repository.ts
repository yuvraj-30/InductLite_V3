/**
 * Plan Entitlement Repository
 *
 * Stores company and site-level plan entitlements and pricing credits.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type { CompanyPlan, Prisma } from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export type FeatureToggleMap = Record<string, boolean>;
export type FeatureCreditMap = Record<string, number>;

export interface CompanyEntitlementSettings {
  companyId: string;
  productPlan: CompanyPlan;
  featureOverrides: FeatureToggleMap;
  featureCreditOverrides: FeatureCreditMap;
}

export interface SiteEntitlementOverrides {
  siteId: string;
  featureOverrides: FeatureToggleMap;
  featureCreditOverrides: FeatureCreditMap;
}

export interface UpdateCompanyEntitlementSettingsInput {
  productPlan?: CompanyPlan;
  featureOverrides?: FeatureToggleMap;
  featureCreditOverrides?: FeatureCreditMap;
}

export interface UpdateSiteEntitlementOverridesInput {
  featureOverrides?: FeatureToggleMap;
  featureCreditOverrides?: FeatureCreditMap;
}

function normalizeFeatureToggleMap(value: unknown): FeatureToggleMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: FeatureToggleMap = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "boolean") {
      result[key] = rawValue;
    }
  }
  return result;
}

function normalizeFeatureCreditMap(value: unknown): FeatureCreditMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: FeatureCreditMap = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      result[key] = Math.trunc(rawValue);
    }
  }
  return result;
}

export async function findCompanyEntitlementSettings(
  companyId: string,
): Promise<CompanyEntitlementSettings | null> {
  requireCompanyId(companyId);

  try {
    const record = await publicDb.company.findFirst({
      where: { id: companyId },
      select: {
        id: true,
        product_plan: true,
        feature_overrides: true,
        feature_credit_overrides: true,
      },
    });

    if (!record) return null;

    return {
      companyId: record.id,
      productPlan: record.product_plan,
      featureOverrides: normalizeFeatureToggleMap(record.feature_overrides),
      featureCreditOverrides: normalizeFeatureCreditMap(
        record.feature_credit_overrides,
      ),
    };
  } catch (error) {
    handlePrismaError(error, "Company");
  }
}

export async function updateCompanyEntitlementSettings(
  companyId: string,
  input: UpdateCompanyEntitlementSettingsInput,
): Promise<CompanyEntitlementSettings> {
  requireCompanyId(companyId);

  try {
    const data: Prisma.CompanyUpdateManyMutationInput = {};

    if (input.productPlan !== undefined) {
      data.product_plan = input.productPlan;
    }
    if (input.featureOverrides !== undefined) {
      data.feature_overrides = input.featureOverrides;
    }
    if (input.featureCreditOverrides !== undefined) {
      data.feature_credit_overrides = input.featureCreditOverrides;
    }

    const result = await publicDb.company.updateMany({
      where: { id: companyId },
      data,
    });

    if (result.count === 0) {
      throw new RepositoryError("Company not found", "NOT_FOUND");
    }

    const updated = await findCompanyEntitlementSettings(companyId);
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

export async function findSiteEntitlementOverrides(
  companyId: string,
  siteId: string,
): Promise<SiteEntitlementOverrides | null> {
  requireCompanyId(companyId);
  if (!siteId.trim()) {
    throw new RepositoryError("siteId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const record = await db.site.findFirst({
      where: { id: siteId },
      select: {
        id: true,
        feature_overrides: true,
        feature_credit_overrides: true,
      },
    });

    if (!record) return null;

    return {
      siteId: record.id,
      featureOverrides: normalizeFeatureToggleMap(record.feature_overrides),
      featureCreditOverrides: normalizeFeatureCreditMap(
        record.feature_credit_overrides,
      ),
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "Site");
  }
}

export async function updateSiteEntitlementOverrides(
  companyId: string,
  siteId: string,
  input: UpdateSiteEntitlementOverridesInput,
): Promise<SiteEntitlementOverrides> {
  requireCompanyId(companyId);
  if (!siteId.trim()) {
    throw new RepositoryError("siteId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const data: Prisma.SiteUpdateManyMutationInput = {};

    if (input.featureOverrides !== undefined) {
      data.feature_overrides = input.featureOverrides;
    }
    if (input.featureCreditOverrides !== undefined) {
      data.feature_credit_overrides = input.featureCreditOverrides;
    }

    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const result = await db.site.updateMany({
      where: { id: siteId },
      data,
    });

    if (result.count === 0) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }

    const updated = await findSiteEntitlementOverrides(companyId, siteId);
    if (!updated) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "Site");
  }
}
