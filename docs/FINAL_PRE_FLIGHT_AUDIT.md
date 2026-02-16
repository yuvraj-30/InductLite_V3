# FINAL PRE-FLIGHT AUDIT

Date: 2026-02-15  
Auditor Mode: Scorched Earth (Phases 1-6, rerun)

## Executive Summary
YES

Go / No-Go: GO

No open Critical blockers remain in the audited scope. The previously critical contractor-document cross-tenant key trust gap is remediated and covered by tests.

## The "Blocker" List (Severity: Critical)
1. None open in this rerun.
2. Critical resolved: contractor document key ownership is now enforced against authenticated tenant + contractor prefix.
Evidence:
`apps/web/src/lib/storage/keys.ts:29`  
`apps/web/src/app/api/storage/contractor-documents/commit/route.ts:80`  
`apps/web/src/lib/repository/contractor.repository.ts:548`  
`apps/web/src/app/api/storage/contractor-documents/route.test.ts` (cross-company and cross-contractor key rejections)  
`apps/web/tests/integration/cross-tenant-idor.test.ts` (29/29 passing)

## The "Optimization" List (Severity: Medium)
1. Encryption fallback still causes full-table decrypt scans for contractor contact filters.
Evidence:
`apps/web/src/lib/repository/contractor.repository.ts:225`  
`apps/web/src/lib/repository/contractor.repository.ts:226`  
`apps/web/src/lib/repository/contractor.repository.ts:271`  
`apps/web/src/lib/repository/contractor.repository.ts:351`
Impact:
O(n) decrypt/filter behavior for contact queries at tenant scale.

2. Timezone handling is still inconsistent across history and dashboard metrics.
Evidence:
`apps/web/src/app/admin/history/actions.ts:28`  
`apps/web/src/app/admin/history/actions.ts:66`  
`apps/web/src/lib/repository/dashboard.repository.ts:35`  
`apps/web/src/lib/repository/dashboard.repository.ts:60`
Impact:
Daily counts can diverge at day boundaries for non-NZ tenants/timezones.

3. Failed-login counters are still read-then-write and race-prone under concurrency.
Evidence:
`apps/web/src/lib/auth/session.ts:194`  
`apps/web/src/lib/auth/session.ts:198`  
`apps/web/src/lib/auth/session.ts:253`  
`apps/web/src/lib/auth/session.ts:256`
Impact:
Lockout counters can be under/over-counted during concurrent attempts.

4. Main PR CI workflow still does not run production build (nightly does).
Evidence:
`.github/workflows/ci.yml:150`  
`.github/workflows/ci.yml:153`  
`.github/workflows/ci.yml:156`  
`.github/workflows/nightly.yml:105`
Impact:
Build regressions can escape PR checks until nightly.

5. Email worker red-flag query still over-fetches template question payloads.
Evidence:
`apps/web/src/lib/email/worker.ts:53`
Impact:
Higher DB payload and memory churn than required for red-flag evaluation.

6. Deprecated transitive dependencies remain in lockfile metadata.
Evidence:
`package-lock.json:5000`  
`package-lock.json:5010`  
`package-lock.json:5021`  
`package-lock.json:11077`  
`package-lock.json:11426`
Impact:
Maintenance and security debt accumulation.

## The "Nitpick" List (Severity: Low)
1. Environment validation logs success on `console.error`.
Evidence:
`apps/web/src/lib/env-validation.ts:579`
Impact:
False-positive noise in production log streams.

2. Dev localhost/http defaults remain in example env templates (acceptable for local dev).
Evidence:
`.env.example:13`  
`.env.example:81`
Impact:
Low; mainly hygiene/documentation.

3. Test helper routes exist under `api/test/*` (guarded in production, but still broad in non-prod when `ALLOW_TEST_RUNNER=1`).
Evidence:
`apps/web/src/app/api/test/_guard.ts:21`
Impact:
Low production risk; maintain strict non-prod access controls.

## Phase-by-Phase Notes
1. Phase 1 (Hygiene): No production hardcoded secret literals found in `apps/web/src/app` + `apps/web/src/lib`; localhost/http references are primarily tests and env examples.
2. Phase 2 (Performance): No obvious `findMany`-inside-loop N+1 killer in hot paths; index coverage in `apps/web/prisma/schema.prisma` is generally strong; key remaining scale issue is encrypted-contact fallback scans and one over-fetch in email worker.
3. Phase 3 (Security): IDOR checks in audited download/commit paths enforce tenant scope; `dangerouslySetInnerHTML` not found; mutation server actions generally enforce `assertOrigin()` and auth/permission checks.
4. Phase 4 (Logic): Sign-in idempotency remains protected by `@@unique([company_id, idempotency_key])`; login lockout increment path is still non-atomic.
5. Phase 5 (Legal/Privacy): Retention jobs are implemented and cron-wired; consent is recorded (`hasAcceptedTerms`, `termsAcceptedAt`); sensitive fields rely on app-layer encryption with production env requirements.
6. Phase 6 (Infrastructure): Prisma client singleton pattern is correctly globalized for runtime reuse.
Evidence:
`apps/web/src/lib/db/prisma.ts:1`

## Verification Executed
1. `npm run -w apps/web test -- src/app/api/storage/contractor-documents/route.test.ts`  
Result: Passed (5/5).
2. `npm run -w apps/web test:integration -- tests/integration/cross-tenant-idor.test.ts`  
Result: Passed (29/29).
