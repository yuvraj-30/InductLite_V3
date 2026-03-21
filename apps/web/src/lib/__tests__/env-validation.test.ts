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

    it("should fail if NEXT_PUBLIC_APP_URL is missing a hostname", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "dev-secret-at-least-32-characters-long-here";
      process.env.NEXT_PUBLIC_APP_URL = "https://";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.name === "NEXT_PUBLIC_APP_URL")).toBe(
        true,
      );
    });

    it("should fail if RL_ADMIN guardrails are not positive integers", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "dev-secret-at-least-32-characters-long-here";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      process.env.RL_ADMIN_PER_USER_PER_MIN = "-1";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.name === "RL_ADMIN_PER_USER_PER_MIN"),
      ).toBe(true);
    });

    it("should allow zero MAX_MESSAGES_PER_COMPANY_PER_MONTH when SMS is disabled", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "dev-secret-at-least-32-characters-long-here";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      process.env.SMS_ENABLED = "false";
      process.env.MAX_MESSAGES_PER_COMPANY_PER_MONTH = "0";

      const result = validateEnv();

      expect(result.errors.some((e) => e.name === "MAX_MESSAGES_PER_COMPANY_PER_MONTH")).toBe(
        false,
      );
    });

    it("should require positive MAX_MESSAGES_PER_COMPANY_PER_MONTH when SMS is enabled", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "dev-secret-at-least-32-characters-long-here";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      process.env.SMS_ENABLED = "true";
      process.env.MAX_MESSAGES_PER_COMPANY_PER_MONTH = "0";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.name === "MAX_MESSAGES_PER_COMPANY_PER_MONTH" &&
            e.error.includes("greater than 0"),
        ),
      ).toBe(true);
    });
  });

  describe("in production mode", () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
      delete process.env.ALLOW_TEST_RUNNER;
      delete process.env.CI;
      process.env.CRON_SECRET = "cron-secret-at-least-16";
      process.env.DATABASE_DIRECT_URL = "postgresql://test@localhost/test";
      process.env.MAGIC_LINK_SECRET = "magic-link-secret-at-least-32-chars";
      process.env.DATA_ENCRYPTION_KEY =
        "production-data-encryption-key-at-least-32";
      process.env.RESEND_API_KEY = "re_test_key";
      process.env.RESEND_FROM = "no-reply@example.com";
      process.env.ENV_BUDGET_TIER = "MVP";
      process.env.MAX_MONTHLY_EGRESS_GB = "100";
      process.env.MAX_MONTHLY_STORAGE_GB = "50";
      process.env.MAX_MONTHLY_JOB_MINUTES = "1000";
      process.env.MAX_MONTHLY_SERVER_ACTION_INVOCATIONS = "1000000";
      process.env.MAX_MONTHLY_COMPUTE_INVOCATIONS = "1200000";
      process.env.MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES = "2500";
      process.env.FEATURE_EXPORTS_ENABLED = "true";
      process.env.FEATURE_UPLOADS_ENABLED = "true";
      process.env.FEATURE_PUBLIC_SIGNIN_ENABLED = "true";
      process.env.FEATURE_VISUAL_REGRESSION_ENABLED = "false";
      process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS =
        "render,neon,cloudflare_r2,upstash,resend";
      process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_FILE =
        "./artifacts/provider-billing.json";
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token";
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

    it("should fail when DATA_ENCRYPTION_KEY is missing", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      delete process.env.DATA_ENCRYPTION_KEY;

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.name === "DATA_ENCRYPTION_KEY")).toBe(
        true,
      );
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
      process.env.NEON_POOLER_URL = "postgresql://test@localhost:6543/test";
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

    it("should allow NEON_POOLER_URL without affecting validation", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.NEON_POOLER_URL = "postgresql://test@localhost:6543/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fallback to NEON_POOLER_URL when DATABASE_URL missing and emit warning", () => {
      delete process.env.DATABASE_URL;
      process.env.NEON_POOLER_URL = "postgresql://test@localhost:6543/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("using NEON_POOLER_URL"))).toBe(true);
      expect(process.env.DATABASE_URL).toBe(process.env.NEON_POOLER_URL);
    });

    it("should recommend pooler when DATABASE_URL is direct and NEON_POOLER_URL exists", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost:5432/test";
      process.env.NEON_POOLER_URL = "postgresql://test@localhost:6543/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some((w) => w.includes("pooler for runtime")),
      ).toBe(true);
    });

    it("should fail when Upstash Redis is missing", () => {
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
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.name === "UPSTASH_REDIS_REST_URL"),
      ).toBe(true);
    });

    it("should fail when ENV_BUDGET_TIER is missing", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      delete process.env.ENV_BUDGET_TIER;

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.name === "ENV_BUDGET_TIER")).toBe(
        true,
      );
    });

    it("should fail when provider billing manifest config is missing", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_FILE;
      delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_JSON;
      delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_URL;

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.name === "BUDGET_TELEMETRY_PROVIDER_BILLING_FILE",
        ),
      ).toBe(true);
    });

    it("should fail when required provider list is missing", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      delete process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS;

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.name === "BUDGET_TELEMETRY_REQUIRED_PROVIDERS",
        ),
      ).toBe(true);
    });

    it("should allow the CI test-runner harness without live production-only integrations", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      process.env.ALLOW_TEST_RUNNER = "1";
      process.env.CI = "1";

      delete process.env.ENV_BUDGET_TIER;
      delete process.env.MAX_MONTHLY_EGRESS_GB;
      delete process.env.MAX_MONTHLY_STORAGE_GB;
      delete process.env.MAX_MONTHLY_JOB_MINUTES;
      delete process.env.MAX_MONTHLY_SERVER_ACTION_INVOCATIONS;
      delete process.env.MAX_MONTHLY_COMPUTE_INVOCATIONS;
      delete process.env.MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES;
      delete process.env.FEATURE_EXPORTS_ENABLED;
      delete process.env.FEATURE_UPLOADS_ENABLED;
      delete process.env.FEATURE_PUBLIC_SIGNIN_ENABLED;
      delete process.env.FEATURE_VISUAL_REGRESSION_ENABLED;
      delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_FILE;
      delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_JSON;
      delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_URL;
      delete process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail when a monthly budget cap exceeds the selected tier ceiling", () => {
      process.env.DATABASE_URL = "postgresql://test@localhost/test";
      process.env.SESSION_SECRET =
        "production-secret-at-least-32-characters-long";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      process.env.MAX_MONTHLY_EGRESS_GB = "101";

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.name === "MAX_MONTHLY_EGRESS_GB" &&
            e.error.includes("exceeds the MVP tier ceiling"),
        ),
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
