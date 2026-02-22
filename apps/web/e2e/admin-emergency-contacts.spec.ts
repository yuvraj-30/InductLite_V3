import { test, expect } from "./test-fixtures";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createSiteAndGetId(page: any, name: string): Promise<string> {
  await page.goto("/admin/sites/new");
  await page.getByLabel(/site name/i).fill(name);
  await page.getByRole("button", { name: "Create Site" }).click();
  await expect(page).toHaveURL(/\/admin\/sites$/);

  const siteLink = page
    .locator(`a[href^="/admin/sites/"]`, { hasText: name })
    .first();
  await expect(siteLink).toBeVisible();
  const href = await siteLink.getAttribute("href");
  if (!href) {
    throw new Error("Failed to resolve site id from site link");
  }

  return href.split("/").pop() ?? "";
}

test.describe.serial("Admin Emergency Setup", () => {
  test("admin can add/remove emergency contacts and procedures", async ({
    page,
    loginAs,
    workerUser,
  }) => {
    test.setTimeout(120000);
    await loginAs(workerUser.email);

    const suffix = uniqueSuffix();
    const siteName = `Emergency Site ${suffix}`;
    const contactName = `Safety Lead ${suffix}`;
    const procedureTitle = `Evacuation Route ${suffix}`;

    const siteId = await createSiteAndGetId(page, siteName);

    await page.goto(`/admin/sites/${siteId}/emergency`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "Emergency Setup" }),
    ).toBeVisible();

    const contactsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Emergency Contacts" }),
    });
    await contactsSection.locator('input[name="name"]').fill(contactName);
    await contactsSection.locator('input[name="role"]').fill("Site Manager");
    await contactsSection.locator('input[name="phone"]').fill("021 444 9999");
    await contactsSection
      .locator('input[name="email"]')
      .fill("safety.lead@example.test");
    await contactsSection.locator('input[name="priority"]').fill("1");
    await contactsSection.getByRole("button", { name: "Add Contact" }).click();

    await expect(contactsSection.getByText(contactName)).toBeVisible();
    await contactsSection.getByRole("button", { name: "Remove" }).first().click();
    await expect(contactsSection.getByText(contactName)).toHaveCount(0);

    const proceduresSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Emergency Procedures" }),
    });
    await proceduresSection.locator('input[name="title"]').fill(procedureTitle);
    await proceduresSection
      .locator('textarea[name="instructions"]')
      .fill("Evacuate to the north muster point and check in with the foreman.");
    await proceduresSection.locator('input[name="sortOrder"]').fill("1");
    await proceduresSection
      .getByRole("button", { name: "Add Procedure" })
      .click();

    await expect(proceduresSection.getByText(procedureTitle)).toBeVisible();
    await proceduresSection.getByRole("button", { name: "Remove" }).first().click();
    await expect(proceduresSection.getByText(procedureTitle)).toHaveCount(0);
  });
});
