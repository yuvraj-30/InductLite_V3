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
  let TEST_SITE_SLUG = "test-site";

  test.beforeAll(async ({ request, seedPublicSite }) => {
    try {
      const body = await seedPublicSite({ slugPrefix: "test-site-e2e-visual" });
      if (body?.success && body.slug) {
        TEST_SITE_SLUG = body.slug;
        return;
      }
    } catch {
      // fallback to existing seed below
    }

    const res = await request.get(`/s/${TEST_SITE_SLUG}`);
    const txt = await res.text();
    if (res.status() === 404 || /Site Not Found|No active template/i.test(txt)) {
      test.skip(true, "Visual public sign-in test site not seeded for this environment");
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (TEST_SITE_SLUG.startsWith("test-site-e2e-visual")) {
      await deletePublicSite(TEST_SITE_SLUG).catch(() => null);
    }
  });

  test("public sign-in page matches baseline", async ({ page }) => {
    await page.goto(`/s/${TEST_SITE_SLUG}`);
    await expect(page.getByLabel(/name|full name/i)).toBeVisible({
      timeout: 10000,
    });

    // Use a stable region to avoid browser chrome / dynamic viewport height jitter.
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
      maxDiffPixelRatio: 0.06,
      maxDiffPixels: 5000,
    });
  });

  test("induction form matches baseline", async ({ page }) => {
    await page.goto(`/s/${TEST_SITE_SLUG}`);
    await expect(page.getByLabel(/name|full name/i)).toBeVisible({
      timeout: 10000,
    });

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

    const form = page.locator("form").first();
    if (await form.count()) {
      const regionRes = await takeAndCompare(page, "induction-form", {
        fullPage: false,
      });
      if (regionRes.uploaded) {
        test.skip(true, "VRT upload performed; check tracker");
        return;
      }
      await expect(form).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio: 0.08,
        maxDiffPixels: 5000,
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
        maxDiffPixelRatio: 0.08,
        maxDiffPixels: 5000,
      });
    }
  });

  test("signature pad matches baseline", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto(`/s/${TEST_SITE_SLUG}`);
    await expect(page.getByLabel(/name|full name/i)).toBeVisible({
      timeout: 10000,
    });

    // Step 1: Fill details
    await page.getByLabel(/name/i).fill("Signature Visual Test");
    await page.getByLabel(/phone/i).fill("+64211234567");
    const visitorType = page.getByLabel(/visitor type/i);
    if (await visitorType.count()) {
      await visitorType.selectOption("CONTRACTOR").catch(() => null);
    }
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: Progress through dynamic induction/sign-off flow.
    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });
    if (await inductionHeading.isVisible().catch(() => false)) {
      // Answer checkbox/radio/text questions when present.
      const checks = page.getByRole("checkbox");
      const checkCount = await checks.count();
      for (let i = 0; i < checkCount; i++) {
        await checks.nth(i).check().catch(() => null);
      }

      const radioGroupNames = await page
        .locator('input[type="radio"][name]')
        .evaluateAll((nodes) => {
          const names = nodes
            .map((node) => node.getAttribute("name"))
            .filter((name): name is string => !!name);
          return Array.from(new Set(names));
        });

      for (const groupName of radioGroupNames) {
        const firstOption = page
          .locator(`input[type="radio"][name="${groupName}"]`)
          .first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.check().catch(() => null);
        }
      }

      const textInputs = page.locator('input[type="text"]');
      const textCount = await textInputs.count();
      for (let i = 0; i < textCount; i++) {
        const input = textInputs.nth(i);
        if (await input.isVisible().catch(() => false)) {
          await input.fill("None").catch(() => null);
        }
      }

      const submitInduction = page.getByRole("button", {
        name: /complete sign-in|continue to sign off|continue|finish|sign off/i,
      });
      await submitInduction.first().click();
    }

    // Step 3: Wait for signature step
    const canvas = page
      .locator("#signature-canvas, canvas.sigCanvas, canvas")
      .first();
    for (let i = 0; i < 20; i++) {
      if (await canvas.isVisible().catch(() => false)) break;
      const nextBtn = page
        .getByRole("button", {
          name: /continue|complete sign-in|continue to sign off|finish|sign off/i,
        })
        .first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click().catch(() => null);
      }
      await page.waitForTimeout(500);
    }
    // Fallback: if public flow didn't reach signature (browser/template variance),
    // use kiosk flow which renders the same signature canvas component more deterministically.
    if (!(await canvas.isVisible().catch(() => false))) {
      await page.goto(`/s/${TEST_SITE_SLUG}/kiosk`);
      await expect(page.locator('input[id="visitorName"]')).toBeVisible({
        timeout: 15000,
      });
      await page.locator('input[id="visitorName"]').fill("Visual Kiosk User");
      await page.locator('input[id="visitorPhone"]').fill("+64211234567");
      const visitorTypeSelect = page.locator('select[id="visitorType"]');
      if (await visitorTypeSelect.count()) {
        await visitorTypeSelect.selectOption("CONTRACTOR").catch(() => null);
      }
      const employer = page.locator('input[id="employerName"]');
      if (await employer.count()) {
        await employer.fill("Visual Employer").catch(() => null);
      }
      const role = page.locator('input[id="roleOnSite"]');
      if (await role.count()) {
        await role.fill("Contractor").catch(() => null);
      }
      await page.locator('button[type="submit"]').click();
      await expect(page.getByRole("heading", { name: /site induction/i })).toBeVisible({
        timeout: 15000,
      });
      const ack = page.getByRole("checkbox");
      const ackCount = await ack.count();
      for (let i = 0; i < ackCount; i++) {
        await ack.nth(i).check().catch(() => null);
      }
      const continueBtn = page.getByRole("button", {
        name: /continue|continue to sign off|finish/i,
      });
      await continueBtn.first().click();
    }

    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      c.style.width = "444px";
      c.style.height = "160px";
      c.width = 888;
      c.height = 320;
    });

    const regionRes = await takeAndCompare(page, "signature-pad", {
      fullPage: false,
    });
    if (regionRes.uploaded) {
      test.skip(true, "VRT upload performed; check tracker");
      return;
    }

    await expect(canvas).toHaveScreenshot(regionRes.filename!, {
      timeout: 20000,
      maxDiffPixelRatio: 0.12,
      maxDiffPixels: 12000,
    });
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
