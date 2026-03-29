import { describe, expect, it } from "vitest";
import {
  buildBillingPlanSummaryRows,
  buildSettingsOverviewCards,
  formatResidencySummary,
} from "./page";

describe("admin settings page helpers", () => {
  it("formats residency summary from region and scope", () => {
    expect(
      formatResidencySummary({
        data_residency_region: "NZ",
        data_residency_scope: "PRIMARY_AND_BACKUP",
      }),
    ).toBe("New Zealand · Primary and backup");

    expect(
      formatResidencySummary({
        data_residency_region: null,
        data_residency_scope: null,
      }),
    ).toBe("Not declared");
  });

  it("builds overview cards in operator-friendly intent order", () => {
    const cards = buildSettingsOverviewCards({
      settings: {
        id: "settings-1",
        retention_days: 365,
        induction_retention_days: 730,
        audit_retention_days: 2555,
        incident_retention_days: 1095,
        emergency_drill_retention_days: 730,
        compliance_legal_hold: true,
        compliance_legal_hold_reason: "Pending regulator inquiry",
        compliance_legal_hold_set_at: new Date("2026-03-02T00:00:00.000Z"),
        data_residency_region: "NZ",
        data_residency_scope: "PRIMARY_AND_BACKUP",
        data_residency_notes: null,
        data_residency_attested_at: new Date("2026-03-01T00:00:00.000Z"),
        data_residency_attested_by: "Ops Lead",
      },
      ssoConfig: {
        enabled: true,
        provider: "MICROSOFT_ENTRA",
        displayName: "Contoso SSO",
        issuerUrl: "https://login.microsoftonline.com/example/v2.0",
        clientId: "client-id",
        clientSecretEncrypted: "secret",
        scopes: ["openid", "profile", "email"],
        autoProvisionUsers: true,
        defaultRole: "ADMIN",
        roleClaimPath: "roles",
        roleMapping: {
          ADMIN: ["admin"],
          SITE_MANAGER: ["manager"],
          VIEWER: ["viewer"],
        },
        allowedEmailDomains: ["example.com"],
        directorySync: {
          enabled: true,
          tokenHash: "token",
        },
        partnerApi: {
          enabled: false,
          scopes: [],
          monthlyQuota: 5000,
          tokenHash: null,
        },
      },
      endpointHost: "billing.example.com",
    });

    expect(cards.map((card) => card.eyebrow)).toEqual([
      "Compliance",
      "Residency",
      "Identity",
      "Accounting",
    ]);
    expect(cards[0]).toMatchObject({
      title: "Legal hold is active",
      badgeLabel: "Hold enabled",
      href: "#compliance",
    });
    expect(cards[2]).toMatchObject({
      title: "SSO enabled",
      badgeLabel: "Enterprise login",
      href: "#identity",
    });
    expect(cards[3]).toMatchObject({
      title: "billing.example.com",
      badgeLabel: "Sync ready",
      href: "#billing",
    });
  });

  it("summarizes billing plan counts for the billing snapshot", () => {
    const rows = buildBillingPlanSummaryRows(
      {
        STANDARD: 2,
        PLUS: 1,
        PRO: 0,
      },
      [
        {
          key: "STANDARD",
          label: "Standard",
          subtitle: "Core visitor sign-in and induction flow.",
          badgeTone: "default",
        },
        {
          key: "PLUS",
          label: "Plus",
          subtitle: "Enhanced automation and workflow tooling.",
          badgeTone: "primary",
        },
        {
          key: "PRO",
          label: "Pro",
          subtitle: "Advanced governance and integration controls.",
          badgeTone: "warning",
        },
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({ key: "STANDARD", siteCount: 2 }),
      expect.objectContaining({ key: "PLUS", siteCount: 1 }),
      expect.objectContaining({ key: "PRO", siteCount: 0 }),
    ]);
  });

  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./page");
    expect(mod).toBeDefined();
  });
});
