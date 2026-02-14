import { test, expect } from "./test-fixtures";
import { getTestRouteHeaders } from "./utils/test-route-auth";

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

    // Expect the job appears in the table (queued) and capture its ID
    const queuedRow = page.locator("tr", { hasText: "QUEUED" }).first();
    await expect(queuedRow).toBeVisible({ timeout: 5000 });
    const jobId = (await queuedRow.locator("td").first().innerText()).trim();

    // Trigger the test-only runner endpoint until job succeeded
    const endpoint = `${baseURL}/api/test/process-next-export`;

    // Allow test runner invocation
    process.env.ALLOW_TEST_RUNNER = "1";

    let attempts = 0;
    let succeeded = false;
    while (attempts < 30) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getTestRouteHeaders(),
      });
      const json = await res.json();
      if (json?.res?.id === jobId && json?.res?.status === "SUCCEEDED") {
        succeeded = true;
        break;
      }
      attempts++;
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(succeeded).toBe(true);

    // Reload UI only after our job is succeeded, then ensure download link is present
    await page.reload();
    const succeededRow = page.locator("tr", { hasText: jobId }).first();
    await expect(succeededRow.getByText(/SUCCEEDED/)).toBeVisible({
      timeout: 15000,
    });
    const downloadLink = succeededRow.locator(
      `a[href*="/api/exports/${jobId}/download"]`,
    );
    await expect(downloadLink).toHaveCount(1, { timeout: 15000 });
  });
});
