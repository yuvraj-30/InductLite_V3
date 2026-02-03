/**
 * Environment Validation Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateEnv } from "../env-validation";

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("in development mode", () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "development";
    });

    it("should pass with minimal required variables", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "dev-secret-at-least-32-characters-long-here";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail if DATABASE_URL is missing", () => {
      delete process.env.DATABASE_URL;
      process.env.SESSION_SECRET =
        "dev-secret-at-least-32-characters-long-here";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.name === "DATABASE_URL")).toBe(true);
    });

    it("should fail if SESSION_SECRET is too short", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET = "tooshort";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.name === "SESSION_SECRET")).toBe(true);
    });

    it("should fail if NEXT_PUBLIC_APP_URL has invalid format", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "dev-secret-at-least-32-characters-long-here";
      process.env.NEXT_PUBLIC_APP_URL = "not-a-valid-url";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.name === "NEXT_PUBLIC_APP_URL")).toBe(
        true,
      );
    });
  });

  describe("in production mode", () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
    });

    it("should warn about local storage mode", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      process.env.STORAGE_MODE = "local";

      const result = validateEnv();

      expect(
        result.warnings.some((w) => w.includes("STORAGE_MODE=local")),
      ).toBe(true);
    });

    it("should fail with dev-like session secret", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET = "dev-secret-something-32-chars-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.name === "SESSION_SECRET" &&
            e.error.includes("development value"),
        ),
      ).toBe(true);
    });

    it("should require S3 config when STORAGE_MODE is s3", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      process.env.STORAGE_MODE = "s3";
      // S3 vars not set

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.name === "S3_BUCKET")).toBe(true);
    });

    it("should pass with full production config", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      process.env.STORAGE_MODE = "s3";
      process.env.S3_BUCKET = "my-bucket";
      process.env.S3_REGION = "ap-southeast-2";
      process.env.S3_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.S3_SECRET_ACCESS_KEY =
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token";

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about missing Upstash Redis", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      process.env.STORAGE_MODE = "s3";
      process.env.S3_BUCKET = "my-bucket";
      process.env.S3_REGION = "ap-southeast-2";
      process.env.S3_ACCESS_KEY_ID = "key";
      process.env.S3_SECRET_ACCESS_KEY = "secret";
      // No Upstash

      const result = validateEnv();

      expect(
        result.warnings.some((w) => w.includes("Upstash Redis not configured")),
      ).toBe(true);
    });

    it("should warn about HTTP URL in production", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "http://example.com"; // HTTP, not HTTPS
      process.env.STORAGE_MODE = "s3";
      process.env.S3_BUCKET = "my-bucket";
      process.env.S3_REGION = "ap-southeast-2";
      process.env.S3_ACCESS_KEY_ID = "key";
      process.env.S3_SECRET_ACCESS_KEY = "secret";

      const result = validateEnv();

      expect(result.warnings.some((w) => w.includes("HTTP"))).toBe(true);
    });
  });
});
