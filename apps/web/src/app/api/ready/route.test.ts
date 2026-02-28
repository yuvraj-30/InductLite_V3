import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateEnv: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  checkReadinessRateLimit: vi.fn(),
  checkDatabaseReadiness: vi.fn(),
  getStableClientKey: vi.fn(),
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/env-validation", () => ({
  validateEnv: mocks.validateEnv,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkReadinessRateLimit: mocks.checkReadinessRateLimit,
}));

vi.mock("@/lib/db/readiness", () => ({
  checkDatabaseReadiness: mocks.checkDatabaseReadiness,
}));

vi.mock("@/lib/rate-limit/clientKey", () => ({
  getStableClientKey: mocks.getStableClientKey,
}));

import { GET } from "./route";

describe("GET /api/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateRequestId.mockReturnValue("req-ready-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.getStableClientKey.mockReturnValue("client-key-1");
    mocks.checkReadinessRateLimit.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
    });
    mocks.validateEnv.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });
    mocks.checkDatabaseReadiness.mockResolvedValue({
      ok: true,
      latency_ms: 10,
    });
  });

  it("returns 429 when readiness probe is rate limited", async () => {
    mocks.checkReadinessRateLimit.mockResolvedValue({
      success: false,
      limit: 120,
      remaining: 0,
      reset: Date.now() + 5_000,
    });

    const res = await GET(
      new Request("http://localhost/api/ready", {
        headers: { "user-agent": "test-agent" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(body).toMatchObject({ ready: false });
    expect(mocks.checkDatabaseReadiness).not.toHaveBeenCalled();
  });

  it("returns 503 when environment validation fails", async () => {
    mocks.validateEnv.mockReturnValue({
      valid: false,
      errors: [{ name: "DATABASE_URL", error: "missing" }],
      warnings: [],
    });

    const res = await GET(new Request("http://localhost/api/ready"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ ready: false });
    expect(mocks.checkDatabaseReadiness).not.toHaveBeenCalled();
  });

  it("returns 503 when database readiness fails", async () => {
    mocks.checkDatabaseReadiness.mockResolvedValue({
      ok: false,
      latency_ms: 8,
      error: "DB unavailable",
    });

    const res = await GET(new Request("http://localhost/api/ready"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ ready: false });
  });

  it("returns 200 when env and database checks pass", async () => {
    const res = await GET(new Request("http://localhost/api/ready"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ready: true });
  });
});
