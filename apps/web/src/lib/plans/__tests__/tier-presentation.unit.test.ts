import { describe, expect, it } from "vitest";
import {
  COMPANY_TIERS,
  TIER_PRESENTATION,
  getCompanyTierPresentation,
  getTierPresentation,
} from "../tier-presentation";

describe("tier presentation", () => {
  it("covers Standard, Plus, Pro, and Add-ons", () => {
    expect(COMPANY_TIERS).toEqual(["STANDARD", "PLUS", "PRO"]);
    const keys = TIER_PRESENTATION.map((tier) => tier.key);
    expect(keys).toContain("STANDARD");
    expect(keys).toContain("PLUS");
    expect(keys).toContain("PRO");
    expect(keys).toContain("ADD_ONS");
  });

  it("returns tier metadata for company tiers and add-ons", () => {
    expect(getCompanyTierPresentation("STANDARD").label).toBe("Standard");
    expect(getCompanyTierPresentation("PLUS").label).toBe("Plus");
    expect(getCompanyTierPresentation("PRO").label).toBe("Pro");
    expect(getTierPresentation("ADD_ONS").label).toBe("Add-ons");
  });
});
