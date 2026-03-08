import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseProcoreConnectorConfig: vi.fn(),
  findSiteById: vi.fn(),
  listContractors: vi.fn(),
  upsertContractorPrequalification: vi.fn(),
  createCommunicationEvent: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/integrations/procore/config", () => ({
  parseProcoreConnectorConfig: mocks.parseProcoreConnectorConfig,
}));

vi.mock("@/lib/repository/site.repository", () => ({
  findSiteById: mocks.findSiteById,
}));

vi.mock("@/lib/repository/contractor.repository", () => ({
  listContractors: mocks.listContractors,
}));

vi.mock("@/lib/repository/permit.repository", () => ({
  upsertContractorPrequalification: mocks.upsertContractorPrequalification,
}));

vi.mock("@/lib/repository/communication.repository", () => ({
  createCommunicationEvent: mocks.createCommunicationEvent,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { POST } from "./route";

describe("POST /api/integrations/procore/workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSiteById.mockResolvedValue({
      id: "cm0000000000000000000001",
      lms_connector: {},
    });
    mocks.parseProcoreConnectorConfig.mockReturnValue({
      enabled: true,
      inboundSharedSecret: "shared-secret",
    });
    mocks.listContractors.mockResolvedValue({
      items: [
        {
          id: "ctr-1",
          name: "Acme Electrical",
          contact_email: "ops@acme.test",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    });
    mocks.upsertContractorPrequalification.mockResolvedValue({});
    mocks.createCommunicationEvent.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns 400 for invalid payload", async () => {
    const req = new Request("http://localhost/api/integrations/procore/workers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("returns 401 when bearer token does not match shared secret", async () => {
    const req = new Request("http://localhost/api/integrations/procore/workers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong-secret",
      },
      body: JSON.stringify({
        companyId: "cm0000000000000000000002",
        siteId: "cm0000000000000000000001",
        profiles: [
          {
            externalId: "ext-1",
            contractorName: "Acme Electrical",
            contractorEmail: "ops@acme.test",
            status: "approved",
          },
        ],
      }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("applies matching profiles and returns summary", async () => {
    const req = new Request("http://localhost/api/integrations/procore/workers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer shared-secret",
      },
      body: JSON.stringify({
        companyId: "cm0000000000000000000002",
        siteId: "cm0000000000000000000001",
        provider: "PROCORE",
        profiles: [
          {
            externalId: "ext-1",
            contractorName: "Acme Electrical",
            contractorEmail: "ops@acme.test",
            status: "approved",
            score: 90,
          },
        ],
      }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.received).toBe(1);
    expect(body.applied).toBe(1);
    expect(body.unmatched).toBe(0);
    expect(mocks.upsertContractorPrequalification).toHaveBeenCalledTimes(1);
    expect(mocks.createCommunicationEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });
});
