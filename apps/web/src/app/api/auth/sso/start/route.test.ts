import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  generateRequestId: vi.fn(),
  parseCompanySsoConfig: vi.fn(),
  discoverOidcConfiguration: vi.fn(),
  buildOidcAuthorizationUrl: vi.fn(),
  createRequestLogger: vi.fn(),
  createAuditLog: vi.fn(),
  findCompanySsoSettingsBySlug: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/identity", () => ({
  parseCompanySsoConfig: mocks.parseCompanySsoConfig,
  discoverOidcConfiguration: mocks.discoverOidcConfiguration,
  buildOidcAuthorizationUrl: mocks.buildOidcAuthorizationUrl,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/company.repository", () => ({
  findCompanySsoSettingsBySlug: mocks.findCompanySsoSettingsBySlug,
}));

vi.mock("@/lib/url/public-url", () => ({
  buildPublicUrl: (path: string, requestUrl?: string) =>
    new URL(path, requestUrl ?? "https://example.com"),
}));

import { GET } from "./route";

describe("api/auth/sso/start", () => {
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
      directorySync: { enabled: false, tokenHash: null },
    });
    mocks.discoverOidcConfiguration.mockResolvedValue({
      issuer: "https://login.microsoftonline.com/tenant/v2.0",
      authorization_endpoint: "https://idp.example.com/authorize",
      token_endpoint: "https://idp.example.com/token",
      jwks_uri: "https://idp.example.com/jwks",
    });
    mocks.buildOidcAuthorizationUrl.mockReturnValue(
      "https://idp.example.com/authorize?state=state-1",
    );
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.getSession.mockResolvedValue({
      save: vi.fn(),
    });
  });

  it("redirects to login when workspace slug is missing", async () => {
    const response = await GET(new Request("https://example.com/api/auth/sso/start"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("sso=missing_workspace");
  });

  it("creates pending session state and redirects to provider", async () => {
    const session = { save: vi.fn() };
    mocks.getSession.mockResolvedValue(session);

    const response = await GET(
      new Request(
        "https://example.com/api/auth/sso/start?company=buildright-nz&returnTo=/admin/dashboard",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://idp.example.com/authorize?state=state-1",
    );
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "auth.sso_start",
      }),
    );
  });

  it("redirects to login when client secret is missing", async () => {
    mocks.parseCompanySsoConfig.mockReturnValueOnce({
      enabled: true,
      provider: "MICROSOFT_ENTRA",
      displayName: "BuildRight SSO",
      issuerUrl: "https://login.microsoftonline.com/tenant/v2.0",
      clientId: "client-1",
      clientSecretEncrypted: null,
      scopes: ["openid", "profile", "email"],
      autoProvisionUsers: true,
      defaultRole: "VIEWER",
      roleClaimPath: "roles",
      roleMapping: { ADMIN: ["admin"], SITE_MANAGER: ["manager"], VIEWER: ["viewer"] },
      allowedEmailDomains: [],
      directorySync: { enabled: false, tokenHash: null },
    });

    const response = await GET(
      new Request("https://example.com/api/auth/sso/start?company=buildright-nz"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("sso=not_configured");
    expect(mocks.buildOidcAuthorizationUrl).not.toHaveBeenCalled();
  });
});
