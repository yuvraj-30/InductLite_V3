import {
  test as base,
  expect,
  type BrowserContext,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

import { programmaticLogin, uiLogin } from "./utils/auth";
import {
  seedPublicSite as _seedPublicSite,
  deletePublicSite as _deletePublicSite,
  type SeedPublicSiteResult,
} from "./utils/seed";
import { getTestRouteHeaders } from "./utils/test-route-auth";

type MyFixtures = {
  /** Programmatic login helper available in test fixtures */
  loginAs: (email?: string) => Promise<void>;
  /** Seed a temporary public site for tests. Returns the seed response body */
  seedPublicSite: (opts?: {
    slugPrefix?: string;
    includeRedFlagQuestion?: boolean;
    includeLanguageVariants?: boolean;
    includeMediaQuizFlow?: boolean;
    includeGeofenceOverrideFlow?: boolean;
    includeSkipLogicFlow?: boolean;
    companySlug?: string;
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

const E2E_QUIET = (() => {
  const v = process.env.E2E_QUIET;
  return v === "1" || v?.toLowerCase() === "true";
})();

const E2E_RUN_ID = (() => {
  const isCi = process.env.CI === "true" || process.env.CI === "1";
  if (!isCi) return null;
  return (
    process.env.TEST_RUN_ID ||
    process.env.GITHUB_RUN_ID ||
    process.env.GITHUB_RUN_NUMBER ||
    null
  );
})();

const console = {
  ...globalThis.console,
  log: (...args: unknown[]) => {
    if (!E2E_QUIET) globalThis.console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (!E2E_QUIET) globalThis.console.warn(...args);
  },
};

function createPrismaClient(connectionString?: string): PrismaClient {
  const resolvedConnectionString =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgresql://invalid:invalid@localhost:5432/invalid";

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolvedConnectionString }),
  });
}

export const test = base.extend<MyFixtures>({
  loginAs: async ({ context, workerUser }, playUse, testInfo) => {
    const projectName = testInfo.project.name;
    const forceUiLogin =
      projectName === "webkit" || projectName === "mobile-safari";

    const openClientPage = async () => {
      const page = await (context as BrowserContext).newPage();
      await page.setExtraHTTPHeaders({ "x-e2e-client": workerUser.clientKey });
      return page;
    };

    await playUse(async (email = "admin@buildright.co.nz") => {
      const password =
        email === workerUser.email
          ? workerUser.password
          : (process.env.E2E_ADMIN_PASSWORD ?? "Admin123!");
      let usedUiFallback = false;

      if (!forceUiLogin) {
        try {
          await programmaticLogin(context as BrowserContext, email, {
            clientKey: workerUser.clientKey,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const shouldFallbackToUi =
            /create-session failed:/i.test(message) &&
            /(404|503|500|502|504)/.test(message);

          if (!shouldFallbackToUi) {
            throw err;
          }

          const page = await openClientPage();
          try {
            await uiLogin(page, email, password);
            usedUiFallback = true;
          } catch (uiErr) {
            const uiMessage =
              uiErr instanceof Error ? uiErr.message : String(uiErr);
            throw new Error(
              `programmaticLogin failed (${message}); UI login fallback failed (${uiMessage})`,
            );
          } finally {
            await page.close();
          }
        }
      } else {
        const page = await openClientPage();
        try {
          await uiLogin(page, email, password);
          usedUiFallback = true;
        } finally {
          await page.close();
        }
      }

      // Optionally skip verification to speed runs (set E2E_SKIP_LOGIN_VERIFY=1 or true)
      const skipVerify = (() => {
        const v = process.env.E2E_SKIP_LOGIN_VERIFY;
        return v === "1" || v?.toLowerCase() === "true";
      })();

      const verifySession = async (
        page: Page,
        maxAttempts: number,
      ): Promise<Error | null> => {
        const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
        let lastErr: Error | null = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await page.goto(`${base}/admin`, {
              waitUntil: "domcontentloaded",
              timeout: 20000,
            });
            const currentUrl = page.url();
            if (/\/login(?:\?|$)/i.test(currentUrl)) {
              throw new Error(`redirected to login (${currentUrl})`);
            }

            const hasLoginForm = await page
              .getByLabel("Email address")
              .isVisible()
              .catch(() => false);
            if (hasLoginForm) {
              throw new Error("login form is still visible after login attempt");
            }

            // Success criteria: reached a non-login admin route.
            if (/\/admin(?:\/|$)/i.test(currentUrl)) {
              return null;
            }

            throw new Error(`unexpected URL after login verification: ${currentUrl}`);
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            if (page.isClosed()) {
              return lastErr;
            }
            await page.waitForTimeout(500);
          }
        }
        return lastErr;
      };

      // Even when E2E_SKIP_LOGIN_VERIFY=1, we still perform a minimal verification
      // and fallback to UI login when the session cookie is not applied (common on WebKit/mobile Safari).
      const page = await openClientPage();
      try {
        let verifyErr: Error | null = null;
        if (!(skipVerify && !usedUiFallback)) {
          const maxAttempts = usedUiFallback ? 1 : 2;
          verifyErr = await verifySession(page, maxAttempts);
        }

        if (verifyErr) {
          await uiLogin(page, email, password);
          usedUiFallback = true;
          verifyErr = await verifySession(page, 2);
        }

        if (verifyErr) {
          throw new Error(
            `login verification failed after UI fallback: ${verifyErr.message}`,
          );
        }

        const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
        const cookies = await (context as BrowserContext).cookies([base]);
        const hasSessionCookie = cookies.some(
          (cookie) =>
            cookie.name === "inductlite_session" &&
            typeof cookie.value === "string" &&
            cookie.value.length > 0,
        );
        if (!hasSessionCookie) {
          throw new Error("login verification failed: session cookie missing");
        }
      } finally {
        await page.close();
      }
    });
  },

  seedPublicSite: async ({ request, workerServer: _workerServer }, playUse) => {
    await playUse(
      async (opts?: {
        slugPrefix?: string;
        includeRedFlagQuestion?: boolean;
        includeLanguageVariants?: boolean;
        includeMediaQuizFlow?: boolean;
        includeGeofenceOverrideFlow?: boolean;
        includeSkipLogicFlow?: boolean;
        companySlug?: string;
      }) => {
        let lastResult:
          | {
              ok: boolean;
              status: number | null;
              body: SeedPublicSiteResult | null;
              rawText?: string;
            }
          | null = null;

        for (let attempt = 1; attempt <= 16; attempt++) {
          const result = await _seedPublicSite(
            request as APIRequestContext,
            opts,
          );
          lastResult = result;

          if (result.ok && result.body?.success) {
            return result.body;
          }

          const serialized = JSON.stringify({
            status: result.status,
            body: result.body ?? {},
            rawText: result.rawText ?? "",
          });
          const html404Response =
            result.status === 404 &&
            typeof result.rawText === "string" &&
            /<!DOCTYPE html>|<html/i.test(result.rawText);
          const isTransient =
            !result.ok ||
            !result.body ||
            html404Response ||
            /404|503|not found|fetch failed|ECONNRESET|socket hang up/i.test(
              serialized,
            );

          if (!isTransient || attempt === 16) {
            break;
          }

          // Best-effort route warmups: helps Next.js dev route compilation settle
          // before the next seed attempt, especially in long local runs.
          await (request as APIRequestContext)
            .get("/api/test/runtime", { headers: getTestRouteHeaders() })
            .catch(() => null);
          await (request as APIRequestContext)
            .post("/api/test/clear-rate-limit", { headers: getTestRouteHeaders() })
            .catch(() => null);

          const backoffMs = Math.min(1200 * attempt, 6000);
          await new Promise((r) => setTimeout(r, backoffMs));
        }

        const rawTextSample =
          typeof lastResult?.rawText === "string"
            ? lastResult.rawText.slice(0, 240)
            : "";
        throw new Error(
          `seedPublicSite: failed after retries: status=${String(lastResult?.status ?? "n/a")} body=${JSON.stringify(lastResult?.body ?? null)} rawText=${JSON.stringify(rawTextSample)} (hint: ensure Playwright webServer is controlling the app with ALLOW_TEST_RUNNER=1 and matching TEST_RUNNER_SECRET_KEY)`,
        );
      },
    );
  },

  deletePublicSite: async ({ request, workerServer: _workerServer }, playUse) => {
    await playUse(async (slug: string) => {
      let lastBody: {
        success?: boolean;
        deleted?: boolean;
        error?: string;
      } | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const { ok, body } = await _deletePublicSite(
          request as APIRequestContext,
          slug,
        );
        lastBody = body;

        if (ok && body) {
          if (!body.success) {
            // Return body so caller can inspect deleted flag or error
            return body as {
              success?: boolean;
              deleted?: boolean;
              error?: string;
            };
          }
          return body as {
            success?: boolean;
            deleted?: boolean;
            error?: string;
          };
        }

        const shouldRetry =
          body?.error && /ECONNRESET|socket hang up/i.test(body.error);
        if (!shouldRetry || attempt === 3) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }

      // Cleanup calls can race test teardown when Playwright is already closing
      // request context/page objects. Treat those as non-fatal cleanup misses.
      const closedContext =
        !!lastBody?.error &&
        /Target page, context or browser has been closed|context.*closed|apiRequestContext\..*closed/i.test(
          lastBody.error,
        );
      if (closedContext) {
        return {
          success: false,
          deleted: false,
          error: lastBody?.error,
        };
      }

      throw new Error(
        `deletePublicSite: failed to call endpoint: ${JSON.stringify(lastBody)}`,
      );
    });
  },

  // Worker-scoped server fixture: creates a per-worker schema, starts an app server bound to a unique port,
  // and exposes `baseUrl` and `schema` for other fixtures to use.
  workerServer: [async ({}, playUse, testInfo) => {
    const { spawn } = await import("child_process");
    const path = await import("path");
    const fetchWithTimeout = async (
      url: string,
      init: RequestInit,
      requestTimeoutMs = 5000,
    ) => {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeoutHandle);
      }
    };

    // Wait for server to be ready by polling the test endpoint
    const waitForUrl = async (url: string, timeout = 120000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          const res = await fetchWithTimeout(
            url,
            {
            method: "POST",
            headers: getTestRouteHeaders(),
            },
            5000,
          );
          if (res && res.ok) return;
          if (res && (res.status === 401 || res.status === 403)) {
            const body = await res.text().catch(() => "");
            throw new Error(
              `E2E endpoint denied (${res.status}) for ${url}. Response: ${body || "<empty>"}`,
            );
          }
        } catch (e) {
          // ignore and retry
          if (e instanceof Error && e.message.includes("E2E endpoint denied")) {
            throw e;
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error(`Timed out waiting for ${url} to become available`);
    };

    const warmRoute = async (opts: {
      url: string;
      method?: "GET" | "POST" | "DELETE";
      body?: unknown;
      okStatuses: number[];
      timeoutMs?: number;
    }) => {
      const {
        url,
        method = "GET",
        body,
        okStatuses,
        timeoutMs = 90000,
      } = opts;
      const start = Date.now();
      let lastStatus: number | null = null;
      let lastBody = "";

      while (Date.now() - start < timeoutMs) {
        try {
          const headers = getTestRouteHeaders(
            body
              ? {
                  "content-type": "application/json",
                }
              : undefined,
          );
          const res = await fetchWithTimeout(
            url,
            {
              method,
              headers,
              body: body ? JSON.stringify(body) : undefined,
            },
            5000,
          );

          lastStatus = res.status;
          lastBody = await res.text().catch(() => "");

          if (okStatuses.includes(res.status)) return;
          if (res.status === 401 || res.status === 403) {
            throw new Error(
              `E2E endpoint denied (${res.status}) for ${method} ${url}. Response: ${lastBody || "<empty>"}`,
            );
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes("E2E endpoint denied")) {
            throw e;
          }
        }

        await new Promise((r) => setTimeout(r, 500));
      }

      throw new Error(
        `Timed out warming route ${method} ${url} (lastStatus=${lastStatus}, lastBody=${lastBody || "<empty>"})`,
      );
    };

    // If running with a shared server (useful on Windows local runs), skip
    // per-worker DB/schema isolation and server spawning. Set
    // E2E_USE_SHARED_SERVER=1 to enable this behaviour.
    if (
      process.env.E2E_USE_SHARED_SERVER === "1" ||
      (process.platform as string) === "win32"
    ) {
      // On Windows default to using a shared server to avoid spawn/shell issues
      // in test workers (local dev machines commonly hit these constraints).
      const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

      // Best-effort diagnostics for shared-server runtime. We do not gate on this
      // endpoint because some dev-server states can transiently 404 it while test
      // routes are still reachable. Gating happens via /api/test/clear-rate-limit.
      const runtimeProbeStarted = Date.now();
      let runtimeAllowSeen = false;
      let runtimeLastStatus: number | null = null;
      let runtimeLastBody = "";

      while (Date.now() - runtimeProbeStarted < 30000) {
        try {
          const runtimeRes = await fetchWithTimeout(
            `${baseUrl}/api/test/runtime`,
            {
              headers: getTestRouteHeaders(),
            },
            5000,
          );
          runtimeLastStatus = runtimeRes.status;
          const txt = await runtimeRes.text().catch(() => "");
          runtimeLastBody = txt;

          if (runtimeRes.status === 404 || runtimeRes.status === 503) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }

          if (!runtimeRes.ok) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }

          const runtimeBody = (() => {
            try {
              return JSON.parse(txt) as {
                allowTestRunner?: boolean;
                nodeEnv?: string;
              };
            } catch {
              return {} as { allowTestRunner?: boolean; nodeEnv?: string };
            }
          })();

          if (runtimeBody.allowTestRunner) {
            runtimeAllowSeen = true;
            break;
          }

          throw new Error(
            `E2E shared server at ${baseUrl} has ALLOW_TEST_RUNNER disabled. Start tests via Playwright webServer (default), or run dev server with ALLOW_TEST_RUNNER=1 and TRUST_PROXY=1.`,
          );
        } catch (err) {
          if (
            err instanceof Error &&
            /ALLOW_TEST_RUNNER disabled/.test(err.message)
          ) {
            throw err;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (!runtimeAllowSeen) {
        console.warn(
          `E2E: runtime probe did not confirm allowTestRunner (lastStatus=${runtimeLastStatus}, lastBody=${runtimeLastBody || "<empty>"}); continuing with clear-rate-limit readiness check`,
        );
      }

      // Shared-server mode in CI relies on the DB being prepared by workflow steps.
      // Optional local fallback: set E2E_SHARED_SERVER_SYNC_DB=1 to force a one-time sync.
      if (!mainDbPushDone) {
        if (process.env.E2E_SHARED_SERVER_SYNC_DB === "1") {
          try {
            const baseDb = process.env.DATABASE_URL;
            if (baseDb) {
              const { spawnSync } = await import("child_process");
              const isWin = (process.platform as string) === "win32";
              const run = (args: string[]) =>
                spawnSync(isWin ? "npx.cmd" : "npx", args, {
                  cwd: process.cwd(),
                  env: {
                    ...process.env,
                    DATABASE_URL: baseDb,
                    DATABASE_DIRECT_URL: baseDb,
                  },
                  stdio: "inherit",
                  shell: false,
                });

              let res = run([
                "prisma",
                "migrate",
                "deploy",
                "--schema",
                "prisma/schema.prisma",
              ]);

              if (res && res.status !== 0) {
                console.warn(
                  "E2E: main DB prisma migrate deploy failed; continuing with db push",
                  res.status,
                );
              }

              res = run([
                "prisma",
                "db",
                "push",
                "--accept-data-loss",
                "--schema",
                "prisma/schema.prisma",
              ]);

              if (res && res.status === 0) {
                mainDbPushDone = true;
                console.log("E2E: main DB schema sync succeeded");
              } else {
                console.warn(
                  "E2E: main DB schema sync failed or returned non-zero status",
                  res && res.status,
                );
              }
            } else {
              console.warn("E2E: DATABASE_URL missing; cannot db push");
            }
          } catch (e) {
            console.warn("E2E: main DB prisma db push threw:", String(e));
          }
        } else {
          mainDbPushDone = true;
        }
      }

      const sharedWarmupTimeoutMs = 120000;
      let clearRateLimitReady = true;
      try {
        await waitForUrl(`${baseUrl}/api/test/clear-rate-limit`, 45000);
      } catch (err) {
        clearRateLimitReady = false;
        console.warn(
          `E2E: clear-rate-limit readiness check failed in shared mode (${String(err)}). Proceeding with route warmup checks.`,
        );
      }
      // Warm critical test routes sequentially to avoid route-compilation contention
      // in local shared-server mode on Windows.
      await warmRoute({
        url: `${baseUrl}/api/test/runtime`,
        method: "GET",
        okStatuses: [200],
        timeoutMs: sharedWarmupTimeoutMs,
      });
      await warmRoute({
        url: `${baseUrl}/api/test/create-session?email=${encodeURIComponent("warmup@example.test")}&json=1`,
        method: "GET",
        okStatuses: [200, 404],
        timeoutMs: sharedWarmupTimeoutMs,
      });
      await warmRoute({
        url: `${baseUrl}/api/test/seed-public-site`,
        method: "POST",
        body: {
          slugPrefix: "warmup-e2e",
          includeRedFlagQuestion: false,
        },
        okStatuses: [200],
        timeoutMs: sharedWarmupTimeoutMs,
      });
      await warmRoute({
        url: `${baseUrl}/api/test/seed-public-site?slug=${encodeURIComponent("warmup-missing-site")}`,
        method: "DELETE",
        // DELETE warmup is non-critical and can intermittently return framework-level 404
        // during route compilation in long dev runs; tolerate it.
        okStatuses: [200, 404],
        timeoutMs: sharedWarmupTimeoutMs,
      });
      if (!clearRateLimitReady) {
        console.warn(
          "E2E: clear-rate-limit endpoint was not ready, but core test routes are available; continuing.",
        );
      }

      await playUse({ baseUrl, schema: "public" });
      return;
    }

    const workerIndex = testInfo.workerIndex;
    const suffix = Math.random().toString(36).substring(2, 8);
    const schema = E2E_RUN_ID
      ? `e2e_${E2E_RUN_ID}_w${workerIndex}_${suffix}`
      : `e2e_w${workerIndex}_${suffix}`;
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
          [
            "prisma",
            "db",
            "push",
            "--accept-data-loss",
            "--schema",
            "prisma/schema.prisma",
          ],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              DATABASE_URL: baseDb,
              DATABASE_DIRECT_URL: baseDb,
            },
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
        const adminClient = createPrismaClient(originalDb);
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
          ? "npx.cmd prisma db push --accept-data-loss"
          : "npx prisma db push --accept-data-loss";
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
            { DATABASE_URL: dbUrl, DATABASE_DIRECT_URL: dbUrl },
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
                { DATABASE_URL: dbUrl, DATABASE_DIRECT_URL: dbUrl },
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
            { DATABASE_URL: dbUrl, DATABASE_DIRECT_URL: dbUrl },
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
            { DATABASE_URL: dbUrl, DATABASE_DIRECT_URL: dbUrl },
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
              ["db", "push", "--accept-data-loss"],
              { DATABASE_URL: dbUrl, DATABASE_DIRECT_URL: dbUrl },
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
                  ],
                  { DATABASE_URL: dbUrl, DATABASE_DIRECT_URL: dbUrl },
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
              ["prisma", "db", "push", "--accept-data-loss"],
              { DATABASE_URL: dbUrl, DATABASE_DIRECT_URL: dbUrl },
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
          const adminClient2 = createPrismaClient(originalDb);
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
      const diagClient = createPrismaClient(dbUrl);
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
          // Table existence check - Prisma uses PascalCase quoted table names (e.g., "Company")
          // PostgreSQL stores them literally when quoted, so we query for exact case.
          const tblRes: any = await diagClient.$queryRawUnsafe(
            `SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${table}'`,
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
            `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}'`,
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
          DATABASE_DIRECT_URL: dbUrl,
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
            DATABASE_DIRECT_URL: dbUrl,
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
                DATABASE_DIRECT_URL: dbUrl,
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
              DATABASE_DIRECT_URL: dbUrl,
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
      const client = createPrismaClient(dbUrl);
      await client.$connect();
      // Drop schema to clean up
      await client.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
      );
      await client.$disconnect();
    } catch (e) {
      console.warn("Failed to drop worker schema:", String(e));
    }
  }, { scope: "worker", timeout: 300000 }],

  // Worker-scoped user fixture: creates a unique user/company per worker and exposes a clientKey
  workerUser: [async ({ workerServer }, playUse, testInfo) => {
    const workerIndex = testInfo.workerIndex;
    const suffix = Math.random().toString(36).substring(2, 8);
    const clientKey = E2E_RUN_ID
      ? `run-${E2E_RUN_ID}-worker-${workerIndex}-${suffix}`
      : `worker-${workerIndex}-${suffix}`;
    const email = `e2e-admin-${workerIndex}-${suffix}@example.test`;
    const password = "Admin123!";

    const base = workerServer.baseUrl;
    let createUserStatus: number | null = null;
    let createUserBody = "";
    let createUserOk = false;

    for (let attempt = 1; attempt <= 20; attempt++) {
      try {
        const res = await fetch(`${base}/api/test/create-user`, {
          method: "POST",
          headers: getTestRouteHeaders({
            "content-type": "application/json",
            "x-e2e-client": clientKey,
          }),
          body: JSON.stringify({
            email,
            password,
            role: "ADMIN",
            companySlug: `test-company-${clientKey}`,
          }),
        });

        const txt = await res.text();
        createUserStatus = res.status;
        createUserBody = txt;

        if (res.ok) {
          createUserOk = true;
          break;
        }

        const retryable =
          res.status === 404 || res.status === 503 || res.status >= 500;
        if (!retryable || attempt === 20) {
          break;
        }
      } catch (err) {
        createUserStatus = null;
        createUserBody = String(err);
        if (attempt === 20) {
          break;
        }
      }

      await new Promise((r) => setTimeout(r, 300 * attempt));
    }

    try {
      console.log(
        "E2E: create-user final response status=",
        createUserStatus,
        "body=",
        createUserBody,
      );
    } catch (_) {
      // ignore
    }

    if (!createUserOk) {
      try {
        const db = createPrismaClient();
        await db.$connect();
        try {
          const companySlug = `test-company-${clientKey}`;
          let company = await db.company.findUnique({
            where: { slug: companySlug },
          });
          if (!company) {
            company = await db.company.create({
              data: {
                name: `Test Company ${companySlug}`,
                slug: companySlug,
              },
            });
          }

          const passwordHash = await hashPassword(password);
          await db.user.upsert({
            where: { email },
            update: {
              company_id: company.id,
              password_hash: passwordHash,
              role: UserRole.ADMIN,
              name: email.split("@")[0] ?? email,
              is_active: true,
            },
            create: {
              company_id: company.id,
              email,
              password_hash: passwordHash,
              role: UserRole.ADMIN,
              name: email.split("@")[0] ?? email,
              is_active: true,
            },
          });
        } finally {
          await db.$disconnect();
        }

        createUserOk = true;
        createUserStatus = 200;
        createUserBody = "created-via-direct-prisma-fallback";
      } catch (fallbackErr) {
        createUserBody = `${createUserBody}\nfallback-error: ${String(fallbackErr)}`;
      }
    }

    if (!createUserOk) {
      const compactBody =
        createUserBody.length > 2000
          ? `${createUserBody.slice(0, 2000)}...`
          : createUserBody;
      throw new Error(
        `create-user failed: ${createUserStatus ?? "network-error"} ${compactBody}`,
      );
    }

    // Optional deep diagnostics only when explicitly enabled.
    if (
      process.env.E2E_DEBUG_TEST_ROUTES === "1" ||
      process.env.E2E_DEBUG_TEST_ROUTES?.toLowerCase() === "true"
    ) {
      try {
        const lookup = await fetch(
          `${base}/api/test/lookup?email=${encodeURIComponent(email)}`,
          { headers: getTestRouteHeaders() },
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
    }

    await playUse({ email, password, clientKey });
  }, { scope: "worker", timeout: 120000 }],

  // Override page to set the per-worker client header for all page requests
  page: async ({ page, workerUser, workerServer }, playUse) => {
    // Set per-worker client key header
    await page.setExtraHTTPHeaders({ "x-e2e-client": workerUser.clientKey });

    // Monkeypatch page.goto so relative paths are resolved against the worker's baseUrl

    const p = page as Page & {
      goto: (url: string | URL, options?: any) => Promise<any>;
    };
    const origGoto = p.goto.bind(page as unknown as Page);
    const isTransientNavigationError = (value: unknown): boolean => {
      const message = value instanceof Error ? value.message : String(value);
      return /Could not connect to server|ECONNRESET|ECONNREFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_ABORTED|NS_BINDING_ABORTED|aborted|interrupted by another navigation/i.test(
        message,
      );
    };

    p.goto = async function (url: string | URL, options?: any) {
      if (typeof url === "string" && url.startsWith("/")) {
        url = `${workerServer.baseUrl}${url}`;
      }
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await origGoto(url as any, options);
        } catch (error) {
          if (!isTransientNavigationError(error) || attempt === 3) {
            throw error;
          }
          await page.waitForTimeout(350 * attempt);
        }
      }
      return origGoto(url as any, options);
    };

    await playUse(page);
  },
});

export { expect };
