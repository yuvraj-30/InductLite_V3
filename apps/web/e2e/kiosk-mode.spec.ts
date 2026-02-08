import { test, expect } from "@playwright/test";

test.describe("Kiosk Mode", () => {
  test("should load the kiosk page for a site", async ({ page }) => {
    // Navigate to a known site's kiosk page
    // Note: In real tests, we'd use a seeded site slug
    await page.goto("/s/test-site/kiosk");

    // Check for Kiosk Mode indicator
    const indicator = page.getByText("Kiosk Mode Active");
    await expect(indicator).toBeVisible();
  });
});
