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

const appRoot = process.cwd();
const standaloneAppRoot = path.dirname(serverPath);

function syncDirIfMissing(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir) || fs.existsSync(targetDir)) {
    return;
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

// In monorepo standalone output, .next/static and public are not always bundled
// beside server.js. Ensure they exist so CSS/JS/public assets are served.
syncDirIfMissing(path.resolve(appRoot, ".next", "static"), path.resolve(standaloneAppRoot, ".next", "static"));
syncDirIfMissing(path.resolve(appRoot, "public"), path.resolve(standaloneAppRoot, "public"));

if (process.argv.includes("--prepare-only")) {
  console.log("standalone-assets-prepared");
  process.exit(0);
}

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    // Render expects the web process to bind to all interfaces.
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
