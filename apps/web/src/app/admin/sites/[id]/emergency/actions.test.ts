import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  EntitlementDeniedError: class EntitlementDeniedError extends Error {
    featureKey: string;
    controlId: string;

    constructor(featureKey: string) {
      super(`Feature is not enabled for this tenant: ${featureKey}`);
      this.name = "EntitlementDeniedError";
      this.featureKey = featureKey;
      this.controlId = "PLAN-ENTITLEMENT-001";
    }
  },
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkSitePermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  createAuditLog: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  createSiteEmergencyContact: vi.fn(),
  deactivateSiteEmergencyContact: vi.fn(),
  createSiteEmergencyProcedure: vi.fn(),
  deactivateSiteEmergencyProcedure: vi.fn(),
  createEmergencyDrill: vi.fn(),
  startRollCallEvent: vi.fn(),
  updateRollCallAttendance: vi.fn(),
  markAllRollCallAttendancesAccounted: vi.fn(),
  closeRollCallEvent: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkSitePermission: mocks.checkSitePermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository/emergency.repository", () => ({
  createSiteEmergencyContact: mocks.createSiteEmergencyContact,
  deactivateSiteEmergencyContact: mocks.deactivateSiteEmergencyContact,
  createSiteEmergencyProcedure: mocks.createSiteEmergencyProcedure,
  deactivateSiteEmergencyProcedure: mocks.deactivateSiteEmergencyProcedure,
  createEmergencyDrill: mocks.createEmergencyDrill,
  startRollCallEvent: mocks.startRollCallEvent,
  updateRollCallAttendance: mocks.updateRollCallAttendance,
  markAllRollCallAttendancesAccounted: mocks.markAllRollCallAttendancesAccounted,
  closeRollCallEvent: mocks.closeRollCallEvent,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

import {
  createEmergencyContactAction,
  createEmergencyDrillAction,
  startRollCallEventAction,
  updateRollCallAttendanceAction,
  closeRollCallEventAction,
} from "./actions";

describe("emergency roll-call actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkSitePermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
      role: "ADMIN",
    });
    mocks.assertCompanyFeatureEnabled.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.startRollCallEvent.mockResolvedValue({
      id: "c123456789012345678901234",
      site_id: "site-1",
      total_people: 4,
      accounted_count: 0,
      missing_count: 4,
    });
    mocks.updateRollCallAttendance.mockResolvedValue({
      id: "c123456789012345678901235",
      status: "ACCOUNTED",
      visitor_name: "John Worker",
    });
    mocks.closeRollCallEvent.mockResolvedValue({
      id: "c123456789012345678901234",
      total_people: 4,
      accounted_count: 3,
      missing_count: 1,
    });
  });

  it("starts roll call event and writes audit log", async () => {
    const result = await startRollCallEventAction("site-1");

    expect(result.success).toBe(true);
    expect(mocks.startRollCallEvent).toHaveBeenCalledWith("company-1", {
      site_id: "site-1",
      started_by: "user-1",
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "emergency.rollcall.start",
        entity_type: "EvacuationEvent",
      }),
    );
  });

  it("allows baseline emergency contacts even when roll-call entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("ROLLCALL_V2"),
    );
    mocks.createSiteEmergencyContact.mockResolvedValue({
      id: "c123456789012345678901236",
      priority: 1,
    });

    const formData = new FormData();
    formData.set("name", "Safety Lead");
    formData.set("phone", "021 444 9999");
    formData.set("priority", "1");

    const result = await createEmergencyContactAction("site-1", null, formData);

    expect(result.success).toBe(true);
    expect(mocks.createSiteEmergencyContact).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        site_id: "site-1",
        name: "Safety Lead",
      }),
    );
  });

  it("allows baseline emergency drill logging even when roll-call entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("ROLLCALL_V2"),
    );
    mocks.createEmergencyDrill.mockResolvedValue({
      id: "c123456789012345678901237",
      drill_type: "EVACUATION",
      legal_hold: false,
    });

    const formData = new FormData();
    formData.set("drillType", "EVACUATION");
    formData.set("scenario", "Evacuation drill");

    const result = await createEmergencyDrillAction("site-1", null, formData);

    expect(result.success).toBe(true);
    expect(mocks.createEmergencyDrill).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        site_id: "site-1",
        drill_type: "EVACUATION",
        scenario: "Evacuation drill",
      }),
    );
  });

  it("rejects invalid attendance status", async () => {
    const result = await updateRollCallAttendanceAction(
      "site-1",
      "c123456789012345678901234",
      "c123456789012345678901235",
      "BAD_STATUS" as unknown as "ACCOUNTED",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid attendance status");
    }
    expect(mocks.updateRollCallAttendance).not.toHaveBeenCalled();
  });

  it("closes roll call event and writes summary audit", async () => {
    const formData = new FormData();
    formData.set("eventId", "c123456789012345678901234");
    formData.set("notes", "All clear after muster");

    const result = await closeRollCallEventAction("site-1", null, formData);

    expect(result.success).toBe(true);
    expect(mocks.closeRollCallEvent).toHaveBeenCalledWith("company-1", {
      event_id: "c123456789012345678901234",
      closed_by: "user-1",
      notes: "All clear after muster",
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "emergency.rollcall.close",
        entity_type: "EvacuationEvent",
      }),
    );
  });
});
