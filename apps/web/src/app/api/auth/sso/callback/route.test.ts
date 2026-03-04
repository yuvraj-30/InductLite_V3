import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  establishAuthenticatedSession: vi.fn(),
  getSession: vi.fn(),
  generateRequestId: vi.fn(),
  decryptClientSecret: vi.fn(),
  discoverOidcConfiguration: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  isEmailDomainAllowed: vi.fn(),
  parseCompanySsoConfig: vi.fn(),
  resolveRoleFromClaims: vi.fn(),
  upsertIdentityUser: vi.fn(),
  verifyIdToken: vi.fn(),
  createRequestLogger: vi.fn(),
  createAuditLog: vi.fn(),
  findCompanySsoSettings: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  establishAuthenticatedSession: mocks.establishAuthenticatedSession,
  getSession: mocks.getSession,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/identity", () => ({
  decryptClientSecret: mocks.decryptClientSecret,
  discoverOidcConfiguration: mocks.discoverOidcConfiguration,
  exchangeAuthorizationCode: mocks.exchangeAuthorizationCode,
  isEmailDomainAllowed: mocks.isEmailDomainAllowed,
  parseCompanySsoConfig: mocks.parseCompanySsoConfig,
  resolveRoleFromClaims: mocks.resolveRoleFromClaims,
  upsertIdentityUser: mocks.upsertIdentityUser,
  verifyIdToken: mocks.verifyIdToken,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/company.repository", () => ({
  findCompanySsoSettings: mocks.findCompanySsoSettings,
}));

vi.mock("@/lib/url/public-url", () => ({
  buildPublicUrl: (path: string, requestUrl?: string) =>
    new URL(path, requestUrl ?? "https://example.com"),
}));

import { GET } from "./route";

describe("api/auth/sso/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    });
    mocks.findCompanySsoSettings.mockResolvedValue({
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
    mocks.decryptClientSecret.mockReturnValue("client-secret");
    mocks.discoverOidcConfiguration.mockResolvedValue({
      issuer: "https://login.microsoftonline.com/tenant/v2.0",
      authorization_endpoint: "https://idp.example.com/authorize",
      token_endpoint: "https://idp.example.com/token",
      jwks_uri: "https://idp.example.com/jwks",
    });
    mocks.exchangeAuthorizationCode.mockResolvedValue({
      id_token: "id-token",
    });
    mocks.verifyIdToken.mockResolvedValue({
      payload: {
        sub: "subject-1",
        email: "user@example.com",
        name: "SSO User",
      },
    });
    mocks.isEmailDomainAllowed.mockReturnValue(true);
    mocks.resolveRoleFromClaims.mockReturnValue("ADMIN");
    mocks.upsertIdentityUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "SSO User",
      role: "ADMIN",
      created: true,
    });
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it("rejects mismatched state", async () => {
    const session = {
      pendingSso: {
        companyId: "company-1",
        companySlug: "buildright-nz",
        state: "expected-state",
        nonce: "nonce-1",
        returnTo: "/admin/dashboard",
        createdAt: Date.now(),
      },
      save: vi.fn(),
    };
    mocks.getSession.mockResolvedValue(session);

    const response = await GET(
      new Request("https://example.com/api/auth/sso/callback?state=wrong&code=abc"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("sso=state_invalid");
    expect(session.save).toHaveBeenCalledTimes(1);
  });

  it("establishes session and redirects on successful callback", async () => {
    const session = {
      pendingSso: {
        companyId: "company-1",
        companySlug: "buildright-nz",
        state: "state-1",
        nonce: "nonce-1",
        returnTo: "/admin/dashboard",
        createdAt: Date.now(),
      },
      save: vi.fn(),
    };
    mocks.getSession.mockResolvedValue(session);

    const response = await GET(
      new Request(
        "https://example.com/api/auth/sso/callback?state=state-1&code=auth-code",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/admin/dashboard",
    );
    expect(mocks.establishAuthenticatedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        companyId: "company-1",
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "auth.sso_login",
      }),
    );
  });
});
