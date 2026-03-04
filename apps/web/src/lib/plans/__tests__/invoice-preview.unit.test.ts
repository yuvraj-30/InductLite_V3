import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyPlan } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findAllSites: vi.fn(),
  getEffectiveEntitlements: vi.fn(),
}));

vi.mock("@/lib/repository/site.repository", () => ({
  findAllSites: mocks.findAllSites,
}));

vi.mock("../entitlements", async () => {
  const actual = await vi.importActual<typeof import("../entitlements")>(
    "../entitlements",
  );
  return {
    ...actual,
    getEffectiveEntitlements: mocks.getEffectiveEntitlements,
  };
});

import { buildCompanyInvoicePreview } from "../invoice-preview";

const PRODUCT_FEATURE_KEYS = [
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
] as const;

function createFeatureMap(value: boolean) {
  return PRODUCT_FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as Record<(typeof PRODUCT_FEATURE_KEYS)[number], boolean>);
}

function createCreditMap(value: number) {
  return PRODUCT_FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as Record<(typeof PRODUCT_FEATURE_KEYS)[number], number>);
}

function createEntitlements(plan: CompanyPlan) {
  return {
    companyId: "company-1",
    plan,
    features: createFeatureMap(true),
    creditsCents: createCreditMap(0),
  };
}

describe("buildCompanyInvoicePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates active-site totals and emits credit line items", async () => {
    mocks.findAllSites.mockResolvedValue([
      {
        id: "site-1",
        name: "Site One",
        is_active: true,
      },
      {
        id: "site-2",
        name: "Site Two",
        is_active: true,
      },
      {
        id: "site-3",
        name: "Inactive Site",
        is_active: false,
      },
    ]);

    const site1 = createEntitlements("STANDARD");
    site1.features.WEBHOOKS_OUTBOUND = false;
    site1.creditsCents.WEBHOOKS_OUTBOUND = 500;

    const site2 = createEntitlements("PLUS");

    mocks.getEffectiveEntitlements
      .mockResolvedValueOnce(site1)
      .mockResolvedValueOnce(site2);

    const preview = await buildCompanyInvoicePreview("company-1");

    expect(preview.activeSiteCount).toBe(2);
    expect(preview.baseTotalCents).toBe(20800);
    expect(preview.creditTotalCents).toBe(500);
    expect(preview.finalTotalCents).toBe(20300);
    expect(preview.siteInvoices).toHaveLength(2);
    expect(preview.siteInvoices[0]?.lineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "PLAN_BASE",
          amountCents: 8900,
        }),
        expect.objectContaining({
          type: "FEATURE_CREDIT",
          featureKey: "WEBHOOKS_OUTBOUND",
          amountCents: -500,
        }),
        expect.objectContaining({
          type: "SITE_TOTAL",
          amountCents: 8400,
        }),
      ]),
    );
  });

  it("adds floor adjustment line item when standard credits exceed floor", async () => {
    mocks.findAllSites.mockResolvedValue([
      {
        id: "site-1",
        name: "Site One",
        is_active: true,
      },
    ]);

    const site = createEntitlements("STANDARD");
    site.features.LOCATION_AUDIT = false;
    site.features.REMINDERS_ENHANCED = false;
    site.features.EXPORTS_ADVANCED = false;
    site.features.WEBHOOKS_OUTBOUND = false;
    site.features.MULTI_LANGUAGE = false;
    site.creditsCents.LOCATION_AUDIT = 2000;
    site.creditsCents.REMINDERS_ENHANCED = 2000;
    site.creditsCents.EXPORTS_ADVANCED = 2000;
    site.creditsCents.WEBHOOKS_OUTBOUND = 2000;
    site.creditsCents.MULTI_LANGUAGE = 2000;

    mocks.getEffectiveEntitlements.mockResolvedValueOnce(site);

    const preview = await buildCompanyInvoicePreview("company-1");
    const lineItems = preview.siteInvoices[0]?.lineItems ?? [];

    expect(preview.finalTotalCents).toBe(6900);
    expect(lineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "FLOOR_ADJUSTMENT",
          amountCents: 8000,
        }),
      ]),
    );
  });
});
