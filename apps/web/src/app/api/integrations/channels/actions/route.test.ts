import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  assertCompanyFeatureEnabled: vi.fn(),
  publicDb: {
    channelIntegrationConfig: {
      findFirst: vi.fn(),
    },
  },
  createChannelDelivery: vi.fn(),
  createCommunicationEvent: vi.fn(),
  markChannelDeliveryStatus: vi.fn(),
  transitionVisitorApprovalRequest: vi.fn(),
  createAuditLog: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  getUserAgentFromHeaders: vi.fn(),
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

vi.mock("@/lib/db/public-db", () => ({
  publicDb: mocks.publicDb,
}));

vi.mock("@/lib/repository/communication.repository", () => ({
  createChannelDelivery: mocks.createChannelDelivery,
  createCommunicationEvent: mocks.createCommunicationEvent,
  markChannelDeliveryStatus: mocks.markChannelDeliveryStatus,
}));

vi.mock("@/lib/repository/visitor-approval.repository", () => ({
  transitionVisitorApprovalRequest: mocks.transitionVisitorApprovalRequest,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/auth/csrf", () => ({
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
  getUserAgentFromHeaders: mocks.getUserAgentFromHeaders,
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: mocks.EntitlementDeniedError,
  assertCompanyFeatureEnabled: mocks.assertCompanyFeatureEnabled,
}));

import { POST } from "./route";

const VALID_PAYLOAD = {
  integrationConfigId: "cm0000000000000000000009",
  actionId: "action-12345678",
  approvalRequestId: "cm0000000000000000000011",
  decision: "APPROVED",
  notes: "Approved from Slack action",
} as const;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("POST /api/integrations/channels/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFeatureEnabled.mockReturnValue(true);
    mocks.assertCompanyFeatureEnabled.mockResolvedValue({});
    mocks.publicDb.channelIntegrationConfig.findFirst.mockResolvedValue({
      id: "cm0000000000000000000009",
      company_id: "company-1",
      provider: "SLACK",
      signing_secret: "super-shared-secret",
      site_id: "cm0000000000000000000001",
    });
    mocks.createChannelDelivery.mockResolvedValue({ id: "delivery-1" });
    mocks.transitionVisitorApprovalRequest.mockResolvedValue({
      id: "cm0000000000000000000011",
      status: "APPROVED",
    });
    mocks.markChannelDeliveryStatus.mockResolvedValue({});
    mocks.createCommunicationEvent.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
    mocks.getClientIpFromHeaders.mockReturnValue("127.0.0.1");
    mocks.getUserAgentFromHeaders.mockReturnValue("test-agent");
  });

  it("returns 403 when signature is invalid", async () => {
    const body = JSON.stringify(VALID_PAYLOAD);
    const req = new Request("http://localhost/api/integrations/channels/actions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-inductlite-signature": "bad-signature",
      },
      body,
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.success).toBe(false);
  });

  it("returns duplicate=true when idempotency create fails", async () => {
    mocks.createChannelDelivery.mockRejectedValue(new Error("duplicate"));
    const body = JSON.stringify(VALID_PAYLOAD);
    const req = new Request("http://localhost/api/integrations/channels/actions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-inductlite-signature": sign(body, "super-shared-secret"),
      },
      body,
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.duplicate).toBe(true);
  });

  it("applies approval action and records side effects", async () => {
    const body = JSON.stringify(VALID_PAYLOAD);
    const req = new Request("http://localhost/api/integrations/channels/actions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-inductlite-signature": sign(body, "super-shared-secret"),
      },
      body,
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.duplicate).toBe(false);
    expect(payload.status).toBe("APPROVED");
    expect(mocks.createChannelDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.markChannelDeliveryStatus).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ status: "ACKNOWLEDGED" }),
    );
    expect(mocks.createCommunicationEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });
});
