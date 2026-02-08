import { test, expect } from "@playwright/test";

test.describe("Kiosk Mode", () => {
  test("should auto-refresh after 10 seconds on success screen", async ({
    page,
  }) => {
    // Navigate to a site kiosk page (assuming seed data or test site exists)
    // We'll use a known slug from the seed data
    const slug = "test-site";
    await page.goto(`/s/${slug}/kiosk`);

    // 1. Fill in visitor details
    await page.fill('input[id="visitorName"]', "Kiosk Tester");
    await page.fill('input[id="visitorPhone"]', "+64211111111");
    await page.click('button[type="submit"]');

    // 2. Complete induction (assume some questions exist)
    // For the sake of this test, we expect to be on the induction step
    await expect(page.locator("h2")).toContainText("Site Induction");

    // Check all checkboxes/radios if any
    const inputs = await page
      .locator('input[type="checkbox"], input[type="radio"]')
      .all();
    for (const input of inputs) {
      await input.check();
    }

    // Wait for the button to be stable and click it
    const continueBtn = page.getByRole("button", { name: /continue/i });
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

    // Submit
    const signBtn = page.getByRole("button", { name: /confirm & sign in/i });
    await signBtn.waitFor({ state: "visible" });
    await signBtn.click();

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
