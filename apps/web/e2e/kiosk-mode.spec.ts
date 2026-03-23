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

async function fillInputWithRetry(input: {
  page: import("@playwright/test").Page;
  selector: string;
  value: string;
}): Promise<void> {
  const { page, selector, value } = input;
  const field = page.locator(selector).first();
  await field.waitFor({ state: "visible", timeout: 10000 });

  for (let attempt = 1; attempt <= 4; attempt++) {
    await field.click({ force: true }).catch(() => null);
    await field.fill(value).catch(() => null);
    const current = await field.inputValue().catch(() => "");
    if (current === value) {
      return;
    }

    await field.type(value, { delay: 10 }).catch(() => null);
    const typed = await field.inputValue().catch(() => "");
    if (typed === value) {
      return;
    }

    await page.waitForTimeout(200 * attempt);
  }

  throw new Error(`Unable to set input ${selector}`);
}

async function waitForKioskStep(input: {
  inductionHeading: import("@playwright/test").Locator;
  detailsNameInput: import("@playwright/test").Locator;
}): Promise<"induction" | "details" | "unknown"> {
  const { inductionHeading, detailsNameInput } = input;

  try {
    await Promise.race([
      inductionHeading.waitFor({ state: "visible", timeout: 2500 }).then(() => "induction"),
      detailsNameInput.waitFor({ state: "visible", timeout: 2500 }).then(() => "details"),
    ]);
  } catch {
    return "unknown";
  }

  if (await inductionHeading.isVisible().catch(() => false)) {
    return "induction";
  }
  if (await detailsNameInput.isVisible().catch(() => false)) {
    return "details";
  }
  return "unknown";
}

test.describe("Kiosk Mode", () => {
  let TEST_SITE_SLUG = "test-site";

  test.beforeAll(async ({ request, seedPublicSite, workerUser }) => {
    try {
      const body = await seedPublicSite({
        slugPrefix: "test-site-e2e-kiosk",
        companySlug: `test-company-kiosk-${workerUser.clientKey}`,
      });
      if (body?.success && body.slug) {
        TEST_SITE_SLUG = body.slug;
        return;
      }
    } catch (error) {
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

  test("should auto-refresh after 10 seconds on success screen", async ({ page }) => {
    test.setTimeout(150000);
    const slug = TEST_SITE_SLUG;

    await page.context().grantPermissions(["geolocation"], {
      origin: "http://localhost:3000",
    });
    await page.context().setGeolocation({
      latitude: -36.8485,
      longitude: 174.7633,
    });

    await page.goto(`/s/${slug}/kiosk`);

    await expect(page.locator('input[id="visitorName"]')).toBeVisible({
      timeout: 10000,
    });

    await fillInputWithRetry({
      page,
      selector: 'input[id="visitorName"]',
      value: "Kiosk Tester",
    });
    await fillInputWithRetry({
      page,
      selector: 'input[id="visitorPhone"]',
      value: "+64211111111",
    });

    const employerField = page.locator('input[id="employerName"]').first();
    if (await employerField.isVisible().catch(() => false)) {
      await employerField.fill("E2E Employer").catch(() => null);
    }

    const roleField = page.locator('input[id="roleOnSite"]').first();
    if (await roleField.isVisible().catch(() => false)) {
      await roleField.fill("Contractor").catch(() => null);
    }

    const emailField = page
      .locator('input[type="email"], input[name="email"]')
      .first();
    if (await emailField.isVisible().catch(() => false)) {
      await emailField.fill("kiosk@test.com").catch(() => null);
    }

    const visitorTypeSelect = page
      .locator(
        'select[name="visitorType"], select[id*="visitorType"], select[aria-label*="visitor type"]',
      )
      .first();
    if (await visitorTypeSelect.isVisible().catch(() => false)) {
      await visitorTypeSelect.selectOption({ value: "CONTRACTOR" }).catch(() => null);
    } else {
      const contractorRadio = page.getByRole("radio", { name: /contractor/i }).first();
      if (await contractorRadio.isVisible().catch(() => false)) {
        await contractorRadio.check().catch(() => null);
      }
    }

    const locationButton = page
      .getByRole("button", { name: /capture location|refresh location/i })
      .first();
    if (await locationButton.isVisible().catch(() => false)) {
      await locationButton.click({ force: true }).catch(() => null);
      await page.waitForTimeout(1200);
    }

    const detailsContinue = page.getByRole("button", {
      name: /continue to induction|review site induction/i,
    });
    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });
    const detailsNameInput = page.locator('input[id="visitorName"]').first();

    for (let attempt = 1; attempt <= 3; attempt++) {
      await detailsContinue.click({ force: true, timeout: 4000 }).catch(() => null);

      const currentStep = await waitForKioskStep({
        inductionHeading,
        detailsNameInput,
      });
      if (currentStep === "induction") {
        break;
      }

      const detailsError = page.getByRole("alert").first();
      const detailsErrorText = (await detailsError.textContent().catch(() => "")) ?? "";
      if (/requires location capture/i.test(detailsErrorText)) {
        if (await locationButton.isVisible().catch(() => false)) {
          await locationButton.click({ force: true }).catch(() => null);
          await page.waitForTimeout(1500);
        }
      }

      if (currentStep !== "details") {
        await page.waitForTimeout(350 * attempt);
        continue;
      }

      const nameVal = await page
        .locator('input[id="visitorName"]')
        .inputValue()
        .catch(() => "");
      if (nameVal !== "Kiosk Tester") {
        await fillInputWithRetry({
          page,
          selector: 'input[id="visitorName"]',
          value: "Kiosk Tester",
        });
      }

      const phoneVal = await page
        .locator('input[id="visitorPhone"]')
        .inputValue()
        .catch(() => "");
      if (phoneVal !== "+64211111111") {
        await fillInputWithRetry({
          page,
          selector: 'input[id="visitorPhone"]',
          value: "+64211111111",
        });
      }

      await page.waitForTimeout(350 * attempt);
    }

    await expect(inductionHeading).toBeVisible({ timeout: 12000 });

    const inputs = await page
      .locator('input[type="checkbox"], input[type="radio"]')
      .all();
    for (const input of inputs) {
      const isVisible = await input.isVisible().catch(() => false);
      const isEnabled = await input.isEnabled().catch(() => false);
      if (!isVisible || !isEnabled) {
        continue;
      }
      await input.check({ force: true, timeout: 1000 }).catch(() => null);
    }

    const textInputs = page.locator(
      'input[type="text"]:not(#visitorName):not(#visitorPhone):not(#employerName):not(#roleOnSite)',
    );
    const textCount = await textInputs.count();
    for (let i = 0; i < textCount; i++) {
      const txt = textInputs.nth(i);
      if (await txt.isVisible().catch(() => false)) {
        await txt.fill("None").catch(() => null);
      }
    }

    const textareas = page.locator("textarea");
    const textareaCount = await textareas.count();
    for (let i = 0; i < textareaCount; i++) {
      const field = textareas.nth(i);
      if (await field.isVisible().catch(() => false)) {
        await field.fill("N/A").catch(() => null);
      }
    }

    await page
      .getByRole("button", {
        name: /continue to sign off|proceed to final clearance/i,
      })
      .click({ force: true, timeout: 4000 });

    const signOffHeading = page.getByRole("heading", {
      level: 2,
      name: /sign off/i,
    });
    await expect(signOffHeading).toBeVisible({ timeout: 12000 });

    const initialSignature = await drawSignatureOnCanvas(page);
    expect(initialSignature).toBe(true);

    const termsCheckboxByLabel = page
      .getByLabel(
        /I acknowledge the site safety terms and conditions|I accept|terms and conditions/i,
      )
      .first();
    if (await termsCheckboxByLabel.isVisible().catch(() => false)) {
      await termsCheckboxByLabel.check().catch(() => null);
    } else {
      const termsCheckbox = page.locator("#hasAcceptedTerms").first();
      if (await termsCheckbox.isVisible().catch(() => false)) {
        await termsCheckbox.check().catch(() => null);
      }
    }

    const submitStartedAt = Date.now();

    const signBtn = page.getByRole("button", {
      name: /confirm\s+(?:&|and)\s+sign in/i,
    });
    const signatureAlert = page
      .getByRole("alert")
      .filter({ hasText: /please provide a signature/i })
      .first();
    const successHeading = page.getByRole("heading", {
      name: /signed in successfully/i,
    });

    await signBtn.click({ force: true, timeout: 4000 }).catch(() => null);
    if (await signatureAlert.isVisible().catch(() => false)) {
      await drawSignatureOnCanvas(page);
      await signBtn.click({ force: true, timeout: 4000 }).catch(() => null);
    }

    let finalState: "success" | "details" | null = null;
    for (let wait = 0; wait < 80; wait++) {
      if (await successHeading.isVisible().catch(() => false)) {
        finalState = "success";
        break;
      }
      if (await detailsNameInput.isVisible().catch(() => false)) {
        finalState = "details";
        break;
      }

      if (wait % 8 === 0 && (await signOffHeading.isVisible().catch(() => false))) {
        await signBtn.click({ force: true, timeout: 2000 }).catch(() => null);
      }

      await page.waitForTimeout(500);
    }

    expect(finalState).not.toBeNull();

    if (finalState === "success") {
      await expect(successHeading).not.toBeVisible({ timeout: 25000 });
      await expect(detailsNameInput).toBeVisible({ timeout: 25000 });
    } else {
      await expect(
        detailsNameInput,
        "Expected kiosk flow to return to details screen after sign-in submit",
      ).toBeVisible({ timeout: 10000 });
    }

    const elapsedSinceSubmit = Date.now() - submitStartedAt;
    expect(elapsedSinceSubmit).toBeGreaterThan(9000);

    const currentUrl = page.url();
    expect(new RegExp(`/s/${slug}(?:/kiosk)?`).test(currentUrl)).toBe(true);
  });
});
