import { test, expect } from "./test-fixtures";
import { getTestRouteHeaders } from "./utils/test-route-auth";

async function fillFieldWithRetry(input: {
  page: import("@playwright/test").Page;
  label: RegExp;
  value: string;
}) {
  const { page, label, value } = input;
  const field = page.getByLabel(label).first();

  const labelSource = label.source.toLowerCase();
  const fallbackSelector =
    labelSource.includes("phone")
      ? "#visitorPhone"
      : labelSource.includes("name")
        ? "#visitorName"
        : null;
  const fallbackField = fallbackSelector ? page.locator(fallbackSelector).first() : null;

  let hasVisibleField = await field.isVisible().catch(() => false);
  if (!hasVisibleField && fallbackField) {
    hasVisibleField = await fallbackField.isVisible().catch(() => false);
  }

  await expect
    .poll(async () => {
      const primaryVisible = await field.isVisible().catch(() => false);
      if (primaryVisible) return true;
      if (!fallbackField) return false;
      return fallbackField.isVisible().catch(() => false);
    })
    .toBe(true);

  const target = hasVisibleField
    ? field
    : fallbackField && (await fallbackField.isVisible().catch(() => false))
      ? fallbackField
      : field;

  for (let attempt = 1; attempt <= 4; attempt++) {
    await target.click({ force: true }).catch(() => null);
    await target.fill(value).catch(() => null);
    const current = await target.inputValue().catch(() => "");
    if (current === value) {
      return;
    }

    await target.type(value, { delay: 10 }).catch(() => null);
    const typed = await target.inputValue().catch(() => "");
    if (typed === value) {
      return;
    }

    await page.waitForTimeout(250 * attempt);
  }

  throw new Error(`Unable to persist value for ${label.toString()}`);
}

test.describe("Induction Skip Logic", () => {
  let testSiteSlug = "test-site";
  let skipLogicSourceQuestionId: string | null = null;

  test.beforeAll(async ({ seedPublicSite }) => {
    const seeded = await seedPublicSite({
      slugPrefix: "test-site-skip-logic",
      includeSkipLogicFlow: true,
    });
    if (!seeded.slug || !seeded.skipLogicSourceQuestionId) {
      throw new Error(
        `Failed to seed skip-logic test site: ${JSON.stringify(seeded)}`,
      );
    }

    testSiteSlug = seeded.slug;
    skipLogicSourceQuestionId = seeded.skipLogicSourceQuestionId;
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (!testSiteSlug.startsWith("test-site-skip-logic")) return;
    await deletePublicSite(testSiteSlug);
  });

  test("skips configured questions when trigger answer matches", async ({ page, request }) => {
    expect(skipLogicSourceQuestionId).toBeTruthy();
    const triggerQuestionId = skipLogicSourceQuestionId!;

    await request
      .post("/api/test/clear-rate-limit", {
        headers: getTestRouteHeaders(),
      })
      .catch(() => null);

    await page.goto(`/s/${testSiteSlug}`);
    await expect
      .poll(async () => {
        const byLabel = await page.getByLabel(/full name|name/i).first().isVisible().catch(() => false);
        if (byLabel) return true;
        return page.locator("#visitorName").first().isVisible().catch(() => false);
      })
      .toBe(true);

    await fillFieldWithRetry({
      page,
      label: /full name|name/i,
      value: "Skip Logic Tester",
    });
    await fillFieldWithRetry({
      page,
      label: /phone number|phone/i,
      value: "+64211234567",
    });

    const visitorType = page.locator("#visitorType");
    if (await visitorType.count()) {
      await visitorType.selectOption("CONTRACTOR").catch(() => null);
    }

    const inductionHeading = page
      .locator("h2", { hasText: /^site induction$/i })
      .first();
    const continueButton = page
      .getByRole("button", { name: /continue to induction|continue/i })
      .first();
    let reachedInduction = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await continueButton.click({ force: true }).catch(() => null);
      if (await inductionHeading.isVisible({ timeout: 6000 }).catch(() => false)) {
        reachedInduction = true;
        break;
      }
      const detailsVisible = await page
        .locator("#visitorName")
        .first()
        .isVisible()
        .catch(() => false);
      if (detailsVisible) {
        await fillFieldWithRetry({
          page,
          label: /full name|name/i,
          value: "Skip Logic Tester",
        });
        await fillFieldWithRetry({
          page,
          label: /phone number|phone/i,
          value: "+64211234567",
        });
      }
      await page.waitForTimeout(300 * attempt);
    }
    expect(reachedInduction).toBe(true);
    await expect(inductionHeading).toBeVisible({ timeout: 15000 });

    const dependentQuestionText = /what is your site supervisor name\?/i;
    const dependentQuestionInput = page.getByLabel(dependentQuestionText).first();

    await page
      .locator(`input[type="radio"][name="${triggerQuestionId}"][value="no"]`)
      .check({ force: true });
    await expect(dependentQuestionInput).toBeVisible({ timeout: 8000 });

    await page
      .locator(`input[type="radio"][name="${triggerQuestionId}"][value="yes"]`)
      .check({ force: true });
    await expect(page.getByText(dependentQuestionText)).toHaveCount(0);

    await expect(
      page.getByText(/i understand emergency muster requirements\./i),
    ).toBeVisible();
  });
});
