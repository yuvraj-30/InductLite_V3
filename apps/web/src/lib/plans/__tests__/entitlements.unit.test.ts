import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCompanyEntitlementSettings: vi.fn(),
  findSiteEntitlementOverrides: vi.fn(),
}));

vi.mock("@/lib/repository/plan-entitlement.repository", () => ({
  findCompanyEntitlementSettings: mocks.findCompanyEntitlementSettings,
  findSiteEntitlementOverrides: mocks.findSiteEntitlementOverrides,
}));

import {
  EntitlementDeniedError,
  assertFeatureEnabled,
  getEffectiveEntitlements,
} from "../entitlements";

describe("plan entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns plan defaults for STANDARD when no overrides exist", async () => {
    mocks.findCompanyEntitlementSettings.mockResolvedValue({
      companyId: "company-1",
      productPlan: "STANDARD",
      featureOverrides: {},
      featureCreditOverrides: {},
    });
    mocks.findSiteEntitlementOverrides.mockResolvedValue(null);

    const entitlements = await getEffectiveEntitlements("company-1");

    expect(entitlements.plan).toBe("STANDARD");
    expect(entitlements.features.HOST_NOTIFICATIONS).toBe(true);
    expect(entitlements.features.QUIZ_SCORING_V2).toBe(false);
    expect(entitlements.features.SMS_WORKFLOWS).toBe(false);
  });

  it("applies site override after company override", async () => {
    mocks.findCompanyEntitlementSettings.mockResolvedValue({
      companyId: "company-1",
      productPlan: "STANDARD",
      featureOverrides: {
        WEBHOOKS_OUTBOUND: false,
      },
      featureCreditOverrides: {},
    });
    mocks.findSiteEntitlementOverrides.mockResolvedValue({
      siteId: "site-1",
      featureOverrides: {
        WEBHOOKS_OUTBOUND: true,
      },
      featureCreditOverrides: {},
    });

    const entitlements = await getEffectiveEntitlements("company-1", "site-1");

    expect(entitlements.features.WEBHOOKS_OUTBOUND).toBe(true);
  });

  it("throws entitlement error when a feature is disabled", async () => {
    mocks.findCompanyEntitlementSettings.mockResolvedValue({
      companyId: "company-1",
      productPlan: "STANDARD",
      featureOverrides: {
        HOST_NOTIFICATIONS: false,
      },
      featureCreditOverrides: {},
    });
    mocks.findSiteEntitlementOverrides.mockResolvedValue(null);

    const entitlements = await getEffectiveEntitlements("company-1");

    expect(() =>
      assertFeatureEnabled(entitlements, "HOST_NOTIFICATIONS"),
    ).toThrowError(EntitlementDeniedError);
  });
});
