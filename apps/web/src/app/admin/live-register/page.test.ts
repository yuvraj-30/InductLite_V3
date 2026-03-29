import { describe, expect, it } from "vitest";
import type { SignInRecordWithDetails } from "@/lib/repository";
import {
  buildLiveRegisterOverview,
  buildLiveRegisterSiteGroups,
  splitLiveRegisterSiteGroups,
} from "./page";

function createRecord(
  overrides: Partial<SignInRecordWithDetails>,
): SignInRecordWithDetails {
  return {
    id: overrides.id ?? "record-1",
    site_id: overrides.site_id ?? "site-1",
    site: overrides.site ?? {
      id: overrides.site_id ?? "site-1",
      name: "Alpha Yard",
    },
    visitor_name: overrides.visitor_name ?? "Alex Example",
    visitor_phone: overrides.visitor_phone ?? "0210000000",
    visitor_phone_display:
      overrides.visitor_phone_display ?? "021 000 0000",
    visitor_email: overrides.visitor_email ?? null,
    visitor_type: overrides.visitor_type ?? "CONTRACTOR",
    employer_name: overrides.employer_name ?? "Example Co",
    sign_in_ts:
      overrides.sign_in_ts ?? new Date("2026-03-27T00:00:00.000Z"),
    sign_out_ts: overrides.sign_out_ts ?? null,
    signed_out_by: overrides.signed_out_by ?? null,
    sign_out_token: overrides.sign_out_token ?? null,
    sign_out_token_exp: overrides.sign_out_token_exp ?? null,
    created_at:
      overrides.created_at ?? new Date("2026-03-27T00:00:00.000Z"),
    notes: overrides.notes ?? null,
    location_latitude: overrides.location_latitude ?? null,
    location_longitude: overrides.location_longitude ?? null,
    location_captured_at: overrides.location_captured_at ?? null,
    location_accuracy_m: overrides.location_accuracy_m ?? null,
    location_within_radius: overrides.location_within_radius ?? null,
    location_distance_m: overrides.location_distance_m ?? null,
    visitor_photo_evidence: overrides.visitor_photo_evidence ?? null,
    visitor_id_evidence: overrides.visitor_id_evidence ?? null,
    visitor_id_evidence_type: overrides.visitor_id_evidence_type ?? null,
    company_id: overrides.company_id ?? "company-1",
  };
}

describe("live-register page helpers", () => {
  it("groups records by site id and sorts urgent sites first", () => {
    const renderedAt = new Date("2026-03-27T10:00:00.000Z");
    const groups = buildLiveRegisterSiteGroups(
      [
        createRecord({
          id: "alpha-1",
          site_id: "site-alpha",
          site: {
            id: "site-alpha",
            name: "Alpha Yard",
          } as SignInRecordWithDetails["site"],
          sign_in_ts: new Date("2026-03-27T01:00:00.000Z"),
          location_captured_at: new Date("2026-03-27T01:00:00.000Z"),
          location_within_radius: false,
        }),
        createRecord({
          id: "alpha-2",
          site_id: "site-alpha",
          site: {
            id: "site-alpha",
            name: "Alpha Yard",
          } as SignInRecordWithDetails["site"],
          sign_in_ts: new Date("2026-03-27T08:30:00.000Z"),
        }),
        createRecord({
          id: "beta-1",
          site_id: "site-beta",
          site: {
            id: "site-beta",
            name: "Beta Depot",
          } as SignInRecordWithDetails["site"],
          sign_in_ts: new Date("2026-03-27T09:10:00.000Z"),
          location_captured_at: new Date("2026-03-27T09:10:00.000Z"),
          location_within_radius: true,
        }),
      ],
      renderedAt,
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      siteId: "site-alpha",
      headcount: 2,
      longStayCount: 1,
      locationExceptionCount: 1,
    });
    expect(groups[1]).toMatchObject({
      siteId: "site-beta",
      headcount: 1,
      longStayCount: 0,
    });
  });

  it("summarizes the control-room overview metrics", () => {
    const overview = buildLiveRegisterOverview([
      {
        siteId: "site-1",
        siteName: "Alpha Yard",
        headcount: 3,
        longStayCount: 1,
        locationExceptionCount: 1,
        locationMissingCount: 1,
        lastSignInTs: new Date("2026-03-27T09:00:00.000Z"),
        records: [],
      },
      {
        siteId: "site-2",
        siteName: "Beta Depot",
        headcount: 2,
        longStayCount: 0,
        locationExceptionCount: 0,
        locationMissingCount: 0,
        lastSignInTs: new Date("2026-03-27T08:00:00.000Z"),
        records: [],
      },
    ]);

    expect(overview).toMatchObject({
      activeSiteCount: 2,
      headcount: 5,
      longStayCount: 1,
      locationExceptionCount: 1,
      monitoredLocationCount: 4,
      busiestSiteName: "Alpha Yard",
      busiestSiteHeadcount: 3,
    });
  });

  it("caps expanded site panels and pushes the rest into the compact drawer", () => {
    const { primaryGroups, secondaryGroups } = splitLiveRegisterSiteGroups(
      [
        {
          siteId: "site-1",
          siteName: "Alpha Yard",
          headcount: 4,
          longStayCount: 0,
          locationExceptionCount: 0,
          locationMissingCount: 0,
          lastSignInTs: new Date("2026-03-27T09:00:00.000Z"),
          records: [],
        },
        {
          siteId: "site-2",
          siteName: "Bravo Works",
          headcount: 3,
          longStayCount: 0,
          locationExceptionCount: 0,
          locationMissingCount: 0,
          lastSignInTs: new Date("2026-03-27T08:00:00.000Z"),
          records: [],
        },
        {
          siteId: "site-3",
          siteName: "Charlie Yard",
          headcount: 2,
          longStayCount: 1,
          locationExceptionCount: 0,
          locationMissingCount: 0,
          lastSignInTs: new Date("2026-03-27T07:00:00.000Z"),
          records: [],
        },
        {
          siteId: "site-4",
          siteName: "Delta Hub",
          headcount: 1,
          longStayCount: 0,
          locationExceptionCount: 0,
          locationMissingCount: 0,
          lastSignInTs: new Date("2026-03-27T06:00:00.000Z"),
          records: [],
        },
      ],
      2,
    );

    expect(primaryGroups.map((group) => group.siteId)).toEqual(["site-1", "site-2"]);
    expect(secondaryGroups.map((group) => group.siteId)).toEqual([
      "site-3",
      "site-4",
    ]);
  });

  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./page");
    expect(mod).toBeDefined();
  });

  it("keeps dense table presentation for expanded live-register detail", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

    expect(source).toContain("data-table-dense");
    expect(source).toContain("data-table-quiet");
    expect(source).toContain("Triage active exceptions before deep site detail");
  });
});
