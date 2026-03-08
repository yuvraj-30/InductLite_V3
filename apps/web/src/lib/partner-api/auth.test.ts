import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findCompanySsoSettingsBySlug: vi.fn(),
  parseCompanySsoConfig: vi.fn(),
  verifyPartnerApiKey: vi.fn(),
}));

vi.mock("@/lib/repository/company.repository", () => ({
  findCompanySsoSettingsBySlug: mocks.findCompanySsoSettingsBySlug,
}));

vi.mock("@/lib/identity", () => ({
  parseCompanySsoConfig: mocks.parseCompanySsoConfig,
  verifyPartnerApiKey: mocks.verifyPartnerApiKey,
}));

import { authenticatePartnerApiRequest } from "./auth";

describe("authenticatePartnerApiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCompanySsoSettingsBySlug.mockResolvedValue({
      id: "company-1",
      slug: "buildright",
      sso_config: {},
    });
    mocks.parseCompanySsoConfig.mockReturnValue({
      partnerApi: {
        enabled: true,
        tokenHash: "hash-1",
        scopes: ["sites.read", "signins.read"],
        monthlyQuota: 10000,
      },
    });
    mocks.verifyPartnerApiKey.mockReturnValue(true);
  });

  it("returns 400 when company query parameter is missing", async () => {
    const req = new Request("https://example.test/api/v1/partner/sites", {
      headers: { authorization: "Bearer key-1" },
    });

    const result = await authenticatePartnerApiRequest(req, "sites.read");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it("returns 403 when required scope is missing", async () => {
    mocks.parseCompanySsoConfig.mockReturnValueOnce({
      partnerApi: {
        enabled: true,
        tokenHash: "hash-1",
        scopes: ["sites.read"],
        monthlyQuota: 10000,
      },
    });
    const req = new Request(
      "https://example.test/api/v1/partner/sign-ins?company=buildright",
      {
        headers: { authorization: "Bearer key-1" },
      },
    );

    const result = await authenticatePartnerApiRequest(req, "signins.read");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns auth context when token and scope are valid", async () => {
    const req = new Request(
      "https://example.test/api/v1/partner/sites?company=buildright",
      {
        headers: { authorization: "Bearer key-1" },
      },
    );

    const result = await authenticatePartnerApiRequest(req, "sites.read");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe("company-1");
      expect(result.context.scope).toBe("sites.read");
      expect(result.context.monthlyQuota).toBe(10000);
      expect(result.context.tokenFingerprint.length).toBe(16);
    }
  });
});
