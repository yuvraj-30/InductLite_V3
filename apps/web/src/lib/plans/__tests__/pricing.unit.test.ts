import { describe, expect, it } from "vitest";
import type { CompanyPlan } from "@prisma/client";
import {
  PLAN_BASE_PRICE_CENTS,
  STANDARD_FLOOR_PRICE_CENTS,
  calculateCompanyPriceCents,
  calculateSitePriceCents,
} from "../pricing";
import {
  PRODUCT_FEATURE_KEYS,
  type EffectiveCreditMap,
  type EffectiveEntitlements,
  type EffectiveFeatureMap,
} from "../entitlements";

function createFeatureMap(defaultValue: boolean): EffectiveFeatureMap {
  return PRODUCT_FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = defaultValue;
    return acc;
  }, {} as EffectiveFeatureMap);
}

function createCreditMap(defaultValue: number): EffectiveCreditMap {
  return PRODUCT_FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = defaultValue;
    return acc;
  }, {} as EffectiveCreditMap);
}

function createEntitlements(plan: CompanyPlan): EffectiveEntitlements {
  return {
    companyId: "company-1",
    siteId: "site-1",
    plan,
    features: createFeatureMap(true),
    creditsCents: createCreditMap(0),
  };
}

describe("plan pricing", () => {
  it("applies standard credits but enforces floor price", () => {
    const entitlements = createEntitlements("STANDARD");
    entitlements.features.LOCATION_AUDIT = false;
    entitlements.features.REMINDERS_ENHANCED = false;
    entitlements.features.EXPORTS_ADVANCED = false;
    entitlements.features.WEBHOOKS_OUTBOUND = false;
    entitlements.features.MULTI_LANGUAGE = false;

    entitlements.creditsCents.LOCATION_AUDIT = 1000;
    entitlements.creditsCents.REMINDERS_ENHANCED = 1000;
    entitlements.creditsCents.EXPORTS_ADVANCED = 1000;
    entitlements.creditsCents.WEBHOOKS_OUTBOUND = 1000;
    entitlements.creditsCents.MULTI_LANGUAGE = 1000;

    const price = calculateSitePriceCents(entitlements);

    expect(price.basePriceCents).toBe(PLAN_BASE_PRICE_CENTS.STANDARD);
    expect(price.finalPriceCents).toBe(STANDARD_FLOOR_PRICE_CENTS);
  });

  it("does not apply credits to PLUS plans", () => {
    const entitlements = createEntitlements("PLUS");
    entitlements.features.LOCATION_AUDIT = false;
    entitlements.creditsCents.LOCATION_AUDIT = 900;

    const price = calculateSitePriceCents(entitlements);
    expect(price.basePriceCents).toBe(PLAN_BASE_PRICE_CENTS.PLUS);
    expect(price.creditAppliedCents).toBe(0);
    expect(price.finalPriceCents).toBe(PLAN_BASE_PRICE_CENTS.PLUS);
  });

  it("aggregates site prices at company level", () => {
    const siteA = createEntitlements("STANDARD");
    siteA.features.WEBHOOKS_OUTBOUND = false;
    siteA.creditsCents.WEBHOOKS_OUTBOUND = 500;

    const siteB = createEntitlements("PRO");

    const totals = calculateCompanyPriceCents([siteA, siteB]);

    expect(totals.siteCount).toBe(2);
    expect(totals.baseTotalCents).toBe(
      PLAN_BASE_PRICE_CENTS.STANDARD + PLAN_BASE_PRICE_CENTS.PRO,
    );
    expect(totals.finalTotalCents).toBe(
      PLAN_BASE_PRICE_CENTS.STANDARD - 500 + PLAN_BASE_PRICE_CENTS.PRO,
    );
  });
});
