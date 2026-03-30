import { describe, expect, it } from "vitest";
import {
  buildPageHref,
  normalizeSiteSearchQuery,
  parseSiteStatusFilter,
  siteMatchesFilters,
} from "./page";

describe("smoke: apps/web/src/app/admin/sites/page.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./page");
    expect(mod).toBeDefined();
  });

  it("normalizes search input for persistent filters", () => {
    expect(normalizeSiteSearchQuery("  Alpha   Site  ")).toBe("Alpha Site");
    expect(normalizeSiteSearchQuery(" ".repeat(12))).toBe("");
  });

  it("parses status filters safely", () => {
    expect(parseSiteStatusFilter("active")).toBe("active");
    expect(parseSiteStatusFilter("inactive")).toBe("inactive");
    expect(parseSiteStatusFilter("unexpected")).toBe("all");
    expect(parseSiteStatusFilter(undefined)).toBe("all");
  });

  it("matches sites against query and status filters", () => {
    expect(
      siteMatchesFilters(
        { name: "Alpha Works", is_active: true },
        "alpha",
        "active",
      ),
    ).toBe(true);
    expect(
      siteMatchesFilters(
        { name: "Alpha Works", is_active: true },
        "beta",
        "active",
      ),
    ).toBe(false);
    expect(
      siteMatchesFilters(
        { name: "Alpha Works", is_active: true },
        "alpha",
        "inactive",
      ),
    ).toBe(false);
  });

  it("builds pagination links that preserve active filters", () => {
    expect(
      buildPageHref(3, { query: "Alpha Site", status: "inactive" }),
    ).toBe("/admin/sites?page=3&q=Alpha+Site&status=inactive");
    expect(buildPageHref(1, { query: "", status: "all" })).toBe("/admin/sites");
  });
});
