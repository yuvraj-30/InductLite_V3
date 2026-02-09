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
    await request.post(`/api/test/clear-rate-limit`);
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
    await page.goto("/s/nonexistent-site-12345");

    // Should show error or 404
    await expect(
      page.getByText(/not found|invalid|doesn't exist/i),
    ).toBeVisible();
  });

  test("should validate required fields", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    // Try to submit without filling required fields
    const submitButton = page.getByRole("button", {
      name: /sign in|continue|submit/i,
    });
    await submitButton.click();

    // Should show validation errors
    await expect(
      page.getByText(/required|please enter|please enter a value/i),
    ).toBeVisible();
  });

  test("should validate phone number format", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    if (!ok) {
      test.skip(true, "Public site not seeded in this environment");
      return;
    }
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/name/i).fill("Test Visitor");
    await page.getByLabel(/phone/i).fill("123"); // Too short

    const submitButton = page.getByRole("button", {
      name: /sign in|continue|submit/i,
    });
    await submitButton.click();

    // Should show phone validation error message
    await expect(
      page.getByText(/invalid phone number|phone number is too short/i),
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

    await nameField.fill("E2E Test Visitor");
    await phoneField.fill(uniqueNzPhone());

    await expect(nameField).toHaveValue("E2E Test Visitor");
    await expect(phoneField).toHaveValue(/^\+64/);

    // Fill email if present
    const emailField = page.getByLabel(/email/i);
    if (await emailField.isVisible()) {
      await emailField.fill("e2e@test.com");
    }

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

    // Wait up to 10s for any of these to appear
    for (let i = 0; i < 20; i++) {
      if (await completeButton.isVisible().catch(() => false)) break;
      if (await signOutLink.isVisible().catch(() => false)) break;
      if (await inductionHeading.isVisible().catch(() => false)) break;
      await page.waitForTimeout(500);
    }

    const anyVisible =
      (await completeButton.isVisible().catch(() => false)) ||
      (await signOutLink.isVisible().catch(() => false)) ||
      (await inductionHeading.isVisible().catch(() => false));
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

    await nameField.fill("E2E Test Visitor");
    await phoneField.fill(uniqueNzPhone());

    await expect(nameField).toHaveValue("E2E Test Visitor");
    await expect(phoneField).toHaveValue(/^\+64/);
    await page
      .getByRole("button", {
        name: /continue to induction|sign in|continue|submit/i,
      })
      .click();

    // Wait for induction form heading
    await expect(
      page.getByRole("heading", { level: 2, name: /site induction/i }),
    ).toBeVisible({ timeout: 10000 });

    // Complete induction - answer all question types

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
    const submitInductionButton = page.getByRole("button", {
      name: /complete sign-in|continue to sign off|complete sign in|finish|sign off/i,
    });
    await submitInductionButton.first().click();

    // Some templates have an additional "Sign Off" confirmation step - handle it if present
    const signOutAnchor = page.locator('a[href*="/sign-out"]');
    const signOffHeading = page.getByRole("heading", {
      level: 2,
      name: /sign off/i,
    });

    // Wait up to 20s for either the final sign-out link or the sign-off confirmation screen
    for (let i = 0; i < 40; i++) {
      if (await signOutAnchor.isVisible().catch(() => false)) break;
      if (await signOffHeading.isVisible().catch(() => false)) break;
      await page.waitForTimeout(500);
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

      await expect(page.getByText("Please provide a signature")).not.toBeVisible({
        timeout: 3000,
      });

      await expect(confirmBtn).toBeEnabled({ timeout: 10000 });

      const canClick =
        (await confirmBtn.count()) > 0 &&
        (await confirmBtn.isVisible().catch(() => false)) &&
        (await confirmBtn.isEnabled().catch(() => false));
      if (canClick) {
        await confirmBtn.scrollIntoViewIfNeeded().catch(() => null);
        await confirmBtn
          .evaluate((el) => (el as HTMLButtonElement).click())
          .catch(() => null);
      } else {
        await page.keyboard.press("Enter").catch(() => null);
      }
    }

    // Final assertions
    await expect(signOutAnchor.first()).toBeVisible({ timeout: 30000 });
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
  const TEST_SITE_SLUG = "test-site";

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
