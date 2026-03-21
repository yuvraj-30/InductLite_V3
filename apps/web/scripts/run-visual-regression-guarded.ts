import { spawn } from "node:child_process";
import { enforceBudgetPath } from "../src/lib/cost/budget-service";

const checkOnly = process.argv.includes("--check-only");

async function main() {
  const budgetDecision = await enforceBudgetPath("visual-regression.run");
  if (!budgetDecision.allowed) {
    console.error(
      `visual-regression.run denied by ${budgetDecision.controlId ?? "COST-008"}: ${budgetDecision.message}`,
    );
    process.exit(1);
  }

  if (checkOnly) {
    console.log("visual-regression.run allowed");
    return;
  }

  const command = "playwright";
  const args = [
    "test",
    "e2e/visual-regression.spec.ts",
    "--workers=1",
    "--reporter=line",
  ];
  const env = {
    ...process.env,
    E2E_SERVER_MODE: process.env.E2E_SERVER_MODE ?? "prod",
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE ?? "0",
  };

  console.log(
    `Running visual regression lane with E2E_SERVER_MODE=${env.E2E_SERVER_MODE}`,
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
