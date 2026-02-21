import { test, expect } from "./test-fixtures";

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe.serial("Admin Management", () => {
  test("admin can create, edit, deactivate, reactivate, and purge users", async ({
    page,
    loginAs,
    workerUser,
  }) => {
    await loginAs(workerUser.email);
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { level: 1, name: "Users" }),
    ).toBeVisible();

    const suffix = randomSuffix();
    const createdName = `Managed User ${suffix}`;
    const createdEmail = `managed-${suffix}@example.test`;

    await page.getByRole("link", { name: "Add User" }).click();
    await page.getByLabel("Full Name").fill(createdName);
    await page.getByLabel("Email").fill(createdEmail);
    await page.getByLabel("Role").selectOption("VIEWER");
    await page.getByLabel("Temporary Password").fill("Welcome123A");
    await page.getByRole("button", { name: "Create User" }).click();

    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByText(createdEmail)).toBeVisible();

    const userRow = page.locator("tbody tr", { hasText: createdEmail }).first();
    await userRow.getByRole("link", { name: "Edit" }).click();

    await expect(page).toHaveURL(/\/admin\/users\/.+/);
    await page.getByLabel("Role").selectOption("SITE_MANAGER");
    await page.getByLabel("New Password (optional)").fill("Updated123A");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("User updated successfully")).toBeVisible();

    await page.goto("/admin/users");
    const updatedRow = page.locator("tbody tr", { hasText: createdEmail }).first();
    await expect(updatedRow.getByText("SITE_MANAGER")).toBeVisible();

    await updatedRow.getByRole("button", { name: "Deactivate" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(updatedRow.getByText("Inactive")).toBeVisible();

    await updatedRow.getByRole("button", { name: "Reactivate" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(updatedRow.getByText("Active")).toBeVisible();

    await updatedRow.getByRole("button", { name: "Deactivate" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(updatedRow.getByText("Inactive")).toBeVisible();

    await updatedRow.getByRole("button", { name: "Delete" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(
      page.locator("tbody tr", { hasText: createdEmail }),
    ).toHaveCount(0);
  });

  test("admin can create, edit, deactivate, reactivate, and purge contractors", async ({
    page,
    loginAs,
    workerUser,
  }) => {
    await loginAs(workerUser.email);
    await page.goto("/admin/contractors");
    await expect(
      page.getByRole("heading", { level: 1, name: "Contractors" }),
    ).toBeVisible();

    const suffix = randomSuffix();
    const contractorName = `Managed Contractor ${suffix}`;
    const updatedTrade = `Electrical ${suffix}`;

    await page.getByRole("link", { name: "Add Contractor" }).click();
    await page.getByLabel("Contractor Name").fill(contractorName);
    await page.getByLabel("Trade").fill("General");
    await page.getByLabel("Contact Name").fill("Field Lead");
    await page.getByLabel("Contact Email").fill(`contractor-${suffix}@test.nz`);
    await page.getByLabel("Contact Phone").fill("+64211234567");
    await page.getByLabel("Notes").fill("Initial onboarding");
    await page.getByRole("button", { name: "Create Contractor" }).click();

    await expect(page).toHaveURL(/\/admin\/contractors/);
    await expect(page.getByText(contractorName)).toBeVisible();

    const contractorRow = page
      .locator("tbody tr", { hasText: contractorName })
      .first();
    await contractorRow.getByRole("link", { name: "Edit" }).click();

    await expect(page).toHaveURL(/\/admin\/contractors\/.+/);
    await page.getByLabel("Trade").fill(updatedTrade);
    await page.getByLabel("Notes").fill("Updated details");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Contractor updated successfully")).toBeVisible();

    await page.goto("/admin/contractors");
    const updatedRow = page
      .locator("tbody tr", { hasText: contractorName })
      .first();
    await expect(updatedRow.getByText(updatedTrade)).toBeVisible();

    await updatedRow.getByRole("button", { name: "Deactivate" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(updatedRow.getByText("Inactive")).toBeVisible();

    await updatedRow.getByRole("button", { name: "Reactivate" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(updatedRow.getByText("Active")).toBeVisible();

    await updatedRow.getByRole("button", { name: "Deactivate" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(updatedRow.getByText("Inactive")).toBeVisible();

    await updatedRow.getByRole("button", { name: "Delete" }).click();
    await updatedRow.getByRole("button", { name: "Yes" }).click();
    await expect(
      page.locator("tbody tr", { hasText: contractorName }),
    ).toHaveCount(0);
  });
});
