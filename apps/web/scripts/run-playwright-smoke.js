const { spawn } = require("node:child_process");
const playwrightCliEntrypoint = require.resolve("@playwright/test/cli");

const args = [
  "test",
  "e2e/public-signin.spec.ts",
  "e2e/admin-auth.spec.ts",
  "e2e/csrf-security.spec.ts",
  "e2e/escalation-approval.spec.ts",
  "e2e/admin-settings.spec.ts",
  "--project=chromium",
  "--workers=1",
];

const env = {
  ...process.env,
  E2E_SERVER_MODE: process.env.E2E_SERVER_MODE ?? "prod",
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE ?? "0",
};

console.log(`Running smoke lane with E2E_SERVER_MODE=${env.E2E_SERVER_MODE}`);

const child = spawn(process.execPath, [playwrightCliEntrypoint, ...args], {
  stdio: "inherit",
  env,
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
