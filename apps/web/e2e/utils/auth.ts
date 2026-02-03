import type { BrowserContext, Page } from "@playwright/test";

/**
 * Programmatic login helper for Playwright tests.
 * Uses the test-only helper endpoint to obtain a sealed session cookie
 * and sets it into the browser context.
 */
export async function programmaticLogin(
  context: BrowserContext,
  email = "admin@buildright.co.nz",
) {
  // Request JSON response so we can read the cookie value directly
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  // Diagnostics: query server runtime endpoint first
  try {
    const rt = await context.request.get(`${base}/api/test/runtime`, {
      headers: { "x-allow-test-runner": "1" },
    });
    try {
      const rtJson = await rt.json().catch(() => null);
      console.log("E2E: create-session preflight runtime:", rt.status, rtJson);
    } catch (_) {
      // ignore
    }
  } catch (e) {
    console.warn(
      "E2E: create-session couldn't call /api/test/runtime:",
      String(e),
    );
  }

  const res = await context.request.get(
    `${base}/api/test/create-session?email=${encodeURIComponent(email)}&json=1`,
    { headers: { "x-allow-test-runner": "1" } },
  );

  if (res.status() !== 200) {
    const txt = await res.text();
    console.log("E2E: create-session failed; response body:", txt);
    throw new Error(`create-session failed: ${res.status()} ${txt}`);
  }

  const json = await res.json();
  if (!json?.cookieName || !json?.cookieValue) {
    throw new Error("create-session response missing cookie details");
  }

  await context.addCookies([
    {
      name: json.cookieName,
      value: json.cookieValue,
      url: process.env.BASE_URL || "http://localhost:3000",
      httpOnly: true,
      // Explicitly set secure: false for E2E tests running over HTTP
      secure: false,
    },
  ]);

  return json;
}

/**
 * UI login helper (falls back to the real login form)
 */
export async function uiLogin(
  page: Page,
  email = "admin@buildright.co.nz",
  password = "Admin123!",
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  // Wait for navigation to admin or some indicator of success
  await page.waitForURL(/\/admin/, { timeout: 10000 });
}
