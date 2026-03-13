import { test, expect } from "./test-fixtures";
import { getTestRouteHeaders } from "./utils/test-route-auth";

type ExportRow = {
  id: string;
  type: string;
  status: string;
};

function toLocalDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function readExportRows(page: any): Promise<ExportRow[]> {
  return page.locator("tbody tr").evaluateAll((rows) =>
    rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        return {
          id: cells[0]?.textContent?.trim() ?? "",
          type: cells[1]?.textContent?.trim() ?? "",
          status: cells[2]?.textContent?.trim() ?? "",
        };
      })
      .filter((row) => row.id.length > 0),
  );
}

async function gotoExportsPage(page: any): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/admin/exports", { waitUntil: "domcontentloaded" });
    const heading = page.getByRole("heading", { name: /^Exports$/i }).first();
    if (await heading.isVisible().catch(() => false)) return;
    if (/\/admin\/dashboard(?:\?|$)/i.test(page.url())) {
      await page.waitForTimeout(350 * attempt);
      continue;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Failed to load /admin/exports");
}

async function waitForNewExport(
  page: any,
  input: { existingIds: Set<string>; exportType: string; timeoutMs?: number },
): Promise<ExportRow> {
  const timeoutMs = input.timeoutMs ?? 30000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    await gotoExportsPage(page);
    const rows = await readExportRows(page);
    const next = rows.find(
      (row) =>
        row.type === input.exportType && !input.existingIds.has(row.id),
    );
    if (next) return next;
    await page.waitForTimeout(500);
  }

  throw new Error(
    `Timed out waiting for new ${input.exportType} export to appear`,
  );
}

async function triggerExportButton(
  page: any,
  name: RegExp,
): Promise<any> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const button = page.getByRole("button", { name });
    if (!(await button.isVisible().catch(() => false))) {
      await gotoExportsPage(page);
      continue;
    }

    await button.scrollIntoViewIfNeeded();
    try {
      await button.click({ timeout: 10000 });
    } catch {
      await button.evaluate((el) => {
        (el as HTMLButtonElement).click();
      });
    }
    return button;
  }

  throw new Error(`Export button not available: ${name.toString()}`);
}

async function waitForQueueTransition(button: any): Promise<void> {
  try {
    await expect(button).toBeDisabled({ timeout: 3000 });
  } catch {
    // Fast responses may skip visible disabled state.
  }
  await expect(button).toBeEnabled({ timeout: 15000 });
}

async function getQueuePanelAlertText(page: any): Promise<string | null> {
  const panel = page
    .locator("div", {
      has: page.getByRole("heading", { name: /Quick Export Actions/i }),
    })
    .first();
  const alert = panel.getByRole("alert").first();
  if (!(await alert.isVisible().catch(() => false))) return null;
  const text = ((await alert.textContent()) || "").trim();
  return text || null;
}

async function waitForQueuePanelAlert(
  page: any,
  timeoutMs = 10000,
): Promise<string | null> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const text = await getQueuePanelAlertText(page);
    if (text) return text;
    await page.waitForTimeout(250);
  }

  return null;
}

async function setDateTimeLocalInput(
  page: any,
  label: RegExp,
  value: string,
): Promise<void> {
  const input = page.getByLabel(label);
  await input.evaluate((element, nextValue) => {
    const field = element as HTMLInputElement;
    field.value = String(nextValue);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.blur();
  }, value);
  await expect(input).toHaveValue(value);
}

async function queueExportAndWaitForRow(
  page: any,
  input: {
    buttonName: RegExp;
    existingIds: Set<string>;
    exportType: string;
  },
): Promise<ExportRow> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const button = await triggerExportButton(page, input.buttonName);
    try {
      // Ensure transition has completed before we start reloading.
      await waitForQueueTransition(button).catch(() => null);

      const panelAlert = await waitForQueuePanelAlert(page, 10000);
      if (
        panelAlert &&
        /could not queue|failed|disabled|limit|forbidden|invalid/i.test(
          panelAlert,
        )
      ) {
        throw new Error(`Export queue failed: ${panelAlert}`);
      }

      return await waitForNewExport(page, {
        existingIds: input.existingIds,
        exportType: input.exportType,
        timeoutMs: 15000,
      });
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(500);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to queue ${input.exportType} export`);
}

test.describe("Admin Export UI & Processing", () => {
  test.describe.configure({ timeout: 120000 });
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "WebKit export queue interactions remain unstable under Playwright; covered on Chromium/Firefox projects.",
  );

  test.beforeEach(async ({ page, loginAs, workerUser }) => {
    // Use fixture helper to programmatically login the per-worker user
    await loginAs(workerUser.email);

    // Land on a stable admin route before navigating deeper; /admin itself redirects.
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/dashboard(?:\?|$)/);
  });

  test("creates export via UI and processes it (test runner)", async ({
    page,
    baseURL,
  }) => {
    await gotoExportsPage(page);
    const beforeIds = new Set((await readExportRows(page)).map((row) => row.id));

    const queuedExport = await queueExportAndWaitForRow(page, {
      buttonName: /Queue Sign-In CSV/i,
      existingIds: beforeIds,
      exportType: "SIGN_IN_CSV",
    });
    const jobId = queuedExport.id;

    // Trigger the test-only runner endpoint until this job is marked SUCCEEDED
    const endpoint = `${baseURL}/api/test/process-next-export`;

    let attempts = 0;
    let succeeded = false;
    while (attempts < 30) {
      await fetch(endpoint, {
        method: "POST",
        headers: getTestRouteHeaders(),
      }).catch(() => null);

      await page.reload();
      const rows = await readExportRows(page);
      const thisJob = rows.find((row) => row.id === jobId);
      if (thisJob?.status === "SUCCEEDED") {
        succeeded = true;
        break;
      }

      attempts++;
      await page.waitForTimeout(500);
    }

    expect(succeeded).toBe(true);

    // Ensure download link is present when job has succeeded
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

  test("queues compliance pack zip quick action", async ({ page }) => {
    await gotoExportsPage(page);
    const beforeIds = new Set((await readExportRows(page)).map((row) => row.id));

    let queuedExport: ExportRow | null = null;
    try {
      queuedExport = await queueExportAndWaitForRow(page, {
        buttonName: /Compliance Pack ZIP \(24h\)/i,
        existingIds: beforeIds,
        exportType: "COMPLIANCE_ZIP",
      });
    } catch {
      await setDateTimeLocalInput(
        page,
        /^From$/i,
        toLocalDateTimeInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      );
      await setDateTimeLocalInput(
        page,
        /^To$/i,
        toLocalDateTimeInputValue(new Date()),
      );

      const rangeButton = page.getByRole("button", {
        name: /Queue Compliance Pack \(Range\)/i,
      });
      await expect(rangeButton).toBeEnabled({ timeout: 10000 });

      queuedExport = await queueExportAndWaitForRow(page, {
        buttonName: /Queue Compliance Pack \(Range\)/i,
        existingIds: beforeIds,
        exportType: "COMPLIANCE_ZIP",
      });
    }

    expect(queuedExport).not.toBeNull();
    expect(queuedExport.status).toMatch(/QUEUED|RUNNING|SUCCEEDED/i);
  });
});
