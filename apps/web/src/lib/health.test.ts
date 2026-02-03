/**
 * Health Check Logic Tests
 *
 * Tests the performHealthCheck function with mocked database.
 * Verifies both healthy and error states.
 */

/* eslint-disable security-guardrails/no-raw-sql -- Test file mocking $queryRaw */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { performHealthCheck, type HealthStatus } from "./health";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

// Import the mocked prisma after setting up the mock
import { prisma } from "@/lib/db";

describe("performHealthCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Date mock if any
    vi.useRealTimers();
  });

  describe("when database is healthy", () => {
    it("should return ok status when database query succeeds", async () => {
      // Arrange: Mock successful database query
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      // Act
      const result = await performHealthCheck();

      // Assert
      expect(result.status).toBe("ok");
      expect(result.checks.database.status).toBe("ok");
      expect(typeof result.checks.database.latency_ms).toBe("number");
      expect(result.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
      expect(result.checks.database.error).toBeUndefined();
    });

    it("should include timestamp in ISO format", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      const result = await performHealthCheck();

      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
      // Verify it's a valid ISO string
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
    });

    it("should include version from package.json", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      const result = await performHealthCheck();

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe("string");
    });

    it("should call prisma.$queryRaw exactly once", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      await performHealthCheck();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("when database is down", () => {
    it("should return error status when database query fails", async () => {
      // Arrange: Mock database connection failure
      vi.mocked(prisma.$queryRaw).mockRejectedValue(
        new Error("Connection refused"),
      );

      // Act
      const result = await performHealthCheck();

      // Assert
      expect(result.status).toBe("error");
      expect(result.checks.database.status).toBe("error");
      expect(result.checks.database.error).toBe("Connection refused");
      expect(result.checks.database.latency_ms).toBeUndefined();
    });

    it("should handle non-Error rejection gracefully", async () => {
      // Some database drivers throw non-Error objects
      vi.mocked(prisma.$queryRaw).mockRejectedValue("String error");

      const result = await performHealthCheck();

      expect(result.status).toBe("error");
      expect(result.checks.database.status).toBe("error");
      expect(result.checks.database.error).toBe("Unknown database error");
    });

    it("should still include timestamp when database fails", async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB down"));

      const result = await performHealthCheck();

      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it("should still include version when database fails", async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB down"));

      const result = await performHealthCheck();

      expect(result.version).toBeDefined();
    });
  });

  describe("response structure", () => {
    it("should match HealthStatus interface when healthy", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      const result = await performHealthCheck();

      // Type-safe check that all required fields exist
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

    it("should match HealthStatus interface when unhealthy", async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("Fail"));

      const result = await performHealthCheck();

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("checks");
      expect(result.checks).toHaveProperty("database");
      expect(result.checks.database).toHaveProperty("status");
      expect(result.checks.database).toHaveProperty("error");
    });
  });
});
