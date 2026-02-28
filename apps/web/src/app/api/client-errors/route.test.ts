import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: mocks.assertOrigin,
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

import { POST } from "./route";

describe("POST /api/client-errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-client-error-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("rejects requests with invalid origin", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const res = await POST(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "app-error-boundary",
          message: "boom",
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Invalid request origin");
  });

  it("rejects invalid JSON payloads", async () => {
    const res = await POST(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid-json",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON payload");
  });

  it("rejects malformed client error payloads", async () => {
    const res = await POST(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "app-error-boundary",
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid client error payload");
  });

  it("logs structured payload and returns 204 for valid events", async () => {
    const res = await POST(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "root-error-boundary",
          message: "Unhandled rendering error",
          digest: "digest-123",
          stack: "stack trace",
          path: "/admin/dashboard",
          userAgent: "Mozilla/5.0",
        }),
      }),
    );

    expect(res.status).toBe(204);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "client.error",
        source: "root-error-boundary",
        message: "Unhandled rendering error",
        digest: "digest-123",
        path: "/admin/dashboard",
        user_agent: "Mozilla/5.0",
      }),
      "Client error boundary event",
    );
  });
});
