const { spawn } = require("node:child_process");

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const npmCliEntrypoint =
  typeof process.env.npm_execpath === "string" &&
  process.env.npm_execpath.trim().length > 0
    ? process.env.npm_execpath
    : null;
const serverMode = process.env.E2E_SERVER_MODE ?? "dev";

function spawnProcess(command, args, options) {
  return spawn(command, args, {
    ...options,
    shell: options.shell ?? false,
  });
}

function spawnNpm(args, env) {
  if (npmCliEntrypoint) {
    return spawnProcess(process.execPath, [npmCliEntrypoint, ...args], {
      stdio: "inherit",
      env,
      shell: false,
    });
  }

  return spawnProcess(npmCommand, args, {
    stdio: "inherit",
    env,
    shell: isWindows,
  });
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child =
      command === "__npm__"
        ? spawnNpm(args, env)
        : spawnProcess(command, args, {
            stdio: "inherit",
            env,
            shell: false,
          });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(" ")} exited via ${signal}`));
        return;
      }
      if ((code ?? 1) !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed with exit code ${code ?? 1}`,
          ),
        );
        return;
      }
      resolve();
    });
  });
}

function forwardSignals(child) {
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];

  for (const signal of signals) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }
}

async function main() {
  if (serverMode === "dev") {
    const child = spawnNpm(["run", "dev", "--", "--webpack"], {
      ...process.env,
      NODE_ENV: "development",
    });

    forwardSignals(child);

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 1);
    });

    return;
  }

  console.log("Preparing production-style Playwright web server");

  await runCommand("__npm__", ["run", "build"], {
    ...process.env,
    NODE_ENV: "production",
  });

  const child = spawn(process.execPath, ["scripts/start-standalone.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
    },
    shell: false,
  });

  forwardSignals(child);

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
