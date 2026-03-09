# Full Test Coverage and Purpose (2026-03-09)

## Direct answer
Short answer: **yes for required baseline coverage**, with one practical caveat.

- Source-to-test mapping is at **0 gaps** (`374/374` source files directly mapped to tests).
- Playwright route coverage is at **0 gaps** (`117/117` app routes covered by e2e evidence).
- Guardrail checks, lint, typecheck, unit tests, integration tests, and functional Chromium e2e pass in the confidence gate.
- Full cross-browser/device functional e2e (`--full`) had one mobile-safari flaky failure previously; that specific test was hardened and passed in targeted rerun. A full all-project rerun was then stopped by request.

## What "fully covered" means here (in plain language)
- Every important code file has a matching test file.
- Every public/admin/API route is touched by e2e tests.
- Security/budget rules are automatically checked.
- Business-critical workflows are tested against a real database.
- Real browser flows are tested end-to-end.

It does **not** mean mathematically perfect branch coverage of every possible runtime path. It means strong production confidence with layered tests and zero known mapping gaps.

## Current measured status

| Area | Current status | Source |
| --- | --- | --- |
| Source files mapped to direct tests | `374/374` (0 gaps) | `docs/TEST_GAP_MATRIX.json` |
| E2E app-route coverage | `117/117` (0 gaps) | `docs/E2E_TEST_GAP_MATRIX.json` |
| Unit test files (`apps/web/src`) | `385` files | repository count |
| Integration test files (`apps/web/tests/integration`) | `17` files | repository count |
| Playwright spec files (`apps/web/e2e`) | `19` files | repository count |
| Mobile test files (`apps/mobile/src`) | `9` files | repository count |
| Shared package test files (`packages/shared/src`) | `4` files | repository count |

## Test layers and purpose (layman language)

| Layer | Why it exists | What it catches |
| --- | --- | --- |
| Guardrail checks (`guardrails-lint`, `guardrails-tests`, `policy-check`) | Ensures security and cost rules are not accidentally broken | Tenant leaks, missing limits, policy drift |
| Unit tests | Checks small pieces of logic in isolation | Validation bugs, wrong conditions, regressions in helpers/actions/routes |
| Integration tests | Tests realistic behavior with real Postgres/Testcontainers | Cross-tenant leaks, job behavior, exports, auth/role data issues |
| Playwright e2e | Simulates real user flows in browser | UI flow breakage, form issues, auth/session flow failures |
| Gap matrices | Proves code/routes are not left untested by mapping | "Untested file" and "untested route" blind spots |

## Integration tests: each file and purpose (plain language)

| Test file | Purpose in normal language |
| --- | --- |
| `compliance-workflows.integration.test.ts` | Checks legal-hold/retention/compliance flows work end-to-end. |
| `cron-digest.test.ts` | Checks scheduled digest jobs trigger and queue messages correctly. |
| `cross-tenant-idor.test.ts` | Verifies one company cannot read/update another company data (anti-IDOR). |
| `emergency-contacts.integration.test.ts` | Ensures emergency contacts/procedures save and load correctly per site/company. |
| `export-guardrails.integration.test.ts` | Verifies export limits/quotas are enforced. |
| `export-job.idempotency.integration.test.ts` | Ensures same export job is not processed twice. |
| `export-job.integration.test.ts` | Validates export worker creates expected files and data. |
| `export-job.s3.integration.test.ts` | Confirms export output writes correctly to S3 path (mocked transport). |
| `export.integration.test.ts` | End-to-end export data correctness checks (including phone normalization). |
| `hazard-register.integration.test.ts` | Checks hazard create/list/close lifecycle with tenant isolation. |
| `health-ready-hardening.integration.test.ts` | Verifies health/readiness behavior under hardened conditions. |
| `incident-reports.integration.test.ts` | Checks incident create/list/resolve behavior with tenant scope. |
| `legal-consent-signature.integration.test.ts` | Validates legal consent versioning + signature evidence storage. |
| `rbac-matrix.test.ts` | Verifies role permissions matrix works as expected. |
| `risk-passport.integration.test.ts` | Ensures risk scoring/passport reflects incidents/quiz outcomes. |
| `token-replay.test.ts` | Prevents sign-out/replay token misuse. |
| `webhook.test.ts` | Validates webhook processing path behavior. |

## Playwright e2e specs: each file and purpose (plain language)

| Spec file | Purpose in normal language |
| --- | --- |
| `a11y.spec.ts` | Basic accessibility checks on key pages. |
| `admin-auth.spec.ts` | Admin login/logout/session/rate-limit behavior. |
| `admin-emergency-contacts.spec.ts` | Admin can manage emergency contacts and procedures. |
| `admin-hazards.spec.ts` | Admin hazard register workflow. |
| `admin-management.spec.ts` | Admin user/contractor lifecycle management. |
| `admin-settings.spec.ts` | Admin settings save and legal-hold behavior. |
| `command-mode.spec.ts` | Command mode dashboard renders and behaves correctly. |
| `csrf-security.spec.ts` | CSRF and security header protections are enforced. |
| `escalation-approval.spec.ts` | Red-flag escalation approve/deny workflow end-to-end. |
| `export.spec.ts` | Export UI + processing workflow checks. |
| `gap-matrix-coverage.spec.ts` | Explicitly covers remaining UI/API route inventory samples. |
| `kiosk-mode.spec.ts` | Kiosk success-screen auto-refresh behavior. |
| `link-integrity.spec.ts` | Finds broken internal links/navigation paths. |
| `logic-flow.spec.ts` | Induction skip-logic correctness. |
| `public-signin.spec.ts` | Main public sign-in/sign-out/induction flows and edge cases. |
| `security-gate.spec.ts` | Test-only route security gate behavior. |
| `seo.spec.ts` | `robots.txt` and `sitemap.xml` availability/validity. |
| `visual-regression.spec.ts` | UI visual snapshot comparisons (pixel-diff lane). |
| `visual-regression.vrt.spec.ts` | VRT upload/example lane for screenshot artifacts. |

## Unit coverage inventory (plain-language summary)

Direct test mapping (`docs/TEST_GAP_MATRIX.json`) currently shows:

- `P0`: `141` high-risk files covered (API contracts, server actions, repositories, auth/db critical paths).
- `P1`: `213` important app/lib files covered.
- `P2`: `20` lower-risk/support files covered.

Risk buckets covered:

- Application logic: `234`
- Mutating server actions: `36`
- Public/API contracts: `46`
- Auth/security flow: `10`
- Data layer infrastructure: `6`
- Tenant-scoped data access: `42`

For exact file-by-file mapping, use `docs/TEST_GAP_MATRIX.json` (it lists each source file and its direct test file).

## Practical release interpretation

For day-to-day release confidence:
- `npm run test:confidence` is the recommended gate (includes all required layers + non-visual e2e).

For maximal browser/device confidence:
- `npm run test:confidence:full` (non-visual all projects).

For pixel-perfect UI baseline checks:
- `npm run test:confidence -- --with-visual` (separate because this is intentionally strict and baseline-sensitive).
