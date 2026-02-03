import { defineConfig, devices } from "@playwright/test";

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
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
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

  // Development server configuration
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        // Provide test env vars so the dev server can unseal test session cookies
        env: {
          // Stable test session secret (must be >= 32 chars)
          SESSION_SECRET:
            process.env.SESSION_SECRET ||
            "test-session-secret-012345678901234567890123456",
          // Allow test-only runner endpoint during E2E
          ALLOW_TEST_RUNNER: "1",
          // Trust proxy headers (required for per-test x-forwarded-for handling)
          TRUST_PROXY: "1",
        },
      },

  // Global timeout (increase to tolerate retries and dev server startup delays)
  timeout: 60000,
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
