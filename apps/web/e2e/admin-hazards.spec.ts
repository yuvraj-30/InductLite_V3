import { test, expect } from "./test-fixtures";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createSite(page: any, name: string) {
  await page.goto("/admin/sites/new");
  await page.getByLabel(/site name/i).fill(name);
  const createButton = page.getByRole("button", { name: "Create Site" });
  await createButton.scrollIntoViewIfNeeded().catch(() => undefined);
  const submitRequest = page
    .waitForResponse(
      (response: any) =>
        response.request().method() === "POST" &&
        /\/admin\/sites\/new(?:\?|$)/.test(response.url()),
      { timeout: 15000 },
    )
    .catch(() => null);
  await Promise.all([
    page.waitForURL(/\/admin\/sites(?:\?.*)?$/, { timeout: 30000 }),
    createButton.click({ force: true }),
  ]);
  await submitRequest;
}

async function submitHazardsForm(page: any, form: any) {
  const submitRequest = page
    .waitForResponse(
      (response: any) =>
        response.request().method() === "POST" &&
        /\/admin\/hazards(?:\?|$)/.test(response.url()),
      { timeout: 15000 },
    )
    .catch(() => null);

  const submitButton = form.locator('button[type="submit"]').first();
  await submitButton.scrollIntoViewIfNeeded().catch(() => undefined);
  try {
    await submitButton.click({ timeout: 10000 });
  } catch {
    await submitButton.evaluate((button: Element) => {
      (button as HTMLButtonElement).click();
    });
  }

  await submitRequest;
}

async function safeGotoHazards(page: any) {
  try {
    await page.goto("/admin/hazards", { waitUntil: "domcontentloaded" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /ERR_ABORTED|NS_BINDING_ABORTED|frame was detached|interrupted by another navigation|aborted/i.test(
        message,
      )
    ) {
      await page.waitForTimeout(200);
      return false;
    }
    throw error;
  }
}

test.describe.serial("Admin Hazard Register", () => {
  test("admin can log and close a hazard", async ({ page, loginAs, workerUser }) => {
    test.slow();
    await loginAs(workerUser.email);

    const suffix = uniqueSuffix();
    const siteName = `Hazard Site ${suffix}`;
    const hazardTitle = `Loose scaffold board ${suffix}`;

    await createSite(page, siteName);

    await page.goto("/admin/hazards");
    await expect(
      page.getByRole("heading", { level: 1, name: "Hazard Register" }),
    ).toBeVisible();

    await page.locator('select[name="siteId"]').selectOption({ label: siteName });
    await page.locator('select[name="riskLevel"]').selectOption("HIGH");
    const titleField = page.getByLabel("Hazard Title");
    await expect(titleField).toBeVisible({ timeout: 15000 });
    await titleField.fill(hazardTitle);

    const descriptionField = page.getByLabel("Description");
    await expect(descriptionField).toBeVisible({ timeout: 15000 });
    await descriptionField.fill("Scaffold board not secured on upper level.");

    const addHazardForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Add Hazard" }) })
      .first();
    await submitHazardsForm(page, addHazardForm);

    await expect
      .poll(
        async () => {
          const navigated = await safeGotoHazards(page);
          if (!navigated) return 0;
          return page.locator("tr", { hasText: hazardTitle }).count();
        },
        { timeout: 45000 },
      )
      .toBe(1);

    const hazardRow = page.locator("tr", { hasText: hazardTitle }).first();
    await expect(hazardRow).toContainText("HIGH");
    await expect(hazardRow).toContainText("OPEN");

    const closeForm = hazardRow.locator("form").first();
    await expect(closeForm).toBeVisible();
    await submitHazardsForm(page, closeForm);

    await expect
      .poll(
        async () => {
          const navigated = await safeGotoHazards(page);
          if (!navigated) return false;
          const hazardPageVisible = await page
            .getByRole("heading", { level: 1, name: "Hazard Register" })
            .isVisible()
            .catch(() => false);
          if (!hazardPageVisible) return false;
          const refreshedRow = page
            .locator("tr", { hasText: hazardTitle })
            .first();
          if ((await refreshedRow.count()) === 0) return false;
          return refreshedRow.getByText("CLOSED").isVisible();
        },
        { timeout: 45000 },
      )
      .toBe(true);
  });
});
