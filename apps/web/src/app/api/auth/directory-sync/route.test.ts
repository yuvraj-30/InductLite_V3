import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyDirectorySyncBatch: vi.fn(),
  parseCompanySsoConfig: vi.fn(),
  verifyDirectorySyncApiKey: vi.fn(),
  createRequestLogger: vi.fn(),
  createSystemAuditLog: vi.fn(),
  findCompanySsoSettingsBySlug: vi.fn(),
  generateRequestId: vi.fn(),
}));

vi.mock("@/lib/identity", () => ({
  applyDirectorySyncBatch: mocks.applyDirectorySyncBatch,
  parseCompanySsoConfig: mocks.parseCompanySsoConfig,
  verifyDirectorySyncApiKey: mocks.verifyDirectorySyncApiKey,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createSystemAuditLog: mocks.createSystemAuditLog,
}));

vi.mock("@/lib/repository/company.repository", () => ({
  findCompanySsoSettingsBySlug: mocks.findCompanySsoSettingsBySlug,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

import { POST } from "./route";

describe("api/auth/directory-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    });
    mocks.findCompanySsoSettingsBySlug.mockResolvedValue({
      id: "company-1",
      name: "BuildRight NZ",
      slug: "buildright-nz",
      sso_config: {},
    });
    mocks.parseCompanySsoConfig.mockReturnValue({
      enabled: true,
      provider: "MICROSOFT_ENTRA",
      displayName: "BuildRight SSO",
      issuerUrl: "https://login.microsoftonline.com/tenant/v2.0",
      clientId: "client-1",
      clientSecretEncrypted: "enc-secret",
      scopes: ["openid", "profile", "email"],
      autoProvisionUsers: true,
      defaultRole: "VIEWER",
      roleClaimPath: "roles",
      roleMapping: { ADMIN: ["admin"], SITE_MANAGER: ["manager"], VIEWER: ["viewer"] },
      allowedEmailDomains: [],
      directorySync: { enabled: true, tokenHash: "hash-1" },
    });
    mocks.verifyDirectorySyncApiKey.mockReturnValue(true);
    mocks.applyDirectorySyncBatch.mockResolvedValue({
      created: 1,
      updated: 0,
      deactivated: 0,
      skipped: 0,
    });
    mocks.createSystemAuditLog.mockResolvedValue(undefined);
  });

  it("rejects invalid bearer token", async () => {
    mocks.verifyDirectorySyncApiKey.mockReturnValue(false);

    const response = await POST(
      new Request("https://example.com/api/auth/directory-sync?company=buildright-nz", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [{ externalId: "u1", email: "one@example.com", name: "One" }],
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("applies sync batch and returns summary", async () => {
    const response = await POST(
      new Request("https://example.com/api/auth/directory-sync?company=buildright-nz", {
        method: "POST",
        headers: {
          Authorization: "Bearer idsync-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [{ externalId: "u1", email: "one@example.com", name: "One" }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        created: 1,
      }),
    );
    expect(mocks.applyDirectorySyncBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        provider: "MICROSOFT_ENTRA",
      }),
    );
    expect(mocks.createSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.directory_sync",
      }),
    );
  });
});
