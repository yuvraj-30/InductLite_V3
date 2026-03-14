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

- The test-only API `/api/test/create-user` is used under the hood to create a per-worker company and user.
  Access policy:
  1. `NODE_ENV=test` -> allowed
  2. `NODE_ENV=production` + `CI=true` + `ALLOW_TEST_RUNNER=1` + `x-test-secret` matching `TEST_RUNNER_SECRET_KEY` -> allowed
  3. all other cases -> blocked (`403`)

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
- Route/path coverage gap matrix (static analysis) can be generated from repo root with:
  - `npm run test:e2e:gap-matrix`
  - Outputs: `docs/E2E_TEST_GAP_MATRIX.md` and `docs/E2E_TEST_GAP_MATRIX.json`
- Dynamic-link assisted gap matrix mode (requires app server reachable, default `http://127.0.0.1:3000`):
  - `npm run test:e2e:gap-matrix -- --dynamic-links`
  - Optional flags: `--base-url <url> --max-pages 250 --max-depth 4`
- Button-only JS flow analysis (heuristic crawl with Playwright):
  - `npm run test:e2e:gap-matrix -- --dynamic-links --js-flows`
  - Optional flags: `--max-buttons-per-page 16`

### Running tests locally on Windows

Prefer the repo-root CI mirror on native Windows shells:

```powershell
npm run test:e2e:ci-local
```

That path mirrors the GitHub Actions PR smoke lane with a shared standalone server, starts local Postgres from `docker-compose.dev.yml` when needed, installs Chromium only, sets `E2E_RETRIES=0`, and fails fast unless `/api/test/runtime` plus `/api/test/clear-rate-limit` are reachable with the CI test-runner secret.

Use WSL when you specifically want the per-worker schema/server model that Playwright uses outside shared-server mode:

1. Open WSL (Ubuntu) and mount the repo directory (for example, `/mnt/c/InductLite_V2`).
2. Install Node.js and npm inside WSL, then run `npm ci` in `apps/web`.
3. Run the full E2E locally with 2 workers: `npx playwright test e2e --reporter=list --workers=2`.
