import { RepositoryError } from "@/lib/repository/base";
import {
  findCompanyEntitlementSettings,
  findSiteEntitlementOverrides,
  type FeatureCreditMap,
  type FeatureToggleMap,
} from "@/lib/repository/plan-entitlement.repository";
import type { CompanyPlan } from "@prisma/client";

export const PRODUCT_FEATURE_KEYS = [
  "HOST_NOTIFICATIONS",
  "BADGE_PRINTING",
  "ROLLCALL_V2",
  "LOCATION_AUDIT",
  "PREREG_INVITES",
  "REMINDERS_ENHANCED",
  "EXPORTS_ADVANCED",
  "WEBHOOKS_OUTBOUND",
  "MULTI_LANGUAGE",
  "QUIZ_SCORING_V2",
  "CONTENT_BLOCKS",
  "LMS_CONNECTOR",
  "ANALYTICS_ADVANCED",
  "SMS_WORKFLOWS",
  "HARDWARE_ACCESS",
  "GEOFENCE_ENFORCEMENT",
  "PERMITS_V1",
  "PREQUALIFICATION_V1",
  "VISITOR_APPROVALS_V1",
  "ID_HARDENING_V1",
  "EMERGENCY_COMMS_V1",
  "TEAMS_SLACK_V1",
  "PWA_PUSH_V1",
  "MOBILE_OFFLINE_ASSIST_V1",
  "COMMUNICATION_HUB_V1",
  "GATEWAY_TRACE_V1",
  "EVIDENCE_TAMPER_V1",
  "POLICY_SIMULATOR_V1",
  "RISK_PASSPORT_V1",
  "SELF_SERVE_CONFIG_V1",
  "ID_OCR_VERIFICATION_V1",
  "ACCESS_CONNECTORS_V1",
  "NATIVE_MOBILE_RUNTIME_V1",
] as const;

export type ProductFeatureKey = (typeof PRODUCT_FEATURE_KEYS)[number];

export type EffectiveFeatureMap = Record<ProductFeatureKey, boolean>;
export type EffectiveCreditMap = Record<ProductFeatureKey, number>;

export interface EffectiveEntitlements {
  companyId: string;
  siteId?: string;
  plan: CompanyPlan;
  features: EffectiveFeatureMap;
  creditsCents: EffectiveCreditMap;
}

export class EntitlementDeniedError extends Error {
  constructor(
    public readonly featureKey: ProductFeatureKey,
    public readonly controlId: string = "PLAN-ENTITLEMENT-001",
  ) {
    super(`Feature is not enabled for this tenant: ${featureKey}`);
    this.name = "EntitlementDeniedError";
  }
}

const PLAN_DEFAULT_FEATURES: Record<CompanyPlan, ProductFeatureKey[]> = {
  STANDARD: [
    "HOST_NOTIFICATIONS",
    "BADGE_PRINTING",
    "ROLLCALL_V2",
    "LOCATION_AUDIT",
    "PREREG_INVITES",
    "REMINDERS_ENHANCED",
    "EXPORTS_ADVANCED",
    "WEBHOOKS_OUTBOUND",
    "MULTI_LANGUAGE",
    "PERMITS_V1",
    "PREQUALIFICATION_V1",
    "VISITOR_APPROVALS_V1",
    "ID_HARDENING_V1",
    "EMERGENCY_COMMS_V1",
    "TEAMS_SLACK_V1",
    "PWA_PUSH_V1",
  ],
  PLUS: [
    "HOST_NOTIFICATIONS",
    "BADGE_PRINTING",
    "ROLLCALL_V2",
    "LOCATION_AUDIT",
    "PREREG_INVITES",
    "REMINDERS_ENHANCED",
    "EXPORTS_ADVANCED",
    "WEBHOOKS_OUTBOUND",
    "MULTI_LANGUAGE",
    "QUIZ_SCORING_V2",
    "CONTENT_BLOCKS",
    "PERMITS_V1",
    "PREQUALIFICATION_V1",
    "VISITOR_APPROVALS_V1",
    "ID_HARDENING_V1",
    "EMERGENCY_COMMS_V1",
    "TEAMS_SLACK_V1",
    "PWA_PUSH_V1",
    "MOBILE_OFFLINE_ASSIST_V1",
    "COMMUNICATION_HUB_V1",
    "GATEWAY_TRACE_V1",
    "EVIDENCE_TAMPER_V1",
    "POLICY_SIMULATOR_V1",
    "RISK_PASSPORT_V1",
    "NATIVE_MOBILE_RUNTIME_V1",
  ],
  PRO: [
    "HOST_NOTIFICATIONS",
    "BADGE_PRINTING",
    "ROLLCALL_V2",
    "LOCATION_AUDIT",
    "PREREG_INVITES",
    "REMINDERS_ENHANCED",
    "EXPORTS_ADVANCED",
    "WEBHOOKS_OUTBOUND",
    "MULTI_LANGUAGE",
    "QUIZ_SCORING_V2",
    "CONTENT_BLOCKS",
    "LMS_CONNECTOR",
    "ANALYTICS_ADVANCED",
    "PERMITS_V1",
    "PREQUALIFICATION_V1",
    "VISITOR_APPROVALS_V1",
    "ID_HARDENING_V1",
    "EMERGENCY_COMMS_V1",
    "TEAMS_SLACK_V1",
    "PWA_PUSH_V1",
    "MOBILE_OFFLINE_ASSIST_V1",
    "COMMUNICATION_HUB_V1",
    "GATEWAY_TRACE_V1",
    "EVIDENCE_TAMPER_V1",
    "POLICY_SIMULATOR_V1",
    "RISK_PASSPORT_V1",
    "SELF_SERVE_CONFIG_V1",
    "ID_OCR_VERIFICATION_V1",
    "ACCESS_CONNECTORS_V1",
    "NATIVE_MOBILE_RUNTIME_V1",
  ],
};

const DEFAULT_STANDARD_CREDITS_CENTS: Partial<
  Record<ProductFeatureKey, number>
> = {
  LOCATION_AUDIT: 300,
  REMINDERS_ENHANCED: 400,
  EXPORTS_ADVANCED: 400,
  WEBHOOKS_OUTBOUND: 500,
  MULTI_LANGUAGE: 400,
  TEAMS_SLACK_V1: 400,
  PWA_PUSH_V1: 300,
};

function createBaseFeatureMap(plan: CompanyPlan): EffectiveFeatureMap {
  const featureSet = new Set<ProductFeatureKey>(PLAN_DEFAULT_FEATURES[plan]);

  return PRODUCT_FEATURE_KEYS.reduce((acc, featureKey) => {
    acc[featureKey] = featureSet.has(featureKey);
    return acc;
  }, {} as EffectiveFeatureMap);
}

function createBaseCreditMap(): EffectiveCreditMap {
  return PRODUCT_FEATURE_KEYS.reduce((acc, featureKey) => {
    const defaultValue = DEFAULT_STANDARD_CREDITS_CENTS[featureKey] ?? 0;
    acc[featureKey] = defaultValue;
    return acc;
  }, {} as EffectiveCreditMap);
}

function applyFeatureOverrides(
  target: EffectiveFeatureMap,
  overrides: FeatureToggleMap,
) {
  for (const featureKey of PRODUCT_FEATURE_KEYS) {
    const overrideValue = overrides[featureKey];
    if (overrideValue !== undefined) {
      target[featureKey] = overrideValue;
    }
  }
}

function applyCreditOverrides(
  target: EffectiveCreditMap,
  overrides: FeatureCreditMap,
) {
  for (const featureKey of PRODUCT_FEATURE_KEYS) {
    const overrideValue = overrides[featureKey];
    if (
      overrideValue !== undefined &&
      Number.isFinite(overrideValue) &&
      overrideValue >= 0
    ) {
      target[featureKey] = Math.trunc(overrideValue);
    }
  }
}

export async function getEffectiveEntitlements(
  companyId: string,
  siteId?: string,
): Promise<EffectiveEntitlements> {
  const company = await findCompanyEntitlementSettings(companyId);
  if (!company) {
    throw new RepositoryError("Company not found", "NOT_FOUND");
  }

  const features = createBaseFeatureMap(company.productPlan);
  const creditsCents = createBaseCreditMap();

  applyFeatureOverrides(features, company.featureOverrides);
  applyCreditOverrides(creditsCents, company.featureCreditOverrides);

  if (siteId) {
    const siteOverrides = await findSiteEntitlementOverrides(companyId, siteId);
    if (!siteOverrides) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }
    applyFeatureOverrides(features, siteOverrides.featureOverrides);
    applyCreditOverrides(creditsCents, siteOverrides.featureCreditOverrides);
  }

  return {
    companyId,
    siteId,
    plan: company.productPlan,
    features,
    creditsCents,
  };
}

export function assertFeatureEnabled(
  entitlements: EffectiveEntitlements,
  featureKey: ProductFeatureKey,
) {
  if (!entitlements.features[featureKey]) {
    throw new EntitlementDeniedError(featureKey);
  }
}

export async function assertCompanyFeatureEnabled(
  companyId: string,
  featureKey: ProductFeatureKey,
  siteId?: string,
) {
  const entitlements = await getEffectiveEntitlements(companyId, siteId);
  assertFeatureEnabled(entitlements, featureKey);
  return entitlements;
}

export const STANDARD_REMOVABLE_FEATURES: ProductFeatureKey[] = [
  "LOCATION_AUDIT",
  "REMINDERS_ENHANCED",
  "EXPORTS_ADVANCED",
  "WEBHOOKS_OUTBOUND",
  "MULTI_LANGUAGE",
  "TEAMS_SLACK_V1",
  "PWA_PUSH_V1",
];
