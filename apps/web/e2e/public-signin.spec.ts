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

const DETAILS_TO_INDUCTION_CTA = /continue to induction|review site induction/i;
const INDUCTION_TO_SIGN_OFF_CTA =
  /continue to sign off|proceed to final clearance|complete sign-in|complete sign in|finish|sign off/i;
const SUCCESS_HEADING_TEXT = /signed in successfully|cleared for site/i;

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

// Public sign-in suite performs repeated seed/setup operations and multi-step flows.
// Keep a higher timeout budget for tests and hooks in this file.
test.setTimeout(120000);

// Helper to attempt opening a public site and retry on rate-limited or transient errors
// Returns true if the site loaded successfully, false if the site does not exist and tests should skip
async function isDetailsStepVisible(page: Page): Promise<boolean> {
  const hasNameByLabel = await page.getByLabel(/full name|name/i).first().isVisible().catch(() => false);
  const hasNameById = await page.locator("#visitorName").first().isVisible().catch(() => false);
  const hasPhoneByLabel = await page
    .getByLabel(/phone number|phone/i)
    .first()
    .isVisible()
    .catch(() => false);
  const hasPhoneById = await page.locator("#visitorPhone").first().isVisible().catch(() => false);
  return (hasNameByLabel || hasNameById) && (hasPhoneByLabel || hasPhoneById);
}

async function openSite(page: Page, slug: string): Promise<boolean> {
  const isClosedError = (value: unknown): boolean => {
    const message = value instanceof Error ? value.message : String(value);
    return /Target page, context or browser has been closed/i.test(message);
  };

  // Keep retry budget bounded but tolerant of slower mobile browser lanes.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (page.isClosed()) {
      return false;
    }

    try {
      await page.goto(`/s/${slug}`, {
        waitUntil: "domcontentloaded",
        timeout: 8000,
      });
    } catch (err) {
      if (isClosedError(err)) {
        return false;
      }
      if (page.isClosed()) {
        return false;
      }
      await page.waitForTimeout(350);
      continue;
    }
    try {
      await expect.poll(async () => isDetailsStepVisible(page)).toBe(true);
      await page.waitForTimeout(500);
      const visible = await isDetailsStepVisible(page);
      if (visible) {
        return true;
      }

      // If content changed, treat as transient and retry
      console.warn(
        `openSite: label disappeared after initial load, retrying (attempt ${attempt + 1})`,
      );
      if (page.isClosed()) {
        return false;
      }
      await page.waitForTimeout(300);
      continue;
    } catch (err) {
      // page.content can throw if the page/context was closed; handle that gracefully
      let content = "";
      try {
        content = await page.content();
      } catch (pageErr) {
        if (page.isClosed() || isClosedError(pageErr)) {
          return false;
        }
        console.warn(
          `openSite: failed to read page content (attempt ${attempt + 1}): ${String(pageErr)}`,
        );
        // Try a short delay and retry
        if (page.isClosed()) {
          return false;
        }
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
        if (page.isClosed()) {
          return false;
        }
        await page.waitForTimeout(700);
        continue;
      }
      // else try again after a short delay
      if (page.isClosed()) {
        return false;
      }
      await page.waitForTimeout(300);
    }
  }
  // Final navigation - let test fail deterministically if still broken and log short snippet
  if (page.isClosed()) {
    return false;
  }
  try {
    await page.goto(`/s/${slug}`, {
      waitUntil: "domcontentloaded",
      timeout: 8000,
    });
  } catch (err) {
    if (isClosedError(err)) {
      return false;
    }
    return false;
  }
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

  // Final verification: only treat the page as "open" when the actual sign-in
  // field is rendered. This avoids false positives on partially hydrated pages.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await expect.poll(async () => isDetailsStepVisible(page)).toBe(true);
      return true;
    } catch {
      if (attempt === 0) {
        try {
          await page.reload({ waitUntil: "domcontentloaded", timeout: 8000 });
        } catch {
          return false;
        }
      }
    }
  }

  return false;
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
  for (let attempt = 1; attempt <= 4; attempt++) {
    await input.click({ force: true }).catch(() => null);
    await input.fill(value).catch(() => null);

    const current = await input.inputValue().catch(() => "");
    if (current === value) {
      return;
    }

    await input.type(value, { delay: 10 }).catch(() => null);
    const typed = await input.inputValue().catch(() => "");
    if (typed === value) {
      return;
    }

    await page.waitForTimeout(200 * attempt);
  }

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

async function ensureDetailsPersisted(
  page: Page,
  details: {
    name: string;
    phone: string;
    email?: string;
    visitorType?: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  },
): Promise<void> {
  const nameField = page.locator("#visitorName").first();
  const phoneField = page.locator("#visitorPhone").first();

  for (let attempt = 1; attempt <= 4; attempt++) {
    const currentName = await nameField.inputValue().catch(() => "");
    const currentPhone = await phoneField.inputValue().catch(() => "");
    const hasExpectedName = currentName === details.name;
    const hasExpectedPhone = /^\+64/.test(currentPhone);
    if (hasExpectedName && hasExpectedPhone) {
      return;
    }

    await fillDetailsForm(page, details).catch(() => null);
    await page.waitForTimeout(250 * attempt);
  }

  await expect(nameField).toHaveValue(details.name);
  await expect(phoneField).toHaveValue(/^\+64/);
}

async function continueToInductionWithRetry(
  page: Page,
  refill?: {
    name: string;
    phone: string;
    email?: string;
    visitorType?: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
    geofenceOverrideCode?: string;
  },
): Promise<boolean> {
  const inductionStepCta = page
    .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
    .first();
  const detailsForm = page.locator("form").first();
  const continueButton = page
    .getByRole("button", { name: DETAILS_TO_INDUCTION_CTA })
    .first();

  for (let attempt = 1; attempt <= 6; attempt++) {
    if (await inductionStepCta.isVisible({ timeout: 500 }).catch(() => false)) {
      return true;
    }

    if (refill?.geofenceOverrideCode) {
      await fillAndAssertInput(
        page,
        "#geofenceOverrideCode",
        refill.geofenceOverrideCode,
      ).catch(() => null);
    }

    await continueButton.click({ force: true }).catch(() => null);
    const hasDetailsForm = (await detailsForm.count().catch(() => 0)) > 0;
    if (hasDetailsForm) {
      await detailsForm
        .evaluate((form) => {
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        })
        .catch(() => null);
    }

    if (await inductionStepCta.isVisible({ timeout: 7000 }).catch(() => false)) {
      return true;
    }

    if (refill) {
      await fillDetailsForm(page, refill).catch(() => null);
      if (refill.geofenceOverrideCode) {
        await fillAndAssertInput(
          page,
          "#geofenceOverrideCode",
          refill.geofenceOverrideCode,
        ).catch(() => null);
      }
    }
    await page.waitForTimeout(300 * attempt);
  }

  return false;
}

async function continueToSignOffWithRetry(page: Page): Promise<boolean> {
  const signOffHeading = page.getByRole("heading", {
    level: 2,
    name: /sign off/i,
  });
  const confirmSignInButton = page
    .getByRole("button", { name: /confirm\s+(?:and|&)\s+sign in/i })
    .first();
  const successHeading = page
    .getByRole("heading", { level: 2, name: SUCCESS_HEADING_TEXT })
    .first();
  const signOutLink = page.locator('a[href*="/sign-out"]').first();
  const continueToSignOffButton = page
    .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
    .first();
  const inductionAckCheckbox = page
    .getByLabel(/i acknowledge and agree to the above/i)
    .first();

  for (let attempt = 1; attempt <= 4; attempt++) {
    const hasSignOffHeading = await signOffHeading
      .isVisible({ timeout: 600 })
      .catch(() => false);
    const hasConfirmButton = await confirmSignInButton
      .isVisible({ timeout: 600 })
      .catch(() => false);
    const hasSuccessHeading = await successHeading
      .isVisible({ timeout: 600 })
      .catch(() => false);
    const hasSignOutLink = await signOutLink
      .isVisible({ timeout: 600 })
      .catch(() => false);

    if (hasSignOffHeading || hasConfirmButton || hasSuccessHeading || hasSignOutLink) {
      return true;
    }

    const canContinue = await continueToSignOffButton
      .isVisible({ timeout: 600 })
      .catch(() => false);
    if (canContinue) {
      const ackVisible = await inductionAckCheckbox
        .isVisible({ timeout: 400 })
        .catch(() => false);
      if (ackVisible) {
        await inductionAckCheckbox.check({ force: true }).catch(() => null);
      }
      await continueToSignOffButton.click({ force: true }).catch(() => null);
    }

    const movedToSignOff = await signOffHeading
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    const movedToConfirm = await confirmSignInButton
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    const reachedSuccess = await successHeading
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    const reachedSignOutLink = await signOutLink
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (movedToSignOff || movedToConfirm || reachedSuccess || reachedSignOutLink) {
      return true;
    }

    await page.waitForTimeout(250 * attempt);
  }

  const finalSignOffVisible = await signOffHeading.isVisible().catch(() => false);
  if (finalSignOffVisible) return true;
  const finalConfirmVisible = await confirmSignInButton.isVisible().catch(() => false);
  if (finalConfirmVisible) return true;
  const finalSuccessVisible = await successHeading.isVisible().catch(() => false);
  if (finalSuccessVisible) return true;
  return signOutLink.isVisible().catch(() => false);
}

async function drawSignatureIfAvailable(page: Page): Promise<void> {
  const canvas = page.locator("#signature-canvas").first();

  if ((await canvas.count()) === 0) {
    return;
  }

  await canvas.waitFor({ state: "visible", timeout: 10_000 });
  await canvas.scrollIntoViewIfNeeded().catch(() => null);

  const drawStroke = async (): Promise<boolean> => {
    const box = await canvas.boundingBox();
    if (!box) return false;

    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 50, { steps: 8 });
    await page.mouse.up();
    return true;
  };

  // The dynamic signature canvas can hydrate a moment after the step appears.
  // Retry briefly so we do not proceed to submit before a stroke is actually drawn.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await drawStroke()) {
      return;
    }
    await page.waitForTimeout(250);
  }
}

async function checkSignOffTermsIfPresent(page: Page): Promise<void> {
  const termsByLabel = page
    .getByLabel(
      /I acknowledge the site safety terms and conditions|I acknowledge the site safety terms and privacy notice|I accept|terms and conditions|terms and privacy/i,
    )
    .first();

  if ((await termsByLabel.count()) > 0) {
    await termsByLabel.check().catch(() => null);
    return;
  }

  const termsCheckbox = page.locator("#hasAcceptedTerms").first();
  if ((await termsCheckbox.count()) > 0) {
    await termsCheckbox.check().catch(() => null);
  }
}

async function submitSignOffWithSignatureRetry(page: Page): Promise<void> {
  const successHeading = page.getByRole("heading", {
    level: 2,
    name: SUCCESS_HEADING_TEXT,
  });
  const signOutLink = page.locator('a[href*="/sign-out"]').first();
  if (
    (await successHeading.isVisible().catch(() => false)) ||
    (await signOutLink.isVisible().catch(() => false))
  ) {
    return;
  }

  const signOffHeading = page.getByRole("heading", {
    level: 2,
    name: /sign off/i,
  });
  const inductionAckCheckbox = page
    .getByLabel(/i acknowledge and agree to the above/i)
    .first();
  if (await inductionAckCheckbox.isVisible({ timeout: 300 }).catch(() => false)) {
    await inductionAckCheckbox.check({ force: true }).catch(() => null);
  }
  if (!(await continueToSignOffWithRetry(page))) {
    throw new Error("Unable to reach sign-off step before submit");
  }

  const confirmButton = page
    .getByRole("button", { name: /confirm\s+(?:&|and)\s+sign in/i })
    .first();
  await confirmButton.scrollIntoViewIfNeeded().catch(() => null);
  await confirmButton.waitFor({ state: "visible", timeout: 10000 });

  const signatureAlert = page
    .getByRole("alert")
    .filter({ hasText: /please provide a signature/i })
    .first();
  const geofenceBlockedMessage = page
    .getByText(
      /geofence policy blocked this sign-in|please provide the supervisor geofence override code/i,
    )
    .first();

  for (let attempt = 1; attempt <= 4; attempt++) {
    if (
      (await successHeading.isVisible().catch(() => false)) ||
      (await signOutLink.isVisible().catch(() => false))
    ) {
      return;
    }

    const canConfirm = await confirmButton
      .isVisible({ timeout: 800 })
      .catch(() => false);
    if (!canConfirm) {
      await page.waitForTimeout(150 * attempt);
      continue;
    }

    await drawSignatureIfAvailable(page);
    await checkSignOffTermsIfPresent(page);
    await confirmButton.click({ force: true, timeout: 5000 }).catch(() => null);

    let reachedPostSubmitState = false;
    for (let poll = 0; poll < 20; poll++) {
      const needsSignature = await signatureAlert
        .isVisible({ timeout: 200 })
        .catch(() => false);
      if (needsSignature) {
        break;
      }

      const blockedByGeofence = await geofenceBlockedMessage
        .isVisible({ timeout: 200 })
        .catch(() => false);
      const signedIn = await successHeading
        .isVisible({ timeout: 200 })
        .catch(() => false);
      const hasSignOut = await signOutLink.isVisible({ timeout: 200 }).catch(() => false);
      const leftSignOff = !(await signOffHeading.isVisible().catch(() => false));

      if (blockedByGeofence || signedIn || hasSignOut || leftSignOff) {
        reachedPostSubmitState = true;
        break;
      }

      await page.waitForTimeout(150);
    }

    if (reachedPostSubmitState) {
      return;
    }

    await page.waitForTimeout(150 * attempt);
  }

  if (await signatureAlert.isVisible().catch(() => false)) {
    throw new Error("Unable to submit sign-off: signature was not captured");
  }
}

test.describe.serial("Public Sign-In Flow", () => {
  test.describe.configure({ timeout: 90000 });

  // Test site slug - may be created dynamically for E2E runs
  let TEST_SITE_SLUG = "test-site";

  // Create a temporary public site for this suite when test runner is allowed
  test.beforeAll(async ({ request, seedPublicSite }) => {
    test.setTimeout(120000);

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
        throw new Error(
          "Public site not seeded in this environment (run 'npm run db:seed')",
        );
      }
    } catch (err) {
      // Network or other error - fail fast so setup issues are explicit.
      throw new Error(`Could not verify public site readiness: ${String(err)}`);
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
    expect(ok).toBe(true);

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

  test("should switch induction language and render localized content", async ({
    page,
    seedPublicSite,
    deletePublicSite,
  }) => {
    const seeded = await seedPublicSite({
      slugPrefix: "test-site-lang-e2e",
      includeLanguageVariants: true,
    });
    const languageSlug = seeded.slug;
    expect(languageSlug).toBeTruthy();

    if (!languageSlug) {
      return;
    }

    try {
      const ok = await openSite(page, languageSlug);
      expect(ok).toBe(true);

      const visitorName = "Language Visitor";
      const visitorPhone = uniqueNzPhone();
      await fillDetailsForm(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "language@test.com",
      });

      const reachedInduction = await continueToInductionWithRetry(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "language@test.com",
      });
      expect(reachedInduction).toBe(true);

      const languageSelectorByLabel = page
        .getByLabel(/induction language/i)
        .first();
      const languageSelector =
        (await languageSelectorByLabel.count()) > 0
          ? languageSelectorByLabel
          : page.locator("select").first();
      await expect(languageSelector).toBeVisible({ timeout: 10000 });
      await languageSelector.selectOption("mi").catch(async () => {
        await languageSelector.selectOption({ label: /te reo maori/i });
      });

      await expect(
        page.getByRole("heading", { name: /whakauru pae/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/E whakaae ana ahau ki nga ture o te pae/i).first(),
      ).toBeVisible();
    } finally {
      await deletePublicSite(languageSlug);
    }
  });

  test("should enforce media acknowledgement and quiz pass threshold", async ({
    page,
    seedPublicSite,
    deletePublicSite,
  }) => {
    const seeded = await seedPublicSite({
      slugPrefix: "test-site-media-quiz-e2e",
      includeMediaQuizFlow: true,
    });
    const mediaQuizSlug = seeded.slug;
    expect(mediaQuizSlug).toBeTruthy();

    if (!mediaQuizSlug) {
      return;
    }

    try {
      const ok = await openSite(page, mediaQuizSlug);
      expect(ok).toBe(true);

      const visitorName = "Media Quiz Visitor";
      const visitorPhone = uniqueNzPhone();
      await fillDetailsForm(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "media.quiz@test.com",
      });

      const reachedInduction = await continueToInductionWithRetry(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "media.quiz@test.com",
      });
      expect(reachedInduction).toBe(true);

      await expect(
        page.getByRole("heading", { name: /induction material/i }),
      ).toBeVisible();

      await page
        .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
        .click();

      await expect(
        page.getByText(/please review and acknowledge the induction media/i),
      ).toBeVisible();

      await page
        .getByRole("checkbox", {
          name: /I have reviewed the induction material before continuing/i,
        })
        .check();

      const failedQuizOption = page
        .locator('input[type="radio"][value="no"]')
        .first();
      await failedQuizOption.scrollIntoViewIfNeeded().catch(() => null);
      await failedQuizOption.check({ force: true });
      await page
        .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
        .click();

      await expect(
        page.getByRole("heading", { level: 2, name: /sign off/i }),
      ).toBeVisible();

      await drawSignatureIfAvailable(page);

      await page.locator("#hasAcceptedTerms").check();
      await page.getByRole("button", { name: /confirm and sign in/i }).click();

      await expect(
        page.getByText(/quiz pass threshold not met|below the required/i).first(),
      ).toBeVisible();
    } finally {
      await deletePublicSite(mediaQuizSlug);
    }
  });

  test("should complete media-first quiz flow when acknowledgement and answers pass", async ({
    page,
    seedPublicSite,
    deletePublicSite,
  }) => {
    const seeded = await seedPublicSite({
      slugPrefix: "test-site-media-quiz-pass-e2e",
      includeMediaQuizFlow: true,
    });
    const mediaQuizSlug = seeded.slug;
    expect(mediaQuizSlug).toBeTruthy();

    if (!mediaQuizSlug) {
      return;
    }

    try {
      const ok = await openSite(page, mediaQuizSlug);
      expect(ok).toBe(true);

      const visitorName = "Media Quiz Pass Visitor";
      const visitorPhone = uniqueNzPhone();
      await fillDetailsForm(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "media.quiz.pass@test.com",
      });

      const reachedInduction = await continueToInductionWithRetry(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "media.quiz.pass@test.com",
      });
      expect(reachedInduction).toBe(true);

      await expect(
        page.getByRole("heading", { name: /induction material/i }),
      ).toBeVisible();

      await page
        .getByRole("checkbox", {
          name: /I have reviewed the induction material before continuing/i,
        })
        .check();

      const passingQuizOption = page
        .locator('input[type="radio"][value="yes"]')
        .first();
      await passingQuizOption.scrollIntoViewIfNeeded().catch(() => null);
      await passingQuizOption.check({ force: true });
      await page
        .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
        .click();

      await expect(
        page.getByRole("heading", { level: 2, name: /sign off/i }),
      ).toBeVisible();

      await drawSignatureIfAvailable(page);

      await page.locator("#hasAcceptedTerms").check();
      await page.getByRole("button", { name: /confirm and sign in/i }).click();

      const signOutLink = page.locator('a[href*="/sign-out"]');
      const successHeading = page.getByRole("heading", {
        level: 2,
        name: SUCCESS_HEADING_TEXT,
      });

      await expect
        .poll(async () => {
          const hasSignOutLink = await signOutLink
            .first()
            .isVisible()
            .catch(() => false);
          const hasSuccessHeading = await successHeading
            .isVisible()
            .catch(() => false);
          return hasSignOutLink || hasSuccessHeading;
        })
        .toBe(true);
    } finally {
      await deletePublicSite(mediaQuizSlug);
    }
  });

  test("should block sign-in when geofence override is required but missing", async ({
    page,
    seedPublicSite,
    deletePublicSite,
  }) => {
    const seeded = await seedPublicSite({
      slugPrefix: "test-site-geofence-block-e2e",
      includeGeofenceOverrideFlow: true,
    });
    const geofenceSlug = seeded.slug;
    expect(geofenceSlug).toBeTruthy();

    if (!geofenceSlug) {
      return;
    }

    try {
      const ok = await openSite(page, geofenceSlug);
      expect(ok).toBe(true);

      const visitorName = "Geofence Block Visitor";
      const visitorPhone = uniqueNzPhone();
      await fillDetailsForm(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "geofence.block@test.com",
      });

      await expect(
        page.getByLabel(/supervisor geofence override code/i),
      ).toBeVisible();

      const reachedInduction = await continueToInductionWithRetry(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "geofence.block@test.com",
      });
      expect(reachedInduction).toBe(true);

      await page
        .getByLabel(/I acknowledge and agree to the above/i)
        .first()
        .check();
      await page
        .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
        .click();
      await submitSignOffWithSignatureRetry(page);

      await expect(
        page
          .getByText(
            /geofence policy blocked this sign-in|please provide the supervisor geofence override code/i,
          )
          .first(),
      ).toBeVisible();
    } finally {
      await deletePublicSite(geofenceSlug);
    }
  });

  test("should allow sign-in when geofence override code is provided", async ({
    page,
    seedPublicSite,
    deletePublicSite,
  }) => {
    const seeded = await seedPublicSite({
      slugPrefix: "test-site-geofence-override-e2e",
      includeGeofenceOverrideFlow: true,
    });
    const geofenceSlug = seeded.slug;
    expect(geofenceSlug).toBeTruthy();

    if (!geofenceSlug) {
      return;
    }

    try {
      const ok = await openSite(page, geofenceSlug);
      expect(ok).toBe(true);

      const visitorName = "Geofence Override Visitor";
      const visitorPhone = uniqueNzPhone();
      await fillDetailsForm(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "geofence.override@test.com",
      });

      await page
        .getByLabel(/supervisor geofence override code/i)
        .fill(seeded.geofenceOverrideCode ?? "123456");

      const reachedInduction = await continueToInductionWithRetry(page, {
        name: visitorName,
        phone: visitorPhone,
        email: "geofence.override@test.com",
        geofenceOverrideCode: seeded.geofenceOverrideCode ?? "123456",
      });
      expect(reachedInduction).toBe(true);

      await page
        .getByLabel(/I acknowledge and agree to the above/i)
        .first()
        .check();
      await page
        .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
        .click();
      await submitSignOffWithSignatureRetry(page);

      await expect(
        page.getByRole("heading", {
          level: 2,
          name: SUCCESS_HEADING_TEXT,
        }),
      ).toBeVisible();
    } finally {
      await deletePublicSite(geofenceSlug);
    }
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
    expect(ok).toBe(true);
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });
    await fillDetailsForm(page, { name: "", phone: "" });

    // Try to submit without filling required fields
    const submitButton = page.getByRole("button", {
      name: DETAILS_TO_INDUCTION_CTA,
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
      page.getByRole("button", { name: DETAILS_TO_INDUCTION_CTA }),
    ).toBeVisible();
  });

  test("should validate phone number format", async ({ page }) => {
    const ok = await openSite(page, TEST_SITE_SLUG);
    expect(ok).toBe(true);
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    await fillDetailsForm(page, {
      name: "Test Visitor",
      phone: "123", // Too short / invalid E.164
    });

    const submitButton = page.getByRole("button", {
      name: DETAILS_TO_INDUCTION_CTA,
    });
    await submitButton.click();

    // Rendering of inline validation copy can differ across engines.
    // Assert behavior: invalid phone must not advance to induction.
    await expect(
      page.getByRole("heading", { level: 2, name: /site induction/i }),
    ).toHaveCount(0);
    await expect(page.getByLabel(/phone number/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: DETAILS_TO_INDUCTION_CTA }),
    ).toBeVisible();
  });

  test("should complete sign-in flow", async ({ page }) => {
    test.slow();

    const ok = await openSite(page, TEST_SITE_SLUG);
    expect(ok).toBe(true);
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    // Fill in visitor details
    const nameField = page.getByLabel(/full name/i);
    const phoneField = page.getByLabel(/phone number/i);
    const visitorName = "E2E Test Visitor";
    const visitorPhone = uniqueNzPhone();
    await fillDetailsForm(page, {
      name: visitorName,
      phone: visitorPhone,
      email: "e2e@test.com",
    });

    await ensureDetailsPersisted(page, {
      name: visitorName,
      phone: visitorPhone,
      email: "e2e@test.com",
    });

    // Select visitor type if present
    //const visitorType = page.getByLabel(/type|role/i);
    //if (await visitorType.isVisible()) {
    //  await visitorType.selectOption({ index: 0 });
    //}
    await page.getByLabel(/visitor type/i).selectOption("CONTRACTOR");

    // After submission we should see one of: complete button, sign-out link, or the induction form.
    const completeButton = page.getByRole("button", {
      name: /complete sign-in/i,
    });
    const signOutLink = page.getByRole("link", { name: /sign out now/i });
    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });
    let reachedInduction = await continueToInductionWithRetry(page, {
      name: visitorName,
      phone: visitorPhone,
      email: "e2e@test.com",
    });
    if (!reachedInduction) {
      const stillOnDetails =
        (await nameField.isVisible().catch(() => false)) &&
        (await phoneField.isVisible().catch(() => false));
      if (stillOnDetails) {
        const currentName = await nameField.inputValue().catch(() => "");
        const currentPhone = await phoneField.inputValue().catch(() => "");
        if (currentName !== visitorName || currentPhone !== visitorPhone) {
          await fillDetailsForm(page, {
            name: visitorName,
            phone: visitorPhone,
            email: "e2e@test.com",
          });
          await page.getByLabel(/visitor type/i).selectOption("CONTRACTOR");
        }
        reachedInduction = await continueToInductionWithRetry(page, {
          name: visitorName,
          phone: visitorPhone,
          email: "e2e@test.com",
        });
      }
    }

    await expect
      .poll(
        async () => {
          if (page.isClosed()) return false;
          const hasCompleteButton = await completeButton
            .isVisible()
            .catch(() => false);
          const hasSignOutLink = await signOutLink.isVisible().catch(() => false);
          const hasInductionHeading = reachedInduction
            ? true
            : await inductionHeading.isVisible().catch(() => false);
          return hasCompleteButton || hasSignOutLink || hasInductionHeading;
        },
        { timeout: 25000, message: "Expected sign-in flow to advance past details step" },
      )
      .toBe(true);
  });

  test("should complete induction and show sign-out token", async ({
    page,
  }) => {
    test.slow();

    const ok = await openSite(page, TEST_SITE_SLUG);
    expect(ok).toBe(true);
    await expect(page.getByLabel(/full name/i)).toBeVisible({ timeout: 5000 });

    const visitorName = "E2E Test Visitor";
    const visitorPhone = uniqueNzPhone();
    await fillDetailsForm(page, {
      name: visitorName,
      phone: visitorPhone,
      email: "e2e@test.com",
    });

    const nameField = page.getByLabel(/full name/i);
    const phoneField = page.getByLabel(/phone number/i);
    await ensureDetailsPersisted(page, {
      name: visitorName,
      phone: visitorPhone,
      email: "e2e@test.com",
    });

    const reachedInduction = await continueToInductionWithRetry(page, {
      name: visitorName,
      phone: visitorPhone,
      email: "e2e@test.com",
    });
    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });

    const signOutAnchor = page.locator('a[href*="/sign-out"]');
    const signOffHeading = page.getByRole("heading", {
      level: 2,
      name: /sign off/i,
    });
    const successHeading = page.getByRole("heading", {
      level: 2,
      name: SUCCESS_HEADING_TEXT,
    }).first();
    const appErrorHeading = page.getByRole("heading", {
      level: 1,
      name: /something went wrong/i,
    });

    if (
      reachedInduction ||
      (await inductionHeading.isVisible({ timeout: 1500 }).catch(() => false))
    ) {
      // 1. Answer ACKNOWLEDGMENT questions (checkboxes)
      const explicitAck = page
        .getByLabel(/i acknowledge and agree to the above/i)
        .first();
      if (await explicitAck.isVisible({ timeout: 500 }).catch(() => false)) {
        await explicitAck.check({ force: true }).catch(() => null);
      }
      const acknowledgments = page.locator('input[type="checkbox"]');
      const ackCount = await acknowledgments.count();
      for (let i = 0; i < ackCount; i++) {
        const checkbox = acknowledgments.nth(i);
        const visible = await checkbox.isVisible().catch(() => false);
        const enabled = await checkbox.isEnabled().catch(() => false);
        if (!visible || !enabled) continue;
        await checkbox.check({ force: true }).catch(async () => {
          await checkbox.click({ force: true }).catch(() => null);
        });
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

      const continueToSignOff = page
        .getByRole("button", {
          name: INDUCTION_TO_SIGN_OFF_CTA,
        })
        .first();
      await continueToSignOff.click({ force: true }).catch(() => null);
      const unansweredWarning = page
        .getByText(/please answer all required questions/i)
        .first();
      if (await unansweredWarning.isVisible({ timeout: 500 }).catch(() => false)) {
        for (let i = 0; i < ackCount; i++) {
          const checkbox = acknowledgments.nth(i);
          const visible = await checkbox.isVisible().catch(() => false);
          const enabled = await checkbox.isEnabled().catch(() => false);
          if (!visible || !enabled) continue;
          await checkbox.check({ force: true }).catch(() => null);
        }
        await continueToSignOff.click({ force: true }).catch(() => null);
      }
    }

    // Complete sign-off if required for this template path.
    await submitSignOffWithSignatureRetry(page);

    // In some local environments, unrelated upstream fetch failures can surface
    // as a global error page during this flow. Treat that as an environment issue.
    if (await appErrorHeading.isVisible().catch(() => false)) {
      const hasFetchFailed = await page
        .getByText(/fetch failed/i)
        .isVisible()
        .catch(() => false);
      if (hasFetchFailed) {
        throw new Error("Transient upstream fetch failure in test environment");
      }
    }

    // Final assertions
    await expect
      .poll(
        async () => {
          const signOutHref = await signOutAnchor.first().getAttribute("href").catch(() => null);
          const hasSignOutLink =
            typeof signOutHref === "string" &&
            /\/sign-out/i.test(signOutHref) &&
            /\btoken=[^&]+/i.test(signOutHref);
          const hasSuccessHeading =
            (await successHeading.count().catch(() => 0)) > 0;
          const stillOnSignOff = await signOffHeading
            .isVisible()
            .catch(() => false);
          return hasSignOutLink || hasSuccessHeading || !stillOnSignOff;
        },
        {
          timeout: 30000,
          message: "Expected sign-in completion state after induction/sign-off",
        },
      )
      .toBe(true);

    await expect
      .poll(
        async () => signOutAnchor.first().getAttribute("href"),
        {
          timeout: 10000,
          message: "Expected sign-out link with token after successful sign-in",
        },
      )
      .toMatch(/\/sign-out.*\btoken=[^&]+/i);

    const href = await signOutAnchor.first().getAttribute("href");
    expect(href).toContain("/sign-out");
    expect(href).toMatch(/\btoken=[^&]+/i);
  });

  test("should support fast-pass last visit details with signature reuse consent", async ({
    page,
  }) => {
    test.setTimeout(120000);

    const ok = await openSite(page, TEST_SITE_SLUG);
    expect(ok).toBe(true);

    await page.evaluate((slug) => {
      const key = `inductlite:last-visit:${slug}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          details: {
            visitorName: "Repeat Worker",
            visitorPhone: "+64211234567",
            visitorEmail: "repeat.worker@example.test",
            employerName: "Repeat Ltd",
            visitorType: "CONTRACTOR",
            roleOnSite: "Electrician",
          },
          signatureData: "data:image/png;base64,ZmFrZQ==",
          savedAt: new Date().toISOString(),
        }),
      );
    }, TEST_SITE_SLUG);

    await page.reload();
    await expect(
      page.getByRole("button", { name: /Use Last Visit Details/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Use Last Visit Details/i }).click();

    await expect(page.locator("#visitorName")).toHaveValue("Repeat Worker");
    await expect(page.locator("#visitorPhone")).toHaveValue("+64211234567");

    const employerVisible = await page
      .locator("#employerName")
      .isVisible()
      .catch(() => false);
    if (employerVisible) {
      await expect(page.locator("#employerName")).toHaveValue("Repeat Ltd");
    }
    const roleVisible = await page
      .locator("#roleOnSite")
      .isVisible()
      .catch(() => false);
    if (roleVisible) {
      await expect(page.locator("#roleOnSite")).toHaveValue("Electrician");
    }

    await page
      .getByRole("button", { name: DETAILS_TO_INDUCTION_CTA })
      .click();

    await expect(
      page.getByRole("heading", { level: 2, name: /site induction/i }),
    ).toBeVisible({ timeout: 10000 });

    const continueToSignOffButton = page
      .getByRole("button", { name: INDUCTION_TO_SIGN_OFF_CTA })
      .first();
    const requiredAck = page
      .getByLabel(/i acknowledge and agree to the above/i)
      .first();

    for (let attempt = 1; attempt <= 4; attempt++) {
      if (await requiredAck.isVisible({ timeout: 400 }).catch(() => false)) {
        await requiredAck.check({ force: true }).catch(async () => {
          await requiredAck.click({ force: true }).catch(() => null);
        });
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
        await page
          .locator(`input[type="radio"][name="${groupName}"]`)
          .first()
          .check()
          .catch(() => null);
      }

      await continueToSignOffButton.click({ force: true }).catch(() => null);
      const reachedSignOff = await page
        .getByRole("heading", { level: 2, name: /sign off/i })
        .isVisible({ timeout: 1200 })
        .catch(() => false);
      if (reachedSignOff) {
        break;
      }

      const unansweredWarning = await page
        .getByText(/please answer all required questions/i)
        .first()
        .isVisible({ timeout: 400 })
        .catch(() => false);
      if (!unansweredWarning) {
        break;
      }
      await page.waitForTimeout(250 * attempt);
    }

    expect(await continueToSignOffWithRetry(page)).toBe(true);

    await expect(
      page.getByText(/Use my previously saved signature for this visit/i),
    ).toBeVisible();
    await page
      .getByRole("checkbox", {
        name: /Use my previously saved signature for this visit/i,
      })
      .check();
    await page.locator("#hasAcceptedTerms").check();

    await page.getByRole("button", { name: /Confirm and Sign In/i }).click();

    const signOutAnchor = page.locator('a[href*="/sign-out"]');
    const successHeading = page.getByRole("heading", {
      level: 2,
      name: SUCCESS_HEADING_TEXT,
    }).first();

    await expect
      .poll(
        async () => {
          const signOutHref = await signOutAnchor.first().getAttribute("href").catch(() => null);
          const hasSignOutLink =
            typeof signOutHref === "string" &&
            /\/sign-out/i.test(signOutHref) &&
            /\btoken=[^&]+/i.test(signOutHref);
          const hasSuccessHeading =
            (await successHeading.count().catch(() => 0)) > 0;
          return hasSignOutLink || hasSuccessHeading;
        },
        { timeout: 90000, message: "Expected sign-in to complete successfully" },
      )
      .toBe(true);
  });
});

test.describe.serial("Sign-Out Flow", () => {
  test("should show error for invalid sign-out token", async ({ page }) => {
    test.slow();
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
    test.slow();
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
    test.setTimeout(120000);

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
        throw new Error(
          "Public site not seeded in this environment (run 'npm run db:seed')",
        );
      }
    } catch (error) {
      throw new Error(`Could not verify public site for XSS tests: ${String(error)}`);
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
    expect(ok).toBe(true);

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
