import { test } from "./test-fixtures";
import { checkA11y, injectAxe } from "axe-playwright";
import type { Page } from "@playwright/test";

test.describe("Accessibility Checks", () => {
  test.describe.configure({ mode: "serial" });

  let TEST_SITE_SLUG = "test-site";

  const adminRoutes = [
    "/admin/dashboard",
    "/admin/live-register",
    "/admin/sites",
    "/admin/sites/new",
    "/admin/templates",
    "/admin/templates/new",
    "/admin/history",
    "/admin/exports",
    "/admin/audit-log",
    "/admin/users",
    "/admin/users/new",
    "/admin/contractors",
    "/admin/pre-registrations",
    "/admin/hazards",
    "/admin/incidents",
    "/admin/settings",
    "/admin/plan-configurator",
    "/admin/policy-simulator",
    "/admin/risk-passport",
  ] as const;

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
    await runSeriousA11yCheck("/", page);
    await runSeriousA11yCheck("/login", page);
    await runSeriousA11yCheck(`/s/${TEST_SITE_SLUG}`, page);
  });

  for (const route of adminRoutes) {
    test(`${route} meets serious+critical a11y`, async ({ page, loginAs }) => {
      await loginAs();
      await runSeriousA11yCheck(route, page);
    });
  }

  test("focus indicators remain visible in both themes", async ({ page, loginAs }) => {
    await loginAs();

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
