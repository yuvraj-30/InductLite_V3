import { test, expect } from "./test-fixtures";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSiteId(href: string | null): string | null {
  if (!href) return null;
  const match = href.match(/\/admin\/sites\/([a-z0-9]+)(?:\?.*)?$/i);
  return match?.[1] ?? null;
}

async function findSiteIdByName(page: any, name: string): Promise<string> {
  if (!/\/admin\/sites(?:\?.*)?$/.test(page.url())) {
    await page.goto("/admin/sites");
  }
  const siteLinks = page.locator('a[href^="/admin/sites/"]', { hasText: name });
  const count = await siteLinks.count();
  for (let i = 0; i < count; i++) {
    const href = await siteLinks.nth(i).getAttribute("href");
    const siteId = parseSiteId(href);
    if (siteId) return siteId;
  }
  throw new Error(`Failed to resolve site id for ${name}`);
}

async function submitEmergencyForm(page: any, form: any) {
  const submitRequest = page
    .waitForResponse(
      (response: any) =>
        response.request().method() === "POST" &&
        /\/admin\/sites\/[^/]+\/emergency(?:\?|$)/.test(response.url()),
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

async function submitEmergencyRemove(page: any, row: any) {
  const submitRequest = page
    .waitForResponse(
      (response: any) =>
        response.request().method() === "POST" &&
        /\/admin\/sites\/[^/]+\/emergency(?:\?|$)/.test(response.url()),
      { timeout: 15000 },
    )
    .catch(() => null);

  const removeButton = row.getByRole("button", { name: "Remove" }).first();
  await removeButton.scrollIntoViewIfNeeded().catch(() => undefined);
  try {
    await removeButton.click({ timeout: 10000 });
  } catch {
    await removeButton.evaluate((button: Element) => {
      (button as HTMLButtonElement).click();
    });
  }
  await submitRequest;
}

async function createSiteAndGetId(page: any, name: string): Promise<string> {
  await page.goto("/admin/sites/new");
  await page.getByLabel(/site name/i).fill(name);
  const createButton = page.getByRole("button", { name: "Create Site" });
  await expect(createButton).toBeEnabled();

  const createForm = page
    .locator("form")
    .filter({ has: createButton })
    .first();
  const submitRequest = page
    .waitForResponse(
      (response: any) =>
        response.request().method() === "POST" &&
        /\/admin\/sites\/new(?:\?|$)/.test(response.url()),
      { timeout: 15000 },
    )
    .catch(() => null);

  await createForm.evaluate((form: Element) => {
    (form as HTMLFormElement).requestSubmit();
  });
  await submitRequest;
  await page.waitForURL(/\/admin\/sites(?:\?.*)?$/, { timeout: 30000 }).catch(() => undefined);

  await expect
    .poll(
      async () => {
        await page.goto("/admin/sites", { waitUntil: "domcontentloaded" });
        return (
          (await page
            .locator(`a[href^="/admin/sites/"]`, { hasText: name })
            .count()) > 0
        );
      },
      { timeout: 45000 },
    )
    .toBe(true);

  return findSiteIdByName(page, name);
}

async function countNamedListItems(section: any, text: string): Promise<number> {
  return section.locator("li", { hasText: text }).count();
}

async function safeReload(page: any) {
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /ERR_ABORTED|NS_BINDING_ABORTED|frame was detached|interrupted by another navigation|frame load interrupted|navigation interrupted|aborted/i.test(
        message,
      )
    ) {
      await page.waitForTimeout(200);
      return;
    }
    throw error;
  }
}

async function removeNamedItemUntilCountDrops(input: {
  page: any;
  section: any;
  name: string;
  previousCount: number;
  ensureReady?: () => Promise<void>;
}): Promise<number> {
  const { page, section, name, previousCount, ensureReady } = input;

  for (let attempt = 1; attempt <= 5; attempt++) {
    await ensureReady?.().catch(() => undefined);
    await safeReload(page);
    await ensureReady?.().catch(() => undefined);
    const currentCount = await countNamedListItems(section, name);
    if (currentCount < previousCount) {
      return currentCount;
    }

    const row = section.locator("li", { hasText: name }).first();
    if ((await row.count()) === 0) {
      return 0;
    }

    await submitEmergencyRemove(page, row).catch(() => undefined);
    await page.waitForTimeout(400 * attempt);
  }

  await safeReload(page);
  return countNamedListItems(section, name);
}

async function addNamedItemUntilCountIncreases(input: {
  page: any;
  section: any;
  name: string;
  previousCount: number;
  fillFields: () => Promise<void>;
  ensureReady?: () => Promise<void>;
}): Promise<number> {
  const { page, section, name, previousCount, fillFields, ensureReady } = input;

  for (let attempt = 1; attempt <= 4; attempt++) {
    await ensureReady?.().catch(() => undefined);
    await safeReload(page);
    await ensureReady?.().catch(() => undefined);
    const currentCount = await countNamedListItems(section, name);
    if (currentCount > previousCount) {
      return currentCount;
    }

    await fillFields();
    const form = section.locator("form").first();
    await submitEmergencyForm(page, form).catch(() => undefined);
    await page.waitForTimeout(300 * attempt);
  }

  await safeReload(page);
  return countNamedListItems(section, name);
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

    let siteId = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        siteId = await createSiteAndGetId(page, siteName);
        break;
      } catch (error) {
        const authRequired = await page
          .getByText(/authentication required/i)
          .first()
          .isVisible()
          .catch(() => false);
        if (!authRequired || attempt === 2) {
          throw error;
        }
        await loginAs(workerUser.email);
      }
    }

    await expect
      .poll(
        async () => {
          await page.goto(`/admin/sites/${siteId}/emergency`, {
            waitUntil: "domcontentloaded",
          });
          const authRequired = await page
            .getByText(/authentication required/i)
            .first()
            .isVisible()
            .catch(() => false);
          if (authRequired) {
            await loginAs(workerUser.email);
            return false;
          }

          const pageNotFound = await page
            .getByRole("heading", { level: 1, name: /page not found/i })
            .isVisible()
            .catch(() => false);
          if (pageNotFound) {
            siteId = await findSiteIdByName(page, siteName);
            return false;
          }

          return page
            .getByRole("heading", { level: 1, name: "Emergency Setup" })
            .isVisible()
            .catch(() => false);
        },
        { timeout: 45000 },
      )
      .toBe(true);

    const ensureEmergencyReady = async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const headingVisible = await page
          .getByRole("heading", { level: 1, name: "Emergency Setup" })
          .isVisible()
          .catch(() => false);
        if (headingVisible) {
          return;
        }

        const authRequired = await page
          .getByText(/authentication required/i)
          .first()
          .isVisible()
          .catch(() => false);
        if (authRequired) {
          await loginAs(workerUser.email);
        }

        await page
          .goto(`/admin/sites/${siteId}/emergency`, {
            waitUntil: "domcontentloaded",
          })
          .catch(() => undefined);

        const pageNotFound = await page
          .getByRole("heading", { level: 1, name: /page not found/i })
          .isVisible()
          .catch(() => false);
        if (pageNotFound) {
          siteId = await findSiteIdByName(page, siteName);
        }
      }

      throw new Error("Emergency setup page not ready for form interaction");
    };

    const contactsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Emergency Contacts" }),
    });
    const fillContactForm = async () => {
      await contactsSection.locator('input[name="name"]').fill(contactName);
      await contactsSection.locator('input[name="role"]').fill("Site Manager");
      await contactsSection.locator('input[name="phone"]').fill("021 444 9999");
      await contactsSection
        .locator('input[name="email"]')
        .fill("safety.lead@example.test");
      await contactsSection.locator('input[name="priority"]').fill("1");
    };
    const contactCountBeforeAdd = await countNamedListItems(
      contactsSection,
      contactName,
    );
    const contactCountAfterAdd = await addNamedItemUntilCountIncreases({
      page,
      section: contactsSection,
      name: contactName,
      previousCount: contactCountBeforeAdd,
      fillFields: fillContactForm,
      ensureReady: ensureEmergencyReady,
    });
    expect(contactCountAfterAdd).toBeGreaterThan(contactCountBeforeAdd);

    const contactRow = contactsSection.locator("li", { hasText: contactName }).first();
    await submitEmergencyRemove(page, contactRow).catch(() => undefined);
    const contactCountAfterRemove = await removeNamedItemUntilCountDrops({
      page,
      section: contactsSection,
      name: contactName,
      previousCount: contactCountAfterAdd,
      ensureReady: ensureEmergencyReady,
    });
    expect(contactCountAfterRemove).toBeLessThan(contactCountAfterAdd);

    await expect
      .poll(
        async () => {
          await page
            .goto(`/admin/sites/${siteId}/emergency`, {
              waitUntil: "domcontentloaded",
            })
            .catch(() => undefined);
          const authRequired = await page
            .getByText(/authentication required/i)
            .first()
            .isVisible()
            .catch(() => false);
          if (authRequired) {
            await loginAs(workerUser.email);
            return false;
          }
          return page
            .getByRole("heading", { level: 1, name: "Emergency Setup" })
            .isVisible()
            .catch(() => false);
        },
        { timeout: 30000 },
      )
      .toBe(true);

    const proceduresSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Emergency Procedures" }),
    });
    const fillProcedureForm = async () => {
      await proceduresSection.locator('input[name="title"]').fill(procedureTitle);
      await proceduresSection
        .locator('textarea[name="instructions"]')
        .fill("Evacuate to the north muster point and check in with the foreman.");
      await proceduresSection.locator('input[name="sortOrder"]').fill("1");
    };
    const procedureCountBeforeAdd = await countNamedListItems(
      proceduresSection,
      procedureTitle,
    );
    const procedureCountAfterAdd = await addNamedItemUntilCountIncreases({
      page,
      section: proceduresSection,
      name: procedureTitle,
      previousCount: procedureCountBeforeAdd,
      fillFields: fillProcedureForm,
      ensureReady: ensureEmergencyReady,
    });
    expect(procedureCountAfterAdd).toBeGreaterThan(procedureCountBeforeAdd);

    const procedureRow = proceduresSection
      .locator("li", { hasText: procedureTitle })
      .first();
    await submitEmergencyRemove(page, procedureRow).catch(() => undefined);
    const procedureCountAfterRemove = await removeNamedItemUntilCountDrops({
      page,
      section: proceduresSection,
      name: procedureTitle,
      previousCount: procedureCountAfterAdd,
      ensureReady: ensureEmergencyReady,
    });
    expect(procedureCountAfterRemove).toBeLessThan(procedureCountAfterAdd);
  });
});
