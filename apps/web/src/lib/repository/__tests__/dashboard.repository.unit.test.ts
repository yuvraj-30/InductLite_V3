import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(),
}));

import { scopedDb } from "@/lib/db/scoped-db";
import { getDashboardMetrics } from "../dashboard.repository";
import type { Prisma } from "@prisma/client";

function createBaseMockDb() {
  return {
    site: {
      count: vi.fn().mockResolvedValue(0),
    },
    signInRecord: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    contractorDocument: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    evacuationEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    emergencyDrill: {
      count: vi.fn().mockResolvedValue(0),
    },
    visitorApprovalRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    permitRequest: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    actionRegisterEntry: {
      count: vi.fn().mockResolvedValue(0),
    },
    inspectionSchedule: {
      count: vi.fn().mockResolvedValue(0),
    },
    inspectionRun: {
      count: vi.fn().mockResolvedValue(0),
    },
    competencyDecision: {
      count: vi.fn().mockResolvedValue(0),
    },
    workerCertification: {
      count: vi.fn().mockResolvedValue(0),
    },
    bookableResource: {
      count: vi.fn().mockResolvedValue(0),
    },
    inductionQuizAttempt: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  };
}

function createHostArrivalAudit(details: Prisma.JsonObject) {
  return {
    id: `audit-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date("2026-02-28T10:00:00Z"),
    details,
  };
}

function setupAuditMocks(
  mockDb: ReturnType<typeof createBaseMockDb>,
  input: {
    quizLogs?: Array<{ details: Prisma.JsonObject }>;
    hostLogs?: Array<{ id: string; created_at: Date; details: Prisma.JsonObject }>;
  },
) {
  const quizLogs = input.quizLogs ?? [];
  const hostLogs = input.hostLogs ?? [];
  mockDb.auditLog.findMany
    .mockResolvedValueOnce(quizLogs)
    .mockResolvedValueOnce(hostLogs)
    .mockResolvedValueOnce([]);
}

describe("dashboard.repository host arrival notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 30-day location audit summary counts", async () => {
    const mockDb = createBaseMockDb();
    setupAuditMocks(mockDb, {});
    mockDb.signInRecord.count
      // currentlyOnSiteCount
      .mockResolvedValueOnce(4)
      // signInsToday
      .mockResolvedValueOnce(6)
      // signInsSevenDays
      .mockResolvedValueOnce(20)
      // signInsThirtyDays
      .mockResolvedValueOnce(40)
      // locationCapturedThirtyDays
      .mockResolvedValueOnce(30)
      // locationWithinRadiusThirtyDays
      .mockResolvedValueOnce(24)
      // locationOutsideRadiusThirtyDays
      .mockResolvedValueOnce(6);

    vi.mocked(scopedDb).mockReturnValue(mockDb as never);

    const metrics = await getDashboardMetrics("company-1", {
      userId: "admin-1",
      userRole: "ADMIN",
      now: new Date("2026-02-28T12:00:00Z"),
    });

    expect(metrics.locationAuditSummary).toEqual({
      totalSignIns30Days: 40,
      captured: 30,
      withinRadius: 24,
      outsideRadius: 6,
      withoutCapture: 10,
    });
    expect(metrics.quizSummary).toMatchObject({
      scoredResponses30Days: 0,
      passRatePercent: 0,
      topRiskTemplateSites: [],
    });
    expect(metrics.actionSummary).toEqual({
      open: 0,
      overdue: 0,
      blocked: 0,
    });
  });

  it("shows admin all arrival alerts with queued notifications", async () => {
    const mockDb = createBaseMockDb();
    setupAuditMocks(mockDb, {
      hostLogs: [
        createHostArrivalAudit({
          visitor_name: "John Worker",
          site_name: "Main Site",
          host_notifications_enabled: true,
          host_notifications_queued: 1,
          host_recipient_id: "host-1",
        }),
        createHostArrivalAudit({
          visitor_name: "Jane Visitor",
          site_name: "North Site",
          host_notifications_enabled: true,
          host_notifications_queued: 2,
        }),
      ],
    });

    vi.mocked(scopedDb).mockReturnValue(mockDb as never);

    const metrics = await getDashboardMetrics("company-1", {
      userId: "admin-1",
      userRole: "ADMIN",
      now: new Date("2026-02-28T12:00:00Z"),
    });

    expect(metrics.hostArrivalNotifications).toHaveLength(2);
  });

  it("filters site manager alerts to broadcast + explicitly targeted entries", async () => {
    const mockDb = createBaseMockDb();
    setupAuditMocks(mockDb, {
      hostLogs: [
        createHostArrivalAudit({
          visitor_name: "Targeted Person",
          site_name: "Main Site",
          host_notifications_enabled: true,
          host_notifications_queued: 1,
          host_recipient_id: "manager-1",
        }),
        createHostArrivalAudit({
          visitor_name: "Other Target",
          site_name: "Main Site",
          host_notifications_enabled: true,
          host_notifications_queued: 1,
          host_recipient_id: "manager-2",
        }),
        createHostArrivalAudit({
          visitor_name: "Broadcast Person",
          site_name: "Main Site",
          host_notifications_enabled: true,
          host_notifications_queued: 1,
        }),
      ],
    });

    vi.mocked(scopedDb).mockReturnValue(mockDb as never);

    const metrics = await getDashboardMetrics("company-1", {
      userId: "manager-1",
      userRole: "SITE_MANAGER",
      now: new Date("2026-02-28T12:00:00Z"),
    });

    expect(metrics.hostArrivalNotifications).toHaveLength(2);
    expect(metrics.hostArrivalNotifications.some((item) => item.targeted)).toBe(
      true,
    );
    expect(
      metrics.hostArrivalNotifications.some(
        (item) => item.visitor_name === "Other Target",
      ),
    ).toBe(false);
  });

  it("limits viewer alerts to explicit host targeting only", async () => {
    const mockDb = createBaseMockDb();
    setupAuditMocks(mockDb, {
      hostLogs: [
        createHostArrivalAudit({
          visitor_name: "Broadcast Person",
          site_name: "Main Site",
          host_notifications_enabled: true,
          host_notifications_queued: 1,
        }),
        createHostArrivalAudit({
          visitor_name: "Viewer Target",
          site_name: "Main Site",
          host_notifications_enabled: true,
          host_notifications_queued: 1,
          host_recipient_id: "viewer-1",
        }),
      ],
    });

    vi.mocked(scopedDb).mockReturnValue(mockDb as never);

    const metrics = await getDashboardMetrics("company-1", {
      userId: "viewer-1",
      userRole: "VIEWER",
      now: new Date("2026-02-28T12:00:00Z"),
    });

    expect(metrics.hostArrivalNotifications).toHaveLength(1);
    expect(metrics.hostArrivalNotifications[0]?.visitor_name).toBe("Viewer Target");
  });

  it("returns quiz summary and ranks risky template-site combinations", async () => {
    const mockDb = createBaseMockDb();
    const passingQuizLogs = Array.from({ length: 15 }, () => ({
      details: { quiz_scoring_enabled: true, quiz_passed: true } as Prisma.JsonObject,
    }));
    const failingQuizLogs = Array.from({ length: 5 }, () => ({
      details: { quiz_scoring_enabled: true, quiz_passed: false } as Prisma.JsonObject,
    }));
    setupAuditMocks(mockDb, {
      quizLogs: [...passingQuizLogs, ...failingQuizLogs],
    });
    mockDb.inductionQuizAttempt.count
      .mockResolvedValueOnce(2) // quizActiveCooldowns
      .mockResolvedValueOnce(9) // quizProfilesAttempted30Days
      .mockResolvedValueOnce(4); // quizProfilesWithRecentFailures
    mockDb.inductionQuizAttempt.findMany.mockResolvedValue([
      {
        template_id: "template-a",
        site_id: "site-1",
        last_passed: false,
        cooldown_until: new Date("2026-03-01T10:00:00Z"),
        template: { name: "Visitor Safety A" },
        site: { name: "Main Site" },
      },
      {
        template_id: "template-a",
        site_id: "site-1",
        last_passed: false,
        cooldown_until: null,
        template: { name: "Visitor Safety A" },
        site: { name: "Main Site" },
      },
      {
        template_id: "template-b",
        site_id: "site-2",
        last_passed: false,
        cooldown_until: new Date("2026-03-01T11:00:00Z"),
        template: { name: "Plant Operator" },
        site: { name: "North Site" },
      },
      {
        template_id: "template-b",
        site_id: "site-2",
        last_passed: true,
        cooldown_until: null,
        template: { name: "Plant Operator" },
        site: { name: "North Site" },
      },
    ]);

    vi.mocked(scopedDb).mockReturnValue(mockDb as never);

    const metrics = await getDashboardMetrics("company-1", {
      userId: "admin-1",
      userRole: "ADMIN",
      now: new Date("2026-02-28T12:00:00Z"),
    });

    expect(metrics.quizSummary).toMatchObject({
      scoredResponses30Days: 20,
      passedResponses30Days: 15,
      failedResponses30Days: 5,
      passRatePercent: 75,
      activeCooldowns: 2,
      profilesAttempted30Days: 9,
      profilesWithRecentFailures: 4,
    });
    expect(metrics.quizSummary.topRiskTemplateSites[0]).toMatchObject({
      template_id: "template-a",
      site_id: "site-1",
      recent_fail_profiles: 2,
      active_cooldowns: 1,
    });
  });
});
