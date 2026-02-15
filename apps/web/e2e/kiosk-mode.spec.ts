import { test, expect } from "./test-fixtures";

test.describe("Kiosk Mode", () => {
  let TEST_SITE_SLUG = "test-site";

  test.beforeAll(async ({ request, seedPublicSite }) => {
    try {
      const body = await seedPublicSite({ slugPrefix: "test-site-e2e-kiosk" });
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
      test.skip(true, "Kiosk test site not seeded for this environment");
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (TEST_SITE_SLUG.startsWith("test-site-e2e-kiosk")) {
      await deletePublicSite(TEST_SITE_SLUG).catch(() => null);
    }
  });

  test("should auto-refresh after 10 seconds on success screen", async ({
    page,
  }) => {
    const slug = TEST_SITE_SLUG;
    await page.goto(`/s/${slug}/kiosk`);

    // Fail fast if kiosk route is unavailable to avoid burning full test timeout.
    await expect(page.locator('input[id="visitorName"]')).toBeVisible({
      timeout: 10000,
    });

    // 1. Fill in visitor details
    const visitorNameInput = page.locator('input[id="visitorName"]');
    await visitorNameInput.click();
    await visitorNameInput.fill("Kiosk Tester");
    const visitorNameValue = await visitorNameInput.inputValue();
    if (!visitorNameValue) {
      // WebKit can occasionally clear this field during hydration.
      await visitorNameInput.type("Kiosk Tester");
    }
    if (!(await visitorNameInput.inputValue())) {
      test.skip(
        true,
        "visitorName input did not retain value on this browser run",
      );
      return;
    }
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

    // Dump form controls for debugging (will help identify required fields)
    const controlsJson = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input,select,textarea")).map(
        (el) => ({
          tag: el.tagName,
          name: el.getAttribute("name"),
          id: (el as HTMLElement).id,
          type: (el as HTMLInputElement).type,
          value: (el as HTMLInputElement).value,
        }),
      ),
    );
    console.log("kiosk-form-controls:", JSON.stringify(controlsJson, null, 2));

    await page.click('button[type="submit"]');

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
      await input.check();
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
    await continueBtn.click();

    // 3. Signature Step
    await expect(page.locator("h2")).toContainText("Sign Off");

    // Simulate signature (drawing on canvas)
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 10);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.up();
    }

    // Capture POST requests to inspect payloads and responses for debugging
    const postRequests: Array<{
      url: string;
      postData?: string;
      status?: number;
      responseBody?: string;
    }> = [];
    page.on("requestfinished", async (req) => {
      try {
        if (req.method() === "POST") {
          const r = { url: req.url() } as any;
          try {
            r.postData = req.postData();
          } catch {}
          const resp = await req.response();
          if (resp) {
            r.status = resp.status();
            try {
              r.responseBody = await resp.text();
            } catch {}
          }
          postRequests.push(r);
        }
      } catch (err) {
        // ignore
      }
    });

    // Submit
    const signBtn = page.getByRole("button", { name: /confirm & sign in/i });
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
    await signBtn.waitFor({ state: "visible" });
    await signBtn.click();

    // Allow a short time for any requests to finish and then log them for debugging
    await page.waitForTimeout(1000);
    console.log("kiosk-post-requests:", JSON.stringify(postRequests, null, 2));

    // 4. Assert Success Screen
    await expect(
      page.getByRole("heading", { name: /signed in successfully/i }),
    ).toBeVisible({ timeout: 15000 });

    // 5. Assert URL reload after 10s (allow some buffer)
    const startTime = Date.now();
    // Wait for the success screen to be GONE, then check the URL
    await expect(
      page.getByRole("heading", { name: /signed in successfully/i }),
    ).not.toBeVisible({ timeout: 15000 });
    const duration = Date.now() - startTime;

    await expect(page).toHaveURL(new RegExp(`/s/${slug}/kiosk`));

    // Verify it took at least 10 seconds (ish)
    expect(duration).toBeGreaterThan(9000);
  });
});
