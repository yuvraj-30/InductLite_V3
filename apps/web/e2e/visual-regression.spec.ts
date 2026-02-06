/*
 * Visual Regression Tests (Playwright + optional VisualRegressionTracker)
 *
 * - This file uses Playwright's built-in screenshot assertions by default.
 * - To enable VisualRegressionTracker (self-hosted dashboard):
 *   - Set VRT_ENABLED=1, VRT_API_URL, and VRT_API_KEY in the environment.
 *   - The tests will upload screenshots to the tracker instead of failing on local diffs.
 */

import { test } from "./test-fixtures";
import { expect } from "@playwright/test";
import { takeAndCompare } from "./utils/visual";

// Test helper: wait for page layout (height) to stabilise to avoid flaky fullPage screenshots
async function ensureStableHeight(page: any, polls = 6, delay = 250) {
  let last = -1;
  for (let i = 0; i < polls; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    if (h === last) return;
    last = h;
    await page.waitForTimeout(delay);
  }
}

// Helper: capture full-page screenshot or region and either upload to VRT or
// return a filename for Playwright's snapshot comparison.

// -----------------------------------------------------------------------------
// Visual tests
// -----------------------------------------------------------------------------

test.describe("Visual Regression - Login Page (Playwright)", () => {
  test("login page matches baseline", async ({ page }, testInfo) => {
    await page.goto("/login");

    const isMobileSafari = testInfo.project.name === "mobile-safari";

    if (!isMobileSafari) {
      const res = await takeAndCompare(page, "login-page-full", {
        fullPage: true,
      });
      if (res.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }

      await ensureStableHeight(page);
      await expect(page).toHaveScreenshot(res.filename!, {
        fullPage: true,
        timeout: 20000,
        maxDiffPixelRatio: 0.02,
      });
    }

    const loginForm = page.locator("form");
    if (await loginForm.count()) {
      const regionRes = await takeAndCompare(page, "login-form", {
        fullPage: false,
      });
      if (!regionRes.uploaded) {
        await expect(loginForm).toHaveScreenshot(regionRes.filename!, {
          timeout: 20000,
          maxDiffPixelRatio: 0.02,
        });
      }
    }
  });
});

// Public sign-in tests

test.describe("Visual Regression - Public Sign-In (Playwright)", () => {
  const TEST_SITE_SLUG = "test-site";

  test("public sign-in page matches baseline", async ({ page }, testInfo) => {
    await page.goto(`/s/${TEST_SITE_SLUG}`);

    const isMobileSafari = testInfo.project.name === "mobile-safari";

    if (!isMobileSafari) {
      const res = await takeAndCompare(page, "public-signin-page-full", {
        fullPage: true,
      });
      if (res.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }

      // Wait for a stable, visible control (name input) for the sign-in page; fallback to a short timeout
      try {
        await page.getByLabel(/name/i).waitFor({ timeout: 15000 });
      } catch (err) {
        await page.waitForTimeout(2000);
      }

      await ensureStableHeight(page);
      await expect(page).toHaveScreenshot(res.filename!, {
        fullPage: true,
        timeout: 20000,
        maxDiffPixelRatio: 0.02,
      });
      return;
    }

    // Mobile Safari: use a stable region to avoid toolbar-induced height changes
    const main = page.locator("main").first();
    const regionRes = await takeAndCompare(page, "public-signin-main", {
      fullPage: false,
    });
    if (regionRes.uploaded) {
      test.skip(true, "VRT upload performed; check tracker");
      return;
    }
    await expect(main).toHaveScreenshot(regionRes.filename!, {
      timeout: 20000,
      maxDiffPixelRatio: 0.03,
    });
  });

  test("induction form matches baseline", async ({ page }, testInfo) => {
    await page.goto(`/s/${TEST_SITE_SLUG}`);

    // Fill in required fields to proceed
    await page.getByLabel(/name/i).fill("Visual Test Visitor");
    await page.getByLabel(/phone/i).fill("+64211234567");
    await page.getByRole("button", { name: /sign in|continue/i }).click();

    // Wait for induction form (stable layout). Prefer waiting for a known control; fall back to a short timeout.
    try {
      await page
        .getByRole("button", { name: /sign in|continue/i })
        .waitFor({ timeout: 10000 });
    } catch (err) {
      // Fallback if the control isn't present or slow - wait briefly then proceed
      await page.waitForTimeout(2000);
    }
    await ensureStableHeight(page);

    const main = page.locator("main").first();
    const form = page.locator("form").first();
    const preferForm = testInfo.project.name === "webkit";

    // Prefer stable region snapshots; use form for WebKit to reduce layout jitter
    if (preferForm && (await form.count())) {
      const regionRes = await takeAndCompare(page, "induction-form", {
        fullPage: false,
      });
      if (regionRes.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(form).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio: 0.03,
      });
    } else if (await main.count()) {
      const regionRes = await takeAndCompare(page, "induction-main", {
        fullPage: false,
      });
      if (regionRes.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(main).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio: 0.03,
      });
    } else if (await form.count()) {
      const regionRes = await takeAndCompare(page, "induction-form", {
        fullPage: false,
      });
      if (regionRes.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(form).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio: 0.03,
      });
    } else {
      const res = await takeAndCompare(page, "induction-form-full", {
        fullPage: true,
      });
      if (res.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(page).toHaveScreenshot(res.filename!, {
        fullPage: true,
        timeout: 20000,
        maxDiffPixelRatio: 0.03,
      });
    }
  });
});

// Admin dashboard visual tests (requires auth)

test.describe("Visual Regression - Admin Dashboard", () => {
  test.beforeEach(async ({ page, loginAs, workerUser }) => {
    // Programmatic login: if this fails (user not seeded locally), skip visual admin tests
    try {
      // Use seeded admin email created by db:seed
      await loginAs(workerUser.email);
      // Explicitly navigate to admin to ensure the session cookie is applied
      await page.goto("/admin");
      await page.waitForURL(/\/admin/);
    } catch (err) {
      console.warn(
        "Skipping admin visual test: programmatic login failed:",
        String(err),
      );
      test.skip(
        true,
        "Admin user not seeded locally (run db:seed or skip visual admin tests)",
      );
    }
  });

  test("live register page matches baseline", async ({ page }) => {
    await page.goto("/admin/live-register");

    // Ensure server-rendered content has stabilised
    await page.waitForLoadState("networkidle");
    await ensureStableHeight(page);

    // Capture the page heading only (excludes dynamic visitor count) for stable comparison
    const header = page
      .getByRole("heading", { name: /live register/i })
      .first();
    if (await header.count()) {
      const regionRes = await takeAndCompare(
        page,
        "admin-live-register-heading",
        {
          fullPage: false,
        },
      );
      if (regionRes.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(header).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio: 0.02,
      });
    } else {
      const res = await takeAndCompare(page, "admin-live-register-full", {
        fullPage: true,
      });
      if (res.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(page).toHaveScreenshot(res.filename!, {
        fullPage: true,
        timeout: 20000,
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test("sites list matches baseline", async ({ page }) => {
    await page.goto("/admin/sites");

    await page.waitForLoadState("networkidle");
    await ensureStableHeight(page);

    // Capture the page heading only for stable comparison (Sites heading)
    const header = page.getByRole("heading", { name: /sites/i }).first();
    if (await header.count()) {
      const regionRes = await takeAndCompare(page, "admin-sites-list-heading", {
        fullPage: false,
      });
      if (regionRes.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(header).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio: 0.02,
      });
    } else {
      const res = await takeAndCompare(page, "admin-sites-list-full", {
        fullPage: true,
      });
      if (res.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(page).toHaveScreenshot(res.filename!, {
        fullPage: true,
        timeout: 20000,
        maxDiffPixelRatio: 0.02,
      });
    }
  });
});
