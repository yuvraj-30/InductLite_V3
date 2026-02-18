/**
 * Public Sign-In Flow E2E Tests
 *
 * Tests the public visitor sign-in kiosk flow:
 * - QR code link access
 * - Induction form completion
 * - Sign-out token generation
 * - Self-service sign-out
 */

import { test, expect } from "./test-fixtures";
import type { Page } from "@playwright/test";
import { getTestRouteHeaders } from "./utils/test-route-auth";

const E2E_QUIET = (() => {
  const v = process.env.E2E_QUIET;
  return v === "1" || v?.toLowerCase() === "true";
})();

function uniqueNzPhone(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `+6421${suffix}`;
}

// Set a unique client IP per test to avoid hitting the public slug rate limiter
// Also clear any in-memory rate-limit counters to ensure predictable test state
test.beforeEach(async ({ context, request }) => {
  const randIp = `127.0.0.${Math.floor(Math.random() * 250) + 1}`;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randIp });

  // Clear in-memory rate-limiter state via test-only endpoint
  try {
    await request.post(`/api/test/clear-rate-limit`, {
      headers: getTestRouteHeaders(),
    });
  } catch (err) {
    // Non-fatal - proceed with test. In CI the endpoint should be allowed.
    if (!E2E_QUIET) {
      console.warn("Failed to clear rate limit state:", String(err));
    }
  }
});

// Helper to attempt opening a public site and retry on rate-limited or transient errors
// Returns true if the site loaded successfully, false if the site does not exist and tests should skip
async function openSite(page: Page, slug: string): Promise<boolean> {
  // Increase attempts to tolerate transient dev-server/hydration delays
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(`/s/${slug}`);
    try {
      // Wait for the sign-in name field to be visible and stable. Increase timeout to allow
      // client-side rendering/hydration to finish and ensure we don't return prematurely.
      await page
        .getByLabel(/full name/i)
        .waitFor({ state: "visible", timeout: 7000 });
      // Stabilize: wait briefly and ensure the label is still present and visible
      await page.waitForTimeout(500);
      const visible = await page.getByLabel(/full name/i).isVisible();
      if (visible) {
        return true;
      }

      // If content changed, treat as transient and retry
      console.warn(
        `openSite: label disappeared after initial load, retrying (attempt ${attempt + 1})`,
      );
      await page.waitForTimeout(300);
      continue;
    } catch (err) {
      // page.content can throw if the page/context was closed; handle that gracefully
      let content = "";
      try {
        content = await page.content();
      } catch (pageErr) {
        console.warn(
          `openSite: failed to read page content (attempt ${attempt + 1}): ${String(pageErr)}`,
        );
        // Try a short delay and retry
        await page.waitForTimeout(300);
        continue;
      }

      if (
        /(Too many requests|RATE_LIMITED|not found|No active template)/i.test(
          content,
        )
      ) {
        // transient - wait and retry
        console.warn(
          `openSite: transient response on attempt ${attempt + 1} for slug=${slug}`,
        );
        await page.waitForTimeout(700);
        continue;
      }
      // else try again after a short delay
      await page.waitForTimeout(300);
    }
  }
  // Final navigation - let test fail deterministically if still broken and log short snippet
  await page.goto(`/s/${slug}`);
  const snippet = (await page.content()).slice(0, 2000);
  console.warn(
    `openSite: final page content snippet for slug=${slug}:`,
    snippet,
  );

  // If the site is missing (local dev without seeded DB), indicate failure so caller can skip
  if (
    /(Site Not Found|No active template|NO_TEMPLATE|notFound)/i.test(snippet)
  ) {
    return false;
  }

  return true;
}

async function fillAndAssertInput(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  const exists = await page.evaluate((sel) => !!document.querySelector(sel), selector);
  if (!exists) {
    return;
  }

  const input = page.locator(selector).first();
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

async function resetDetailsForm(page: Page): Promise<void> {
  await fillAndAssertInput(page, "#visitorName", "");
  await fillAndAssertInput(page, "#visitorPhone", "");
  await fillAndAssertInput(page, "#visitorEmail", "");
  await fillAndAssertInput(page, "#employerName", "");
  await fillAndAssertInput(page, "#roleOnSite", "");
}

async function fillDetailsForm(
  page: Page,
  {
    name,
    phone,
    email = "e2e@test.com",
    visitorType = "CONTRACTOR",
  }: {
    name: string;
    phone: string;
    email?: string;
    visitorType?: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  },
): Promise<void> {
  await resetDetailsForm(page);
  await fillAndAssertInput(page, "#visitorName", name);
  await fillAndAssertInput(page, "#visitorPhone", phone);
  await fillAndAssertInput(page, "#visitorEmail", email);
  await page.locator("#visitorType").selectOption(visitorType);
}

test.describe.serial("Public Sign-In Flow", () => {
  // Test site slug - may be created dynamically for E2E runs
  let TEST_SITE_SLUG = "test-site";

  // Create a temporary public site for this suite when test runner is allowed
  test.beforeAll(async ({ request, seedPublicSite }) => {
    // Try seeding a temporary public site (preferred when running tests locally/CI)
    try {
      const body = await seedPublicSite();
      if (!E2E_QUIET) {
        console.warn("seed-public-site response:", body);
      }
      if (body?.success && body.slug) {
        TEST_SITE_SLUG = body.slug;

        // Ensure rate-limit was cleared by the server. If it wasn't, fail fast so the CI/dev
        // environment can be corrected (this usually means ALLOW_TEST_RUNNER is not set or
        // TRUST_PROXY isn't honoring X-Forwarded-For headers and the in-memory limiter cannot be cleared).
        // Treat an explicit `false` as an error, but accept `undefined` (older seeds) as success.
        // A `false` typically means the environment disallowed test-only endpoints (missing ALLOW_TEST_RUNNER)
        // or TRUST_PROXY isn't honoring headers, but it can also indicate a race where the in-memory limiter
        // was re-populated by another concurrent process before it could be cleared.
        if (body?.clearedRateLimit === false) {
          throw new Error(
            "Seeded public site but rate limit was NOT cleared by the server. Please ensure tests run with ALLOW_TEST_RUNNER=1 and TRUST_PROXY=1, or run 'npm run db:seed' locally. This prevents flaky rate-limited failures.",
          );
        }

        return;
      }
    } catch (err) {
      // Fall back to verifying an existing seeded site
      console.warn(
        "seed-public-site failed, falling back to existing seed check:",
        String(err),
      );
    }

    // Fallback: verify there's a seeded public site named 'test-site' and skip if not
    try {
      const res = await request.get(`/s/test-site`);
      const txt = await res.text();
      if (
        res.status() === 404 ||
        /Site Not Found|No active template/i.test(txt)
      ) {
        test.skip(
          true,
          "Public site not seeded in this environment (run 'npm run db:seed')",
        );
      }
    } catch (err) {
      // Network or other error - skip to avoid noisy failures
      test.skip(
        true,
        "Could not verify public site; skipping public-signin tests",
      );
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    // If we created a dynamic slug, attempt cleanup
    try {
      if (TEST_SITE_SLUG && TEST_SITE_SLUG.startsWith("test-site-e2e")) {
        const res = await deletePublicSite(TEST_SITE_SLUG);
        if (!res?.success || !res?.deleted) {
          console.warn("seed-public-site delete response:", res);
          throw new Error(
            `Failed to delete seeded public site (slug=${TEST_SITE_SLUG})`,
          );
        }
      }
    } catch (err) {
      console.warn("Failed to delete seeded public site:", String(err));
      // Fail the teardown to surface cleanup issues
      throw err;
    }
  });

  test("should display sign-in page for valid site slug", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!E2E_QUIET) {
      console.warn("openSite returned", ok);
    }
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }

    // Wait for the sign-in form to be ready
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/phone number/i)).toBeVisible({
      timeout: 10000,
    });

    // Check the page heading that specifically references the site (h2)
    await expect(
      page.getByRole("heading", { level: 2, name: /welcome to/i }),
    ).toBeVisible();
  });

  test("should show 404 for invalid site slug", async ({ page }) => {
    const response = await page.goto("/s/nonexistent-site-12345", {
      waitUntil: "domcontentloaded",
    });

    // Depending on rendering path/browser we may either see an inline error copy
    // or get a direct 404 response for the page request.
    const hasErrorText = await page
      .getByText(
        /not found|link not found|invalid|doesn't exist|site not found|expired|replaced/i,
      )
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasErrorText) {
      expect(response?.status()).toBe(404);
    }
  });

  test("should validate required fields", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });
    await fillDetailsForm(page, { name: "", phone: "" });

    // Try to submit without filling required fields
    const submitButton = page.getByRole("button", {
      name: /sign in|continue|submit/i,
    });
    await submitButton.click();

    // Browser/rendering paths can differ on how inline validation text is
    // exposed; assert behavior instead: required fields must block progression.
    await expect(
      page.getByRole("heading", { level: 2, name: /site induction/i }),
    ).toHaveCount(0);
    await expect(page.locator("#visitorName")).toHaveValue("");
    await expect(page.locator("#visitorPhone")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: /continue to induction/i }),
    ).toBeVisible();
  });

  test("should validate phone number format", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    await fillDetailsForm(page, {
      name: "Test Visitor",
      phone: "123", // Too short / invalid E.164
    });

    const submitButton = page.getByRole("button", {
      name: /sign in|continue|submit/i,
    });
    await submitButton.click();

    // Rendering of inline validation copy can differ across engines.
    // Assert behavior: invalid phone must not advance to induction.
    await expect(
      page.getByRole("heading", { level: 2, name: /site induction/i }),
    ).toHaveCount(0);
    await expect(page.getByLabel(/phone number/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue to induction/i }),
    ).toBeVisible();
  });

  test("should complete sign-in flow", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    // Fill in visitor details
    const nameField = page.getByLabel(/full name/i);
    const phoneField = page.getByLabel(/phone number/i);
    await fillDetailsForm(page, {
      name: "E2E Test Visitor",
      phone: uniqueNzPhone(),
      email: "e2e@test.com",
    });

    await expect(nameField).toHaveValue("E2E Test Visitor");
    await expect(phoneField).toHaveValue(/^\+64/);

    // Select visitor type if present
    //const visitorType = page.getByLabel(/type|role/i);
    //if (await visitorType.isVisible()) {
    //  await visitorType.selectOption({ index: 0 });
    //}
    await page.getByLabel(/visitor type/i).selectOption("CONTRACTOR");

    // Submit sign-in
    await page
      .getByRole("button", {
        name: /continue to induction|sign in|continue|submit/i,
      })
      .click();

    // After submission we should see one of: complete button, sign-out link, or the induction form.
    const completeButton = page.getByRole("button", {
      name: /complete sign-in/i,
    });
    const signOutLink = page.getByRole("link", { name: /sign out now/i });
    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });

    // Wait for transition. If still on details due click timing, retry once.
    for (let i = 0; i < 20; i++) {
      if (await completeButton.isVisible().catch(() => false)) break;
      if (await signOutLink.isVisible().catch(() => false)) break;
      if (await inductionHeading.isVisible().catch(() => false)) break;
      await page.waitForTimeout(500);
    }

    let anyVisible =
      (await completeButton.isVisible().catch(() => false)) ||
      (await signOutLink.isVisible().catch(() => false)) ||
      (await inductionHeading.isVisible().catch(() => false));

    if (!anyVisible) {
      const stillOnDetails =
        (await nameField.isVisible().catch(() => false)) &&
        (await phoneField.isVisible().catch(() => false));
      if (stillOnDetails) {
        await page
          .getByRole("button", {
            name: /continue to induction|sign in|continue|submit/i,
          })
          .click();
        for (let i = 0; i < 20; i++) {
          if (await completeButton.isVisible().catch(() => false)) break;
          if (await signOutLink.isVisible().catch(() => false)) break;
          if (await inductionHeading.isVisible().catch(() => false)) break;
          await page.waitForTimeout(500);
        }
        anyVisible =
          (await completeButton.isVisible().catch(() => false)) ||
          (await signOutLink.isVisible().catch(() => false)) ||
          (await inductionHeading.isVisible().catch(() => false));
      }
    }
    expect(anyVisible).toBe(true);
  });

  test("should complete induction and show sign-out token", async ({
    page,
  }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    // Complete sign-in
    const nameField = page.getByLabel(/full name/i);
    const phoneField = page.getByLabel(/phone number/i);

    await fillDetailsForm(page, {
      name: "E2E Test Visitor",
      phone: uniqueNzPhone(),
      email: "e2e@test.com",
    });

    await expect(nameField).toHaveValue("E2E Test Visitor");
    await expect(phoneField).toHaveValue(/^\+64/);
    await page
      .getByRole("button", {
        name: /continue to induction|sign in|continue|submit/i,
      })
      .click();

    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });
    const submitInductionButton = page.getByRole("button", {
      name: /complete sign-in|continue to sign off|complete sign in|finish|sign off/i,
    });
    const signOutAnchor = page.locator('a[href*="/sign-out"]');
    const signOffHeading = page.getByRole("heading", {
      level: 2,
      name: /sign off/i,
    });
    const successHeading = page.getByRole("heading", {
      level: 2,
      name: /signed in successfully/i,
    });
    const appErrorHeading = page.getByRole("heading", {
      level: 1,
      name: /something went wrong/i,
    });

    // Depending on template/browser timing, we may land on induction, sign-off, or final success.
    for (let i = 0; i < 40; i++) {
      if (await inductionHeading.isVisible().catch(() => false)) break;
      if (await submitInductionButton.first().isVisible().catch(() => false)) break;
      if (await signOutAnchor.first().isVisible().catch(() => false)) break;
      if (await signOffHeading.isVisible().catch(() => false)) break;
      if (await successHeading.isVisible().catch(() => false)) break;
      await page.waitForTimeout(500);
    }

    const reachedInduction =
      (await inductionHeading.isVisible().catch(() => false)) ||
      (await submitInductionButton.first().isVisible().catch(() => false));
    let reachedValidState =
      (await signOutAnchor.first().isVisible().catch(() => false)) ||
      (await signOffHeading.isVisible().catch(() => false)) ||
      (await successHeading.isVisible().catch(() => false));

    if (!reachedInduction && !reachedValidState) {
      const stillOnSignIn =
        (await nameField.isVisible().catch(() => false)) &&
        (await phoneField.isVisible().catch(() => false));

      // Retry submit once when CI/browser timing leaves us on the initial form.
      if (stillOnSignIn) {
        await page
          .getByRole("button", {
            name: /continue to induction|sign in|continue|submit/i,
          })
          .click();

        for (let i = 0; i < 20; i++) {
          if (await inductionHeading.isVisible().catch(() => false)) break;
          if (await submitInductionButton.first().isVisible().catch(() => false))
            break;
          if (await signOutAnchor.first().isVisible().catch(() => false)) break;
          if (await signOffHeading.isVisible().catch(() => false)) break;
          if (await successHeading.isVisible().catch(() => false)) break;
          await page.waitForTimeout(500);
        }
      }
    }

    const reachedInductionAfterRetry =
      (await inductionHeading.isVisible().catch(() => false)) ||
      (await submitInductionButton.first().isVisible().catch(() => false));
    reachedValidState =
      (await signOutAnchor.first().isVisible().catch(() => false)) ||
      (await signOffHeading.isVisible().catch(() => false)) ||
      (await successHeading.isVisible().catch(() => false));

    // Complete induction - answer all question types

    if (reachedInductionAfterRetry) {
      // 1. Answer ACKNOWLEDGMENT questions (checkboxes)
      const acknowledgments = page.getByRole("checkbox");
      const ackCount = await acknowledgments.count();
      for (let i = 0; i < ackCount; i++) {
        await acknowledgments.nth(i).check();
      }

      // 2. Answer all radio groups (YES_NO + MULTIPLE_CHOICE)
      // This avoids template-specific assumptions and ensures required groups are filled.
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

      // 4. Answer TEXT questions (optional medical conditions)
      const textInputs = page.locator('input[type="text"]').filter({
        has: page.locator('label:has-text("medical")'),
      });
      if ((await textInputs.count()) > 0) {
        await textInputs.first().fill("None");
      }

      // Submit induction - support multiple label variants (some templates use different button text)
      await submitInductionButton.first().click();
    } else if (!reachedValidState) {
      expect(reachedValidState).toBe(true);
    }

    // If we're on the sign-off screen, click the confirm button
    if (await signOffHeading.isVisible().catch(() => false)) {
      const confirmBtn = page
        .locator("button")
        .filter({
          hasText:
            /confirm|sign in|sign-off|sign off|complete sign-?in|finish/i,
        })
        .first();

      const canvas = page.locator("#signature-canvas");
      if ((await canvas.count()) > 0) {
        await canvas.scrollIntoViewIfNeeded().catch(() => null);
        const drawStroke = async () => {
          const box = await canvas.boundingBox();
          if (!box) return false;
          const startX = box.x + Math.max(8, box.width * 0.2);
          const startY = box.y + Math.max(8, box.height * 0.3);
          const endX = box.x + Math.max(16, box.width * 0.8);
          const endY = box.y + Math.max(16, box.height * 0.7);
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(endX, endY, { steps: 8 });
          await page.mouse.up();
          return true;
        };

        await drawStroke();

        // CI can occasionally miss a very fast stroke on canvas; retry once.
        if (await confirmBtn.isDisabled().catch(() => true)) {
          await drawStroke();
        }
      }

      const termsCheckboxByLabel = page
        .getByLabel(
          /I acknowledge the site safety terms and conditions|I accept|terms and conditions/i,
        )
        .first();
      if ((await termsCheckboxByLabel.count()) > 0) {
        await termsCheckboxByLabel.check().catch(() => null);
      } else {
        const termsCheckbox = page.locator("#hasAcceptedTerms");
        if ((await termsCheckbox.count()) > 0) {
          await termsCheckbox.check().catch(() => null);
        }
      }

      await expect(page.getByText("Please provide a signature")).not.toBeVisible({
        timeout: 3000,
      });

      await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
      await confirmBtn.scrollIntoViewIfNeeded().catch(() => null);

      // CI can intermittently miss a single click on this step; retry until we see transition.
      for (let attempt = 0; attempt < 3; attempt++) {
        await confirmBtn.click({ timeout: 5000 });

        let transitioned = false;
        for (let i = 0; i < 16; i++) {
          if (await signOutAnchor.first().isVisible().catch(() => false)) {
            transitioned = true;
            break;
          }
          if (await successHeading.isVisible().catch(() => false)) {
            transitioned = true;
            break;
          }
          if (!(await signOffHeading.isVisible().catch(() => false))) {
            transitioned = true;
            break;
          }
          await page.waitForTimeout(500);
        }

        if (transitioned) {
          break;
        }
      }
    }

    // In some local environments, unrelated upstream fetch failures can surface
    // as a global error page during this flow. Treat that as an environment issue.
    if (await appErrorHeading.isVisible().catch(() => false)) {
      const hasFetchFailed = await page
        .getByText(/fetch failed/i)
        .isVisible()
        .catch(() => false);
      if (hasFetchFailed) {
        test.skip(true, "Transient upstream fetch failure in test environment");
        return;
      }
    }

    // Final assertions
    const hasSignOutLink = await signOutAnchor.first().isVisible().catch(() => false);
    const hasSuccessHeading = await successHeading.isVisible().catch(() => false);
    expect(hasSignOutLink || hasSuccessHeading).toBe(true);

    if (!hasSignOutLink) {
      // If success UI is visible but link hydration is delayed, wait one final time.
      await expect(signOutAnchor.first()).toBeVisible({ timeout: 10000 });
    }

    const href = await signOutAnchor.first().getAttribute("href");
    expect(href).toContain("/sign-out");
    // Extra check: ensure token query parameter is present (small additional e2e check)
    expect(href).toMatch(/\btoken=[^&]+/);
  });
});

test.describe.serial("Sign-Out Flow", () => {
  test("should show error for invalid sign-out token", async ({ page }) => {
    await page.goto("/sign-out?token=invalid-token-12345&phone=+64211234567");

    // Wait for sign-out UI to appear - prefer the phone textbox; fall back to an error message
    const phoneBox = page
      .getByRole("textbox", { name: /phone number/i })
      .first();
    if ((await phoneBox.count()) > 0) {
      await expect(phoneBox).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText(/invalid|expired|not found/i)).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("should require phone number for sign-out", async ({ page }) => {
    await page.goto("/sign-out?token=some-token");

    // Should show phone input or error about missing phone
    const phoneBox = page
      .getByRole("textbox", { name: /phone number/i })
      .first();
    if ((await phoneBox.count()) > 0) {
      await expect(phoneBox).toBeVisible();
    } else {
      await expect(page.getByText(/phone|required/i)).toBeVisible();
    }
  });
});

test.describe.serial("XSS Prevention", () => {
  const XSS_PAYLOAD = "<script>alert('xss')</script>";
  let TEST_SITE_SLUG = "test-site";

  test.beforeAll(async ({ request, seedPublicSite }) => {
    try {
      const body = await seedPublicSite();
      if (body?.success && body.slug) {
        TEST_SITE_SLUG = body.slug;
        return;
      }
    } catch (err) {
      console.warn(
        "seed-public-site failed for XSS suite, falling back to existing seed:",
        String(err),
      );
    }

    // Fallback: verify the default seeded slug exists, otherwise skip suite tests.
    try {
      const res = await request.get(`/s/${TEST_SITE_SLUG}`);
      const txt = await res.text();
      if (
        res.status() === 404 ||
        /Site Not Found|No active template/i.test(txt)
      ) {
        test.skip(
          true,
          "Public site not seeded in this environment (run 'npm run db:seed')",
        );
      }
    } catch {
      test.skip(
        true,
        "Could not verify public site; skipping XSS tests for this environment",
      );
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    try {
      if (TEST_SITE_SLUG && TEST_SITE_SLUG.startsWith("test-site-e2e")) {
        await deletePublicSite(TEST_SITE_SLUG);
      }
    } catch (err) {
      console.warn("Failed to delete seeded XSS public site:", String(err));
    }
  });

  test("should sanitize name field input", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }

    // Ensure field is visible/stable before interacting to avoid intermittent hydration races
    await page
      .getByLabel(/name/i)
      .waitFor({ state: "visible", timeout: 10000 });
    await page.getByLabel(/name/i).fill(XSS_PAYLOAD);
    await page.getByLabel(/phone/i).fill(uniqueNzPhone());

    // Check that script tag is not rendered
    const content = await page.content();
    expect(content).not.toContain("<script>alert");
  });

  test("should sanitize URL parameters", async ({ page }) => {
    await page.goto(
      `/s/${TEST_SITE_SLUG}?name=${encodeURIComponent(XSS_PAYLOAD)}`,
    );

    const content = await page.content();
    expect(content).not.toContain("<script>alert");
  });
});
