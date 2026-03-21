import { spawn } from "node:child_process";

const command = "playwright";
const args = [
  "test",
  "e2e/performance-budget.spec.ts",
  "--project=chromium",
  "--workers=1",
  "--reporter=line",
];

const env = {
  ...process.env,
  E2E_SERVER_MODE: process.env.E2E_SERVER_MODE ?? "prod",
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE ?? "0",
};

console.log(
  `Running perf-budget lane with E2E_SERVER_MODE=${env.E2E_SERVER_MODE}`,
);

const child = spawn(command, args, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
