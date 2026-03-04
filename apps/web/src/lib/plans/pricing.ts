import type { CompanyPlan } from "@prisma/client";
import type { EffectiveEntitlements } from "./entitlements";
import { STANDARD_REMOVABLE_FEATURES } from "./entitlements";

export const PLAN_BASE_PRICE_CENTS: Record<CompanyPlan, number> = {
  STANDARD: 8900,
  PLUS: 11900,
  PRO: 14900,
};

export const STANDARD_FLOOR_PRICE_CENTS = 6900;

export interface SitePriceBreakdown {
  basePriceCents: number;
  creditAppliedCents: number;
  finalPriceCents: number;
}

export interface CompanyPriceBreakdown {
  siteCount: number;
  baseTotalCents: number;
  creditTotalCents: number;
  finalTotalCents: number;
}

export function calculateSitePriceCents(
  entitlements: EffectiveEntitlements,
): SitePriceBreakdown {
  const basePriceCents = PLAN_BASE_PRICE_CENTS[entitlements.plan];
  if (entitlements.plan !== "STANDARD") {
    return {
      basePriceCents,
      creditAppliedCents: 0,
      finalPriceCents: basePriceCents,
    };
  }

  let creditAppliedCents = 0;
  for (const featureKey of STANDARD_REMOVABLE_FEATURES) {
    if (!entitlements.features[featureKey]) {
      creditAppliedCents += entitlements.creditsCents[featureKey] ?? 0;
    }
  }

  const finalPriceCents = Math.max(
    STANDARD_FLOOR_PRICE_CENTS,
    basePriceCents - creditAppliedCents,
  );

  return {
    basePriceCents,
    creditAppliedCents,
    finalPriceCents,
  };
}

export function calculateCompanyPriceCents(
  siteEntitlements: EffectiveEntitlements[],
): CompanyPriceBreakdown {
  let baseTotalCents = 0;
  let creditTotalCents = 0;
  let finalTotalCents = 0;

  for (const entitlements of siteEntitlements) {
    const sitePrice = calculateSitePriceCents(entitlements);
    baseTotalCents += sitePrice.basePriceCents;
    creditTotalCents += sitePrice.creditAppliedCents;
    finalTotalCents += sitePrice.finalPriceCents;
  }

  return {
    siteCount: siteEntitlements.length,
    baseTotalCents,
    creditTotalCents,
    finalTotalCents,
  };
}
