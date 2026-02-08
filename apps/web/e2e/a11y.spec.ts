import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

test.describe("Accessibility (A11y)", () => {
  test("should have no critical violations on the public sign-in page", async ({
    page,
  }) => {
    const slug = "test-site";
    await page.goto(`/s/${slug}`);

    // Inject axe-core
    await injectAxe(page);

    // Scan for violations
    await checkA11y(page, undefined, {
      axeOptions: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "best-practice"],
        },
      },
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });

  test("should have no violations on the kiosk mode page", async ({ page }) => {
    const slug = "test-site";
    await page.goto(`/s/${slug}/kiosk`);
    await injectAxe(page);
    await checkA11y(page);
  });
});
