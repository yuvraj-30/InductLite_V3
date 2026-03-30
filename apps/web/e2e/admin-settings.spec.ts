import { test, expect } from "./test-fixtures";

test.describe.serial("Admin Settings", () => {
  test.describe.configure({ timeout: 90000 });

  async function ensureDisclosureOpen(
    page: any,
    title: string,
    fieldLabel: string,
  ) {
    const field = page.getByLabel(fieldLabel);
    if (await field.isVisible().catch(() => false)) {
      return;
    }

    const disclosure = page
      .locator("details")
      .filter({ has: page.getByText(title, { exact: true }) })
      .first();

    await disclosure.locator("summary").click();
    await expect(field).toBeVisible();
  }

  async function setNumericField(page: any, label: string, value: string) {
    const field = page.getByLabel(label);
    await field.fill("");
    await field.type(value);
    await expect(field).toHaveValue(value);
  }

  async function setCheckboxChecked(page: any, label: string) {
    const checkbox = page.getByLabel(label);
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.check({ force: true });
    await expect(checkbox).toBeChecked();
  }

  async function submitSettingsForm(page: any, saveButton: any) {
    const saveForm = page
      .locator("form")
      .filter({ has: saveButton })
      .first();
    const submitRequest = page
      .waitForResponse(
        (response: any) =>
          response.request().method() === "POST" &&
          /\/admin\/settings(?:\?|$)/.test(response.url()),
        { timeout: 20000 },
      )
      .catch(() => null);

    await saveForm.evaluate((form: Element) => {
      (form as HTMLFormElement).requestSubmit();
    });

    await submitRequest;
  }

  test.beforeEach(async ({ page, loginAs, workerUser }) => {
    await loginAs(workerUser.email);
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Settings" }),
    ).toBeVisible();
  });

  test("admin can save retention and legal-hold settings", async ({ page }) => {
    const legalHoldReason = `Regulator evidence hold ${Date.now()}`;
    const saveButton = page.getByRole("button", { name: "Save Settings" });

    await ensureDisclosureOpen(
      page,
      "Retention windows",
      "Sign-in register retention (days)",
    );
    await setNumericField(page, "Sign-in register retention (days)", "730");
    await setNumericField(page, "Induction evidence retention (days)", "730");
    await setNumericField(page, "Audit log retention (days)", "180");
    await setNumericField(page, "Incident retention (days)", "2000");
    await setNumericField(page, "Emergency drill retention (days)", "2000");
    await ensureDisclosureOpen(
      page,
      "Pause automated purge rules",
      "Compliance legal hold enabled",
    );
    await setCheckboxChecked(page, "Compliance legal hold enabled");
    await page.getByLabel("Legal hold reason").fill(legalHoldReason);
    await expect(page.getByLabel("Legal hold reason")).toHaveValue(
      legalHoldReason,
    );

    await saveButton.scrollIntoViewIfNeeded();
    await submitSettingsForm(page, saveButton);
    await expect
      .poll(
        async () => {
          await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
          await ensureDisclosureOpen(
            page,
            "Retention windows",
            "Sign-in register retention (days)",
          );
          return page.getByLabel("Sign-in register retention (days)").inputValue();
        },
        { timeout: 45000 },
      )
      .toBe("730");

    await ensureDisclosureOpen(
      page,
      "Pause automated purge rules",
      "Compliance legal hold enabled",
    );
    await expect(
      page.getByLabel("Sign-in register retention (days)"),
    ).toHaveValue("730");
    await expect(
      page.getByLabel("Induction evidence retention (days)"),
    ).toHaveValue("730");
    await expect(page.getByLabel("Audit log retention (days)")).toHaveValue(
      "180",
    );
    await expect(page.getByLabel("Incident retention (days)")).toHaveValue(
      "2000",
    );
    await expect(
      page.getByLabel("Emergency drill retention (days)"),
    ).toHaveValue("2000");
    await expect(page.getByLabel("Compliance legal hold enabled")).toBeChecked();
    await expect(page.getByLabel("Legal hold reason")).toHaveValue(
      legalHoldReason,
    );
  });

  test("legal hold requires a reason", async ({ page }) => {
    const legalHoldReason = page.getByLabel("Legal hold reason");
    const saveButton = page.getByRole("button", { name: "Save Settings" });

    await ensureDisclosureOpen(
      page,
      "Pause automated purge rules",
      "Compliance legal hold enabled",
    );
    await setCheckboxChecked(page, "Compliance legal hold enabled");
    await legalHoldReason.waitFor({ state: "visible", timeout: 15000 });
    // Use fill() to clear value instead of keyboard shortcuts for mobile Safari stability.
    await legalHoldReason.fill(`temporary-${Date.now()}`);
    await legalHoldReason.fill("");
    await expect(legalHoldReason).toHaveValue("");

    await submitSettingsForm(page, saveButton);

    await expect(
      page
        .getByText(/legal hold reason is required when legal hold is enabled/i)
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
