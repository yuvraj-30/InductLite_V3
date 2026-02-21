import { test, expect } from "./test-fixtures";

test.describe("Admin Command Mode", () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeEach(async ({ loginAs, workerUser }) => {
    await loginAs(workerUser.email);
  });

  test("shows command-mode operational dashboard", async ({ page }) => {
    await page.goto("/admin/command-mode", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await expect(
      page.getByRole("heading", { name: /Foreman Command Mode/i }),
    ).toBeVisible();
    await expect(page.getByText(/On Site Now/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Overstay Alerts/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Evacuation Roll Call/i }),
    ).toBeVisible();
  });
});
