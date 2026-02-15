# FINAL PRE-FLIGHT AUDIT (Scorched Earth)

Audit date: 2026-02-15
Scope audited: `apps/web/src/app`, `apps/web/src/lib`, `.env*`, `apps/web/prisma/schema.prisma`, `apps/web/src/lib/db`, `apps/web/src/lib/auth`, `apps/web/src/lib/rate-limit`, `apps/web/src/lib/maintenance`, `apps/web/Dockerfile`, root `package.json`, `apps/web/package.json`, `.github/workflows/*`.

## Executive Summary
YES

The previous production test-route exposure blocker is now remediated. Current audited state is go-live capable, with one non-blocking optimization still recommended (public sign-in idempotency).

## The Blocker List (Severity: Critical)

1. None identified in the audited scope.

## The Optimization List (Severity: Medium)

1. Public sign-in duplicate-submit race still has no explicit idempotency key
- Evidence: `apps/web/src/app/s/[slug]/actions.ts:313` calls `createPublicSignIn` directly for each valid submission.
- Evidence: `apps/web/src/lib/repository/public-signin.repository.ts:124` always creates a new `SignInRecord`.
- Evidence: `apps/web/prisma/schema.prisma:186` has no unique idempotency/request key on `SignInRecord`.
- Impact: double-click/retry windows can create duplicate sign-ins.

## The Nitpick List (Severity: Low)

1. Test-route diagnostics are now opt-in (improved)
- Evidence: `apps/web/src/app/api/test/create-session/route.ts:6` and `apps/web/src/app/api/test/create-user/route.ts:9` require `E2E_DEBUG_TEST_ROUTES=1` before logging.

2. Unsafe raw SQL usage in audited test routes was removed (improved)
- Evidence: `apps/web/src/app/api/test/lookup/route.ts:40` now uses typed `$queryRaw` template form; no `$queryRawUnsafe` matches remain in audited test/lib scope.

3. No heavy client-library bloat found in client components
- Scan result: no `moment`/`lodash`/`dayjs` imports detected under `apps/web/src` client paths.

4. No `dangerouslySetInnerHTML` usage found
- Scan result: no direct `dangerouslySetInnerHTML` matches under `apps/web/src`.

## Phase-by-Phase Notes

- Phase 1 (Hygiene): `localhost`/`http://` references remain mostly in env examples/tests plus controlled dev defaults (`apps/web/src/lib/auth/csrf.ts:44`). No hardcoded live API keys found in TS/TSX runtime files. `.env` remains untracked.
- Phase 2 (Performance): site list over-fetch remediation is in place via explicit projections (`apps/web/src/lib/repository/site.repository.ts:190`, `apps/web/src/lib/repository/site.repository.ts:239`). Retention cleanup now uses bounded concurrency (`apps/web/src/lib/maintenance/retention.ts:11`, `apps/web/src/lib/maintenance/retention.ts:59`).
- Phase 3 (Security): production access to test routes is now denied by default (`apps/web/src/app/api/test/_guard.ts:21`) with route-level defense-in-depth in sensitive endpoints (`apps/web/src/app/api/test/create-session/route.ts:33`, `apps/web/src/app/api/test/create-user/route.ts:32`).
- Phase 4 (Logic): timezone boundary handling remains consistent UTC in audited history flows. Remaining logic optimization is duplicate-submit idempotency for public sign-in.
- Phase 5 (Legal): consent capture remains implemented end-to-end (schema + validation + persistence), and retention cron remains implemented.
- Phase 6 (Infrastructure): local build now enforces lint/typecheck before build (`package.json:6`). CI E2E now starts via dev server (`.github/workflows/ci.yml:236`), avoiding production-mode test-route conflicts.
