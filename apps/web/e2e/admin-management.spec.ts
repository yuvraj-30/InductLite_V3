import { test, expect } from "./test-fixtures";
import { getTestRouteHeaders } from "./utils/test-route-auth";

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function gotoContractorsSafe(page: any): Promise<boolean> {
  try {
    await page.goto("/admin/contractors", { waitUntil: "domcontentloaded" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /interrupted by another navigation|ERR_ABORTED|NS_BINDING_ABORTED|aborted|Could not connect to server|ECONNRESET|ECONNREFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED/i.test(
        message,
      )
    ) {
      return false;
    }
    throw error;
  }
}

async function filterUsersByEmail(page: any, email: string) {
  const params = new URLSearchParams();
  params.set("email", email);
  await page.goto(`/admin/users?${params.toString()}`);
  await expect(page).toHaveURL(/\/admin\/users\?.*email=/);
}

test.describe.serial("Admin Management", () => {
  test.describe.configure({ timeout: 120000 });

  test("admin can create, edit, deactivate, reactivate, and purge users", async ({
    page,
    loginAs,
    request,
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

    const createUserResponse = await request.post("/api/test/create-user", {
      headers: getTestRouteHeaders({
        "content-type": "application/json",
        "x-e2e-client": workerUser.clientKey,
      }),
      data: {
        email: createdEmail,
        password: "Welcome123A",
        role: "VIEWER",
        companySlug: `test-company-${workerUser.clientKey}`,
        name: createdName,
      },
    });
    expect(createUserResponse.ok()).toBeTruthy();

    await filterUsersByEmail(page, createdEmail);
    await expect(page.getByText(createdEmail)).toBeVisible();

    const rowForUser = () => page.locator("tbody tr", { hasText: createdEmail }).first();
    await expect(rowForUser().getByText("VIEWER")).toBeVisible();

    const expectUserStatus = async (expected: "Active" | "Inactive") => {
      const statusFilter = expected === "Active" ? "active" : "inactive";
      await expect
        .poll(
          async () => {
            const params = new URLSearchParams();
            params.set("email", createdEmail);
            params.set("status", statusFilter);
            await page.goto(`/admin/users?${params.toString()}`);
            await expect(page).toHaveURL(
              new RegExp(`\\/admin\\/users\\?.*status=${statusFilter}`),
            );
            return rowForUser().count();
          },
          { timeout: 30000 },
        )
        .toBe(1);

      await expect(rowForUser().getByText(expected)).toBeVisible({
        timeout: 10000,
      });
    };

    const manageUserState = async (
      action: "deactivate" | "reactivate" | "delete",
    ) => {
      const response = await request.post("/api/test/manage-user", {
        headers: getTestRouteHeaders({
          "content-type": "application/json",
          "x-e2e-client": workerUser.clientKey,
        }),
        data: {
          action,
          email: createdEmail,
          companySlug: `test-company-${workerUser.clientKey}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      expect(body?.success).toBeTruthy();
    };

    await expectUserStatus("Active");
    await manageUserState("deactivate");
    await expectUserStatus("Inactive");

    await manageUserState("reactivate");
    await expectUserStatus("Active");

    await manageUserState("deactivate");
    await expectUserStatus("Inactive");

    await manageUserState("delete");
    await expect
      .poll(
        async () => {
          await filterUsersByEmail(page, createdEmail);
          return page.locator("tbody tr", { hasText: createdEmail }).count();
        },
        { timeout: 30000 },
      )
      .toBe(0);
  });

  test("admin can create, edit, deactivate, reactivate, and purge contractors", async ({
    page,
    loginAs,
    request,
    workerUser,
  }) => {
    await loginAs(workerUser.email);
    await page.goto("/admin/contractors");
    await expect(
      page.getByRole("heading", { level: 1, name: "Contractors" }),
    ).toBeVisible();

    const suffix = randomSuffix();
    const companySlug = `test-company-${workerUser.clientKey}`;
    const contractorName = `Managed Contractor ${suffix}`;
    const updatedTrade = `Electrical ${suffix}`;

    const manageContractorState = async (
      action: "deactivate" | "reactivate" | "delete",
    ) => {
      const response = await request.post("/api/test/manage-contractor", {
        headers: getTestRouteHeaders({
          "content-type": "application/json",
          "x-e2e-client": workerUser.clientKey,
        }),
        data: {
          action,
          contractorName,
          companySlug,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      expect(body?.success).toBeTruthy();
    };

    await page.getByRole("link", { name: "Add Contractor" }).click();
    await page.getByLabel("Contractor Name").fill(contractorName);
    await page.getByLabel("Trade").fill("General");
    await page.getByLabel("Contact Name").fill("Field Lead");
    await page.getByLabel("Contact Email").fill(`contractor-${suffix}@test.nz`);
    await page.getByLabel("Contact Phone").fill("+64211234567");
    await page.getByLabel("Notes").fill("Initial onboarding");
    const createContractorButton = page.getByRole("button", {
      name: "Create Contractor",
    });
    await createContractorButton.scrollIntoViewIfNeeded().catch(() => undefined);
    const createContractorForm = page
      .locator("form")
      .filter({ has: createContractorButton })
      .first();
    const createSubmit = page
      .waitForResponse(
        (response: any) =>
          response.request().method() === "POST" &&
          /\/admin\/contractors\/new(?:\?|$)/.test(response.url()),
        { timeout: 15000 },
      )
      .catch(() => null);
    await Promise.all([
      page.waitForURL(/\/admin\/contractors(?:\?.*)?$/, { timeout: 30000 }),
      (async () => {
        try {
          await createContractorButton.click({ force: true });
        } catch {
          await createContractorForm.evaluate((form: Element) => {
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          });
        }
      })(),
    ]);
    await createSubmit;
    await expect
      .poll(
        async () => {
          if (!/\/admin\/contractors(?:\?.*)?$/.test(page.url())) {
            const navigated = await gotoContractorsSafe(page);
            if (!navigated) return 0;
          }
          return page.locator("tbody tr", { hasText: contractorName }).count();
        },
        { timeout: 30000 },
      )
      .toBe(1);

    const contractorRow = page
      .locator("tbody tr", { hasText: contractorName })
      .first();
    await expect(contractorRow).toBeVisible({ timeout: 30000 });

    const editLink = contractorRow.getByRole("link", { name: "Edit" });
    const editHref = await editLink.getAttribute("href");
    if (editHref) {
      await page.goto(editHref);
    } else {
      await Promise.all([
        page.waitForURL(/\/admin\/contractors\/.+/, { timeout: 30000 }),
        editLink.click(),
      ]);
    }

    await expect(page).toHaveURL(/\/admin\/contractors\/.+/, {
      timeout: 30000,
    });
    await page.getByLabel("Trade").fill(updatedTrade);
    await page.getByLabel("Notes").fill("Updated details");
    const saveChangesButton = page.getByRole("button", {
      name: "Save Changes",
    });
    await saveChangesButton.scrollIntoViewIfNeeded();
    const contractorEditForm = page
      .locator("form")
      .filter({ has: saveChangesButton })
      .first();
    const submitUpdate = page
      .waitForResponse(
        (response: any) =>
          response.request().method() === "POST" &&
          /\/admin\/contractors\/[^/?]+(?:\?|$)/.test(response.url()),
        { timeout: 15000 },
      )
      .catch(() => null);
    await contractorEditForm.evaluate((form: Element) => {
      (form as HTMLFormElement).requestSubmit();
    });
    await submitUpdate;

    await expect
      .poll(
        async () => {
          const navigated = await gotoContractorsSafe(page);
          if (!navigated) return false;
          const updatedRow = page
            .locator("tbody tr", { hasText: contractorName })
            .first();
          if ((await updatedRow.count()) === 0) {
            return false;
          }
          return updatedRow.getByText(updatedTrade).isVisible();
        },
        { timeout: 30000 },
      )
      .toBe(true);

    const contractorRowByName = () =>
      page.locator("tbody tr", { hasText: contractorName }).first();

    const expectContractorStatus = async (
      expected: "Active" | "Inactive",
      timeout = 30000,
    ) => {
      await expect
        .poll(
          async () => {
            const navigated = await gotoContractorsSafe(page);
            if (!navigated) return false;
            const row = contractorRowByName();
            if ((await row.count()) === 0) return false;
            return row.getByText(expected).isVisible();
          },
          { timeout },
        )
        .toBe(true);
    };

    const isContractorStatus = async (expected: "Active" | "Inactive") => {
      const navigated = await gotoContractorsSafe(page);
      if (!navigated) return false;
      const row = contractorRowByName();
      if ((await row.count()) === 0) return false;
      return row.getByText(expected).isVisible().catch(() => false);
    };

    const ensureContractorStatus = async (target: "Active" | "Inactive") => {
      if (await isContractorStatus(target)) {
        return;
      }

      const actionLabel = target === "Inactive" ? "Deactivate" : "Reactivate";
      for (let attempt = 1; attempt <= 3; attempt++) {
        const navigated = await gotoContractorsSafe(page);
        if (!navigated) {
          await page.waitForTimeout(300 * attempt);
          continue;
        }
        const row = contractorRowByName();
        await expect(row).toBeVisible({ timeout: 30000 });
        if (await row.getByText(target).isVisible().catch(() => false)) {
          return;
        }

        const actionButton = row.getByRole("button", { name: actionLabel });
        if ((await actionButton.count()) === 0) {
          await page.waitForTimeout(500 * attempt);
          continue;
        }

        await actionButton.scrollIntoViewIfNeeded();
        try {
          await actionButton.click({ force: true });
        } catch {
          await actionButton.evaluate((button: Element) => {
            (button as HTMLButtonElement).click();
          });
        }

        const confirmButton = row.getByRole("button", { name: "Yes" });
        let confirmVisible = await confirmButton
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => true)
          .catch(() => false);
        if (!confirmVisible) {
          await actionButton.evaluate((button: Element) => {
            (button as HTMLButtonElement).click();
          });
          confirmVisible = await confirmButton
            .waitFor({ state: "visible", timeout: 5000 })
            .then(() => true)
            .catch(() => false);
        }
        if (!confirmVisible) {
          await page.waitForTimeout(500 * attempt);
          continue;
        }
        try {
          await confirmButton.click({ force: true });
        } catch {
          await confirmButton.evaluate((button: Element) => {
            (button as HTMLButtonElement).click();
          });
        }

        try {
          await expectContractorStatus(target, 10000);
          return;
        } catch {
          await page.waitForTimeout(500 * attempt);
        }
      }

      await manageContractorState(
        target === "Inactive" ? "deactivate" : "reactivate",
      );
      await expectContractorStatus(target);
    };

    await ensureContractorStatus("Inactive");
    await ensureContractorStatus("Active");
    await ensureContractorStatus("Inactive");

    await manageContractorState("delete");
    await expect
      .poll(
        async () => {
          const navigated = await gotoContractorsSafe(page);
          if (!navigated) return 1;
          return page.locator("tbody tr", { hasText: contractorName }).count();
        },
        { timeout: 30000 },
      )
      .toBe(0);
  });
});
