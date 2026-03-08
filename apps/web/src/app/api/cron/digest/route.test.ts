import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processWeeklyDigest: vi.fn(),
  generateRequestId: vi.fn(),
  requireCronSecret: vi.fn(),
  log: { error: vi.fn() },
}));

vi.mock("@/lib/email/worker", () => ({
  processWeeklyDigest: mocks.processWeeklyDigest,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/cron", () => ({
  requireCronSecret: mocks.requireCronSecret,
}));

import { POST } from "./route";

describe("POST /api/cron/digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.requireCronSecret.mockResolvedValue({
      ok: true,
      response: null,
      log: mocks.log,
    });
    mocks.processWeeklyDigest.mockResolvedValue(undefined);
  });

  it("returns auth response when cron secret is invalid", async () => {
    mocks.requireCronSecret.mockResolvedValue({
      ok: false,
      response: Response.json({ ok: false }, { status: 401 }),
      log: mocks.log,
    });

    const res = await POST(new Request("http://localhost/api/cron/digest"));
    expect(res.status).toBe(401);
  });

  it("returns success when digest processing passes", async () => {
    const res = await POST(new Request("http://localhost/api/cron/digest"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.processWeeklyDigest).toHaveBeenCalledTimes(1);
  });

  it("returns 500 and logs when processing fails", async () => {
    mocks.processWeeklyDigest.mockRejectedValue(new Error("boom"));

    const res = await POST(new Request("http://localhost/api/cron/digest"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
    expect(body.requestId).toBe("req-1");
    expect(mocks.log.error).toHaveBeenCalledTimes(1);
  });
});
