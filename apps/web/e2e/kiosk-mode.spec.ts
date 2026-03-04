import { test, expect } from "./test-fixtures";

async function drawSignatureOnCanvas(
  page: import("@playwright/test").Page,
  timeoutMs = 4000,
): Promise<boolean> {
  const canvas = page.locator("#signature-canvas, canvas.sigCanvas, canvas").first();
  const visible = await canvas.isVisible({ timeout: timeoutMs }).catch(() => false);
  if (!visible) {
    return false;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const box = await canvas.boundingBox();
    if (!box) {
      await page.waitForTimeout(250);
      continue;
    }

    const startX = box.x + Math.max(8, box.width * 0.2);
    const startY = box.y + Math.max(8, box.height * 0.3);
    const midX = box.x + Math.max(16, box.width * 0.5);
    const midY = box.y + Math.max(16, box.height * 0.6);
    const endX = box.x + Math.max(24, box.width * 0.8);
    const endY = box.y + Math.max(24, box.height * 0.4);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(midX, midY, { steps: 6 });
    await page.mouse.move(endX, endY, { steps: 6 });
    await page.mouse.up();
    return true;
  }

  return false;
}

test.describe("Kiosk Mode", () => {
  let TEST_SITE_SLUG = "test-site";

  test.beforeAll(async ({ request, seedPublicSite }) => {
    try {
      const body = await seedPublicSite({ slugPrefix: "test-site-e2e-kiosk" });
      if (body?.success && body.slug) {
        TEST_SITE_SLUG = body.slug;
        return;
      }
    } catch (error) {
      // fallback to existing seed below
      console.warn(
        "kiosk seedPublicSite failed, trying fallback seeded slug:",
        String(error),
      );
    }

    const res = await request.get(`/s/${TEST_SITE_SLUG}`);
    const txt = await res.text();
    if (res.status() === 404 || /Site Not Found|No active template/i.test(txt)) {
      throw new Error(
        "Kiosk test site not seeded. Ensure test runner endpoints are enabled and seeding succeeds.",
      );
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (TEST_SITE_SLUG.startsWith("test-site-e2e-kiosk")) {
      await deletePublicSite(TEST_SITE_SLUG).catch(() => null);
    }
  });

  test("should auto-refresh after 10 seconds on success screen", async (
    { page },
    testInfo,
  ) => {
    if (process.platform === "win32") {
      test.skip(
        true,
        "Kiosk success-screen auto-refresh is flaky under Windows local Playwright/dev-server runtime.",
      );
    }

    if (
      testInfo.project.name === "mobile-chrome" ||
      testInfo.project.name === "mobile-safari"
    ) {
      test.skip(
        true,
        "Kiosk signature canvas flow is flaky under mobile emulation in full-suite runs.",
      );
    }

    test.setTimeout(120000);
    const slug = TEST_SITE_SLUG;
    await page.goto(`/s/${slug}/kiosk`);

    // Fail fast if kiosk route is unavailable to avoid burning full test timeout.
    await expect(page.locator('input[id="visitorName"]')).toBeVisible({
      timeout: 10000,
    });

    // 1. Fill in visitor details
    const visitorNameInput = page.locator('input[id="visitorName"]');
    for (let attempt = 1; attempt <= 3; attempt++) {
      await visitorNameInput.click();
      await visitorNameInput.fill("Kiosk Tester");
      const retained = await visitorNameInput.inputValue();
      if (retained) break;
      // WebKit can occasionally clear this field during hydration.
      await visitorNameInput.type("Kiosk Tester").catch(() => null);
      if (attempt < 3) {
        await page.waitForTimeout(250 * attempt);
      }
    }
    await expect(visitorNameInput).toHaveValue("Kiosk Tester");
    await page.fill('input[id="visitorPhone"]', "+64211111111");
    const employerField = page.locator('input[id="employerName"]');
    if ((await employerField.count()) > 0) {
      await employerField.first().fill("E2E Employer");
    }
    const roleField = page.locator('input[id="roleOnSite"]');
    if ((await roleField.count()) > 0) {
      await roleField.first().fill("Contractor");
    }

    // Fill optional email if present
    const emailField = page.locator('input[type="email"], input[name="email"]');
    if ((await emailField.count()) > 0) {
      await emailField.first().fill("kiosk@test.com");
    }

    // Select visitor type if present (some kiosk templates require selecting a type)
    // Try multiple selector strategies to ensure we satisfy the required enum schema
    const visitorTypeSelect = page.locator(
      'select[name="visitorType"], select[id*="visitorType"], select[aria-label*="visitor type"]',
    );
    if ((await visitorTypeSelect.count()) > 0) {
      await visitorTypeSelect
        .first()
        .selectOption({ value: "CONTRACTOR" })
        .catch(() => null);
    } else {
      // Try radio option fallback
      const contractorRadio = page
        .getByRole("radio", { name: /contractor/i })
        .first();
      if ((await contractorRadio.count()) > 0) {
        await contractorRadio.check().catch(() => null);
      }
    }

    await page.click('button[type="submit"]', { force: true });

    // 2. Complete induction (assume some questions exist)
    // For the sake of this test, we expect to be on the induction step
    await expect(page.locator("h2")).toContainText(/site induction/i, {
      timeout: 15000,
    });

    // Check all checkboxes/radios if any
    const inputs = await page
      .locator('input[type="checkbox"], input[type="radio"]')
      .all();
    for (const input of inputs) {
      const isVisible = await input.isVisible().catch(() => false);
      const isEnabled = await input.isEnabled().catch(() => false);
      if (!isVisible || !isEnabled) {
        continue;
      }
      await input.check({ force: true, timeout: 2000 }).catch(() => null);
    }

    // Fill any text inputs (required text answers) with a default value
    const textInputs = page.locator('input[type="text"]');
    const textCount = await textInputs.count();
    for (let i = 0; i < textCount; i++) {
      const txt = textInputs.nth(i);
      if (await txt.isVisible()) {
        await txt.fill("None");
      }
    }

    // Wait for the button to be stable and click it
    const continueBtn = page.getByRole("button", {
      name: /continue|continue to sign off|continue to sign off/i,
    });
    await continueBtn.waitFor({ state: "visible" });
    await continueBtn.click({ force: true });

    // 3. Signature Step
    await expect(page.locator("h2")).toContainText("Sign Off");

    // Simulate signature (drawing on canvas)
    const initialSignature = await drawSignatureOnCanvas(page);
    expect(initialSignature).toBe(true);

    const submitStartedAt = Date.now();

    // Submit
    const signBtn = page.getByRole("button", {
      name: /confirm\s+(?:&|and)\s+sign in/i,
    });
    const signatureAlert = page
      .getByRole("alert")
      .filter({ hasText: /please provide a signature/i })
      .first();
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
    await signBtn.scrollIntoViewIfNeeded();
    await signBtn.waitFor({ state: "visible", timeout: 15000 });
    const successHeading = page.getByRole("heading", {
      name: /signed in successfully/i,
    });
    const signOffHeading = page.getByRole("heading", {
      name: /sign off/i,
    });

    for (let attempt = 1; attempt <= 4; attempt++) {
      await signBtn.click({ force: true });
      await signBtn
        .evaluate((button) => {
          const form = (button as HTMLElement).closest("form");
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        })
        .catch(() => null);

      const needsSignature = await signatureAlert.isVisible().catch(() => false);
      if (!needsSignature) {
        const reachedSuccess = await successHeading
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        const leftSignOffStep = !(await signOffHeading.isVisible().catch(() => false));
        if (reachedSuccess || leftSignOffStep) {
          break;
        }
        // Still on sign-off without explicit signature alert; retry submit.
        await page.waitForTimeout(300);
        continue;
      }
      const stillOnSignOff = await signOffHeading.isVisible().catch(() => false);
      if (!stillOnSignOff) {
        break;
      }
      await drawSignatureOnCanvas(page);
    }

    await page.waitForTimeout(300);

    // 4. Assert success path:
    //   a) success screen appears, then auto-refreshes after ~10s
    //   b) on slower full-suite runs, success screen may already have auto-refreshed
    //      by the time this assertion executes.
    const successVisible = await successHeading
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const detailsNameInput = page.locator('input[id="visitorName"]').first();
    if (successVisible) {
      await expect(successHeading).not.toBeVisible({ timeout: 15000 });
      await expect(detailsNameInput).toBeVisible({ timeout: 15000 });
    } else {
      await expect(detailsNameInput).toBeVisible({ timeout: 15000 });
    }

    const elapsedSinceSubmit = Date.now() - submitStartedAt;
    expect(elapsedSinceSubmit).toBeGreaterThan(9000);

    const currentUrl = page.url();
    expect(new RegExp(`/s/${slug}(?:/kiosk)?`).test(currentUrl)).toBe(true);
  });
});
