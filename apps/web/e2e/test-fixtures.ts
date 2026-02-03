import {
  test as base,
  expect,
  type BrowserContext,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { programmaticLogin } from "./utils/auth";
import {
  seedPublicSite as _seedPublicSite,
  deletePublicSite as _deletePublicSite,
  type SeedPublicSiteResult,
} from "./utils/seed";

type MyFixtures = {
  /** Programmatic login helper available in test fixtures */
  loginAs: (email?: string) => Promise<void>;
  /** Seed a temporary public site for tests. Returns the seed response body */
  seedPublicSite: (opts?: {
    slugPrefix?: string;
  }) => Promise<SeedPublicSiteResult>;
  /** Delete a previously seeded public site by slug */
  deletePublicSite: (
    slug: string,
  ) => Promise<{ success?: boolean; deleted?: boolean; error?: string }>;
  /** Worker-scoped server (baseUrl & schema) for parallel test isolation */
  workerServer: { baseUrl: string; schema: string };
  /** Worker-scoped user for parallel test isolation */
  workerUser: { email: string; password: string; clientKey: string };
};

// Ensure we only attempt to push the main DB schema once per test run
let mainDbPushDone = false;

export const test = base.extend<MyFixtures>({
  loginAs: async ({ context }, playUse) => {
    await playUse(async (email = "admin@buildright.co.nz") => {
      await programmaticLogin(context as BrowserContext, email);

      // Optionally skip verification to speed runs (set E2E_SKIP_LOGIN_VERIFY=1 or true)
      const skipVerify = (() => {
        const v = process.env.E2E_SKIP_LOGIN_VERIFY;
        return v === "1" || v?.toLowerCase() === "true";
      })();
      if (skipVerify) return;

      // Verify session works by navigating to /admin and checking for a stable admin UI element
      const page = await (context as BrowserContext).newPage();
      try {
        const base = process.env.BASE_URL ?? "http://localhost:3000";
        const maxAttempts = 2;
        let lastErr: Error | null = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await page.goto(`${base}/admin`, {
              waitUntil: "networkidle",
              timeout: 10000,
            });
            // Use accessible role for stable match: the header contains a Sign Out link
            await page
              .getByRole("link", { name: /sign out/i })
              .waitFor({ timeout: 3000 });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            // small backoff before retry
            await page.waitForTimeout(500);
          }
        }
        if (lastErr) {
          throw new Error(
            `programmaticLogin verification failed: could not detect authenticated admin UI after ${maxAttempts} attempts. This may indicate the seeded admin user is missing or session cookie was not applied. Cause: ${lastErr.message}`,
          );
        }
      } finally {
        await page.close();
      }
    });
  },

  seedPublicSite: async ({ request }, playUse) => {
    await playUse(async (opts?: { slugPrefix?: string }) => {
      const { ok, body } = await _seedPublicSite(
        request as APIRequestContext,
        opts,
      );
      if (!ok || !body) {
        throw new Error(
          `seedPublicSite: failed to call endpoint: ${JSON.stringify(body)}`,
        );
      }
      if (!body.success) {
        throw new Error(
          `seedPublicSite: unsuccessful: ${JSON.stringify(body)}`,
        );
      }
      return body;
    });
  },

  deletePublicSite: async ({ request }, playUse) => {
    await playUse(async (slug: string) => {
      const { ok, body } = await _deletePublicSite(
        request as APIRequestContext,
        slug,
      );
      if (!ok || !body) {
        throw new Error(
          `deletePublicSite: failed to call endpoint: ${JSON.stringify(body)}`,
        );
      }
      if (!body.success) {
        // Return body so caller can inspect deleted flag or error
        return body as { success?: boolean; deleted?: boolean; error?: string };
      }
      return body as { success?: boolean; deleted?: boolean; error?: string };
    });
  },

  // Worker-scoped server fixture: creates a per-worker schema, starts an app server bound to a unique port,
  // and exposes `baseUrl` and `schema` for other fixtures to use.
  workerServer: async ({}, playUse, testInfo) => {
    const { spawn } = await import("child_process");
    const path = await import("path");

    // If running with a shared server (useful on Windows local runs), skip
    // per-worker DB/schema isolation and server spawning. Set
    // E2E_USE_SHARED_SERVER=1 to enable this behaviour.
    if (
      process.env.E2E_USE_SHARED_SERVER === "1" ||
      (process.platform as string) === "win32"
    ) {
      // On Windows default to using a shared server to avoid spawn/shell issues
      // in test workers (local dev machines commonly hit these constraints).
      const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
      await playUse({ baseUrl, schema: "public" });
      return;
    }

    const workerIndex = testInfo.workerIndex;
    const suffix = Math.random().toString(36).substring(2, 8);
    const schema = `e2e_w${workerIndex}_${suffix}`;
    // Pick a base port per worker to avoid conflicts; 3100 + workerIndex
    const basePort = 3100;
    const port = basePort + Number(workerIndex);
    const baseUrl = `http://localhost:${port}`;

    // Expose BASE_URL in this worker so helpers using process.env.BASE_URL pick up the worker server
    process.env.BASE_URL = baseUrl;

    // Build a DB URL that uses the schema for this worker
    const originalDb =
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/inductlite_e2e";

    // Ensure the main DB (without per-worker schema) has the Prisma schema applied
    // Run this once per test run to populate tables in the 'public' schema which some
    // endpoints expect (e.g., public Company table).
    if (!mainDbPushDone) {
      try {
        // Remove any schema= query param so we target the main/public schema
        const stripSchema = (u: string) => {
          try {
            const uu = new URL(u);
            uu.searchParams.delete("schema");
            return uu.toString();
          } catch (e) {
            return u.replace(/[?&]schema=[^&]*/g, "");
          }
        };
        const baseDb = stripSchema(originalDb);
        console.log(
          "E2E: ensuring main DB has Prisma schema (target):",
          baseDb,
        );
        const { spawnSync } = await import("child_process");
        const isWin = (process.platform as string) === "win32";
        const res = spawnSync(
          isWin ? "npx.cmd" : "npx",
          ["prisma", "db", "push", "--accept-data-loss", "--skip-generate"],
          {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: baseDb },
            stdio: "inherit",
            shell: false,
          },
        );
        if (res && res.status === 0) {
          mainDbPushDone = true;
          console.log("E2E: main DB prisma db push succeeded");
        } else {
          console.warn(
            "E2E: main DB prisma db push failed or returned non-zero status",
            res && res.status,
          );
        }
      } catch (e) {
        console.warn("E2E: main DB prisma db push threw:", String(e));
      }
    }

    // Build DB URL with an explicit schema param for this worker. Use URL parsing
    // to replace any existing schema query param instead of appending another one
    // (duplicate schema params can cause Prisma to pick the wrong one).
    const addSchemaToDbUrl = (url: string, schemaName: string) => {
      try {
        const u = new URL(url);
        u.searchParams.set("schema", schemaName);
        return u.toString();
      } catch (e) {
        // Falling back to string manipulation for non-standard URLs
        if (url.includes("schema=")) {
          return url.replace(/([?&])schema=[^&]*/, `$1schema=${schemaName}`);
        }
        return url.includes("?")
          ? `${url}&schema=${schemaName}`
          : `${url}?schema=${schemaName}`;
      }
    };
    const dbUrl = addSchemaToDbUrl(originalDb, schema);

    // Diagnostic: log the effective schema param so CI logs show what Prisma will target
    try {
      const parsed = new URL(dbUrl);
      console.log(
        "E2E: worker dbUrl schema=",
        parsed.searchParams.get("schema"),
      );
    } catch (_) {
      // ignore parsing issues for non-URL formatted connection strings
    }

    // Ensure the schema exists before attempting `prisma db push`. Some Postgres
    // installations will not implicitly create the schema from the connection
    // parameter and `prisma db push` may fail to write objects into a non-existent
    // schema. Create it explicitly via a short-lived Prisma client.
    try {
      try {
        const adminClient = new PrismaClient({
          datasources: { db: { url: originalDb } },
        });
        await adminClient.$connect();
        // Create schema if it doesn't exist. Use $executeRawUnsafe here because
        // this is a test-only helper and the schema name is generated internally.
        await adminClient.$executeRawUnsafe(
          `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
        );
        await adminClient.$disconnect();
        console.log("E2E: ensured worker schema exists:", schema);
      } catch (err) {
        // If creating the schema fails, log and continue; subsequent prisma db push
        // may still succeed in some environments or we may fall back.
        console.warn(
          "E2E: failed to create worker schema (continuing):",
          String(err),
        );
      }

      // Keep a platform-aware shell fallback command (intentionally unused but documented for Windows shims)

      const _commandString =
        process.platform === "win32"
          ? "npx.cmd prisma db push --accept-data-loss --skip-generate"
          : "npx prisma db push --accept-data-loss --skip-generate";
      // Mark intentionally unused variable as referenced to silence TS no-unused-local
      void _commandString;

      // Retry a couple of times in case of transient file locks or DB contention
      let attempts = 0;
      let lastErr: Error | null = null;
      const isWin = (process.platform as string) === "win32";

      // Import child_process and fs modules once so we can use their sync APIs without `require`.
      const child_process = await import("child_process");
      const fsModule = await import("fs");

      // Helper to try running a command (binary or npx) with retries
      const runCommand = (
        bin: string,
        args: string[],
        env: Record<string, string> = {},
      ) => {
        try {
          return child_process.spawnSync(bin, args, {
            cwd: path.resolve(process.cwd()),
            env: { ...process.env, ...env },
            stdio: "inherit",
            shell: false,
          });
        } catch (e) {
          return { error: e } as any;
        }
      };

      // Candidate local prisma binaries
      const candidates = [
        path.resolve(
          process.cwd(),
          "node_modules",
          ".bin",
          isWin ? "prisma.cmd" : "prisma",
        ),
        path.resolve(
          process.cwd(),
          "..",
          "node_modules",
          ".bin",
          isWin ? "prisma.cmd" : "prisma",
        ),
        path.resolve(
          process.cwd(),
          "..",
          "..",
          "node_modules",
          ".bin",
          isWin ? "prisma.cmd" : "prisma",
        ),
      ];

      // Primary approach: run `prisma migrate deploy` against the worker DB URL
      while (attempts < 3) {
        attempts++;
        let res: any;
        const found = candidates.find((p) => {
          try {
            return fsModule.existsSync(p);
          } catch {
            return false;
          }
        });

        if (found) {
          console.log(
            "E2E: attempting prisma binary at:",
            found,
            "for migrate deploy",
          );
          res = runCommand(
            found,
            ["migrate", "deploy", "--schema=prisma/schema.prisma"],
            { DATABASE_URL: dbUrl },
          );
          if (res && (res.error as NodeJS.ErrnoException)?.code === "ENOENT") {
            // try node invocation
            try {
              console.log(
                "E2E: attempting to run prisma via node",
                process.execPath,
                found,
              );
              const alt = runCommand(
                process.execPath,
                [found, "migrate", "deploy", "--schema=prisma/schema.prisma"],
                { DATABASE_URL: dbUrl },
              );
              if (alt && alt.status === 0) res = alt;
            } catch (e) {
              console.warn(
                "E2E: node invocation of prisma migrate errored:",
                String(e),
              );
            }
          }
        } else {
          console.log(
            "E2E: no local prisma binary found; falling back to npx migrate deploy",
          );
          res = runCommand(
            isWin ? "npx.cmd" : "npx",
            ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"],
            { DATABASE_URL: dbUrl },
          );
        }

        if (res && res.error) {
          lastErr =
            res.error instanceof Error
              ? res.error
              : new Error(String(res.error));
          await new Promise((r) => setTimeout(r, 500 * attempts));
          continue;
        }
        if (res && res.status !== 0) {
          lastErr = new Error(
            `prisma migrate deploy failed with exit code ${res.status}`,
          );
          await new Promise((r) => setTimeout(r, 500 * attempts));
          continue;
        }

        // If migrations applied, attempt to run seed script against same DB
        try {
          console.log("E2E: attempting to run seed script for worker schema");
          // Try npx tsx prisma/seed.ts with DATABASE_URL set
          const seedCmd = runCommand(
            isWin ? "npx.cmd" : "npx",
            ["tsx", "prisma/seed.ts"],
            { DATABASE_URL: dbUrl },
          );
          if (seedCmd && seedCmd.error) {
            console.warn(
              "E2E: seed command returned error, will continue:",
              String(seedCmd.error),
            );
          } else if (seedCmd && seedCmd.status !== 0) {
            console.warn(
              "E2E: seed command exited non-zero status",
              seedCmd.status,
            );
          } else {
            console.log("E2E: seed script executed (status ok)");
          }
        } catch (e) {
          console.warn("E2E: running seed script errored:", String(e));
        }

        lastErr = null;
        break;
      }

      // If migrate deploy failed for all attempts, try 'prisma db push' as a fallback
      if (lastErr) {
        console.warn(
          "E2E: prisma migrate deploy failed for worker schema:",
          String(lastErr),
        );
        console.log(
          "E2E: falling back to prisma db push for worker schema (best-effort)",
        );

        attempts = 0;
        while (attempts < 3) {
          attempts++;
          let res: any;
          const found = candidates.find((p) => {
            try {
              return fsModule.existsSync(p);
            } catch {
              return false;
            }
          });

          if (found) {
            console.log(
              "E2E: attempting prisma binary at:",
              found,
              "for db push",
            );
            res = runCommand(
              found,
              ["db", "push", "--accept-data-loss", "--skip-generate"],
              { DATABASE_URL: dbUrl },
            );
            if (
              res &&
              (res.error as NodeJS.ErrnoException)?.code === "ENOENT"
            ) {
              try {
                console.log(
                  "E2E: attempting to run prisma db push via node",
                  process.execPath,
                  found,
                );
                const alt = runCommand(
                  process.execPath,
                  [
                    found,
                    "db",
                    "push",
                    "--accept-data-loss",
                    "--skip-generate",
                  ],
                  { DATABASE_URL: dbUrl },
                );
                if (alt && alt.status === 0) res = alt;
              } catch (e) {
                console.warn(
                  "E2E: node invocation of prisma db push errored:",
                  String(e),
                );
              }
            }
          } else {
            console.log(
              "E2E: no local prisma binary found; falling back to npx db push",
            );
            res = runCommand(
              isWin ? "npx.cmd" : "npx",
              ["prisma", "db", "push", "--accept-data-loss", "--skip-generate"],
              { DATABASE_URL: dbUrl },
            );
          }

          if (res && res.error) {
            lastErr =
              res.error instanceof Error
                ? res.error
                : new Error(String(res.error));
            await new Promise((r) => setTimeout(r, 500 * attempts));
            continue;
          }
          if (res && res.status !== 0) {
            lastErr = new Error(
              `prisma db push failed with exit code ${res.status}`,
            );
            await new Promise((r) => setTimeout(r, 500 * attempts));
            continue;
          }

          lastErr = null;
          break;
        }
      }

      // If both migrate+seed and db push failed, attempt a structural copy from public schema
      if (lastErr) {
        console.warn(
          "E2E: prisma migrate/db push both failed for worker schema; attempting structural copy from public schema",
          String(lastErr),
        );
        try {
          const adminClient2 = new PrismaClient({
            datasources: { db: { url: originalDb } },
          });
          await adminClient2.$connect();

          // Copy a small set of core tables from public into the worker schema
          const tablesToCopy = ["Company", "User", "SignInRecord", "AuditLog"];
          for (const t of tablesToCopy) {
            const sql = `CREATE TABLE IF NOT EXISTS "${schema}"."${t}" (LIKE public."${t}" INCLUDING ALL)`;
            try {
              await adminClient2.$executeRawUnsafe(sql);
              console.log(
                `E2E: copied table structure for ${t} into schema ${schema}`,
              );
            } catch (e) {
              console.warn(`E2E: failed to copy table ${t}:`, String(e));
            }
          }

          await adminClient2.$disconnect();
          // Clear lastErr since we attempted a structural copy
          lastErr = null;
        } catch (e) {
          console.warn(
            "E2E: structural copy from public schema failed:",
            String(e),
          );
        }
      }

      // Diagnostic: verify tables were created in the worker schema at runtime.
      const diagClient = new PrismaClient({
        datasources: { db: { url: dbUrl } },
      });
      await diagClient.$connect();
      try {
        // Basic table counts
        const total = await diagClient.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = '${schema}'`,
        );
        console.log("E2E: schema table count:", schema, JSON.stringify(total));

        // Required tables and required columns per table to verify
        const required = {
          User: ["id", "company_id", "email", "password_hash"],
          Company: ["id", "slug"],
          SignInRecord: ["id", "company_id", "site_id"],
          AuditLog: ["id", "company_id", "action"],
        } as Record<string, string[]>;

        const missing: string[] = [];

        for (const [table, cols] of Object.entries(required)) {
          // Table existence check (case-insensitive in information_schema, normalize to lower)
          const tbl = table.toLowerCase();
          const tblRes: any = await diagClient.$queryRawUnsafe(
            `SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${tbl}'`,
          );
          const tblCount =
            Array.isArray(tblRes) && tblRes[0]
              ? (tblRes[0] as any).c
              : (tblRes?.c ?? 0);
          if (!tblCount) {
            missing.push(`${table} (table missing)`);
            continue;
          }

          // Columns existence
          const colRes: any = await diagClient.$queryRawUnsafe(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${tbl}'`,
          );
          const presentCols = new Set(
            (Array.isArray(colRes) ? colRes : []).map((r: any) =>
              (r.column_name || r.column_name).toString(),
            ),
          );
          const absent = cols.filter((c) => !presentCols.has(c));
          if (absent.length) {
            missing.push(`${table} missing columns: ${absent.join(",")}`);
          }
        }

        if (missing.length) {
          console.error(
            "E2E: required table/column checks FAILED for schema",
            schema,
            missing,
          );
          throw new Error(
            `Schema ${schema} missing required tables/columns: ${missing.join("; ")}`,
          );
        }

        console.log(
          "E2E: required table/column checks passed for schema",
          schema,
        );
      } finally {
        await diagClient.$disconnect();
      }
    } catch (e) {
      console.warn("E2E: failed to query tables in schema", schema, String(e));
      throw e;
    }

    // Start app server process pointing at the worker schema
    // Use `next dev` locally to avoid requiring a production build (faster for local runs).
    const startScript = process.env.CI ? "start" : "dev";

    // Prefer running the compiled standalone server in CI (check multiple
    // locations) or invoke Next via its node entrypoint to avoid relying on
    // spawning `npm` (which can be missing in some worker environments).
    const fs = await import("fs");
    const standaloneCandidates = [
      path.resolve(process.cwd(), ".next", "standalone", "server.js"),
      path.resolve(process.cwd(), "..", ".next", "standalone", "server.js"),
      path.resolve(
        process.cwd(),
        "..",
        "..",
        ".next",
        "standalone",
        "server.js",
      ),
    ];

    let serverProc;
    const standaloneFound = standaloneCandidates.find((p) => fs.existsSync(p));
    if (standaloneFound) {
      console.log("E2E: starting standalone server at", standaloneFound);
      serverProc = spawn(process.execPath, [standaloneFound], {
        cwd: path.resolve(process.cwd()),
        env: {
          ...process.env,
          DATABASE_URL: dbUrl,
          PORT: String(port),
          ALLOW_TEST_RUNNER: "1",
          SESSION_SECRET:
            process.env.SESSION_SECRET ||
            "test-session-secret-012345678901234567890123456",
        },
        stdio: "inherit",
      });
    } else {
      // Try Next's node entrypoint (relative to this package)
      const nextNodeBin = path.resolve(
        process.cwd(),
        "node_modules",
        "next",
        "dist",
        "bin",
        "next",
      );
      if (fs.existsSync(nextNodeBin)) {
        console.log("E2E: running Next via node bin:", nextNodeBin);
        serverProc = spawn(process.execPath, [nextNodeBin, "start"], {
          cwd: path.resolve(process.cwd()),
          env: {
            ...process.env,
            DATABASE_URL: dbUrl,
            PORT: String(port),
            ALLOW_TEST_RUNNER: "1",
            SESSION_SECRET:
              process.env.SESSION_SECRET ||
              "test-session-secret-012345678901234567890123456",
          },
          stdio: "inherit",
        });
      } else {
        console.warn(
          "E2E: no standalone or Next bin found; falling back to 'npm run start' (may fail if npm is unavailable)",
          standaloneCandidates,
          nextNodeBin,
        );

        // Diagnostic: log PATH so we can see if npm is available in the worker environment
        try {
          console.log("E2E: PATH=", process.env.PATH);
        } catch (_) {
          // ignore
        }

        // Check for npm executable in PATH before spawning it. If not found,
        // attempt to run Next via node entrypoint (if available) or throw a
        // descriptive error to help CI debugging.
        const pathDirs = (process.env.PATH || "").split(path.delimiter);
        const npmName = process.platform === "win32" ? "npm.cmd" : "npm";
        const npmFound = pathDirs
          .map((d) => path.join(d, npmName))
          .find((p) => {
            try {
              return fs.existsSync(p);
            } catch (_) {
              return false;
            }
          });

        if (!npmFound) {
          console.warn(
            "E2E: npm not found in PATH; attempting Node+Next fallbacks",
          );
          // If Next node entrypoint exists but earlier path check failed due to
          // race or install layout, try a couple of upward candidates before
          // giving up.
          const altNext = path.resolve(
            process.cwd(),
            "..",
            "node_modules",
            "next",
            "dist",
            "bin",
            "next",
          );
          if (fs.existsSync(altNext)) {
            console.log(
              "E2E: found Next node bin at",
              altNext,
              "— running it via node",
            );
            serverProc = spawn(process.execPath, [altNext, "start"], {
              cwd: path.resolve(process.cwd()),
              env: {
                ...process.env,
                DATABASE_URL: dbUrl,
                PORT: String(port),
                ALLOW_TEST_RUNNER: "1",
                SESSION_SECRET:
                  process.env.SESSION_SECRET ||
                  "test-session-secret-012345678901234567890123456",
              },
              stdio: "inherit",
            });
          } else {
            throw new Error(
              "E2E: npm not available in PATH and Next node binary not found — cannot start worker server",
            );
          }
        } else {
          serverProc = spawn(npmFound, ["run", startScript], {
            cwd: path.resolve(process.cwd()),
            env: {
              ...process.env,
              DATABASE_URL: dbUrl,
              PORT: String(port),
              ALLOW_TEST_RUNNER: "1",
              SESSION_SECRET:
                process.env.SESSION_SECRET ||
                "test-session-secret-012345678901234567890123456",
            },
            stdio: "inherit",
          });
        }
      }
    }

    // Wait for server to be ready by polling the test endpoint
    const waitForUrl = async (url: string, timeout = 120000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          const res = await fetch(url, { method: "POST" });
          if (res && res.ok) return;
        } catch (e) {
          // ignore and retry
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error(`Timed out waiting for ${url} to become available`);
    };

    try {
      await waitForUrl(`${baseUrl}/api/test/clear-rate-limit`, 120000);
    } catch (err) {
      // Kill the process and rethrow
      try {
        serverProc.kill();
      } catch (e) {
        // ignore
      }
      throw err;
    }

    await playUse({ baseUrl, schema });

    // Teardown: stop server and drop the schema
    try {
      serverProc.kill();
    } catch (e) {
      // ignore
    }

    try {
      // Use a short-lived Prisma client pointing at the schema to drop it
      const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
      await client.$connect();
      // Drop schema to clean up
      await client.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
      );
      await client.$disconnect();
    } catch (e) {
      console.warn("Failed to drop worker schema:", String(e));
    }
  },

  // Worker-scoped user fixture: creates a unique user/company per worker and exposes a clientKey
  workerUser: async ({ workerServer }, playUse, testInfo) => {
    const workerIndex = testInfo.workerIndex;
    const suffix = Math.random().toString(36).substring(2, 8);
    const clientKey = `worker-${workerIndex}-${suffix}`;
    const email = `e2e-admin-${workerIndex}-${suffix}@example.test`;
    const password = "Admin123!";

    const base = workerServer.baseUrl;
    const res = await fetch(`${base}/api/test/create-user`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-e2e-client": clientKey,
      },
      body: JSON.stringify({
        email,
        password,
        role: "ADMIN",
        companySlug: `test-company-${clientKey}`,
      }),
    });

    const txt = await res.text();
    try {
      // Log response body for diagnostics (helps in CI logs) - not exposing secrets
      console.log(
        "E2E: create-user response status=",
        res.status,
        "body=",
        txt,
      );
    } catch (_) {
      // ignore
    }

    if (!res.ok) {
      throw new Error(`create-user failed: ${res.status} ${txt}`);
    }

    // Verify via test-only lookup endpoint that the server runtime can see the created user
    try {
      const lookup = await fetch(
        `${base}/api/test/lookup?email=${encodeURIComponent(email)}`,
      );
      const lookupText = await lookup.text();
      console.log(
        "E2E: create-user lookup status=",
        lookup.status,
        "body=",
        lookupText,
      );
    } catch (e) {
      console.warn("E2E: create-user lookup failed:", String(e));
    }

    await playUse({ email, password, clientKey });
  },

  // Override page to set the per-worker client header for all page requests
  page: async ({ page, workerUser, workerServer }, playUse) => {
    // Set per-worker client key header
    await page.setExtraHTTPHeaders({ "x-e2e-client": workerUser.clientKey });

    // Monkeypatch page.goto so relative paths are resolved against the worker's baseUrl

    const p = page as Page & {
      goto: (url: string | URL, options?: any) => Promise<any>;
    };
    const origGoto = p.goto.bind(page as unknown as Page);

    p.goto = async function (url: string | URL, options?: any) {
      if (typeof url === "string" && url.startsWith("/")) {
        url = `${workerServer.baseUrl}${url}`;
      }
      return origGoto(url as any, options);
    };

    await playUse(page);
  },
});

export { expect };
