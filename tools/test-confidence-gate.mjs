#!/usr/bin/env node
import { spawn } from "node:child_process";

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const child = spawn(
      isWindows ? "cmd.exe" : command,
      isWindows ? ["/d", "/s", "/c", command, ...args] : args,
      {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
    },
    );

    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function runStep(step) {
  const startedAt = Date.now();
  console.log(`\n[confidence] START ${step.name}`);
  console.log(`[confidence] CMD   ${step.command} ${step.args.join(" ")}`);
  const result = await runCommand(step.command, step.args);
  const durationMs = Date.now() - startedAt;

  if (!result || result.code !== 0) {
    throw new Error(
      `${step.name} failed (exitCode=${String(result?.code)} signal=${String(result?.signal)} durationMs=${durationMs})`,
    );
  }

  console.log(`[confidence] PASS  ${step.name} (${durationMs}ms)`);
}

function buildSteps(options) {
  const steps = [
    { name: "Guardrails lint", command: "npm", args: ["run", "guardrails-lint"] },
    { name: "Guardrails tests", command: "npm", args: ["run", "guardrails-tests"] },
    { name: "Policy check", command: "npm", args: ["run", "policy-check"] },
    { name: "Lint", command: "npm", args: ["run", "lint"] },
    { name: "Typecheck", command: "npm", args: ["run", "typecheck"] },
    { name: "Unit test gap matrix", command: "npm", args: ["run", "test:gap-matrix"] },
    { name: "Playwright route gap matrix", command: "npm", args: ["run", "test:e2e:gap-matrix"] },
    { name: "Unit tests", command: "npm", args: ["run", "test"] },
    { name: "Integration tests", command: "npm", args: ["run", "test:integration"] },
  ];

  if (!options.skipE2E) {
    if (options.full) {
      steps.push({
        name: "Playwright E2E full matrix (all configured projects, non-visual)",
        command: "npm",
        args: [
          "run",
          "-w",
          "apps/web",
          "test:e2e",
          "--",
          "--workers=1",
          "--reporter=line",
          "--grep-invert",
          "Visual Regression|VRT -",
        ],
      });
    } else {
      steps.push({
        name: "Playwright E2E stable (chromium, non-visual)",
        command: "npm",
        args: [
          "run",
          "-w",
          "apps/web",
          "test:e2e",
          "--",
          "--project=chromium",
          "--workers=1",
          "--reporter=line",
          "--grep-invert",
          "Visual Regression|VRT -",
        ],
      });
    }

    steps.push({
      name: "Playwright UI/UX performance budget lane (chromium)",
      command: "npm",
      args: ["run", "test:e2e:perf-budget"],
    });
    steps.push({
      name: "UI/UX performance budget report",
      command: "npm",
      args: ["run", "report:ux-perf-budget"],
    });

    if (options.withVisual) {
      steps.push({
        name: "Playwright visual regression lane (chromium)",
        command: "npm",
        args: ["run", "-w", "apps/web", "test:visual"],
      });
    }
  }

  return steps;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage:");
    console.log("  node tools/test-confidence-gate.mjs");
    console.log("    Runs confidence gate with guardrails + lint/typecheck + unit/integration + chromium e2e");
    console.log("  node tools/test-confidence-gate.mjs --full");
    console.log("    Runs confidence gate with full Playwright suite across all configured projects (non-visual)");
    console.log("  node tools/test-confidence-gate.mjs --skip-e2e");
    console.log("    Runs confidence gate without Playwright execution");
    console.log("  node tools/test-confidence-gate.mjs --with-visual");
    console.log("    Adds the visual regression lane (chromium) after functional e2e");
    return;
  }

  const options = {
    full: args.includes("--full"),
    skipE2E: args.includes("--skip-e2e"),
    withVisual: args.includes("--with-visual"),
  };

  const startedAt = Date.now();
  console.log("[confidence] Gate started");
  console.log(`[confidence] Mode: ${options.full ? "full" : "quick"}${options.skipE2E ? " (e2e skipped)" : ""}`);

  const steps = buildSteps(options);
  for (const step of steps) {
    await runStep(step);
  }

  const durationMs = Date.now() - startedAt;
  console.log(`\n[confidence] Gate PASS (${durationMs}ms)`);
}

main().catch((error) => {
  console.error("\n[confidence] Gate FAILED");
  console.error(String(error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
