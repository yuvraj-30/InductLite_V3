import { describe, it, expect, vi, afterEach } from "vitest";

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

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: vi.fn(() => "req-health-ready"),
  getClientIp: vi.fn(async () => "198.51.100.10"),
}));

import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env-validation";
import { getClientIp } from "@/lib/auth/csrf";
import { GET as getHealth } from "../../src/app/health/route";
import { GET as getReady } from "../../src/app/api/ready/route";

describe("Health and readiness hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("health route sanitizes database errors", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValue(
      new Error("sensitive db error host=db.internal password=secret"),
    );

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
    vi.spyOn(prisma, "$queryRaw").mockResolvedValue([{ ok: 1 }] as never);
    vi.mocked(validateEnv).mockReturnValue({
      valid: false,
      errors: ["missing env"],
    });
    vi.mocked(getClientIp).mockResolvedValue("198.51.100.11");

    const response = await getReady();
    const body = (await response.json()) as { ready: boolean };

    expect(response.status).toBe(503);
    expect(body.ready).toBe(false);
  });

  it("readiness route applies per-IP throttling", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValue([{ ok: 1 }] as never);
    vi.mocked(validateEnv).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(getClientIp).mockResolvedValue("198.51.100.12");

    let response: Awaited<ReturnType<typeof getReady>> | null = null;
    for (let i = 0; i < 121; i += 1) {
      response = await getReady();
    }

    expect(response?.status).toBe(429);
  });
});
