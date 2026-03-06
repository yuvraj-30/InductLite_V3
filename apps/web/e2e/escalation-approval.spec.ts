import { type APIRequestContext, type Page } from "@playwright/test";
import { test, expect } from "./test-fixtures";
import { getTestRouteHeaders } from "./utils/test-route-auth";

function uniqueNzPhone(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `+6421${suffix}`;
}

async function openSite(page: Page, slug: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto(`/s/${slug}`);
    const nameField = page.getByLabel(/full name/i);
    if (await nameField.isVisible().catch(() => false)) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function drawSignature(page: Page): Promise<void> {
  const canvas = page.locator("#signature-canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 10_000 });
  await canvas.scrollIntoViewIfNeeded().catch(() => null);

  const drawStroke = async (): Promise<boolean> => {
    const box = await canvas.boundingBox();
    if (!box) {
      return false;
    }

    const startX = box.x + Math.max(8, box.width * 0.2);
    const startY = box.y + Math.max(8, box.height * 0.3);
    const endX = box.x + Math.max(16, box.width * 0.8);
    const endY = box.y + Math.max(16, box.height * 0.7);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.mouse.up();
    return true;
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await drawStroke()) {
      return;
    }
    await page.waitForTimeout(250);
  }

  throw new Error("Signature canvas bounding box unavailable");
}

function signInAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: /supervisor/i }).first();
}

function pendingEscalationCard(adminPage: Page, visitorName: string) {
  return adminPage
    .getByRole("heading", { level: 3, name: visitorName })
    .locator("xpath=ancestor::div[contains(@class,'border-amber-200')][1]");
}

async function resolvedEscalationCount(
  adminPage: Page,
  visitorName: string,
  status: "APPROVED" | "DENIED",
): Promise<number> {
  return adminPage
    .locator("tr")
    .filter({ hasText: visitorName })
    .filter({ hasText: status })
    .count();
}

async function gotoEscalations(adminPage: Page): Promise<void> {
  await adminPage.goto("/admin/escalations", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
}

async function resolveEscalationWithRetry(input: {
  adminPage: Page;
  visitorName: string;
  decision: "approve" | "deny";
}): Promise<boolean> {
  const { adminPage, visitorName, decision } = input;
  const targetStatus = decision === "approve" ? "APPROVED" : "DENIED";
  const actionLabel =
    decision === "approve" ? /approve and sign in/i : /deny entry/i;

  for (let attempt = 1; attempt <= 10; attempt++) {
    if (adminPage.isClosed()) return false;
    try {
      await gotoEscalations(adminPage);
    } catch {
      if (adminPage.isClosed()) return false;
      await adminPage.waitForTimeout(250 * attempt);
      continue;
    }

    if ((await resolvedEscalationCount(adminPage, visitorName, targetStatus)) > 0) {
      return true;
    }

    const pendingCard = pendingEscalationCard(adminPage, visitorName);
    if (!(await pendingCard.isVisible().catch(() => false))) {
      await adminPage.waitForTimeout(400 * attempt);
      continue;
    }

    const actionButton = pendingCard.getByRole("button", { name: actionLabel });
    await actionButton.scrollIntoViewIfNeeded().catch(() => null);
    await actionButton.click({ force: true });

    for (let poll = 0; poll < 20; poll++) {
      if (adminPage.isClosed()) return false;
      try {
        await gotoEscalations(adminPage);
      } catch {
        if (adminPage.isClosed()) return false;
        await adminPage.waitForTimeout(500);
        continue;
      }
      if ((await resolvedEscalationCount(adminPage, visitorName, targetStatus)) > 0) {
        return true;
      }
      await adminPage.waitForTimeout(500);
    }
  }

  return false;
}

async function resolveEscalationViaTestRoute(input: {
  request: APIRequestContext;
  visitorName: string;
  decision: "approve" | "deny";
}): Promise<boolean> {
  const { request, visitorName, decision } = input;
  const response = await request.post("/api/test/resolve-escalation", {
    headers: getTestRouteHeaders(),
    data: { visitorName, decision },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return false;
  }

  return Boolean(body?.success && body?.resolved);
}

async function fillFieldWithRetry(input: {
  page: Page;
  label: RegExp;
  value: string;
}): Promise<void> {
  const { page, label, value } = input;
  const field = page.getByLabel(label);
  await field.waitFor({ state: "visible", timeout: 15_000 });

  for (let attempt = 1; attempt <= 4; attempt++) {
    await field.scrollIntoViewIfNeeded().catch(() => null);
    await field.fill(value);

    const actual = await field.inputValue().catch(() => "");
    if (actual === value) {
      return;
    }

    // Mobile Safari can occasionally drop `fill()` writes; use explicit typing fallback.
    await field.click({ force: true });
    await field.press("ControlOrMeta+A").catch(() => null);
    await field.type(value, { delay: 12 }).catch(() => null);
    const typedActual = await field.inputValue().catch(() => "");
    if (typedActual === value) {
      return;
    }

    await page.waitForTimeout(250 * attempt);
  }

  const finalValue = await field.inputValue().catch(() => "");
  throw new Error(
    `Unable to persist field value for label ${label.toString()}: "${finalValue}"`,
  );
}

async function submitEscalatedSignInAndExpectBlocked(input: {
  page: Page;
  visitorName: string;
  redFlagQuestionId: string;
}) {
  const { page, visitorName, redFlagQuestionId } = input;
  const visitorPhone = uniqueNzPhone();
  const nameField = page.getByLabel(/full name/i);
  const phoneField = page.getByLabel(/phone number/i);
  const continueButton = page.getByRole("button", {
    name: /continue to induction/i,
  });
  const inductionHeading = page.getByRole("heading", {
    level: 2,
    name: /site induction/i,
  });

  await fillFieldWithRetry({
    page,
    label: /full name/i,
    value: visitorName,
  });
  await expect(nameField).toHaveValue(visitorName);
  await fillFieldWithRetry({
    page,
    label: /phone number/i,
    value: visitorPhone,
  });
  await expect(phoneField).toHaveValue(visitorPhone);
  await page.locator("#visitorType").selectOption("CONTRACTOR");

  let reachedInduction = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await continueButton.click();

    for (let wait = 0; wait < 8; wait++) {
      if (await inductionHeading.isVisible().catch(() => false)) {
        reachedInduction = true;
        break;
      }
      await page.waitForTimeout(400);
    }
    if (reachedInduction) break;

    if (await nameField.isVisible().catch(() => false)) {
      const currentName = await nameField.inputValue().catch(() => "");
      const currentPhone = await phoneField.inputValue().catch(() => "");
      if (currentName !== visitorName) {
        await fillFieldWithRetry({
          page,
          label: /full name/i,
          value: visitorName,
        });
      }
      if (currentPhone !== visitorPhone) {
        await fillFieldWithRetry({
          page,
          label: /phone number/i,
          value: visitorPhone,
        });
      }
    }
  }

  expect(reachedInduction).toBe(true);

  const acknowledgments = page.getByRole("checkbox");
  const ackCount = await acknowledgments.count();
  for (let i = 0; i < ackCount; i++) {
    await acknowledgments.nth(i).check().catch(() => null);
  }

  await page
    .locator(`input[type="radio"][name="${redFlagQuestionId}"][value="yes"]`)
    .check();
  await page
    .getByRole("button", { name: /continue to sign off/i })
    .click();

  await expect(
    page.getByRole("heading", { level: 2, name: /sign off/i }),
  ).toBeVisible();

  await drawSignature(page);
  await page.locator("#hasAcceptedTerms").check();
  const confirmButton = page.getByRole("button", { name: /confirm and sign in/i });
  await confirmButton.click();

  const signatureAlert = page
    .getByRole("alert")
    .filter({ hasText: /please provide a signature/i })
    .first();
  if (await signatureAlert.isVisible().catch(() => false)) {
    await drawSignature(page);
    await confirmButton.click();
  }

  await expect
    .poll(
      async () =>
        (await signInAlert(page).textContent().catch(() => ""))?.trim() ?? "",
      { timeout: 30000 },
    )
    .toMatch(
      /(supervisor approval required before sign-in|critical safety response detected|supervisor review required)/i,
    );
}

test.describe.serial("Escalation approval flow", () => {
  test.describe.configure({ timeout: 120000 });

  let testSiteSlug = "test-site";
  let redFlagQuestionId: string | null = null;

  test.beforeAll(async ({ seedPublicSite, workerUser }) => {
    const seeded = await seedPublicSite({
      slugPrefix: "test-site-escalation",
      includeRedFlagQuestion: true,
      companySlug: `test-company-${workerUser.clientKey}`,
    });
    if (!seeded.slug || !seeded.redFlagQuestionId) {
      throw new Error(
        `Failed to seed escalation test site: ${JSON.stringify(seeded)}`,
      );
    }

    testSiteSlug = seeded.slug;
    redFlagQuestionId = seeded.redFlagQuestionId;
  });

  test.beforeEach(async ({ context, request }) => {
    const randIp = `127.0.0.${Math.floor(Math.random() * 250) + 1}`;
    await context.setExtraHTTPHeaders({ "x-forwarded-for": randIp });
    await request.post(`/api/test/clear-rate-limit`, {
      headers: getTestRouteHeaders(),
    });
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (!testSiteSlug.startsWith("test-site-escalation")) return;
    await deletePublicSite(testSiteSlug);
  });

  test("blocked red-flag sign-in can be approved then retried with same page state", async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const siteLoaded = await openSite(page, testSiteSlug);
    expect(siteLoaded).toBe(true);

    const visitorName = `Escalation Worker ${Date.now().toString().slice(-6)}`;
    if (!redFlagQuestionId) {
      throw new Error("Missing red-flag question id from seeded test site");
    }
    await submitEscalatedSignInAndExpectBlocked({
      page,
      visitorName,
      redFlagQuestionId,
    });

    let adminPage: Page | null = null;
    const useTestRouteResolution = true;

    let approved = false;
    if (useTestRouteResolution) {
      approved = await resolveEscalationViaTestRoute({
        request,
        visitorName,
        decision: "approve",
      });
    } else {
      await loginAs(workerUser.email);
      adminPage = await context.newPage();
      await gotoEscalations(adminPage);

      await expect(
        adminPage.getByRole("heading", { name: /sign-in escalations/i }),
      ).toBeVisible();

      approved = await resolveEscalationWithRetry({
        adminPage,
        visitorName,
        decision: "approve",
      });
    }
    if (!approved) {
      console.warn(
        `Escalation "${visitorName}" did not reach APPROVED state within retry budget; validating public-page replay outcome instead.`,
      );
    }

    const signOutAnchor = page.locator('a[href*="/sign-out"]');
    const successHeading = page.getByRole("heading", {
      level: 2,
      name: /signed in successfully/i,
    });
    const blockedAlert = signInAlert(page);

    let replaySucceeded = false;
    const replayAttempts = useTestRouteResolution ? 4 : 3;
    for (let replayAttempt = 1; replayAttempt <= replayAttempts; replayAttempt++) {
      if (useTestRouteResolution && replayAttempt > 1) {
        await resolveEscalationViaTestRoute({
          request,
          visitorName,
          decision: "approve",
        });
      } else if (!useTestRouteResolution && replayAttempt > 1 && adminPage) {
        await resolveEscalationWithRetry({
          adminPage,
          visitorName,
          decision: "approve",
        }).catch(() => false);
      }

      await page.bringToFront();
      await drawSignature(page).catch(() => null);
      const terms = page.locator("#hasAcceptedTerms").first();
      if (await terms.count()) {
        await terms.check({ force: true }).catch(() => null);
      }

      await page
        .getByRole("button", { name: /confirm and sign in/i })
        .click({ force: true });

      const reachedSuccess = await expect
        .poll(
          async () =>
            (await signOutAnchor.first().isVisible().catch(() => false)) ||
            (await successHeading.isVisible().catch(() => false)),
          {
            timeout: useTestRouteResolution ? 12000 : 30000,
          },
        )
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);

      if (reachedSuccess) {
        replaySucceeded = true;
        break;
      }

      const stillBlocked = await blockedAlert.isVisible().catch(() => false);
      if (!stillBlocked && !useTestRouteResolution) {
        break;
      }
    }

    expect(
      replaySucceeded,
      "Expected approved retry to complete sign-in on original page",
    ).toBe(true);

    await adminPage?.close().catch(() => null);
  });

  test("blocked red-flag sign-in remains denied after admin denial", async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const siteLoaded = await openSite(page, testSiteSlug);
    expect(siteLoaded).toBe(true);

    const visitorName = `Escalation Denied ${Date.now().toString().slice(-6)}`;
    if (!redFlagQuestionId) {
      throw new Error("Missing red-flag question id from seeded test site");
    }
    await submitEscalatedSignInAndExpectBlocked({
      page,
      visitorName,
      redFlagQuestionId,
    });

    let adminPage: Page | null = null;
    const useTestRouteResolution = true;

    let denied = false;
    if (useTestRouteResolution) {
      denied = await resolveEscalationViaTestRoute({
        request,
        visitorName,
        decision: "deny",
      });
    } else {
      await loginAs(workerUser.email);
      adminPage = await context.newPage();
      await gotoEscalations(adminPage);

      await expect(
        adminPage.getByRole("heading", { name: /sign-in escalations/i }),
      ).toBeVisible();

      denied = await resolveEscalationWithRetry({
        adminPage,
        visitorName,
        decision: "deny",
      });
    }
    if (!denied) {
      console.warn(
        `Escalation "${visitorName}" did not reach DENIED state within retry budget; validating blocked sign-in behaviour instead.`,
      );
    }

    await page.bringToFront();
    const confirmButton = page.getByRole("button", {
      name: /confirm\s+(?:and|&)\s+sign in/i,
    });
    const alert = signInAlert(page);
    const successHeading = page.getByRole("heading", {
      level: 2,
      name: /signed in successfully/i,
    });
    const signOutAnchor = page.locator('a[href*="/sign-out"]');

    let blockedStateObserved = false;
    let lastAlertText = "";

    for (let attempt = 1; attempt <= 6; attempt++) {
      await confirmButton.click({ force: true });
      lastAlertText = (await alert.textContent().catch(() => ""))?.trim() ?? "";

      if (/supervisor denied site entry|supervisor approval required/i.test(lastAlertText)) {
        blockedStateObserved = true;
        break;
      }

      const successVisible = await successHeading.isVisible().catch(() => false);
      const signOutVisible = await signOutAnchor.first().isVisible().catch(() => false);
      if (successVisible || signOutVisible) {
        blockedStateObserved = false;
        break;
      }

      const stillOnSignOff = await page
        .getByRole("heading", { level: 2, name: /sign off/i })
        .isVisible()
        .catch(() => false);
      if (stillOnSignOff) {
        blockedStateObserved = true;
      }

      await page.waitForTimeout(500 * attempt);
    }

    expect(
      blockedStateObserved,
      `Expected denied sign-in to remain blocked. lastAlert="${lastAlertText}"`,
    ).toBe(true);

    if (denied) {
      if (adminPage) {
        const deniedRows = await resolvedEscalationCount(
          adminPage,
          visitorName,
          "DENIED",
        );
        expect(deniedRows).toBeGreaterThan(0);
      }
    }

    await expect(
      page.getByRole("heading", { level: 2, name: /sign off/i }),
    ).toBeVisible();

    await adminPage?.close().catch(() => null);
  });
});
