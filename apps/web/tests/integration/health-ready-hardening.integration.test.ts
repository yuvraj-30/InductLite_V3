import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  })),
}));

vi.mock("@/lib/env-validation", () => ({
  validateEnv: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock("@/lib/db/readiness", () => ({
  checkDatabaseReadiness: vi.fn(async () => ({ ok: true, latency_ms: 1 })),
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: vi.fn(() => "req-health-ready"),
}));

import { checkDatabaseReadiness } from "@/lib/db/readiness";
import { validateEnv } from "@/lib/env-validation";
import { GET as getHealth } from "../../src/app/health/route";
import { GET as getReady } from "../../src/app/api/ready/route";

describe("Health and readiness hardening", () => {
  beforeEach(() => {
    vi.mocked(checkDatabaseReadiness).mockResolvedValue({
      ok: true,
      latency_ms: 1,
    });
    vi.mocked(validateEnv).mockReturnValue({ valid: true, errors: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("health route sanitizes database errors", async () => {
    vi.mocked(checkDatabaseReadiness).mockResolvedValue({
      ok: false,
      latency_ms: 2,
      error: "sensitive db error host=db.internal password=secret",
    });

    const response = await getHealth();
    const body = (await response.json()) as {
      status: string;
      checks: { database: { error?: string } };
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.checks.database.error).toBe("Database unavailable");
  });

  it("readiness route returns 503 when env validation fails", async () => {
    vi.mocked(validateEnv).mockReturnValue({
      valid: false,
      errors: ["missing env"],
    });

    const response = await getReady(
      new Request("http://localhost/api/ready", {
        headers: { "x-real-ip": "198.51.100.11", "user-agent": "vitest-ready" },
      }),
    );
    const body = (await response.json()) as { ready: boolean };

    expect(response.status).toBe(503);
    expect(body.ready).toBe(false);
  });

  it("readiness route applies per-IP throttling", async () => {
    vi.mocked(validateEnv).mockReturnValue({ valid: true, errors: [] });

    let response: Awaited<ReturnType<typeof getReady>> | null = null;
    for (let i = 0; i < 121; i += 1) {
      response = await getReady(
        new Request("http://localhost/api/ready", {
          headers: {
            "x-real-ip": "198.51.100.12",
            "user-agent": "vitest-ready-throttle",
            accept: "application/json",
          },
        }),
      );
    }

    expect(response?.status).toBe(429);
  });
});
