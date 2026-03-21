import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/webhook-delivery.repository", () => ({
  listDueOutboundWebhookDeliveries: vi.fn(),
  claimOutboundWebhookDelivery: vi.fn(),
  markOutboundWebhookDeliverySent: vi.fn(),
  markOutboundWebhookDeliveryRetriableFailure: vi.fn(),
}));

const scopedDelegates = vi.hoisted(() => ({
  site: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  accessConnectorConfig: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(() => scopedDelegates),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: vi.fn().mockReturnValue("req-webhook-worker-test"),
}));

import {
  claimOutboundWebhookDelivery,
  listDueOutboundWebhookDeliveries,
  markOutboundWebhookDeliveryRetriableFailure,
  markOutboundWebhookDeliverySent,
} from "@/lib/repository/webhook-delivery.repository";
import { scopedDb } from "@/lib/db/scoped-db";
import { processOutboundWebhookQueue } from "../worker";

describe("processOutboundWebhookQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBHOOK_SIGNING_SECRET = "";
    vi.mocked(scopedDb).mockReturnValue(
      scopedDelegates as unknown as ReturnType<typeof scopedDb>,
    );
    vi.mocked(scopedDelegates.site.findFirst).mockResolvedValue(null);
    vi.mocked(scopedDelegates.accessConnectorConfig.findFirst).mockResolvedValue(null);
  });

  it("sends due webhooks and marks successful deliveries", async () => {
    process.env.WEBHOOK_SIGNING_SECRET = "test-signing-secret";
    vi.mocked(listDueOutboundWebhookDeliveries).mockResolvedValue([
      {
        id: "delivery-1",
        company_id: "company-1",
        site_id: "site-1",
        event_type: "induction.completed",
        target_url: "https://example.com/hook",
        payload: { event: "induction.completed", data: { signInRecordId: "r-1" } },
        status: "PENDING",
        attempts: 0,
        max_attempts: 5,
      },
    ]);
    vi.mocked(claimOutboundWebhookDelivery).mockResolvedValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("ok"),
    } as unknown as Response);

    const summary = await processOutboundWebhookQueue(
      new Date("2026-02-28T12:00:00.000Z"),
    );

    expect(summary).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 1,
      retried: 0,
      deadLettered: 0,
    });
    expect(markOutboundWebhookDeliverySent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "delivery-1",
        statusCode: 200,
      }),
    );
    expect(markOutboundWebhookDeliveryRetriableFailure).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-InductLite-Signature": expect.stringMatching(/^sha256=/),
        }),
      }),
    );
  });

  it("schedules retries on non-2xx responses", async () => {
    vi.mocked(listDueOutboundWebhookDeliveries).mockResolvedValue([
      {
        id: "delivery-2",
        company_id: "company-1",
        site_id: "site-1",
        event_type: "induction.completed",
        target_url: "https://example.com/hook",
        payload: { event: "induction.completed", data: { signInRecordId: "r-2" } },
        status: "RETRYING",
        attempts: 1,
        max_attempts: 5,
      },
    ]);
    vi.mocked(claimOutboundWebhookDelivery).mockResolvedValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("service unavailable"),
    } as unknown as Response);

    const summary = await processOutboundWebhookQueue(
      new Date("2026-02-28T13:00:00.000Z"),
    );

    expect(summary).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 0,
      retried: 1,
      deadLettered: 0,
    });
    expect(markOutboundWebhookDeliveryRetriableFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "delivery-2",
        statusCode: 503,
        dead: false,
      }),
    );
  });

  it("prefers site-level webhook signing secret over env default", async () => {
    process.env.WEBHOOK_SIGNING_SECRET = "env-default-secret";
    vi.mocked(scopedDelegates.site.findFirst).mockResolvedValue({
      webhooks: {
        endpoints: [{ url: "https://example.com/hook", enabled: true }],
        signingSecret: "site-specific-signing-secret",
      },
    } as never);
    vi.mocked(listDueOutboundWebhookDeliveries).mockResolvedValue([
      {
        id: "delivery-4",
        company_id: "company-1",
        site_id: "site-1",
        event_type: "induction.completed",
        target_url: "https://example.com/hook",
        payload: { event: "induction.completed", data: { signInRecordId: "r-4" } },
        status: "PENDING",
        attempts: 0,
        max_attempts: 5,
      },
    ]);
    vi.mocked(claimOutboundWebhookDelivery).mockResolvedValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("ok"),
    } as unknown as Response);

    await processOutboundWebhookQueue(new Date("2026-02-28T15:00:00.000Z"));

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-InductLite-Signature": expect.any(String),
        }),
      }),
    );
    expect(scopedDelegates.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "site-1",
          company_id: "company-1",
        },
      }),
    );
  });

  it("dead-letters when final attempt fails", async () => {
    vi.mocked(listDueOutboundWebhookDeliveries).mockResolvedValue([
      {
        id: "delivery-3",
        company_id: "company-1",
        site_id: "site-1",
        event_type: "induction.completed",
        target_url: "https://example.com/hook",
        payload: { event: "induction.completed", data: { signInRecordId: "r-3" } },
        status: "RETRYING",
        attempts: 4,
        max_attempts: 5,
      },
    ]);
    vi.mocked(claimOutboundWebhookDelivery).mockResolvedValue(true);
    global.fetch = vi.fn().mockRejectedValue(new Error("network timeout"));

    const summary = await processOutboundWebhookQueue(
      new Date("2026-02-28T14:00:00.000Z"),
    );

    expect(summary).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 0,
      retried: 0,
      deadLettered: 1,
    });
    expect(markOutboundWebhookDeliveryRetriableFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "delivery-3",
        dead: true,
      }),
    );
  });

  it("adds lms auth headers for lms completion events", async () => {
    vi.mocked(scopedDelegates.site.findFirst).mockResolvedValue({
      webhooks: null,
      lms_connector: {
        enabled: true,
        endpointUrl: "https://lms.example.test/sync",
        authToken: "lms-token-123456",
        provider: "Moodle",
      },
    } as never);
    vi.mocked(listDueOutboundWebhookDeliveries).mockResolvedValue([
      {
        id: "delivery-lms-1",
        company_id: "company-1",
        site_id: "site-1",
        event_type: "lms.completion",
        target_url: "https://lms.example.test/sync",
        payload: { event: "lms.completion", data: { signInRecordId: "r-9" } },
        status: "PENDING",
        attempts: 0,
        max_attempts: 5,
      },
    ]);
    vi.mocked(claimOutboundWebhookDelivery).mockResolvedValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("ok"),
    } as unknown as Response);

    const summary = await processOutboundWebhookQueue(
      new Date("2026-03-02T10:00:00.000Z"),
    );

    expect(summary.sent).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://lms.example.test/sync",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer lms-token-123456",
          "X-InductLite-Lms-Provider": "Moodle",
        }),
      }),
    );
  });

  it("adds hardware auth headers for hardware access events", async () => {
    vi.mocked(scopedDelegates.site.findFirst).mockResolvedValue({
      webhooks: null,
      lms_connector: null,
      access_control: {
        hardware: {
          enabled: true,
          endpointUrl: "https://hardware.example.test/events",
          authToken: "hardware-token-123",
          provider: "SITE_GATEWAY",
        },
      },
    } as never);
    vi.mocked(listDueOutboundWebhookDeliveries).mockResolvedValue([
      {
        id: "delivery-hardware-1",
        company_id: "company-1",
        site_id: "site-1",
        event_type: "hardware.access.decision",
        target_url: "https://hardware.example.test/events",
        payload: { event: "hardware.access.decision", decision: "ALLOW" },
        status: "PENDING",
        attempts: 0,
        max_attempts: 5,
      },
    ]);
    vi.mocked(claimOutboundWebhookDelivery).mockResolvedValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: vi.fn().mockResolvedValue("accepted"),
    } as unknown as Response);

    const summary = await processOutboundWebhookQueue(
      new Date("2026-03-02T10:00:00.000Z"),
    );

    expect(summary.sent).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://hardware.example.test/events",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer hardware-token-123",
          "X-InductLite-Hardware-Provider": "SITE_GATEWAY",
        }),
      }),
    );
  });
});
