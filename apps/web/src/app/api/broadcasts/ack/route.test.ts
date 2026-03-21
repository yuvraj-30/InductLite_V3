import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBroadcastForAcknowledgement: vi.fn(),
  buildBroadcastAckToken: vi.fn(),
  findBroadcastRecipientByTokenHash: vi.fn(),
  updateBroadcastRecipientStatus: vi.fn(),
  createCommunicationEvent: vi.fn(),
  createAuditLog: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  getUserAgentFromHeaders: vi.fn(),
}));

vi.mock("@/lib/db/scoped", () => ({
  findBroadcastForAcknowledgement: mocks.findBroadcastForAcknowledgement,
}));

vi.mock("@/lib/repository/communication.repository", () => ({
  buildBroadcastAckToken: mocks.buildBroadcastAckToken,
  createCommunicationEvent: mocks.createCommunicationEvent,
  findBroadcastRecipientByTokenHash: mocks.findBroadcastRecipientByTokenHash,
  updateBroadcastRecipientStatus: mocks.updateBroadcastRecipientStatus,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/auth/csrf", () => ({
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
  getUserAgentFromHeaders: mocks.getUserAgentFromHeaders,
}));

import { GET } from "./route";

function nextRequest(url: string): any {
  const parsed = new URL(url);
  return {
    nextUrl: parsed,
    headers: new Headers(),
  };
}

describe("GET /api/broadcasts/ack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBroadcastForAcknowledgement.mockResolvedValue({
      id: "broadcast-1",
      company_id: "company-1",
      site_id: "cm0000000000000000000001",
    });
    mocks.buildBroadcastAckToken.mockReturnValue("hashed-token");
    mocks.findBroadcastRecipientByTokenHash.mockResolvedValue({
      id: "rec-1",
      broadcast_id: "broadcast-1",
      channel: "EMAIL",
      status: "DELIVERED",
      recipient_email: "person@example.test",
      recipient_phone: null,
    });
    mocks.updateBroadcastRecipientStatus.mockResolvedValue({});
    mocks.createCommunicationEvent.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
    mocks.getClientIpFromHeaders.mockReturnValue("127.0.0.1");
    mocks.getUserAgentFromHeaders.mockReturnValue("test-agent");
  });

  it("returns 400 when required query params are missing", async () => {
    const response = await GET(nextRequest("http://localhost/api/broadcasts/ack"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("returns duplicate response when already acknowledged", async () => {
    mocks.findBroadcastRecipientByTokenHash.mockResolvedValue({
      id: "rec-1",
      broadcast_id: "broadcast-1",
      channel: "EMAIL",
      status: "ACKNOWLEDGED",
      recipient_email: "person@example.test",
      recipient_phone: null,
    });

    const response = await GET(
      nextRequest(
        "http://localhost/api/broadcasts/ack?broadcast=broadcast-1&channel=email&token=abc123",
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(mocks.updateBroadcastRecipientStatus).not.toHaveBeenCalled();
  });

  it("records acknowledgement and audit log for valid token", async () => {
    const response = await GET(
      nextRequest(
        "http://localhost/api/broadcasts/ack?broadcast=broadcast-1&channel=email&token=abc123",
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.acknowledged).toBe(true);
    expect(mocks.updateBroadcastRecipientStatus).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        recipient_id: "rec-1",
        status: "ACKNOWLEDGED",
      }),
    );
    expect(mocks.createCommunicationEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });
});
