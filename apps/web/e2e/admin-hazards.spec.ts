import { test, expect } from "./test-fixtures";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createSite(page: any, name: string) {
  await page.goto("/admin/sites/new");
  await page.getByLabel(/site name/i).fill(name);
  await page.getByRole("button", { name: "Create Site" }).click();
  await expect(page).toHaveURL(/\/admin\/sites$/);
}

test.describe.serial("Admin Hazard Register", () => {
  test("admin can log and close a hazard", async ({ page, loginAs, workerUser }) => {
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
    await page.locator('input[name="title"]').fill(hazardTitle);
    await page
      .locator('textarea[name="description"]')
      .fill("Scaffold board not secured on upper level.");

    await page.getByRole("button", { name: "Add Hazard" }).click();

    const hazardRow = page.locator("tr", { hasText: hazardTitle }).first();
    await expect(hazardRow).toBeVisible();
    await expect(hazardRow).toContainText("HIGH");
    await expect(hazardRow).toContainText("OPEN");

    await hazardRow.getByRole("button", { name: "Close" }).click();
    await expect(hazardRow).toContainText("CLOSED");
  });
});
