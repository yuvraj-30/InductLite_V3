const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const appRequire = createRequire(path.join(appRoot, "package.json"));
const prismaCliPath = appRequire.resolve("prisma/build/index.js");

const result = spawnSync(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  cwd: appRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
