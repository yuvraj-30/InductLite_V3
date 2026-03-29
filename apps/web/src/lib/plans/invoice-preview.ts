import { findAllSites } from "@/lib/repository/site.repository";
import {
  STANDARD_REMOVABLE_FEATURES,
  getEffectiveEntitlements,
  type ProductFeatureKey,
} from "./entitlements";
import { calculateCompanyPriceCents, calculateSitePriceCents } from "./pricing";

export type InvoiceLineItemType =
  | "PLAN_BASE"
  | "FEATURE_CREDIT"
  | "FLOOR_ADJUSTMENT"
  | "SITE_TOTAL";

export interface InvoiceLineItem {
  type: InvoiceLineItemType;
  description: string;
  amountCents: number;
  featureKey?: ProductFeatureKey;
}

export interface SiteInvoicePreview {
  siteId: string;
  siteName: string;
  plan: "STANDARD" | "PLUS" | "PRO";
  basePriceCents: number;
  creditAppliedCents: number;
  finalPriceCents: number;
  lineItems: InvoiceLineItem[];
}

export interface CompanyInvoicePreview {
  companyId: string;
  currency: "NZD";
  generatedAt: Date;
  activeSiteCount: number;
  baseTotalCents: number;
  creditTotalCents: number;
  finalTotalCents: number;
  siteInvoices: SiteInvoicePreview[];
}

export interface CompanyInvoiceSummary {
  companyId: string;
  currency: "NZD";
  generatedAt: Date;
  activeSiteCount: number;
  baseTotalCents: number;
  creditTotalCents: number;
  finalTotalCents: number;
  planCounts: {
    STANDARD: number;
    PLUS: number;
    PRO: number;
  };
}

type SiteEntitlementSnapshot = {
  site: Awaited<ReturnType<typeof findAllSites>>[number];
  entitlements: Awaited<ReturnType<typeof getEffectiveEntitlements>>;
};

const FEATURE_LABELS: Record<ProductFeatureKey, string> = {
  HOST_NOTIFICATIONS: "Host notifications",
  BADGE_PRINTING: "Badge printing",
  ROLLCALL_V2: "Emergency roll-call",
  LOCATION_AUDIT: "Location verification (audit mode)",
  PREREG_INVITES: "Pre-registration and invites",
  REMINDERS_ENHANCED: "Enhanced reminders",
  EXPORTS_ADVANCED: "Advanced export bundles",
  WEBHOOKS_OUTBOUND: "Outbound webhooks",
  MULTI_LANGUAGE: "Multi-language induction packs",
  QUIZ_SCORING_V2: "Quiz scoring",
  CONTENT_BLOCKS: "Media-first content blocks",
  LMS_CONNECTOR: "LMS connector",
  ANALYTICS_ADVANCED: "Advanced analytics",
  SMS_WORKFLOWS: "SMS workflows",
  HARDWARE_ACCESS: "Hardware access integration",
  GEOFENCE_ENFORCEMENT: "Geofence enforcement",
  PERMITS_V1: "Permit-to-work",
  PREQUALIFICATION_V1: "Contractor prequalification",
  VISITOR_APPROVALS_V1: "Visitor approvals",
  ID_HARDENING_V1: "Identity hardening",
  EMERGENCY_COMMS_V1: "Emergency communications",
  TEAMS_SLACK_V1: "Teams and Slack integrations",
  PWA_PUSH_V1: "PWA push notifications",
  MOBILE_OFFLINE_ASSIST_V1: "Mobile offline assist",
  COMMUNICATION_HUB_V1: "Unified communication hub",
  GATEWAY_TRACE_V1: "Gate and turnstile traceability",
  EVIDENCE_TAMPER_V1: "Tamper-evident evidence packs",
  POLICY_SIMULATOR_V1: "Safety policy simulator",
  RISK_PASSPORT_V1: "Contractor risk passport",
  SELF_SERVE_CONFIG_V1: "Self-serve plan configurator",
  ID_OCR_VERIFICATION_V1: "OCR identity verification",
  ACCESS_CONNECTORS_V1: "Provider access connectors",
  NATIVE_MOBILE_RUNTIME_V1: "Native mobile runtime",
};

function createEmptyPlanCounts(): CompanyInvoiceSummary["planCounts"] {
  return {
    STANDARD: 0,
    PLUS: 0,
    PRO: 0,
  };
}

async function resolveActiveSiteEntitlementSnapshots(
  companyId: string,
): Promise<SiteEntitlementSnapshot[]> {
  const sites = await findAllSites(companyId);
  const activeSites = sites.filter((site) => site.is_active);

  return Promise.all(
    activeSites.map(async (site) => ({
      site,
      entitlements: await getEffectiveEntitlements(companyId, site.id),
    })),
  );
}

function buildPlanCounts(
  siteInvoiceInputs: SiteEntitlementSnapshot[],
): CompanyInvoiceSummary["planCounts"] {
  const planCounts = createEmptyPlanCounts();

  for (const { entitlements } of siteInvoiceInputs) {
    planCounts[entitlements.plan] += 1;
  }

  return planCounts;
}

export async function buildCompanyInvoiceSummary(
  companyId: string,
): Promise<CompanyInvoiceSummary> {
  const siteInvoiceInputs = await resolveActiveSiteEntitlementSnapshots(companyId);
  const totals = calculateCompanyPriceCents(
    siteInvoiceInputs.map(({ entitlements }) => entitlements),
  );

  return {
    companyId,
    currency: "NZD",
    generatedAt: new Date(),
    activeSiteCount: siteInvoiceInputs.length,
    baseTotalCents: totals.baseTotalCents,
    creditTotalCents: totals.creditTotalCents,
    finalTotalCents: totals.finalTotalCents,
    planCounts: buildPlanCounts(siteInvoiceInputs),
  };
}

export async function buildCompanyInvoicePreview(
  companyId: string,
): Promise<CompanyInvoicePreview> {
  const siteInvoiceInputs = await resolveActiveSiteEntitlementSnapshots(companyId);

  const siteInvoices: SiteInvoicePreview[] = [];
  const entitlementSnapshots = siteInvoiceInputs.map(
    ({ entitlements }) => entitlements,
  );

  for (const { site, entitlements } of siteInvoiceInputs) {
    const sitePrice = calculateSitePriceCents(entitlements);

    const lineItems: InvoiceLineItem[] = [
      {
        type: "PLAN_BASE",
        description: `${entitlements.plan} base plan`,
        amountCents: sitePrice.basePriceCents,
      },
    ];

    let appliedCreditCents = 0;
    if (entitlements.plan === "STANDARD") {
      for (const featureKey of STANDARD_REMOVABLE_FEATURES) {
        if (!entitlements.features[featureKey]) {
          const creditCents = entitlements.creditsCents[featureKey] ?? 0;
          if (creditCents <= 0) continue;
          appliedCreditCents += creditCents;
          lineItems.push({
            type: "FEATURE_CREDIT",
            featureKey,
            description: `Credit: ${FEATURE_LABELS[featureKey]}`,
            amountCents: -creditCents,
          });
        }
      }
    }

    const discountedTotalCents = sitePrice.basePriceCents - appliedCreditCents;
    if (sitePrice.finalPriceCents > discountedTotalCents) {
      lineItems.push({
        type: "FLOOR_ADJUSTMENT",
        description: "Standard plan floor adjustment",
        amountCents: sitePrice.finalPriceCents - discountedTotalCents,
      });
    }

    lineItems.push({
      type: "SITE_TOTAL",
      description: "Estimated site monthly total",
      amountCents: sitePrice.finalPriceCents,
    });

    siteInvoices.push({
      siteId: site.id,
      siteName: site.name,
      plan: entitlements.plan,
      basePriceCents: sitePrice.basePriceCents,
      creditAppliedCents: sitePrice.creditAppliedCents,
      finalPriceCents: sitePrice.finalPriceCents,
      lineItems,
    });
  }

  const totals = calculateCompanyPriceCents(entitlementSnapshots);
  return {
    companyId,
    currency: "NZD",
    generatedAt: new Date(),
    activeSiteCount: siteInvoiceInputs.length,
    baseTotalCents: totals.baseTotalCents,
    creditTotalCents: totals.creditTotalCents,
    finalTotalCents: totals.finalTotalCents,
    siteInvoices,
  };
}
