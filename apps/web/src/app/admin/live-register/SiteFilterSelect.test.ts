import { describe, expect, it } from "vitest";
import {
  buildLiveRegisterSiteFilterHref,
  getLiveRegisterSiteMatches,
} from "./SiteFilterSelect";

describe("live register site filter helpers", () => {
  it("preserves unrelated search params when applying a site filter", () => {
    expect(
      buildLiveRegisterSiteFilterHref(
        "/admin/live-register",
        "site=site-1&status=on_site",
        "site-2",
      ),
    ).toBe("/admin/live-register?site=site-2&status=on_site");
  });

  it("removes the site filter when cleared", () => {
    expect(
      buildLiveRegisterSiteFilterHref(
        "/admin/live-register",
        "site=site-1&status=on_site",
      ),
    ).toBe("/admin/live-register?status=on_site");
  });

  it("prioritizes the selected site and prefix matches", () => {
    const result = getLiveRegisterSiteMatches(
      [
        { id: "site-2", name: "South Yard", is_active: true },
        { id: "site-1", name: "South Gate", is_active: true },
        { id: "site-3", name: "North Plant", is_active: true },
      ],
      "south",
      "site-2",
    );

    expect(result.totalMatches).toBe(2);
    expect(result.visibleSites.map((site) => site.id)).toEqual([
      "site-2",
      "site-1",
    ]);
  });

  it("matches site names case-insensitively and keeps active sites ahead of inactive ones", () => {
    const result = getLiveRegisterSiteMatches(
      [
        { id: "site-1", name: "Alpha Works", is_active: false },
        { id: "site-2", name: "ALPHA Yard", is_active: true },
        { id: "site-3", name: "Bravo Office", is_active: true },
      ],
      "alpha",
    );

    expect(result.totalMatches).toBe(2);
    expect(result.visibleSites.map((site) => site.id)).toEqual([
      "site-2",
      "site-1",
    ]);
  });

  it("limits visible results while keeping the total match count", () => {
    const result = getLiveRegisterSiteMatches(
      Array.from({ length: 20 }, (_, index) => ({
        id: `site-${index + 1}`,
        name: `Site ${index + 1}`,
        is_active: true,
      })),
      "site",
      undefined,
      5,
    );

    expect(result.totalMatches).toBe(20);
    expect(result.visibleSites).toHaveLength(5);
  });

  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./SiteFilterSelect");
    expect(mod).toBeDefined();
  });
});
