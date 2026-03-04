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
  headers: vi.fn(),
  assertOrigin: vi.fn(),
  checkSitePermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  createPreRegistrationInvite: vi.fn(),
  deactivatePreRegistrationInvite: vi.fn(),
  queueEmailNotification: vi.fn(),
  findSiteById: vi.fn(),
  createPublicLinkForSite: vi.fn(),
  findActivePublicLinkForSite: vi.fn(),
  createAuditLog: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
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

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkSitePermission: mocks.checkSitePermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository", () => ({
  createPreRegistrationInvite: mocks.createPreRegistrationInvite,
  deactivatePreRegistrationInvite: mocks.deactivatePreRegistrationInvite,
  queueEmailNotification: mocks.queueEmailNotification,
  findSiteById: mocks.findSiteById,
}));

vi.mock("@/lib/repository/site.repository", () => ({
  createPublicLinkForSite: mocks.createPublicLinkForSite,
  findActivePublicLinkForSite: mocks.findActivePublicLinkForSite,
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
  bulkCreatePreRegistrationInvitesAction,
  createPreRegistrationInviteAction,
  deactivatePreRegistrationInviteAction,
} from "./actions";

describe("pre-registration actions", () => {
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
    mocks.findSiteById.mockResolvedValue({
      id: "site-1",
      name: "Site One",
    });
    mocks.createPreRegistrationInvite.mockResolvedValue({
      invite: {
        id: "invite-1",
        visitor_name: "John Worker",
        visitor_type: "CONTRACTOR",
        expires_at: new Date("2026-03-10T00:00:00Z"),
      },
      inviteToken: "token-1234567890123456",
    });
    mocks.findActivePublicLinkForSite.mockResolvedValue({ slug: "slug-1" });
    mocks.createPublicLinkForSite.mockResolvedValue({ slug: "slug-1" });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.headers.mockResolvedValue(
      new Headers({
        host: "example.com",
        "x-forwarded-proto": "https",
      }),
    );
    mocks.deactivatePreRegistrationInvite.mockResolvedValue(true);
    mocks.queueEmailNotification.mockResolvedValue(undefined);
  });

  it("creates invite and returns invite link", async () => {
    const formData = new FormData();
    formData.set("siteId", "c123456789012345678901234");
    formData.set("visitorName", "John Worker");
    formData.set("visitorPhone", "0211234567");
    formData.set("visitorType", "CONTRACTOR");

    const result = await createPreRegistrationInviteAction(null, formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.inviteLink).toContain("/s/slug-1?invite=");
    }
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "preregistration.create",
      }),
    );
  });

  it("returns error when prereg entitlement is disabled", async () => {
    mocks.assertCompanyFeatureEnabled.mockRejectedValue(
      new mocks.EntitlementDeniedError("PREREG_INVITES"),
    );

    const formData = new FormData();
    formData.set("siteId", "c123456789012345678901234");
    formData.set("visitorName", "John Worker");
    formData.set("visitorPhone", "0211234567");
    formData.set("visitorType", "CONTRACTOR");

    const result = await createPreRegistrationInviteAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Pre-registration invites are disabled");
    }
    expect(mocks.createPreRegistrationInvite).not.toHaveBeenCalled();
  });

  it("deactivates invite and writes audit log", async () => {
    const result = await deactivatePreRegistrationInviteAction(
      "invite-1",
      "site-1",
    );

    expect(result.success).toBe(true);
    expect(mocks.deactivatePreRegistrationInvite).toHaveBeenCalledWith(
      "company-1",
      "invite-1",
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "preregistration.deactivate",
        entity_id: "invite-1",
      }),
    );
  });

  it("bulk creates invites and returns summary", async () => {
    mocks.createPreRegistrationInvite
      .mockResolvedValueOnce({
        invite: {
          id: "invite-1",
          visitor_name: "John Worker",
          visitor_type: "CONTRACTOR",
          expires_at: new Date("2026-03-10T00:00:00Z"),
        },
        inviteToken: "token-1111111111111111",
      })
      .mockResolvedValueOnce({
        invite: {
          id: "invite-2",
          visitor_name: "Jane Visitor",
          visitor_type: "VISITOR",
          expires_at: new Date("2026-03-10T00:00:00Z"),
        },
        inviteToken: "token-2222222222222222",
      });

    const formData = new FormData();
    formData.set("siteId", "c123456789012345678901234");
    formData.set(
      "csvData",
      [
        "visitorName,visitorPhone,visitorEmail,visitorType",
        "John Worker,0211234567,john@example.com,CONTRACTOR",
        "Jane Visitor,0217654321,jane@example.com,VISITOR",
      ].join("\n"),
    );
    formData.set("sendInviteEmail", "on");

    const result = await bulkCreatePreRegistrationInvitesAction(null, formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.created).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.created[0]?.inviteLink).toContain("/s/slug-1?invite=");
    }

    expect(mocks.createPreRegistrationInvite).toHaveBeenCalledTimes(2);
    expect(mocks.queueEmailNotification).toHaveBeenCalledTimes(2);
  });

  it("bulk action reports row failures", async () => {
    mocks.createPreRegistrationInvite.mockResolvedValue({
      invite: {
        id: "invite-1",
        visitor_name: "John Worker",
        visitor_type: "CONTRACTOR",
        expires_at: new Date("2026-03-10T00:00:00Z"),
      },
      inviteToken: "token-1111111111111111",
    });

    const formData = new FormData();
    formData.set("siteId", "c123456789012345678901234");
    formData.set(
      "csvData",
      [
        "visitorName,visitorPhone,visitorType",
        "John Worker,0211234567,CONTRACTOR",
        "Bad Row,abc123,CONTRACTOR",
      ].join("\n"),
    );

    const result = await bulkCreatePreRegistrationInvitesAction(null, formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.created).toHaveLength(1);
      expect(result.failed.length).toBeGreaterThanOrEqual(1);
    }
  });
});
