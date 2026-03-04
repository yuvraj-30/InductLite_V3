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
};

export async function buildCompanyInvoicePreview(
  companyId: string,
): Promise<CompanyInvoicePreview> {
  const sites = await findAllSites(companyId);
  const activeSites = sites.filter((site) => site.is_active);

  const siteInvoices: SiteInvoicePreview[] = [];
  const entitlementSnapshots = [];

  for (const site of activeSites) {
    const entitlements = await getEffectiveEntitlements(companyId, site.id);
    entitlementSnapshots.push(entitlements);
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
    activeSiteCount: activeSites.length,
    baseTotalCents: totals.baseTotalCents,
    creditTotalCents: totals.creditTotalCents,
    finalTotalCents: totals.finalTotalCents,
    siteInvoices,
  };
}
