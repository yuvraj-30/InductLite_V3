# Playwright E2E helpers

This folder contains Playwright end-to-end tests and a small shared test fixture to help with programmatic login.

## Using the `loginAs` fixture

Import the shared `test` fixture in your test file instead of `@playwright/test`:

```ts
import { test, expect } from "./test-fixtures";
```

Then use the `loginAs` fixture in your `beforeEach`:

```ts
test.beforeEach(async ({ loginAs }) => {
  await loginAs("admin@buildright.co.nz");
});
```

This helper calls `/api/test/create-session?json=1` and sets the sealed session cookie on the Playwright context so you can skip the UI login in tests. After setting the cookie, `loginAs` verifies the session by navigating to `/admin` and checking for a stable admin UI element (the "Sign Out" link), with a single retry. This adds a small verification cost but prevents flaky navigation timeouts caused by misapplied cookies or missing seeded admin users. To opt out of verification for faster runs (for example in local smoke runs), set `E2E_SKIP_LOGIN_VERIFY=1` or `E2E_SKIP_LOGIN_VERIFY=true` in the environment.

### Best practice

- Prefer `loginAs()` for tests that need an authenticated session but **do not** need to verify the login UI itself. This speeds tests and reduces flakiness from rate limits or UI timing. For tests that exercise the login UX (e.g., `admin-auth.spec.ts`), keep the UI-based form flow.

## Worker-scoped isolation

- This test suite provides a `workerUser` fixture (worker scope). Use `workerUser` in tests to get a unique admin account and `clientKey` header per Playwright worker (avoids shared account collisions when running tests in parallel):

```ts
test.beforeEach(async ({ loginAs, workerUser }) => {
  await loginAs(workerUser.email);
});
```

- The test-only API `/api/test/create-user` is used under the hood to create a per-worker company and user. In non-test runtimes it requires both `ALLOW_TEST_RUNNER=1` and `x-test-secret` matching `TEST_RUNNER_SECRET_KEY`.

- To clear rate-limit state for a specific worker or client, call `/api/test/clear-rate-limit?clientKey=<clientKey>`.

## Fallback UI login

If you need to exercise the real login form, use `uiLogin` from `./utils/auth`:

```ts
import { uiLogin } from "./utils/auth";

await uiLogin(page, "admin@buildright.co.nz", "Admin123!");
```

## Notes

- The `playwright.config.ts` includes test env overrides (`SESSION_SECRET` and `ALLOW_TEST_RUNNER`) so the dev server can accept test-created session cookies.
- Keep test seed data (admin user) in sync with the test account used here.

### Running tests locally on Windows (WSL) ⚠️

Schema-per-worker spawns a per-worker app server and runs `prisma db push` per worker. On Windows this currently requires a Linux shell environment (WSL) because spawning the Prisma CLI from Playwright worker processes can fail on native Windows shells.

Quick steps (WSL):

1. Open WSL (Ubuntu) and mount the repo directory (e.g., `/mnt/c/InductLite_V2`).
2. Install Node.js & pnpm/npm in WSL if not present, then run `npm ci` in the `apps/web` directory.
3. Run the full E2E locally with 2 workers: `npx playwright test e2e --reporter=list --workers=2`.

If you cannot use WSL, run sequential tests locally (single worker) or use Docker to provide a Linux environment.

If you want, I can add a Windows fallback that uses a namespaced shared DB instead of per‑worker schemas (we currently prefer verifying full isolation on CI).
