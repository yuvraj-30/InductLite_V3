import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(() => ({
    auditLog: {
      findMany: mocks.findMany,
    },
  })),
}));

import { getAdvancedAuditAnalytics } from "../audit-analytics.repository";

describe("audit analytics repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates advanced audit analytics metrics", async () => {
    mocks.findMany.mockResolvedValue([
      {
        action: "auth.login_failed",
        user_id: "u-1",
        ip_address: "10.0.0.1",
        created_at: new Date("2026-03-01T00:30:00.000Z"),
        details: null,
      },
      {
        action: "visitor.sign_in_escalation_submitted",
        user_id: null,
        ip_address: "10.0.0.2",
        created_at: new Date("2026-03-01T12:30:00.000Z"),
        details: null,
      },
      {
        action: "sms.sent",
        user_id: null,
        ip_address: "10.0.0.1",
        created_at: new Date("2026-03-02T12:30:00.000Z"),
        details: null,
      },
      {
        action: "hardware.access_queued",
        user_id: null,
        ip_address: "10.0.0.3",
        created_at: new Date("2026-03-02T12:40:00.000Z"),
        details: { decision: "DENY" },
      },
    ]);

    const result = await getAdvancedAuditAnalytics("company-1", {
      now: new Date("2026-03-03T00:00:00.000Z"),
      windowDays: 30,
      timezone: "Pacific/Auckland",
    });

    expect(result.totalEvents30Days).toBe(4);
    expect(result.failedLoginCount30Days).toBe(1);
    expect(result.escalationEventCount30Days).toBe(1);
    expect(result.smsSentCount30Days).toBe(1);
    expect(result.hardwareDeniedCount30Days).toBe(1);
    expect(result.topActions[0]).toMatchObject({
      action: "auth.login_failed",
      count: 1,
    });
    expect(result.topIpAddresses[0]).toMatchObject({
      ipAddress: "10.0.0.1",
      count: 2,
    });
    expect(result.dailyEventTrend.length).toBeGreaterThan(0);
  });
});
