import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  companyFindFirst: vi.fn(),
  companyUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db/public-db", () => ({
  publicDb: {
    company: {
      findFirst: mocks.companyFindFirst,
      updateMany: mocks.companyUpdateMany,
    },
  },
}));

import {
  findCompanyComplianceSettings,
  updateCompanyComplianceSettings,
} from "../company.repository";

describe("company.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns company compliance settings by company id", async () => {
    mocks.companyFindFirst.mockResolvedValue({
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

    const result = await findCompanyComplianceSettings("company-1");

    expect(result).toEqual(
      expect.objectContaining({
        id: "company-1",
        retention_days: 365,
        audit_retention_days: 90,
      }),
    );
    expect(mocks.companyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "company-1" },
      }),
    );
  });

  it("sets legal hold timestamp when enabling legal hold", async () => {
    mocks.companyFindFirst
      .mockResolvedValueOnce({
        compliance_legal_hold: false,
        compliance_legal_hold_set_at: null,
      })
      .mockResolvedValueOnce({
        id: "company-1",
        retention_days: 365,
        induction_retention_days: 365,
        audit_retention_days: 90,
        incident_retention_days: 1825,
        emergency_drill_retention_days: 1825,
        compliance_legal_hold: true,
        compliance_legal_hold_reason: "Regulator request",
        compliance_legal_hold_set_at: new Date("2026-02-23T00:00:00.000Z"),
      });
    mocks.companyUpdateMany.mockResolvedValue({ count: 1 });

    await updateCompanyComplianceSettings("company-1", {
      retention_days: 365,
      induction_retention_days: 365,
      audit_retention_days: 90,
      incident_retention_days: 1825,
      emergency_drill_retention_days: 1825,
      compliance_legal_hold: true,
      compliance_legal_hold_reason: "Regulator request",
    });

    expect(mocks.companyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "company-1" },
        data: expect.objectContaining({
          compliance_legal_hold: true,
          compliance_legal_hold_reason: "Regulator request",
          compliance_legal_hold_set_at: expect.any(Date),
        }),
      }),
    );
  });
});
