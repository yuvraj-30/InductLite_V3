import { test, expect } from "./test-fixtures";

async function fillFieldWithRetry(input: {
  page: import("@playwright/test").Page;
  label: RegExp;
  value: string;
}) {
  const { page, label, value } = input;
  const field = page.getByLabel(label).first();
  await field.waitFor({ state: "visible", timeout: 15000 });

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

  test("skips configured questions when trigger answer matches", async ({ page }) => {
    expect(skipLogicSourceQuestionId).toBeTruthy();
    const triggerQuestionId = skipLogicSourceQuestionId!;

    await page.goto(`/s/${testSiteSlug}`);

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

    const inductionHeading = page.getByRole("heading", {
      level: 2,
      name: /site induction/i,
    });
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
