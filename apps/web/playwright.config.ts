import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

function loadEnvFile(filePath: string): Record<string, string> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf8");
    const env: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!key) continue;
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const rootEnvPath = path.resolve(__dirname, "..", "..", ".env");
const rootEnv = loadEnvFile(rootEnvPath);
// Never inherit NODE_ENV from .env here; Playwright and Next should control it explicitly.
const { NODE_ENV: _ignoredNodeEnv, ...rootEnvWithoutNodeEnv } = rootEnv;
Object.assign(process.env, rootEnvWithoutNodeEnv);
const testRunnerSecret =
  process.env.TEST_RUNNER_SECRET_KEY ||
  "e2e-test-runner-secret-3b0f2cbf5de0416ebf958e8d";
process.env.TEST_RUNNER_SECRET_KEY = testRunnerSecret;
const defaultBaseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
process.env.BASE_URL = defaultBaseUrl;
process.env.E2E_QUIET = process.env.E2E_QUIET || "1";
process.env.E2E_SKIP_LOGIN_VERIFY = process.env.E2E_SKIP_LOGIN_VERIFY || "1";
// E2E runs execute over HTTP localhost; secure cookies would be dropped in WebKit.
process.env.SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE || "0";

const e2eServerMode = process.env.E2E_SERVER_MODE ?? "dev";
const useDevServer = e2eServerMode === "dev";
const e2eNodeOptions =
  process.env.E2E_NODE_OPTIONS ??
  process.env.NODE_OPTIONS ??
  "--max-old-space-size=6144";
const disableExternalRateLimit =
  process.env.E2E_ALLOW_EXTERNAL_RATE_LIMIT !== "1";
const productionSessionSecret =
  process.env.E2E_PROD_SESSION_SECRET ||
  "production-session-secret-8f2d4f819f1643648fa1d36c5a2b77db";
const configuredSessionSecret = process.env.SESSION_SECRET;
const isDevLikeSessionSecret = (value: string | undefined): boolean =>
  !value || /dev-secret/i.test(value);
const e2eRequiredSecrets = {
  sessionSecret: useDevServer
    ? (configuredSessionSecret ||
      "test-session-secret-012345678901234567890123456")
    : (isDevLikeSessionSecret(configuredSessionSecret)
      ? productionSessionSecret
      : (configuredSessionSecret || productionSessionSecret)),
  dataEncryptionKey:
    process.env.DATA_ENCRYPTION_KEY ||
    "e2e-data-encryption-key-5f8a44c73a824c879bf77f9f329ce2a8",
  magicLinkSecret:
    process.env.MAGIC_LINK_SECRET ||
    "e2e-magic-link-secret-0d42f5b7f8b14732a74b5d6f66ef4d9a",
  cronSecret:
    process.env.CRON_SECRET ||
    "e2e-cron-secret-6c81b2d2b4f94f7db5f3d8e224e90d5b",
  resendApiKey:
    process.env.RESEND_API_KEY || "re_e2e_placeholder_key_1234567890",
  resendFrom:
    process.env.RESEND_FROM || "no-reply@inductlite.example.test",
};

if (disableExternalRateLimit) {
  // E2E runs should be deterministic and avoid flaky external DNS/network hops.
  process.env.UPSTASH_REDIS_REST_URL = "";
  process.env.UPSTASH_REDIS_REST_TOKEN = "";
  process.env.RATE_LIMIT_TELEMETRY_URL = "";
  process.env.RATE_LIMIT_ANALYTICS = "0";
}

function buildTestProviderBillingManifestJson(): string {
  const now = new Date();
  const iso = now.toISOString();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return JSON.stringify({
    capturedAt: iso,
    month,
    notes:
      "Playwright test-only provider billing manifest for deterministic prod-like budget enforcement.",
    entries: [
      "render",
      "neon",
      "cloudflare_r2",
      "upstash",
      "resend",
    ].map((provider, index) => ({
      provider,
      sourceType: "provider_api",
      capturedAt: iso,
      amountNzd: Number(((index + 1) / 100).toFixed(2)),
      invoiceRef: `${provider}-${month}`,
    })),
  });
}

const prodLikeBudgetEnv: Record<string, string> = useDevServer
  ? {}
  : {
      ENV_BUDGET_TIER: process.env.ENV_BUDGET_TIER || "MVP",
      MAX_MONTHLY_EGRESS_GB: process.env.MAX_MONTHLY_EGRESS_GB || "100",
      MAX_MONTHLY_STORAGE_GB: process.env.MAX_MONTHLY_STORAGE_GB || "50",
      MAX_MONTHLY_JOB_MINUTES: process.env.MAX_MONTHLY_JOB_MINUTES || "1000",
      MAX_MONTHLY_SERVER_ACTION_INVOCATIONS:
        process.env.MAX_MONTHLY_SERVER_ACTION_INVOCATIONS || "1000000",
      MAX_MONTHLY_COMPUTE_INVOCATIONS:
        process.env.MAX_MONTHLY_COMPUTE_INVOCATIONS || "1200000",
      MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES:
        process.env.MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES || "2500",
      FEATURE_EXPORTS_ENABLED: process.env.FEATURE_EXPORTS_ENABLED || "true",
      FEATURE_UPLOADS_ENABLED: process.env.FEATURE_UPLOADS_ENABLED || "true",
      FEATURE_PUBLIC_SIGNIN_ENABLED:
        process.env.FEATURE_PUBLIC_SIGNIN_ENABLED || "true",
      FEATURE_VISUAL_REGRESSION_ENABLED:
        process.env.FEATURE_VISUAL_REGRESSION_ENABLED || "false",
      EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT:
        process.env.EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT || "101",
      BUDGET_TELEMETRY_STALE_AFTER_HOURS:
        process.env.BUDGET_TELEMETRY_STALE_AFTER_HOURS || "24",
      BUDGET_TELEMETRY_REQUIRED_PROVIDERS:
        process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS ||
        "render,neon,cloudflare_r2,upstash,resend",
      BUDGET_TELEMETRY_PROVIDER_BILLING_JSON:
        process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_JSON ||
        buildTestProviderBillingManifestJson(),
    };

const e2eRateLimitEnv: Record<string, string> = disableExternalRateLimit
  ? {
      // CI-like local Playwright runs should exercise the same no-external-redis
      // path as branch smoke, otherwise production-mode standalone tests can
      // fail closed on synthetic Redis config before product behavior is reached.
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    }
  : {
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? "",
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
    };

/**
 * Playwright E2E Test Configuration
 *
 * Security-focused end-to-end tests for InductLite:
 * - Public sign-in flow
 * - Admin login/logout
 * - CSRF protection validation
 * - Session handling
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: Number(process.env.E2E_RETRIES ?? (process.env.CI ? 2 : 0)),
  // Keep local defaults conservative to avoid overloading the app server.
  workers: process.env.CI ? 1 : Number(process.env.E2E_WORKERS || 1),
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: defaultBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    // Mobile viewports for responsive testing
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  // Local server configuration
  webServer: process.env.CI
    ? undefined
    : {
        command: "node scripts/run-playwright-web-server.js",
        url: defaultBaseUrl,
        // Default to false so we don't accidentally reuse a stale local server
        // missing E2E env flags (ALLOW_TEST_RUNNER/TRUST_PROXY).
        reuseExistingServer: process.env.PW_REUSE_EXISTING_SERVER === "1",
        timeout: Number(
          process.env.E2E_WEB_SERVER_TIMEOUT_MS ||
            (useDevServer ? 300000 : 600000),
        ),
        // Provide test env vars so the app can unseal test session cookies
        env: {
          ...rootEnvWithoutNodeEnv,
          E2E_QUIET: process.env.E2E_QUIET || "1",
          E2E_SERVER_MODE: e2eServerMode,
          NODE_ENV: useDevServer ? "development" : "test",
          CI: useDevServer ? (process.env.CI ?? "false") : "true",
          NODE_OPTIONS: e2eNodeOptions,
          TEST_RUNNER_SECRET_KEY: testRunnerSecret,
          // Stable test session secret (must be >= 32 chars)
          SESSION_SECRET: e2eRequiredSecrets.sessionSecret,
          SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE || "0",
          DATA_ENCRYPTION_KEY: e2eRequiredSecrets.dataEncryptionKey,
          MAGIC_LINK_SECRET: e2eRequiredSecrets.magicLinkSecret,
          CRON_SECRET: e2eRequiredSecrets.cronSecret,
          RESEND_API_KEY: e2eRequiredSecrets.resendApiKey,
          RESEND_FROM: e2eRequiredSecrets.resendFrom,
          ...prodLikeBudgetEnv,
          // Allow test-only runner endpoint during E2E
          ALLOW_TEST_RUNNER: "1",
          // Trust proxy headers (required for per-test x-forwarded-for handling)
          TRUST_PROXY: "1",
          // Disable external analytics/redis during local E2E unless explicitly enabled.
          ...e2eRateLimitEnv,
          RATE_LIMIT_TELEMETRY_URL: disableExternalRateLimit
            ? ""
            : (process.env.RATE_LIMIT_TELEMETRY_URL ?? ""),
          RATE_LIMIT_ANALYTICS: disableExternalRateLimit
            ? "0"
            : (process.env.RATE_LIMIT_ANALYTICS ?? "1"),
        },
      },

  // Keep test runtime bounded locally: fail fast on stuck steps.
  timeout: Number(process.env.E2E_TEST_TIMEOUT_MS || 30000),
  expect: {
    timeout: 10000,
    // Default screenshot tolerance: allow small pixel diffs for flaky rendering differences and apply a common style mask
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.01,
      stylePath: "./e2e/screenshot.css",
    },
  },
});
