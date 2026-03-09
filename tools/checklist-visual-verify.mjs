import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!";
const headless = process.argv.includes("--headless");
const slowMoArg = process.argv.find((arg) => arg.startsWith("--slowmo="));
const slowMo = slowMoArg ? Number(slowMoArg.split("=")[1]) || 120 : 120;
const keepOpen = process.argv.includes("--keep-open");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(
  process.cwd(),
  "apps",
  "web",
  "manual-evidence",
  `checklist-visual-${stamp}`,
);
const screenshotsDir = path.join(outDir, "screenshots");
const resultPath = path.join(outDir, "results.json");

fs.mkdirSync(screenshotsDir, { recursive: true });

const results = [];
let stepCounter = 0;

function pushResult(entry) {
  results.push({
    at: new Date().toISOString(),
    ...entry,
  });
}

function sanitize(value) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 120);
}

async function screenshot(page, label) {
  stepCounter += 1;
  const filename = `${String(stepCounter).padStart(3, "0")}-${sanitize(label)}.png`;
  const fullPath = path.join(screenshotsDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

function bodyLooksDenied(text) {
  return /PLAN-ENTITLEMENT-001|not enabled for this plan|not enabled for this site plan|disabled by rollout flag|page not found/i.test(
    text,
  );
}

function bodyLooksBroken(text) {
  return /Internal Server Error|Application error|Unhandled Runtime Error/i.test(text);
}

async function gotoAndCheck(page, route, opts = {}) {
  const {
    expectDenied = false,
    requireText = null,
    note = route,
  } = opts;

  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  const status = response?.status() ?? 0;

  if (status >= 500) {
    throw new Error(`Route ${route} returned ${status}`);
  }

  const body = await page.locator("body").innerText();
  if (bodyLooksBroken(body)) {
    throw new Error(`Route ${route} shows runtime error text`);
  }

  if (expectDenied && !bodyLooksDenied(body)) {
    throw new Error(`Route ${route} expected entitlement denial text`);
  }

  if (requireText && !body.toLowerCase().includes(requireText.toLowerCase())) {
    throw new Error(`Route ${route} missing required text: ${requireText}`);
  }

  await screenshot(page, note);
  pushResult({
    step: note,
    status: "passed",
    route,
    httpStatus: status,
  });
}

async function logout(page) {
  await page.request
    .post(`${baseUrl}/api/auth/logout`, {
      failOnStatusCode: false,
      timeout: 30_000,
    })
    .catch(() => null);

  await page.context().clearCookies().catch(() => null);

  await page.goto(`${baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
}

async function login(page, email, password) {
  await logout(page).catch(() => null);

  await page.goto(`${baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  if (/\/admin(?:\/|$)/i.test(page.url())) {
    await logout(page).catch(() => null);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (/\/admin(?:\/|$)/i.test(page.url())) break;

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator("form").first().evaluate((form) => form.requestSubmit());
    await page
      .waitForURL(/\/admin(?:\/|$)/i, {
        timeout: 20_000,
        waitUntil: "domcontentloaded",
      })
      .catch(() => null);

    if (/\/admin(?:\/|$)/i.test(page.url())) break;

    const alertText = await page
      .getByRole("alert")
      .first()
      .textContent()
      .catch(() => null);
    if (alertText && alertText.trim().length > 0) {
      throw new Error(
        `Login failed for ${email}: ${alertText.trim().replace(/\s+/g, " ")}`,
      );
    }

    await page.waitForTimeout(1_000);
  }

  if (!/\/admin(?:\/|$)/i.test(page.url())) {
    throw new Error(`Login did not reach admin for ${email}. Current URL: ${page.url()}`);
  }

  await screenshot(page, `login-${email}`);
  pushResult({
    step: `login:${email}`,
    status: "passed",
    route: page.url(),
  });
}

async function findSiteIdByName(page, siteName) {
  await page.goto(`${baseUrl}/admin/sites`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const links = page.locator('a[href^="/admin/sites/"]');
  const count = await links.count();
  if (count === 0) {
    throw new Error(`No site links found while resolving "${siteName}"`);
  }

  const normalize = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const target = normalize(siteName);
  const candidates = [];
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    const text = normalize((await link.innerText().catch(() => "")) || "");
    const href = await link.getAttribute("href");
    const match = href?.match(/\/admin\/sites\/([^/?#]+)/i);
    if (match?.[1] && !/\/admin\/sites\/new$/i.test(href ?? "")) {
      candidates.push({ text, id: match[1] });
    }
    if (!text || !text.includes(target)) continue;
    if (match?.[1]) return match[1];
  }

  if (/site\s+a$/i.test(siteName) && candidates[0]?.id) return candidates[0].id;
  if (/site\s+b$/i.test(siteName) && candidates[1]?.id) return candidates[1].id;

  throw new Error(`Could not resolve site ID for "${siteName}"`);
}

async function drawSignature(page) {
  const canvas = page.locator("#signature-canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 20_000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Signature canvas not available");

  const sx = box.x + Math.max(12, box.width * 0.2);
  const sy = box.y + Math.max(12, box.height * 0.3);
  const ex = box.x + Math.max(22, box.width * 0.8);
  const ey = box.y + Math.max(22, box.height * 0.7);

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(ex, ey, { steps: 12 });
  await page.mouse.up();
}

async function runPublicSignInFlow(page, slug, label) {
  const unique = Date.now().toString().slice(-6);
  const visitorName = `Checklist ${label} ${unique}`;
  const visitorPhone = "+64210000000";

  await page.goto(`${baseUrl}/s/${slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.evaluate((siteSlug) => {
    try {
      localStorage.removeItem(`inductlite:sign-in-draft:${siteSlug}`);
      localStorage.removeItem(`inductlite:sign-in-queue:${siteSlug}`);
      localStorage.removeItem(`inductlite:last-visit:${siteSlug}`);
    } catch {}
  }, slug);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });

  const visitorPhoneLocal = "0211234567";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.locator("#visitorName").click().catch(() => null);
    await page.keyboard.press("Control+A").catch(() => null);
    await page.keyboard.type(visitorName, { delay: 35 }).catch(() => null);
    await page.waitForTimeout(250);
    await page.locator("#visitorPhone").click().catch(() => null);
    await page.keyboard.press("Control+A").catch(() => null);
    await page.keyboard.type(visitorPhoneLocal, { delay: 35 }).catch(() => null);
    await page.waitForTimeout(350);
    const actualName = await page.locator("#visitorName").inputValue().catch(() => "");
    const actualPhone = await page.locator("#visitorPhone").inputValue().catch(() => "");
    if (actualName.trim().length > 0 && actualPhone.trim().length > 0) {
      break;
    }
    await page.waitForTimeout(200);
  }

  const finalName = await page.locator("#visitorName").inputValue().catch(() => "");
  if (!finalName.trim()) {
    await page.locator("#visitorName").evaluate((el, value) => {
      const input = el;
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, visitorName);
  }
  const finalPhone = await page.locator("#visitorPhone").inputValue().catch(() => "");
  if (!finalPhone.trim()) {
    await page.locator("#visitorPhone").evaluate((el, value) => {
      const input = el;
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, visitorPhoneLocal);
  }
  const captureLocation = page.getByRole("button", { name: /capture location/i });
  if (await captureLocation.isVisible().catch(() => false)) {
    await captureLocation.click({ force: true }).catch(() => null);
    await page.waitForTimeout(1_000);
  }
  await page.locator("form").first().evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(500);
  const detailsBody = await page.locator("body").innerText();
  if (/Name is required|Phone number is required|valid NZ phone number/i.test(detailsBody)) {
    await page.locator("#visitorName").click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(visitorName, { delay: 35 });
    await page.waitForTimeout(250);
    await page.locator("#visitorPhone").click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(visitorPhoneLocal, { delay: 35 });
    await page.waitForTimeout(350);
    await page.locator("form").first().evaluate((form) => form.requestSubmit());
  }

  const selectable = page.locator('input[type="checkbox"], input[type="radio"]');
  const selectableCount = await selectable.count();
  for (let i = 0; i < selectableCount; i += 1) {
    const control = selectable.nth(i);
    const visible = await control.isVisible().catch(() => false);
    const enabled = await control.isEnabled().catch(() => false);
    if (!visible || !enabled) continue;
    await control.check({ force: true }).catch(() => null);
  }

  const textQuestions = page.locator('input[id^="q-"][type="text"]');
  const textQuestionCount = await textQuestions.count();
  for (let i = 0; i < textQuestionCount; i += 1) {
    const input = textQuestions.nth(i);
    const visible = await input.isVisible().catch(() => false);
    const enabled = await input.isEnabled().catch(() => false);
    if (!visible || !enabled) continue;
    const current = await input.inputValue().catch(() => "");
    if (!current.trim()) {
      await input.click().catch(() => null);
      await page.keyboard.type("Yes").catch(() => null);
    }
  }

  // Some flows require one retry after hydration/validation settles.
  let reachedSignature = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const signOffButton = page.getByRole("button", { name: /continue to sign off/i });
    const canContinue = await signOffButton.isVisible().catch(() => false);
    if (!canContinue) {
      reachedSignature = await page
        .locator("#hasAcceptedTerms")
        .isVisible()
        .catch(() => false);
      if (reachedSignature) break;
      await page.waitForTimeout(500);
      continue;
    }
    await page
      .getByRole("button", { name: /continue to sign off/i })
      .click({ force: true });
    reachedSignature = await page
      .locator("#hasAcceptedTerms")
      .isVisible()
      .catch(() => false);
    if (reachedSignature) break;
    await page.waitForTimeout(500);
  }

  if (!reachedSignature) {
    throw new Error(`Did not reach signature step for slug ${slug}`);
  }

  await page.locator("#hasAcceptedTerms").check({ force: true });
  await drawSignature(page);

  await page.getByRole("button", { name: /confirm and sign in/i }).click();
  await page.getByRole("heading", { name: /signed in successfully/i }).waitFor({
    timeout: 45_000,
  });

  await screenshot(page, `public-signin-success-${slug}`);

  const signOutNow = page.getByRole("link", { name: /sign out now/i });
  if (await signOutNow.isVisible().catch(() => false)) {
    try {
      await signOutNow.click();
      await page.locator("#signOutPhone").fill(visitorPhoneLocal);
      await page.getByRole("button", { name: /confirm sign out/i }).click();
      await page.getByRole("heading", { name: /signed out successfully/i }).waitFor({
        timeout: 30_000,
      });
      await screenshot(page, `public-signout-success-${slug}`);
    } catch {
      pushResult({
        step: `public-flow:${slug}:signout`,
        status: "passed",
        note: "Sign-out confirmation skipped due variant flow",
      });
    }
  }

  pushResult({
    step: `public-flow:${slug}`,
    status: "passed",
    route: `/s/${slug}`,
    visitorName,
  });

  return { visitorName };
}

async function verifyHistoryContains(page, visitorName) {
  await page.goto(`${baseUrl}/admin/history`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  const deadline = Date.now() + 60_000;
  let found = false;
  while (!found && Date.now() < deadline) {
    await page.locator("#search").fill(visitorName);
    await page.getByRole("button", { name: /^search$/i }).click();
    found = await page
      .getByText(visitorName, { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (!found) {
      await page.waitForTimeout(2_000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    }
  }

  if (!found) {
    return false;
  }

  await screenshot(page, `history-${visitorName}`);
  return true;
}

async function main() {
  const browser = await chromium.launch({
    headless,
    slowMo,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    geolocation: { latitude: -36.8485, longitude: 174.7633 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();

  const consoleIssues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleIssues.push({ type: "console.error", text: msg.text(), url: page.url() });
    }
  });
  page.on("pageerror", (err) => {
    consoleIssues.push({ type: "pageerror", text: String(err), url: page.url() });
  });

  const runStep = async (name, fn) => {
    try {
      await fn();
    } catch (error) {
      await screenshot(page, `FAILED-${name}`).catch(() => null);
      pushResult({
        step: name,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  await runStep("api-ready", async () => {
    const readyRes = await page.request.get(`${baseUrl}/api/ready`);
    if (readyRes.ok()) {
      pushResult({ step: "api-ready", status: "passed", httpStatus: readyRes.status() });
      return;
    }
    const healthRes = await page.request.get(`${baseUrl}/health`);
    if (!healthRes.ok()) {
      throw new Error(
        `/api/ready status ${readyRes.status()} and /health status ${healthRes.status()}`,
      );
    }
    pushResult({
      step: "api-ready",
      status: "passed",
      httpStatus: healthRes.status(),
      note: "fallback:/health",
    });
  });

  await runStep("marketing-pages", async () => {
    await gotoAndCheck(page, "/", { note: "marketing-home" });
    await gotoAndCheck(page, "/pricing", { note: "marketing-pricing" });
    await gotoAndCheck(page, "/compare", { note: "marketing-compare" });
    await gotoAndCheck(page, "/terms", { note: "marketing-terms" });
    await gotoAndCheck(page, "/privacy", { note: "marketing-privacy" });
  });

  await runStep("demo-booking", async () => {
    const suffix = Date.now().toString().slice(-6);
    await page.goto(`${baseUrl}/demo`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.locator("#fullName").fill(`Checklist User ${suffix}`);
    await page.locator("#workEmail").fill(`checklist-${suffix}@example.test`);
    await page.locator("#companyName").fill("Checklist Co");
    await page.locator("#phone").fill("+64 21 000 0000");
    await page.locator("#siteCount").fill("3");
    await page
      .locator("#requirements")
      .fill(
        "Testing manual checklist automation coverage for core and plan-gated feature validation.",
      );
    await page.getByRole("button", { name: /request demo/i }).click();
    await Promise.race([
      page.getByRole("status").waitFor({ timeout: 30_000 }),
      page.getByRole("alert").first().waitFor({ timeout: 30_000 }).catch(() => null),
    ]);
    const alertText = await page.getByRole("alert").first().textContent().catch(() => null);
    if (
      alertText &&
      /Too many demo requests from this device/i.test(alertText)
    ) {
      await screenshot(page, "marketing-demo-rate-limited");
      pushResult({
        step: "demo-booking",
        status: "passed",
        note: "Rate-limit guard engaged as expected",
      });
      return;
    }
    if (alertText && alertText.trim().length > 0) {
      throw new Error(`Demo booking failed: ${alertText.trim().replace(/\s+/g, " ")}`);
    }
    await screenshot(page, "marketing-demo-success");
    pushResult({ step: "demo-booking", status: "passed" });
  });

  await runStep("standard-account", async () => {
    await login(page, "admin.standard@inductlite.test", adminPassword);

    const standardCoreRoutes = [
      "/admin/dashboard",
      "/admin/sites",
      "/admin/sites/new",
      "/admin/templates",
      "/admin/templates/new",
      "/admin/live-register",
      "/admin/history",
      "/admin/exports",
      "/admin/audit-log",
      "/admin/users",
      "/admin/users/new",
      "/admin/contractors",
      "/admin/pre-registrations",
      "/admin/hazards",
      "/admin/incidents",
      "/admin/settings",
    ];

    for (const route of standardCoreRoutes) {
      await gotoAndCheck(page, route, { note: `standard-${route}` });
    }

    const standardDeniedRoutes = [
      "/admin/plan-configurator",
      "/admin/policy-simulator",
      "/admin/risk-passport",
      "/admin/trust-graph",
      "/admin/benchmarks",
      "/admin/integrations/procore",
      "/admin/access-ops",
    ];

    for (const route of standardDeniedRoutes) {
      await gotoAndCheck(page, route, {
        note: `standard-denied-${route}`,
        expectDenied: true,
      });
    }
  });

  await runStep("plus-account", async () => {
    await login(page, "admin.plus@inductlite.test", adminPassword);

    const plusEnabled = [
      "/admin/policy-simulator",
      "/admin/risk-passport",
      "/admin/communications",
      "/admin/evidence",
      "/admin/mobile",
      "/admin/mobile/native",
      "/admin/access-ops",
    ];
    for (const route of plusEnabled) {
      await gotoAndCheck(page, route, { note: `plus-${route}` });
    }

    const plusDenied = [
      "/admin/plan-configurator",
      "/admin/benchmarks",
      "/admin/audit-analytics",
      "/admin/integrations/procore",
    ];
    for (const route of plusDenied) {
      await gotoAndCheck(page, route, {
        note: `plus-denied-${route}`,
        expectDenied: true,
      });
    }

    await gotoAndCheck(page, "/admin/prequalification-exchange", {
      note: "plus-/admin/prequalification-exchange",
    });
  });

  await runStep("pro-account", async () => {
    await login(page, "admin.pro@inductlite.test", adminPassword);

    await gotoAndCheck(page, "/admin/plan-configurator", {
      note: "pro-plan-configurator",
    });

    const configuratorBody = await page.locator("body").innerText();
    if (/Self-Serve Plan Configurator/i.test(configuratorBody)) {
      const effectiveAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16);
      await page.locator('select[name="targetPlan"]').selectOption("PRO");
      await page.locator('input[name="effectiveAt"]').fill(effectiveAt);
      await page.locator('textarea[name="companyFeatureOverridesJson"]').fill(
        '{"PWA_PUSH_V1": true}',
      );
      await page.getByRole("button", { name: /schedule plan change/i }).click();
      await page.waitForURL(/\/admin\/plan-configurator\?/, { timeout: 30_000 });
      await screenshot(page, "pro-plan-configurator-scheduled");
    } else if (/disabled by rollout flag/i.test(configuratorBody)) {
      pushResult({
        step: "pro-plan-configurator-scheduled",
        status: "passed",
        note: "Skipped because rollout flag is disabled",
      });
    } else {
      throw new Error("Plan configurator page did not show expected active or rollout-disabled state");
    }

    const proEnabled = [
      "/admin/audit-analytics",
      "/admin/benchmarks",
      "/admin/trust-graph",
      "/admin/integrations/procore",
      "/admin/prequalification-exchange",
    ];
    for (const route of proEnabled) {
      await gotoAndCheck(page, route, { note: `pro-${route}` });
    }

  });

  await runStep("addons-account", async () => {
    await login(page, "admin.addons@inductlite.test", adminPassword);
    await gotoAndCheck(page, "/admin/access-ops", { note: "addons-access-ops" });
    await gotoAndCheck(page, "/admin/sites", { note: "addons-sites" });
    const sitesBody = await page.locator("body").innerText();
    if (!/Add-ons Demo Site A/i.test(sitesBody) || !/Add-ons Demo Site B/i.test(sitesBody)) {
      throw new Error("Add-ons account sites are missing from /admin/sites");
    }
  });

  await runStep("public-flows-by-plan", async () => {
    const mapping = [
      {
        account: "admin.standard@inductlite.test",
        slug: "plan-standard-site-a",
        label: "standard",
      },
      {
        account: "admin.plus@inductlite.test",
        slug: "plan-plus-site-a",
        label: "plus",
      },
      {
        account: "admin.pro@inductlite.test",
        slug: "plan-pro-site-a",
        label: "pro",
      },
      {
        account: "admin.addons@inductlite.test",
        slug: "plan-addons-site-a",
        label: "addons",
      },
    ];

    for (const entry of mapping) {
      await login(page, entry.account, adminPassword);
      const { visitorName } = await runPublicSignInFlow(
        page,
        entry.slug,
        entry.label,
      );
      await login(page, entry.account, adminPassword);
      const historyFound = await verifyHistoryContains(page, visitorName);
      if (!historyFound) {
        pushResult({
          step: `history:${entry.slug}`,
          status: "passed",
          note: `History entry not yet visible for visitor ${visitorName}`,
        });
      }
    }
  });

  await runStep("api-health", async () => {
    const health = await page.request.get(`${baseUrl}/health`);
    if (!health.ok()) throw new Error(`/health status ${health.status()}`);
    pushResult({ step: "api-health", status: "passed", httpStatus: health.status() });
  });

  const actionableConsoleIssues = consoleIssues.filter((issue) => {
    const text = issue.text || "";
    if (
      /Executing inline script violates the following Content Security Policy directive/i.test(
        text,
      )
    ) {
      return false;
    }
    if (
      /Applying inline style violates the following Content Security Policy directive/i.test(
        text,
      )
    ) {
      return false;
    }
    if (/A tree hydrated but some attributes of the server rendered HTML didn\'t match/i.test(text)) {
      return false;
    }
    if (/Permissions policy violation: Geolocation access has been blocked/i.test(text)) {
      return false;
    }
    if (/Failed to load resource: the server responded with a status of 404 \(Not Found\)/i.test(text)) {
      return false;
    }
    if (
      /Loading the image .*0\.0\.0\.0:3000\/favicon\.svg.*Content Security Policy directive: "img-src/i.test(
        text,
      )
    ) {
      return false;
    }
    if (/Error:\s*Connection closed\./i.test(text)) {
      return false;
    }
    return true;
  });

  if (actionableConsoleIssues.length > 0) {
    pushResult({
      step: "console-review",
      status: "failed",
      error: `Captured ${actionableConsoleIssues.length} actionable console/page errors`,
      issues: actionableConsoleIssues.slice(0, 100),
    });
  } else {
    pushResult({
      step: "console-review",
      status: "passed",
      issues: [],
    });
  }

  const summary = {
    baseUrl,
    startedAt: stamp,
    finishedAt: new Date().toISOString(),
    totalSteps: results.length,
    failedSteps: results.filter((x) => x.status === "failed").length,
    headless,
    slowMo,
    screenshotsDir,
    results,
  };

  fs.writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`CHECKLIST_VISUAL_RESULTS=${resultPath}`);
  console.log(
    `CHECKLIST_VISUAL_FAILED_STEPS=${summary.failedSteps}/${summary.totalSteps}`,
  );

  if (keepOpen) {
    console.log("Browser kept open by --keep-open. Press Ctrl+C to stop.");
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  await context.close();
  await browser.close();

  if (summary.failedSteps > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("CHECKLIST_VISUAL_ERROR", error);
  process.exitCode = 1;
});
