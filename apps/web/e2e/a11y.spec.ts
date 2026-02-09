import { test } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

test.describe("Accessibility Checks", () => {
  test("homepage should be accessible", async ({ page }) => {
    await page.goto("/");
    await injectAxe(page);
    await checkA11y(page);
  });

  test("sign-in flow should be accessible", async ({ page }) => {
    await page.goto("/s/test-site");
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });
});
