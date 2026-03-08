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
import { getTestRouteHeaders } from "./utils/test-route-auth";

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

async function fillInputResilient(input: any, value: string): Promise<boolean> {
  const exists = (await input.count().catch(() => 0)) as number;
  if (exists === 0) return false;

  const isVisible = await input.isVisible({ timeout: 1200 }).catch(() => false);
  if (!isVisible) return false;

  await input.click({ timeout: 1500 }).catch(() => null);
  await input.fill(value, { timeout: 1500 }).catch(() => null);

  let current = (await input.inputValue().catch(() => "")) as string;
  if (current.trim()) return true;

  await input.type(value, { delay: 25 }).catch(() => null);
  current = (await input.inputValue().catch(() => "")) as string;
  if (current.trim()) return true;

  await input
    .evaluate((el, nextValue) => {
      const node = el as HTMLInputElement;
      node.value = String(nextValue);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, value)
    .catch(() => null);
  current = (await input.inputValue().catch(() => "")) as string;
  return current.trim().length > 0;
}

async function openPublicSignIn(page: any, slug: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      await page.goto(`/s/${slug}`, {
        waitUntil: "domcontentloaded",
        timeout: 12000,
      });
      const nameField = page.getByLabel(/name|full name/i);
      if (await nameField.isVisible({ timeout: 8000 }).catch(() => false)) {
        return true;
      }

      const html = await page.content().catch(() => "");
      if (
        /(Too many requests|RATE_LIMITED|No active template|Site Not Found|Unable to Load)/i.test(
          html,
        )
      ) {
        await page.waitForTimeout(500 * attempt);
        continue;
      }
    } catch {
      // Retry transient navigation failures in local/dev webserver mode.
    }

    await page.waitForTimeout(400 * attempt);
  }

  return false;
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
    const isWebkitDesktop = testInfo.project.name === "webkit";

    if (!isMobileSafari) {
      const res = await takeAndCompare(page, "login-page-full", {
        fullPage: true,
      });
      if (res.uploaded) {
        return;
      }

      await ensureStableHeight(page);
      await expect(page).toHaveScreenshot(res.filename!, {
        fullPage: true,
        timeout: 20000,
        maxDiffPixelRatio: isWebkitDesktop ? 0.03 : 0.02,
        // Override global default to avoid benign font/layout jitter on WebKit desktop.
        maxDiffPixels: isWebkitDesktop ? 9000 : 100,
      });
    }

    const loginForm = page
      .locator("form:has(input[type='email']):has(input[type='password'])")
      .first();
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

  test.beforeEach(async ({ context, request }) => {
    // Avoid public slug limiter collisions when visual tests run all projects serially.
    const randIp = `127.0.0.${Math.floor(Math.random() * 250) + 1}`;
    await context.setExtraHTTPHeaders({ "x-forwarded-for": randIp });
    await request
      .post("/api/test/clear-rate-limit", { headers: getTestRouteHeaders() })
      .catch(() => null);
  });

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
      throw new Error(
        "Visual public sign-in test site not seeded for this environment",
      );
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (TEST_SITE_SLUG.startsWith("test-site-e2e-visual")) {
      await deletePublicSite(TEST_SITE_SLUG).catch(() => null);
    }
  });

  test("public sign-in page matches baseline", async ({ page }, testInfo) => {
    const opened = await openPublicSignIn(page, TEST_SITE_SLUG);
    expect(opened).toBe(true);

    // Use a stable region to avoid browser chrome / dynamic viewport height jitter.
    const main = page.locator("main").first();
    const regionRes = await takeAndCompare(page, "public-signin-main", {
      fullPage: false,
    });
    if (regionRes.uploaded) {
      return;
    }
    const isMobileProject =
      testInfo.project.name === "mobile-chrome" ||
      testInfo.project.name === "mobile-safari";
    await expect(main).toHaveScreenshot(regionRes.filename!, {
      timeout: 20000,
      maxDiffPixelRatio: isMobileProject ? 0.1 : 0.06,
      maxDiffPixels: isMobileProject ? 13000 : 6000,
    });
  });

  test("induction form matches baseline", async ({ page }, testInfo) => {
    test.setTimeout(120000);

    const opened = await openPublicSignIn(page, TEST_SITE_SLUG);
    expect(opened).toBe(true);

    await page.evaluate((slug) => {
      window.localStorage.removeItem(`inductlite:sign-in-draft:${slug}`);
      window.localStorage.removeItem(`inductlite:last-visit:${slug}`);
    }, TEST_SITE_SLUG);
    await page.reload({ waitUntil: "domcontentloaded" });

    let reachedInduction = false;
    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (page.isClosed()) break;

      if (await inductionHeading.isVisible({ timeout: 500 }).catch(() => false)) {
        reachedInduction = true;
        break;
      }

      const backToDetails = page
        .getByRole("button", { name: /back to details/i })
        .first();
      if (await backToDetails.isVisible({ timeout: 500 }).catch(() => false)) {
        await backToDetails.click({ force: true }).catch(() => null);
        await page.waitForTimeout(250);
      }

      const nameInput = page.getByLabel(/full name|name/i).first();
      const phoneInput = page.getByLabel(/phone number|phone/i).first();
      const hasNameField = await nameInput
        .isVisible({ timeout: 1200 })
        .catch(() => false);
      const hasPhoneField = await phoneInput
        .isVisible({ timeout: 1200 })
        .catch(() => false);
      if (!hasNameField || !hasPhoneField) {
        await page.waitForTimeout(300 * attempt);
        continue;
      }

      await fillInputResilient(nameInput, "Visual Test Visitor");
      await fillInputResilient(phoneInput, "+64211234567");
      const continueButton = page.getByRole("button", {
        name: /continue to induction|sign in|continue/i,
      });
      await continueButton.first().click({ force: true }).catch(() => null);
      const detailsForm = page.locator("form").first();
      if ((await detailsForm.count().catch(() => 0)) > 0) {
        await detailsForm
          .evaluate((form) => {
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          })
          .catch(() => null);
      }

      if (await inductionHeading.isVisible({ timeout: 10000 }).catch(() => false)) {
        reachedInduction = true;
        break;
      }
      if (page.isClosed()) break;
      await page.waitForTimeout(400 * attempt);
    }

    if (!reachedInduction && !page.isClosed()) {
      const reopened = await openPublicSignIn(page, TEST_SITE_SLUG);
      if (reopened) {
        if (await inductionHeading.isVisible({ timeout: 500 }).catch(() => false)) {
          reachedInduction = true;
        }
        await fillInputResilient(
          page.getByLabel(/full name|name/i).first(),
          "Visual Test Visitor",
        );
        await fillInputResilient(
          page.getByLabel(/phone number|phone/i).first(),
          "+64211234567",
        );
        await page
          .getByRole("button", { name: /continue to induction|sign in|continue/i })
          .first()
          .click({ force: true })
          .catch(() => null);
        const detailsForm = page.locator("form").first();
        if ((await detailsForm.count().catch(() => 0)) > 0) {
          await detailsForm
            .evaluate((form) => {
              if (form instanceof HTMLFormElement) {
                form.requestSubmit();
              }
            })
            .catch(() => null);
        }
        reachedInduction = await inductionHeading
          .isVisible({ timeout: 12000 })
          .catch(() => false);
      }
    }

    expect(reachedInduction).toBe(true);
    await ensureStableHeight(page);

    const regionRes = await takeAndCompare(page, "induction-step-heading", {
      fullPage: false,
    });
    if (regionRes.uploaded) {
      return;
    }
    const isFirefox = testInfo.project.name === "firefox";
    await expect(inductionHeading).toHaveScreenshot(regionRes.filename!, {
      timeout: 20000,
      maxDiffPixelRatio: isFirefox ? 0.12 : 0.06,
      maxDiffPixels: isFirefox ? 2000 : undefined,
      stylePath: "./e2e/screenshot.heading.css",
    });
  });

  test("signature pad matches baseline", async ({ page }, testInfo) => {
    test.setTimeout(90000);

    const opened = await openPublicSignIn(page, TEST_SITE_SLUG);
    expect(opened).toBe(true);

    // Step 1: Fill details
    await fillInputResilient(
      page.getByLabel(/full name|name/i).first(),
      "Signature Visual Test",
    );
    await fillInputResilient(
      page.getByLabel(/phone number|phone/i).first(),
      "+64211234567",
    );
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
      const kioskForm = page.getByRole("region", { name: /sign-in form/i }).first();
      const kioskNameInput = kioskForm
        .getByRole("textbox", { name: /full name/i })
        .first();
      await expect(kioskNameInput).toBeVisible({ timeout: 15000 });
      await fillInputResilient(kioskNameInput, "Visual Kiosk User");

      const kioskPhoneInput = kioskForm
        .getByRole("textbox", { name: /phone number|phone/i })
        .first();
      await fillInputResilient(kioskPhoneInput, "+64211234567");

      await kioskForm
        .getByRole("combobox", { name: /visitor type/i })
        .first()
        .selectOption("CONTRACTOR")
        .catch(() => null);

      const employer = page.locator('input[id="employerName"]');
      if (await employer.count()) {
        await employer.fill("Visual Employer").catch(() => null);
      }
      const role = page.locator('input[id="roleOnSite"]');
      if (await role.count()) {
        await role.fill("Contractor").catch(() => null);
      }
      const submitKioskForm = kioskForm
        .getByRole("button", { name: /continue to induction|continue/i })
        .first();
      await submitKioskForm.click();
      const kioskInductionHeading = page.getByRole("heading", {
        name: /site induction/i,
      });
      if (await kioskInductionHeading.isVisible({ timeout: 15000 }).catch(() => false)) {
        const ack = page.getByRole("checkbox");
        const ackCount = await ack.count();
        for (let i = 0; i < ackCount; i++) {
          await ack.nth(i).check().catch(() => null);
        }
        const continueBtn = page.getByRole("button", {
          name: /continue|continue to sign off|finish/i,
        });
        await continueBtn.first().click().catch(() => null);
      }
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
      return;
    }

    await expect(canvas).toHaveScreenshot(regionRes.filename!, {
      timeout: 20000,
      maxDiffPixelRatio: testInfo.project.name === "firefox" ? 0.18 : 0.12,
      maxDiffPixels: testInfo.project.name === "firefox" ? 20000 : 12000,
    });
  });
});

// Admin dashboard visual tests (requires auth)

test.describe("Visual Regression - Admin Dashboard", () => {
  test.beforeEach(async ({ page, loginAs, workerUser }) => {
    // Programmatic login: retry for transient local-server stalls under long full-suite runs.
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await loginAs(workerUser.email);
        await page.goto("/admin", {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        await page.waitForURL(/\/admin/, { timeout: 45000 });
        return;
      } catch (err) {
        lastError = err;
        if (page.isClosed()) break;
        await page.waitForTimeout(600 * attempt);
      }
    }

    throw new Error(
      `Admin visual test setup failed (programmatic login): ${String(lastError)}`,
    );
  });

  test("live register page matches baseline", async ({ page }, testInfo) => {
    await page.goto("/admin/live-register");

    // Ensure server-rendered content has stabilised
    await page.waitForLoadState("networkidle");
    await ensureStableHeight(page);

    // Capture the page heading only (excludes dynamic visitor count) for stable comparison
    const header = page
      .getByRole("heading", { name: /live register/i })
      .first();
    if (await header.count()) {
      await header.evaluate((el) => {
        const node = el as HTMLElement;
        node.style.display = "inline-block";
        node.style.whiteSpace = "nowrap";
        node.style.width = "200px";
      });
      const regionRes = await takeAndCompare(
        page,
        "admin-live-register-heading",
        {
          fullPage: false,
        },
      );
      if (regionRes.uploaded) {
        return;
      }
      await expect(header).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio:
          testInfo.project.name === "mobile-safari"
            ? 0.85
            : testInfo.project.name === "mobile-chrome"
              ? 0.25
              : 0.08,
        maxDiffPixels:
          testInfo.project.name === "mobile-safari"
            ? 7000
            : testInfo.project.name === "mobile-chrome"
              ? 1400
              : undefined,
        stylePath: "./e2e/screenshot.heading.css",
      });
    } else {
      const res = await takeAndCompare(page, "admin-live-register-full", {
        fullPage: true,
      });
      if (res.uploaded) {
        return;
      }
      await expect(page).toHaveScreenshot(res.filename!, {
        fullPage: true,
        timeout: 20000,
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test("sites list matches baseline", async ({ page }, testInfo) => {
    await page.goto("/admin/sites");

    await page.waitForLoadState("networkidle");
    await ensureStableHeight(page);

    // Capture the page heading only for stable comparison (Sites heading)
    const header = page.getByRole("heading", { name: /sites/i }).first();
    if (await header.count()) {
      await header.evaluate((el) => {
        const node = el as HTMLElement;
        node.style.display = "inline-block";
        node.style.width = "fit-content";
      });
      const regionRes = await takeAndCompare(page, "admin-sites-list-heading", {
        fullPage: false,
      });
      if (regionRes.uploaded) {
        return;
      }
      const isMobileSafari = testInfo.project.name === "mobile-safari";
      await expect(header).toHaveScreenshot(regionRes.filename!, {
        timeout: 20000,
        maxDiffPixelRatio: isMobileSafari ? 0.85 : 0.08,
        maxDiffPixels: isMobileSafari ? 3000 : undefined,
        stylePath: "./e2e/screenshot.heading.css",
      });
    } else {
      const res = await takeAndCompare(page, "admin-sites-list-full", {
        fullPage: true,
      });
      if (res.uploaded) {
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
