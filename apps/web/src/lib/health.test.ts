import { describe, it, expect, vi, beforeEach } from "vitest";
import { performHealthCheck, type HealthStatus } from "./health";

const mocks = vi.hoisted(() => ({
  checkDatabaseReadiness: vi.fn(),
}));

vi.mock("@/lib/db/readiness", () => ({
  checkDatabaseReadiness: mocks.checkDatabaseReadiness,
}));

describe("performHealthCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok status when database readiness succeeds", async () => {
    mocks.checkDatabaseReadiness.mockResolvedValue({
      ok: true,
      latency_ms: 12,
    });

    const result = await performHealthCheck();

    expect(result.status).toBe("ok");
    expect(result.checks.database.status).toBe("ok");
    expect(result.checks.database.latency_ms).toBe(12);
    expect(result.checks.database.error).toBeUndefined();
  });

  it("returns error status when database readiness fails", async () => {
    mocks.checkDatabaseReadiness.mockResolvedValue({
      ok: false,
      latency_ms: 9,
      error: "Connection refused",
    });

    const result = await performHealthCheck();

    expect(result.status).toBe("error");
    expect(result.checks.database.status).toBe("error");
    expect(result.checks.database.error).toBe("Connection refused");
    expect(result.checks.database.latency_ms).toBeUndefined();
  });

  it("falls back to unknown database error when readiness has no message", async () => {
    mocks.checkDatabaseReadiness.mockResolvedValue({
      ok: false,
      latency_ms: 4,
    });

    const result = await performHealthCheck();

    expect(result.status).toBe("error");
    expect(result.checks.database.error).toBe("Unknown database error");
  });

  it("matches HealthStatus shape", async () => {
    mocks.checkDatabaseReadiness.mockResolvedValue({
      ok: true,
      latency_ms: 3,
    });

    const result = await performHealthCheck();

    const requiredFields: (keyof HealthStatus)[] = [
      "status",
      "timestamp",
      "version",
      "checks",
    ];
    for (const field of requiredFields) {
      expect(result).toHaveProperty(field);
    }
    expect(result.checks).toHaveProperty("database");
    expect(result.checks.database).toHaveProperty("status");
  });
});
