import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit, devices } from 'playwright';

const root = process.cwd();
const appDir = path.join(root, 'apps', 'web');
const outDir = path.join(root, 'apps', 'web', 'manual-evidence');
const logPath = path.join(outDir, 'manual-dev.log');
const secret = 'manual-e2e-secret';
const baseUrl = 'http://localhost:3000';

fs.mkdirSync(outDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? "inherit",
      shell: options.shell ?? false,
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function fetchJson(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return { ok: res.ok, status: res.status, body, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForRuntime(maxMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetchJson(`${baseUrl}/api/test/runtime`, {
        method: 'GET',
        headers: { 'x-test-secret': secret },
      }, 5000);
      if (res.ok && res.body?.allowTestRunner) {
        return;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error('Timed out waiting for /api/test/runtime with allowTestRunner=true');
}

async function clearRateLimit() {
  await fetchJson(`${baseUrl}/api/test/clear-rate-limit`, {
    method: 'POST',
    headers: { 'x-test-secret': secret },
  }, 10000);
}

async function seedSite(opts) {
  const res = await fetchJson(`${baseUrl}/api/test/seed-public-site`, {
    method: 'POST',
    headers: {
      'x-test-secret': secret,
      'content-type': 'application/json',
    },
    body: JSON.stringify(opts),
  }, 30000);
  if (!res.ok || !res.body?.success || !res.body?.slug) {
    throw new Error(`seed-public-site failed: status=${res.status} body=${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function deleteSite(slug) {
  await fetchJson(`${baseUrl}/api/test/seed-public-site?slug=${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: { 'x-test-secret': secret },
  }, 15000);
}

async function createAdminUser({ email, password, companySlug }) {
  const res = await fetchJson(`${baseUrl}/api/test/create-user`, {
    method: 'POST',
    headers: {
      'x-test-secret': secret,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      role: 'ADMIN',
      companySlug,
    }),
  }, 30000);

  if (!res.ok) {
    throw new Error(`create-user failed: status=${res.status} body=${JSON.stringify(res.body)}`);
  }
}

async function drawSignature(page, selector = '#signature-canvas, canvas.sigCanvas, canvas') {
  const canvas = page.locator(selector).first();
  await canvas.waitFor({ state: 'visible', timeout: 15000 });
  for (let attempt = 0; attempt < 4; attempt++) {
    const box = await canvas.boundingBox();
    if (!box) {
      await page.waitForTimeout(250);
      continue;
    }
    const startX = box.x + Math.max(8, box.width * 0.2);
    const startY = box.y + Math.max(8, box.height * 0.3);
    const endX = box.x + Math.max(16, box.width * 0.8);
    const endY = box.y + Math.max(16, box.height * 0.7);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.mouse.up();
    return;
  }
  throw new Error('Unable to draw signature: canvas bounding box unavailable');
}

async function fillVisibleChecksAndRadios(page) {
  const inputs = await page.locator('input[type="checkbox"], input[type="radio"]').all();
  for (const input of inputs) {
    const isVisible = await input.isVisible().catch(() => false);
    const isEnabled = await input.isEnabled().catch(() => false);
    if (!isVisible || !isEnabled) continue;
    await input.check({ force: true }).catch(() => null);
  }
}

async function runKioskFlow({ browserType, contextOptions, slug, label }) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext(contextOptions ?? {});
  const page = await context.newPage();

  const result = { label, pass: false, durationMs: null, details: '' };

  try {
    await clearRateLimit();
    await page.goto(`${baseUrl}/s/${slug}/kiosk`, { waitUntil: 'domcontentloaded' });
    await page.locator('#visitorName').waitFor({ state: 'visible', timeout: 15000 });

    const visitorName = `Manual ${label} User`;
    const visitorPhone = '+64211111111';
    await page.locator('#visitorName').fill(visitorName);
    await page.locator('#visitorPhone').fill(visitorPhone);

    const visitorType = page.locator('#visitorType');
    if (await visitorType.count()) {
      await visitorType.selectOption('CONTRACTOR').catch(() => null);
    }

    const detailsSubmit = page.locator('button[type="submit"]').first();
    const inductionHeading = page.getByRole('heading', { level: 2, name: /site induction/i });
    let reachedInduction = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await detailsSubmit.click({ force: true });
      if (await inductionHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        reachedInduction = true;
        break;
      }
      // Hydration jitter can clear inputs on smaller/mobile viewports.
      await page.locator('#visitorName').fill(visitorName).catch(() => null);
      await page.locator('#visitorPhone').fill(visitorPhone).catch(() => null);
      await page.waitForTimeout(300 * attempt);
    }
    if (!reachedInduction) {
      throw new Error('Did not reach induction step from kiosk details');
    }

    await fillVisibleChecksAndRadios(page);

    const textInputs = page.locator('input[type="text"]');
    const textCount = await textInputs.count();
    for (let i = 0; i < textCount; i++) {
      const input = textInputs.nth(i);
      if (await input.isVisible().catch(() => false)) {
        await input.fill('None').catch(() => null);
      }
    }

    await page.getByRole('button', { name: /continue to sign off|continue/i }).first().click({ force: true });
    await page.getByRole('heading', { level: 2, name: /sign off/i }).waitFor({ timeout: 20000 });

    await drawSignature(page);

    const terms = page.locator('#hasAcceptedTerms');
    if (await terms.count()) {
      await terms.check({ force: true }).catch(() => null);
    } else {
      await page.getByLabel(/terms|conditions|privacy/i).first().check({ force: true }).catch(() => null);
    }

    const confirmBtn = page.getByRole('button', { name: /confirm\s+(?:and|&)\s+sign in/i }).first();
    const submitStart = Date.now();
    await confirmBtn.click({ force: true });

    const sigAlert = page.getByRole('alert').filter({ hasText: /please provide a signature/i }).first();
    if (await sigAlert.isVisible().catch(() => false)) {
      await drawSignature(page);
      await confirmBtn.click({ force: true });
    }

    const successHeading = page.getByRole('heading', { name: /signed in successfully/i }).first();
    await successHeading.waitFor({ state: 'visible', timeout: 25000 });
    await successHeading.waitFor({ state: 'hidden', timeout: 25000 });
    await page.locator('#visitorName').first().waitFor({ state: 'visible', timeout: 15000 });

    const elapsed = Date.now() - submitStart;
    result.durationMs = elapsed;
    result.pass = elapsed >= 9000;
    result.details = `success-screen-cycle-ms=${elapsed}`;

    await page.screenshot({ path: path.join(outDir, `kiosk-${label}.png`), fullPage: true });
  } catch (error) {
    result.pass = false;
    result.details = `error=${error instanceof Error ? error.message : String(error)}`;
    await page.screenshot({ path: path.join(outDir, `kiosk-${label}-error.png`), fullPage: true }).catch(() => null);
  } finally {
    await context.close();
    await browser.close();
  }

  return result;
}

function uniqueVisitorName(prefix) {
  return `${prefix} ${Date.now().toString().slice(-6)}`;
}

async function openPublicSite(page, slug) {
  for (let i = 0; i < 6; i++) {
    await clearRateLimit();
    await page.goto(`${baseUrl}/s/${slug}`, { waitUntil: 'domcontentloaded' });
    if (await page.getByLabel(/full name|name/i).first().isVisible().catch(() => false)) {
      return true;
    }
    await page.waitForTimeout(700);
  }
  return false;
}

async function submitEscalatedSignIn({ page, slug, visitorName, redFlagQuestionId }) {
  const loaded = await openPublicSite(page, slug);
  if (!loaded) {
    throw new Error('public site did not load for escalation flow');
  }

  const phone = `+6421${Math.floor(100000 + Math.random() * 900000)}`;
  const nameField = page.getByLabel(/full name|name/i).first();
  const phoneField = page.getByLabel(/phone number|phone/i).first();
  await nameField.fill(visitorName);
  await phoneField.fill(phone);

  const visitorType = page.locator('#visitorType');
  if (await visitorType.count()) {
    await visitorType.selectOption('CONTRACTOR').catch(() => null);
  }

  const continueButton = page.getByRole('button', { name: /continue to induction|sign in|continue/i }).first();
  const inductionHeading = page.getByRole('heading', { level: 2, name: /site induction/i });
  let reachedInduction = false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await continueButton.click({ force: true });
    if (await inductionHeading.isVisible({ timeout: 7000 }).catch(() => false)) {
      reachedInduction = true;
      break;
    }
    await nameField.fill(visitorName).catch(() => null);
    await phoneField.fill(phone).catch(() => null);
    await page.waitForTimeout(350 * attempt);
  }
  if (!reachedInduction) {
    throw new Error('Did not reach induction step in escalation public flow');
  }

  await fillVisibleChecksAndRadios(page);
  await page.locator(`input[type="radio"][name="${redFlagQuestionId}"][value="yes"]`).check({ force: true });
  await page.getByRole('button', { name: /continue to sign off|continue/i }).first().click({ force: true });

  await page.getByRole('heading', { level: 2, name: /sign off/i }).waitFor({ timeout: 25000 });
  await drawSignature(page);

  const terms = page.locator('#hasAcceptedTerms');
  if (await terms.count()) {
    await terms.check({ force: true });
  }

  const confirmBtn = page.getByRole('button', { name: /confirm\s+(?:and|&)\s+sign in/i }).first();
  await confirmBtn.click({ force: true });

  const sigAlert = page.getByRole('alert').filter({ hasText: /please provide a signature/i }).first();
  if (await sigAlert.isVisible().catch(() => false)) {
    await drawSignature(page);
    await confirmBtn.click({ force: true });
  }

  await page
    .getByRole('alert')
    .filter({ hasText: /supervisor approval required|critical safety response detected|supervisor review required/i })
    .first()
    .waitFor({ timeout: 30000 });
}

async function loginAdmin(page, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click({ force: true });
  await page.waitForURL(/\/admin/, { timeout: 30000 });
}

async function resolveEscalation({ adminPage, visitorName, decision }) {
  const actionName = decision === 'approve' ? /approve and sign in/i : /deny entry/i;
  const finalStatus = decision === 'approve' ? 'APPROVED' : 'DENIED';

  for (let attempt = 0; attempt < 12; attempt++) {
    await adminPage.goto(`${baseUrl}/admin/escalations`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await adminPage.getByRole('heading', { name: /sign-in escalations/i }).waitFor({ timeout: 15000 });

    const resolved = await adminPage
      .locator('tr')
      .filter({ hasText: visitorName })
      .filter({ hasText: finalStatus })
      .count();
    if (resolved > 0) return true;

    const pendingHeading = adminPage.getByRole('heading', { level: 3, name: visitorName }).first();
    const hasPending = await pendingHeading.isVisible().catch(() => false);
    if (!hasPending) {
      await adminPage.waitForTimeout(800);
      continue;
    }

    const card = pendingHeading.locator('xpath=ancestor::div[contains(@class,"border-amber-200")][1]');
    await card.getByRole('button', { name: actionName }).first().click({ force: true });
    await adminPage.waitForTimeout(1000);
  }
  return false;
}

async function runEscalationFlow({ browserType, label, slug, redFlagQuestionId, adminEmail, adminPassword }) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const publicPage = await context.newPage();
  const adminPage = await context.newPage();

  const result = {
    label,
    approvePass: false,
    denyPass: false,
    details: '',
  };

  try {
    await loginAdmin(adminPage, adminEmail, adminPassword);

    const approveVisitor = uniqueVisitorName(`Approve ${label}`);
    await submitEscalatedSignIn({
      page: publicPage,
      slug,
      visitorName: approveVisitor,
      redFlagQuestionId,
    });

    const approved = await resolveEscalation({
      adminPage,
      visitorName: approveVisitor,
      decision: 'approve',
    });

    if (!approved) {
      throw new Error(`Could not approve escalation for ${approveVisitor}`);
    }

    await publicPage.bringToFront();
    await publicPage.getByRole('button', { name: /confirm\s+(?:and|&)\s+sign in/i }).first().click({ force: true });

    const successVisible = await Promise.race([
      publicPage.getByRole('heading', { level: 2, name: /signed in successfully/i }).first().waitFor({ timeout: 30000 }).then(() => true),
      publicPage.locator('a[href*="/sign-out"]').first().waitFor({ timeout: 30000 }).then(() => true),
    ]).catch(() => false);

    result.approvePass = Boolean(successVisible);
    await publicPage.screenshot({ path: path.join(outDir, `escalation-approve-${label}.png`), fullPage: true });

    const denyVisitor = uniqueVisitorName(`Deny ${label}`);
    await submitEscalatedSignIn({
      page: publicPage,
      slug,
      visitorName: denyVisitor,
      redFlagQuestionId,
    });

    const deniedResolved = await resolveEscalation({
      adminPage,
      visitorName: denyVisitor,
      decision: 'deny',
    });

    await publicPage.bringToFront();
    const confirmBtn = publicPage.getByRole('button', { name: /confirm\s+(?:and|&)\s+sign in/i }).first();
    let latestAlertText = '';
    for (let i = 0; i < 3; i++) {
      await confirmBtn.click({ force: true });
      await publicPage.waitForTimeout(800);
      const txt = await publicPage
        .getByRole('alert')
        .first()
        .textContent()
        .catch(() => '');
      latestAlertText = (txt ?? '').trim();
      if (latestAlertText.length > 0) {
        break;
      }
    }

    const deniedAlert = publicPage
      .getByRole('alert')
      .filter({ hasText: /supervisor denied site entry|supervisor approval required/i })
      .first();

    const deniedVisible = await deniedAlert.isVisible({ timeout: 30000 }).catch(() => false);
    const stillOnSignOff = await publicPage.getByRole('heading', { level: 2, name: /sign off/i }).first().isVisible().catch(() => false);

    result.denyPass = Boolean(deniedVisible && stillOnSignOff);
    await publicPage.screenshot({ path: path.join(outDir, `escalation-deny-${label}.png`), fullPage: true });

    result.details = `approve=${result.approvePass} deny=${result.denyPass} deniedResolved=${deniedResolved} denyAlert=\"${latestAlertText}\"`;
  } catch (error) {
    result.details = `error=${error instanceof Error ? error.message : String(error)}`;
    await publicPage.screenshot({ path: path.join(outDir, `escalation-${label}-error.png`), fullPage: true }).catch(() => null);
  } finally {
    await context.close();
    await browser.close();
  }

  return result;
}

async function runManualFlow() {
  const runSummary = {
    kioskDesktop: null,
    kioskMobile: null,
    escalationChromium: null,
    escalationWebkit: null,
    seeded: {},
  };

  const nextBinCandidates = [
    path.join(root, 'apps', 'web', 'node_modules', 'next', 'dist', 'bin', 'next'),
    path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
  ];
  const nextBin = nextBinCandidates.find((candidate) => fs.existsSync(candidate));
  if (!nextBin) {
    throw new Error('Could not find Next.js bin');
  }

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const server = spawn(process.execPath, [nextBin, 'dev', '-p', '3000'], {
    cwd: appDir,
    env: {
      ...process.env,
      ALLOW_TEST_RUNNER: '1',
      TRUST_PROXY: '1',
      TEST_RUNNER_SECRET_KEY: secret,
      SESSION_COOKIE_SECURE: '0',
      PORT: '3000',
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(logStream);
  server.stderr.pipe(logStream);

  let kioskSlug = null;
  let escalationSlug = null;

  try {
    await waitForRuntime();
    await clearRateLimit();

    const kioskSeed = await seedSite({ slugPrefix: 'manual-kiosk' });
    kioskSlug = kioskSeed.slug;

    const companySlug = `manual-flow-company-${Date.now().toString().slice(-6)}`;
    const escalationSeed = await seedSite({
      slugPrefix: 'manual-escalation',
      includeRedFlagQuestion: true,
      companySlug,
    });
    escalationSlug = escalationSeed.slug;

    const adminEmail = `manual-admin-${Date.now().toString().slice(-6)}@example.test`;
    const adminPassword = 'Admin123!';
    await createAdminUser({ email: adminEmail, password: adminPassword, companySlug });

    runSummary.seeded = {
      kioskSlug,
      escalationSlug,
      redFlagQuestionId: escalationSeed.redFlagQuestionId,
      companySlug,
      adminEmail,
    };

    runSummary.kioskDesktop = await runKioskFlow({
      browserType: chromium,
      contextOptions: { viewport: { width: 1366, height: 900 } },
      slug: kioskSlug,
      label: 'desktop-chromium',
    });

    runSummary.kioskMobile = await runKioskFlow({
      browserType: chromium,
      contextOptions: { ...devices['Pixel 5'] },
      slug: kioskSlug,
      label: 'mobile-pixel5',
    });

    if (!escalationSeed.redFlagQuestionId) {
      throw new Error('Escalation seed missing redFlagQuestionId');
    }

    runSummary.escalationChromium = await runEscalationFlow({
      browserType: chromium,
      label: 'chromium',
      slug: escalationSlug,
      redFlagQuestionId: escalationSeed.redFlagQuestionId,
      adminEmail,
      adminPassword,
    });

    runSummary.escalationWebkit = await runEscalationFlow({
      browserType: webkit,
      label: 'webkit',
      slug: escalationSlug,
      redFlagQuestionId: escalationSeed.redFlagQuestionId,
      adminEmail,
      adminPassword,
    });

    console.log('MANUAL_FLOW_SUMMARY_START');
    console.log(JSON.stringify(runSummary, null, 2));
    console.log('MANUAL_FLOW_SUMMARY_END');
  } finally {
    if (kioskSlug) {
      await deleteSite(kioskSlug).catch(() => null);
    }
    if (escalationSlug) {
      await deleteSite(escalationSlug).catch(() => null);
    }

    if (!server.killed) {
      server.kill('SIGTERM');
      await sleep(1200);
      if (!server.killed) {
        server.kill('SIGKILL');
      }
    }

    logStream.end();
  }
}

async function runAllE2E(extraArgs = []) {
  const isWindows = process.platform === "win32";
  const npmArgs = ["run", "-w", "apps/web", "test:e2e"];
  if (extraArgs.length > 0) {
    npmArgs.push("--", ...extraArgs);
  }

  const command = isWindows ? "cmd.exe" : "npm";
  const args = isWindows ? ["/d", "/s", "/c", "npm", ...npmArgs] : npmArgs;

  console.log("FULL_E2E_RUN_START");
  console.log(
    JSON.stringify(
      {
        command: "npm",
        args: npmArgs,
        runner: command,
        runnerArgs: args,
      },
      null,
      2,
    ),
  );

  const startedAt = Date.now();
  const result = await runCommand(command, args, {
    cwd: root,
    env: {
      E2E_QUIET: process.env.E2E_QUIET ?? "1",
      TEST_RUNNER_SECRET_KEY:
        process.env.TEST_RUNNER_SECRET_KEY ?? "e2e-test-runner-secret-3b0f2cbf5de0416ebf958e8d",
      SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE ?? "0",
    },
  });
  const durationMs = Date.now() - startedAt;

  console.log("FULL_E2E_RUN_END");
  console.log(
    JSON.stringify(
      {
        code: result.code,
        signal: result.signal,
        durationMs,
      },
      null,
      2,
    ),
  );

  if (result.code !== 0) {
    throw new Error(
      `Full E2E run failed (exitCode=${String(result.code)} signal=${String(result.signal)})`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const showHelp = args.includes("--help") || args.includes("-h");
  if (showHelp) {
    console.log("Usage:");
    console.log("  node tools/manual-flow-verify.mjs");
    console.log("    Runs manual kiosk/escalation flow verification");
    console.log("  node tools/manual-flow-verify.mjs --all-e2e [-- <playwright-args>]");
    console.log("    Runs full apps/web Playwright E2E suite (305 tests)");
    return;
  }

  const separatorIndex = args.indexOf("--");
  const passthroughArgs =
    separatorIndex >= 0 ? args.slice(separatorIndex + 1) : [];
  const runAll = args.includes("--all-e2e");

  if (runAll) {
    await runAllE2E(passthroughArgs);
    return;
  }

  await runManualFlow();
}

main().catch((error) => {
  console.error("MANUAL_FLOW_ERROR", error);
  process.exitCode = 1;
});
