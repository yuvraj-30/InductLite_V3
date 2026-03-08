import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  checkSitePermission: vi.fn(),
  isFeatureEnabled: vi.fn(),
  runIdentityOcrVerification: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: mocks.assertOrigin,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/auth", () => ({
  checkSitePermission: mocks.checkSitePermission,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/identity-ocr", () => ({
  runIdentityOcrVerification: mocks.runIdentityOcrVerification,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { POST } from "./route";

describe("POST /api/identity/ocr/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
      role: "ADMIN",
    });
    mocks.checkSitePermission.mockResolvedValue({ success: true });
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.runIdentityOcrVerification.mockResolvedValue({
      executed: true,
      decisionStatus: "APPROVED",
      reasonCode: "OCR_CONFIDENCE_PASS",
    });
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns 403 when rollout flag is disabled", async () => {
    mocks.isFeatureEnabled.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/identity/ocr/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId: "cm0000000000000000000001",
          visitorName: "Ari Contractor",
          documentImageDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
        }),
      }) as any,
    );

    expect(response.status).toBe(403);
  });

  it("returns OCR decision status when executed", async () => {
    const response = await POST(
      new Request("http://localhost/api/identity/ocr/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId: "cm0000000000000000000001",
          visitorName: "Ari Contractor",
          documentImageDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
          decisionMode: "assist",
        }),
      }) as any,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.decisionStatus).toBe("APPROVED");
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });
});

