# FINAL PRE-FLIGHT AUDIT (Scorched Earth)

## Remediation Status (2026-02-12)
- Phase 1 kill switch applied: all handlers in `apps/web/src/app/api/test/**` now hard-return `404` in production.
- `create-session` production guard is the first handler statement (`apps/web/src/app/api/test/create-session/route.ts:23`).
- `create-user` production guard runs before any test diagnostic/raw SQL path.
- Consent tracking fields added to `SignInRecord`:
  - `hasAcceptedTerms Boolean @default(false)`
  - `termsAcceptedAt DateTime?`
- Migration applied: `apps/web/prisma/migrations/20260212112811_add_legal_consent_tracking/migration.sql`.
- Type safety verified after migration with `npm run typecheck` (passing).
- Medium/Low remediation pass complete:
  - Export queue fan-out removed in `apps/web/src/lib/repository/export.repository.ts` (global count/claim/requeue now batched).
  - Email worker N+1 removed and over-fetch reduced in `apps/web/src/lib/email/worker.ts` (idempotency logs prefetched; minimal selects; weekly digest counts batched).
  - UTC range handling standardized in `apps/web/src/lib/repository/dashboard.repository.ts` and `apps/web/src/app/admin/history/actions.ts`.
  - NZ display timezone standardized in `apps/web/src/app/admin/sites/[id]/page.tsx` (`Pacific/Auckland`).
  - Localhost fallbacks removed with strict `NEXT_PUBLIC_APP_URL` enforcement in:
    - `apps/web/src/lib/url/public-url.ts`
    - `apps/web/src/app/admin/sites/[id]/page.tsx`
    - `apps/web/src/app/(auth)/contractor/actions.ts`
  - Privacy safeguard directive added for induction answer payloads:
    - `apps/web/prisma/schema.prisma` (`/// @Encrypted: Do not store PII here without encryption.`)

## Executive Summary
**NO-GO (NO).**  
The app is **not** production-ready in its current state due to critical security/legal blockers.

## The "Blocker" List (Severity: Critical)
1. **Auth bypass path via test endpoint header override**
   - `apps/web/src/app/api/test/create-session/route.ts:24` reads `x-allow-test-runner`.
   - `apps/web/src/app/api/test/create-session/route.ts:38` allows access when header is `"1"` even if not test mode.
   - Same route can mint session cookies (`sealData`) and set them (`Set-Cookie`) at `apps/web/src/app/api/test/create-session/route.ts:217`, `apps/web/src/app/api/test/create-session/route.ts:242`.
   - Impact: session forgery risk if this endpoint is reachable in non-test deployments.

2. **Production-footgun test APIs can create users/sessions**
   - `apps/web/src/app/api/test/create-user/route.ts:11` allows execution when `ALLOW_TEST_RUNNER="1"` outside test NODE_ENV.
   - User creation occurs at `apps/web/src/app/api/test/create-user/route.ts:122`, `apps/web/src/app/api/test/create-user/route.ts:135`, `apps/web/src/app/api/test/create-user/route.ts:151`.
   - Impact: if env is mis-set, an attacker can bootstrap identities and combine with test-session endpoint behavior.

3. **Raw SQL usage in app route (policy violation)**
   - `apps/web/src/app/api/test/create-user/route.ts:41` uses `$queryRawUnsafe`.
   - Guardrail mismatch with repo policy that forbids raw SQL primitives.

4. **Missing explicit terms-consent persistence (legal requirement gap)**
   - No `hasAcceptedTerms` (or equivalent) + timestamp field found in schema.
   - `apps/web/prisma/schema.prisma` contains sign-in PII fields (`visitor_phone`, `visitor_email`) but no acceptance tracking (`apps/web/prisma/schema.prisma:191`, `apps/web/prisma/schema.prisma:192`).
   - Impact: consent/auditability gap for GDPR/privacy compliance posture.

## The "Optimization" List (Severity: Medium)
1. **N+1 / per-tenant fan-out query patterns in export scheduler**
   - `apps/web/src/lib/repository/export.repository.ts:75`, `apps/web/src/lib/repository/export.repository.ts:185`, `apps/web/src/lib/repository/export.repository.ts:232`.
   - Pattern: enumerate all companies then query each one separately.
   - Impact: scales poorly with tenant count and raises DB cost/latency.

2. **N+1 and over-fetching in email worker**
   - Over-fetch: `user: true` at `apps/web/src/lib/email/worker.ts:30` (pulls full user rows, including fields not needed for sending email).
   - N+1 checks: `findFirst` per response at `apps/web/src/lib/email/worker.ts:84`.
   - Per-company looped counts at `apps/web/src/lib/email/worker.ts:206`, `apps/web/src/lib/email/worker.ts:211`, `apps/web/src/lib/email/worker.ts:217`, `apps/web/src/lib/email/worker.ts:224`.

3. **Timezone-sensitive day boundaries likely incorrect for NZ/AU expectations**
   - Local-server midnight used: `apps/web/src/lib/repository/dashboard.repository.ts:35`.
   - UTC hard-suffix date filter used: `apps/web/src/app/admin/history/actions.ts:65`.
   - Mixed locale/timezone rendering defaults (`toLocaleString()` without explicit timezone) at `apps/web/src/app/admin/sites/[id]/page.tsx:207`, `apps/web/src/app/admin/sites/[id]/page.tsx:211`.
   - Impact: day-based metrics and UI timestamps can drift by timezone/hosting region.

4. **CSRF defense-in-depth missing on mutating API routes**
   - Mutating API routes rely on auth checks but do not enforce `assertOrigin()`/origin validation:
   - `apps/web/src/app/api/storage/contractor-documents/presign/route.ts:18`
   - `apps/web/src/app/api/storage/contractor-documents/commit/route.ts:23`
   - `apps/web/src/app/api/auth/logout/route.ts:8`
   - Auth check implementation (`checkPermission`) has no origin check: `apps/web/src/lib/auth/guards.ts:112`.

5. **Localhost fallback URLs can leak into runtime behavior if env is misconfigured**
   - `apps/web/src/lib/url/public-url.ts:19` fallback to `http://localhost:3000`.
   - `apps/web/src/app/admin/sites/[id]/page.tsx:87` uses `NEXT_PUBLIC_BASE_URL || "http://localhost:3000"`.
   - `apps/web/src/app/(auth)/contractor/actions.ts:70` similar fallback for magic links.
   - Impact: broken production links and potential redirect confusion if base URL env is missing/invalid.

6. **Build safety split between scripts and CI**
   - Root build script is only `turbo run build` (`package.json:6`) and does not inherently force lint/typecheck in the same command.
   - CI does run lint/typecheck (`.github/workflows/ci.yml:90`, `.github/workflows/ci.yml:94`), but local `npm run build` alone is not a full quality gate.

7. **Dependency tree health issues**
   - `npm ls` reports invalid/extraneous package state in this workspace (`.tmp_npm_ls.json:3` through `.tmp_npm_ls.json:7`).
   - Impact: reproducibility risk and harder incident/debug response.

8. **Privacy risk: induction answers are stored as raw JSON**
   - `apps/web/prisma/schema.prisma:229` (`answers Json`).
   - If health/safety-sensitive responses are entered, they are stored unencrypted at-rest at app layer.

## The "Nitpick" List (Severity: Low)
1. **Likely zombie/unused repository function**
   - `apps/web/src/lib/repository/public-signin.repository.ts:391` (`findPublicSignInById`) appears only used by tests/re-export, not app runtime consumers.

2. **Test endpoints include verbose console diagnostics**
   - Example: `apps/web/src/app/api/test/create-user/route.ts:33`, `apps/web/src/app/api/test/create-user/route.ts:164`.
   - Low severity for prod only if test endpoints are fully excluded/locked down.

3. **No `dangerouslySetInnerHTML` found**
   - Positive hygiene check: no direct usage detected under `apps/web/src/app` and `apps/web/src/lib`.

## Phase-by-Phase Outcome Snapshot
- **Phase 1 (Hygiene):** local URL fallbacks and noisy test logging found; no hardcoded live secrets in app/lib runtime paths.
- **Phase 2 (Performance):** multiple fan-out/N+1 patterns found in export + email workers.
- **Phase 3 (Security):** critical test-endpoint auth bypass risk; CSRF defense-in-depth gaps on mutating API routes.
- **Phase 4 (Logic):** timezone/day-boundary drift risks; no clear catastrophic null-deref crash path found in core audited flows.
- **Phase 5 (Legal):** retention job exists (`apps/web/src/lib/maintenance/retention.ts:16`), but consent tracking field is missing; PII and induction answers are plain fields.
- **Phase 6 (Infrastructure):** Prisma singleton pattern is correct (`apps/web/src/lib/db/prisma.ts:17`, `apps/web/src/lib/db/prisma.ts:20`); build script alone is not a full lint/typecheck gate.
