import { test, expect } from "./test-fixtures";

test.describe("Admin Export UI & Processing", () => {
  test.beforeEach(async ({ page, loginAs, workerUser }) => {
    // Use fixture helper to programmatically login the per-worker user
    await loginAs(workerUser.email);

    // Visit admin to verify session
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("creates export via UI and processes it (test runner)", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/admin/exports");

    // Queue a SIGN_IN_CSV
    await page.getByRole("button", { name: /Queue Export/i }).click();

    // Expect the job appears in the table (queued)
    await expect(page.getByText(/QUEUED/i)).toBeVisible({ timeout: 5000 });

    // Trigger the test-only runner endpoint until job succeeded
    const endpoint = `${baseURL}/api/test/process-next-export`;

    // Allow test runner invocation
    process.env.ALLOW_TEST_RUNNER = "1";

    let attempts = 0;
    let succeeded = false;
    while (attempts < 20) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "x-test-runner": "1" },
      });
      const json = await res.json();
      if (json?.res?.status === "SUCCEEDED") {
        succeeded = true;
        break;
      }
      attempts++;
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(succeeded).toBe(true);

    // Reload UI and check file link is present in the succeeded job row
    await page.reload();
    const succeededRow = page.locator("tr", { hasText: "SUCCEEDED" }).first();
    await expect(succeededRow.getByRole("link")).toBeVisible({ timeout: 5000 });
  });
});
