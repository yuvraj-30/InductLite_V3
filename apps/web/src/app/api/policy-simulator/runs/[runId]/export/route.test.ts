import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkPermissionReadOnly: vi.fn(),
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  findPolicySimulationRunById: vi.fn(),
  findPolicySimulationResultByRunId: vi.fn(),
  findPolicySimulationById: vi.fn(),
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
}));

vi.mock("@/lib/auth", () => ({
  checkPermissionReadOnly: mocks.checkPermissionReadOnly,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/repository/policy-simulator.repository", () => ({
  findPolicySimulationRunById: mocks.findPolicySimulationRunById,
  findPolicySimulationResultByRunId: mocks.findPolicySimulationResultByRunId,
  findPolicySimulationById: mocks.findPolicySimulationById,
}));

import { GET } from "./route";

describe("policy simulator export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPermissionReadOnly.mockResolvedValue({
      success: true,
      user: { companyId: "company-1" },
    });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.findPolicySimulationRunById.mockResolvedValue({
      id: "run-1",
      policy_simulation_id: "sim-1",
      status: "SUCCEEDED",
      created_at: new Date("2026-03-08T00:00:00.000Z"),
      started_at: new Date("2026-03-08T00:01:00.000Z"),
      completed_at: new Date("2026-03-08T00:02:00.000Z"),
      requested_by: "user-1",
    });
    mocks.findPolicySimulationResultByRunId.mockResolvedValue({
      policy_simulation_run_id: "run-1",
      blocked_entries_estimate: 3,
      approval_load_estimate: 2,
      false_positive_estimate: 1,
      summary: { a: 1 },
      breakdown: { b: 2 },
      created_at: new Date("2026-03-08T00:02:00.000Z"),
    });
    mocks.findPolicySimulationById.mockResolvedValue({
      id: "sim-1",
      name: "Scenario",
      scenario: { lookbackDays: 30 },
      created_at: new Date("2026-03-07T00:00:00.000Z"),
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mocks.checkPermissionReadOnly.mockResolvedValue({
      success: false,
      code: "UNAUTHENTICATED",
      error: "Authentication required",
    });

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ runId: "run-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 404 when run is missing", async () => {
    mocks.findPolicySimulationRunById.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ runId: "run-404" }),
    });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns JSON export payload when data exists", async () => {
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ runId: "run-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toContain(
      "policy-simulation-run-1.json",
    );
    const text = await res.text();
    expect(text).toContain("\"run\"");
    expect(text).toContain("\"result\"");
  });
});
