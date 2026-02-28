import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  findCompanyComplianceSettings: vi.fn(),
  updateCompanyComplianceSettings: vi.fn(),
  createAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
  generateRequestId: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createRequestLogger: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkPermission: mocks.checkPermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository/company.repository", () => ({
  findCompanyComplianceSettings: mocks.findCompanyComplianceSettings,
  updateCompanyComplianceSettings: mocks.updateCompanyComplianceSettings,
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

import { updateComplianceSettingsAction } from "./actions";

function buildValidFormData(): FormData {
  const formData = new FormData();
  formData.set("retentionDays", "365");
  formData.set("inductionRetentionDays", "365");
  formData.set("auditRetentionDays", "90");
  formData.set("incidentRetentionDays", "1825");
  formData.set("emergencyDrillRetentionDays", "1825");
  formData.set("complianceLegalHold", "true");
  formData.set("complianceLegalHoldReason", "Ongoing regulator investigation");
  return formData;
}

describe("updateComplianceSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.findCompanyComplianceSettings.mockResolvedValue({
      id: "company-1",
      retention_days: 365,
      induction_retention_days: 365,
      audit_retention_days: 90,
      incident_retention_days: 1825,
      emergency_drill_retention_days: 1825,
      compliance_legal_hold: false,
      compliance_legal_hold_reason: null,
      compliance_legal_hold_set_at: null,
    });
    mocks.updateCompanyComplianceSettings.mockResolvedValue({
      id: "company-1",
      retention_days: 365,
      induction_retention_days: 365,
      audit_retention_days: 90,
      incident_retention_days: 1825,
      emergency_drill_retention_days: 1825,
      compliance_legal_hold: true,
      compliance_legal_hold_reason: "Ongoing regulator investigation",
      compliance_legal_hold_set_at: new Date("2026-02-23T00:00:00.000Z"),
    });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("returns origin error when CSRF origin validation fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const result = await updateComplianceSettingsAction(null, buildValidFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }
    expect(mocks.updateCompanyComplianceSettings).not.toHaveBeenCalled();
  });

  it("validates legal-hold reason when hold is enabled", async () => {
    const formData = buildValidFormData();
    formData.set("complianceLegalHoldReason", "");

    const result = await updateComplianceSettingsAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.complianceLegalHoldReason?.[0]).toContain(
        "required",
      );
    }
    expect(mocks.updateCompanyComplianceSettings).not.toHaveBeenCalled();
  });

  it("updates settings and writes audit log on success", async () => {
    const result = await updateComplianceSettingsAction(null, buildValidFormData());

    expect(result.success).toBe(true);
    expect(mocks.updateCompanyComplianceSettings).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        retention_days: 365,
        induction_retention_days: 365,
        audit_retention_days: 90,
        incident_retention_days: 1825,
        emergency_drill_retention_days: 1825,
        compliance_legal_hold: true,
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "settings.update",
        entity_type: "Company",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });
});
