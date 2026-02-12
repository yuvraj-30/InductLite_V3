#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const candidates = [
  path.resolve(process.cwd(), ".next", "standalone", "server.js"),
  path.resolve(process.cwd(), ".next", "standalone", "apps", "web", "server.js"),
];

const serverPath = candidates.find((candidate) => fs.existsSync(candidate));

if (!serverPath) {
  console.error(
    [
      "Standalone server entrypoint not found.",
      "Checked:",
      ...candidates.map((candidate) => `- ${candidate}`),
      "Run `npm run build` before starting.",
    ].join("\n"),
  );
  process.exit(1);
}

if (process.argv.includes("--check")) {
  console.log(serverPath);
  process.exit(0);
}

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
