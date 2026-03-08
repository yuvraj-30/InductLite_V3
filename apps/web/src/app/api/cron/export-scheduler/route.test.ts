import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processNextExportJob: vi.fn(),
  requireCronSecret: vi.fn(),
  log: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/export/runner", () => ({
  processNextExportJob: mocks.processNextExportJob,
}));

vi.mock("@/lib/cron", () => ({
  requireCronSecret: mocks.requireCronSecret,
}));

import { GET } from "./route";

describe("GET /api/cron/export-scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCronSecret.mockResolvedValue({
      ok: true,
      response: null,
      log: mocks.log,
    });
    mocks.processNextExportJob.mockResolvedValue({ status: "DONE", id: "job-1" });
  });

  it("returns auth response when cron secret is invalid", async () => {
    mocks.requireCronSecret.mockResolvedValue({
      ok: false,
      response: Response.json({ ok: false }, { status: 401 }),
      log: mocks.log,
    });

    const res = await GET(new Request("http://localhost/api/cron/export-scheduler"));
    expect(res.status).toBe(401);
  });

  it("returns processed=true when export job was processed", async () => {
    const res = await GET(new Request("http://localhost/api/cron/export-scheduler"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(true);
    expect(body.result.status).toBe("DONE");
    expect(mocks.log.info).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when export processing throws", async () => {
    mocks.processNextExportJob.mockRejectedValue(new Error("fail"));

    const res = await GET(new Request("http://localhost/api/cron/export-scheduler"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Export cron failed");
    expect(mocks.log.error).toHaveBeenCalledTimes(1);
  });
});
