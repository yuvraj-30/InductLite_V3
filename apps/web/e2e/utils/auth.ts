import type { BrowserContext, Page } from "@playwright/test";
import { getTestRouteHeaders } from "./test-route-auth";

/**
 * Programmatic login helper for Playwright tests.
 * Uses the test-only helper endpoint to obtain a sealed session cookie
 * and sets it into the browser context.
 */
export async function programmaticLogin(
  context: BrowserContext,
  email = "admin@buildright.co.nz",
  options?: { clientKey?: string },
) {
  // Request JSON response so we can read the cookie value directly
  const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
  const headers = getTestRouteHeaders(
    options?.clientKey ? { "x-e2e-client": options.clientKey } : undefined,
  );
  // Diagnostics: query server runtime endpoint first and tolerate warmup latency.
  let rtStatus: number | null = null;
  let rtJson: unknown = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const rt = await context.request.get(`${base}/api/test/runtime`, {
        headers,
        timeout: 5000,
      });
      rtStatus = rt.status();
      rtJson = await rt.json().catch(() => null);

      if (rtStatus === 200 || rtStatus === 401 || rtStatus === 403) {
        break;
      }
    } catch (e) {
      rtStatus = null;
      rtJson = String(e);
    }

    await new Promise((r) => setTimeout(r, 300 * attempt));
  }
  console.log("E2E: create-session preflight runtime:", rtStatus, rtJson);

  let res: any = null;
  let lastStatus: number | null = null;
  let lastText = "";
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      res = await context.request.get(
        `${base}/api/test/create-session?email=${encodeURIComponent(email)}&json=1`,
        { headers, timeout: 15000 },
      );
      lastStatus = res.status();
      lastError = null;

      if (lastStatus === 200) break;

      lastText = await res.text().catch(() => "");
      const retryable = [404, 408, 500, 502, 503, 504].includes(lastStatus);
      if (!retryable || attempt === 6) {
        console.log("E2E: create-session failed; response body:", lastText);
        throw new Error(`create-session failed: ${lastStatus} ${lastText}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const retryable =
        /timeout|socket|network|econnreset|503|504/i.test(lastError);
      if (!retryable || attempt === 6) {
        throw new Error(`create-session failed: ${lastError}`);
      }
    }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }

  if (!res || lastStatus !== 200) {
    throw new Error(
      `create-session failed: ${lastStatus ?? "unknown"} ${lastText || lastError || ""}`,
    );
  }

  const json = await res.json();
  if (!json?.cookieName || !json?.cookieValue) {
    throw new Error("create-session response missing cookie details");
  }

  await context.addCookies([
    {
      name: json.cookieName,
      value: json.cookieValue,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
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
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  // If an existing session already redirects us to admin, treat as success.
  if (/\/admin(?:\/|$)/.test(page.url())) {
    return;
  }

  const signOutLink = page.getByRole("link", { name: /sign out/i }).first();
  if (await signOutLink.isVisible().catch(() => false)) {
    return;
  }

  const emailField = page.getByLabel("Email address");
  await emailField.waitFor({ state: "visible", timeout: 10000 });
  await emailField.fill(email);
  await page.getByLabel("Password").waitFor({ state: "visible", timeout: 10000 });
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in/i }).click({ force: true });
  await page.waitForLoadState("domcontentloaded").catch(() => null);

  // Wait for navigation to admin or an already-authenticated control.
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (/\/admin(?:\/|$)/i.test(page.url())) {
      return;
    }
    const hasSignOut = await page
      .locator('button:has-text("Sign Out"), a:has-text("Sign Out")')
      .first()
      .isVisible()
      .catch(() => false);
    if (hasSignOut) {
      return;
    }
    if (page.isClosed()) {
      throw new Error("UI login failed: page closed before admin navigation");
    }
    await page.waitForTimeout(300);
  }

  throw new Error(`UI login failed: did not reach /admin (finalUrl=${page.url()})`);
}
