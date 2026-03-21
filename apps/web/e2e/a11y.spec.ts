import { test } from "./test-fixtures";
import { checkA11y, injectAxe } from "axe-playwright";
import type { Page } from "@playwright/test";
import { A11Y_ADMIN_ROUTES, A11Y_PUBLIC_ROUTES } from "./route-governance";

test.describe("Accessibility Checks", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  let TEST_SITE_SLUG = "test-site";

  async function runSeriousA11yCheck(path: string, page: Page) {
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
    await injectAxe(page);
    await checkA11y(
      page,
      undefined,
      {
        includedImpacts: ["critical", "serious"],
        detailedReport: true,
        detailedReportOptions: { html: true },
      },
      true,
    );
  }

  test.beforeAll(async ({ request, seedPublicSite }) => {
    try {
      const body = await seedPublicSite({ slugPrefix: "test-site-e2e-a11y" });
      if (body?.success && body.slug) {
        TEST_SITE_SLUG = body.slug;
        return;
      }
    } catch (error) {
      console.warn("a11y seedPublicSite failed, trying fallback slug:", String(error));
    }

    const res = await request.get(`/s/${TEST_SITE_SLUG}`);
    const txt = await res.text();
    if (res.status() === 404 || /Site Not Found|No active template/i.test(txt)) {
      throw new Error(
        "A11y public site is not seeded. Ensure test runner endpoints are enabled and site seeding succeeds.",
      );
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (TEST_SITE_SLUG.startsWith("test-site-e2e-a11y")) {
      await deletePublicSite(TEST_SITE_SLUG).catch(() => null);
    }
  });

  test("public routes meet serious+critical a11y", async ({ page }) => {
    for (const route of A11Y_PUBLIC_ROUTES) {
      await runSeriousA11yCheck(route, page);
    }
    await runSeriousA11yCheck(`/s/${TEST_SITE_SLUG}`, page);
  });

  for (const route of A11Y_ADMIN_ROUTES) {
    test(
      `${route} meets serious+critical a11y`,
      async ({ page, loginAs, workerUser }) => {
        await loginAs(workerUser.email);
        await runSeriousA11yCheck(route, page);
      },
    );
  }

  test("focus indicators remain visible in both themes", async ({
    page,
    loginAs,
    workerUser,
  }) => {
    await loginAs(workerUser.email);

    const verifyFocusVisible = async (theme: "warm-light" | "high-contrast-dark") => {
      await page.goto("/admin/dashboard");
      await page.evaluate((value) => {
        document.documentElement.setAttribute("data-theme", value);
      }, theme);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      const hasVisibleFocus = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return false;
        const style = window.getComputedStyle(active);
        const outlineVisible = style.outlineStyle !== "none" && style.outlineWidth !== "0px";
        const boxShadowVisible = style.boxShadow !== "none";
        return outlineVisible || boxShadowVisible;
      });

      if (!hasVisibleFocus) {
        throw new Error(`Focus indicator not visible under theme ${theme}`);
      }
    };

    await verifyFocusVisible("warm-light");
    await verifyFocusVisible("high-contrast-dark");
  });
});
