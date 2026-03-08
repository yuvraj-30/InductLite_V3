import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  verifyEvidenceSignature: vi.fn(),
  computeEvidenceHashRoot: vi.fn(),
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

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

vi.mock("@/lib/repository/evidence.repository", () => ({
  verifyEvidenceSignature: mocks.verifyEvidenceSignature,
  computeEvidenceHashRoot: mocks.computeEvidenceHashRoot,
}));

import { GET, POST } from "./route";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);

describe("evidence verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.verifyEvidenceSignature.mockReturnValue(true);
    mocks.computeEvidenceHashRoot.mockReturnValue(hashA);
  });

  it("returns 400 for invalid GET payload", async () => {
    const req = {
      nextUrl: new URL("http://localhost/api/evidence/verify?companyId=bad"),
    } as any;
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("returns 403 when rollout flag is disabled", async () => {
    mocks.isFeatureEnabled.mockReturnValue(false);
    const req = {
      nextUrl: new URL(
        `http://localhost/api/evidence/verify?companyId=company-1&hashRoot=${hashA}&signature=${hashB}`,
      ),
    } as any;

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("verifies POST payload against signature and artifact hash root", async () => {
    mocks.computeEvidenceHashRoot.mockReturnValue(hashA);
    mocks.verifyEvidenceSignature.mockReturnValue(true);

    const req = new Request("http://localhost/api/evidence/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: "company-1",
        hashRoot: hashA,
        signature: hashB,
        artifactHashes: [hashC, hashB],
      }),
    });

    const res = await POST(req as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.verified).toBe(true);
    expect(body.signatureValid).toBe(true);
    expect(body.hashRootMatchesArtifacts).toBe(true);
    expect(mocks.computeEvidenceHashRoot).toHaveBeenCalledWith([hashC, hashB]);
  });
});
