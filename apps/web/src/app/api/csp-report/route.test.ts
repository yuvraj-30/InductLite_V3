import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRequestLogger: vi.fn(),
  generateRequestId: vi.fn(),
  checkCspReportRateLimit: vi.fn(),
  getStableClientKey: vi.fn(),
  logger: { warn: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkCspReportRateLimit: mocks.checkCspReportRateLimit,
}));

vi.mock("@/lib/rate-limit/clientKey", () => ({
  getStableClientKey: mocks.getStableClientKey,
}));

import { GET, POST } from "./route";

describe("csp report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.getStableClientKey.mockReturnValue("client-1");
    mocks.checkCspReportRateLimit.mockResolvedValue({ success: true });
  });

  it("returns 204 for GET", async () => {
    const res = await GET();
    expect(res.status).toBe(204);
  });

  it("returns 204 and logs sanitized violation payload", async () => {
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        "csp-report": {
          "blocked-uri": "https://evil.example.test/path?token=abc#frag",
          "document-uri": "https://app.example.test/page?x=1",
          "effective-directive": "script-src",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "csp_violation",
        effectiveDirective: "script-src",
        blocked: "https://evil.example.test/path",
        document: "https://app.example.test/page",
      }),
      "CSP violation report",
    );
  });

  it("returns 204 when rate limit is exceeded", async () => {
    mocks.checkCspReportRateLimit.mockResolvedValue({ success: false });
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });
});
