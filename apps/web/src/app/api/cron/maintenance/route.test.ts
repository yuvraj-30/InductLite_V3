import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runRetentionTasks: vi.fn(),
  processEmailQueue: vi.fn(),
  processOutboundWebhookQueue: vi.fn(),
  runMarketOpsJobs: vi.fn(),
  requireCronSecret: vi.fn(),
  log: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/maintenance/retention", () => ({
  runRetentionTasks: mocks.runRetentionTasks,
}));

vi.mock("@/lib/email/worker", () => ({
  processEmailQueue: mocks.processEmailQueue,
}));

vi.mock("@/lib/webhook/worker", () => ({
  processOutboundWebhookQueue: mocks.processOutboundWebhookQueue,
}));

vi.mock("@/lib/operations/market-ops", () => ({
  runMarketOpsJobs: mocks.runMarketOpsJobs,
}));

vi.mock("@/lib/cron", () => ({
  requireCronSecret: mocks.requireCronSecret,
}));

import { GET } from "./route";

describe("GET /api/cron/maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCronSecret.mockResolvedValue({
      ok: true,
      response: null,
      log: mocks.log,
    });
    mocks.runRetentionTasks.mockResolvedValue(undefined);
    mocks.processEmailQueue.mockResolvedValue(undefined);
    mocks.processOutboundWebhookQueue.mockResolvedValue({
      processed: 2,
      failed: 0,
      skipped: 0,
    });
    mocks.runMarketOpsJobs.mockResolvedValue({
      alertsSent: 1,
      digestsSent: 2,
    });
  });

  it("returns auth response when cron secret is invalid", async () => {
    mocks.requireCronSecret.mockResolvedValue({
      ok: false,
      response: Response.json({ ok: false }, { status: 401 }),
      log: mocks.log,
    });

    const res = await GET(new Request("http://localhost/api/cron/maintenance"));
    expect(res.status).toBe(401);
  });

  it("returns maintenance summary on success", async () => {
    const res = await GET(new Request("http://localhost/api/cron/maintenance"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.email_queue_processed).toBe(true);
    expect(body.webhook_summary.processed).toBe(2);
    expect(body.market_ops_summary.alertsSent).toBe(1);
    expect(mocks.log.info).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when maintenance fails", async () => {
    mocks.runRetentionTasks.mockRejectedValue(new Error("fail"));

    const res = await GET(new Request("http://localhost/api/cron/maintenance"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Maintenance cron failed");
    expect(mocks.log.error).toHaveBeenCalledTimes(1);
  });
});
