# GOLD STANDARD AUDIT (Black Box Reverse Engineering)

#### 1. Executive Scorecard
- **Security Posture:** 7.1/10
- **CI/CD Maturity:** 7.8/10
- **Unit Testing:** 7.4/10
- **Integration Testing:** 8.1/10
- **E2E Testing:** 6.9/10
- **UI/UX & Accessibility:** 6.6/10
- **Visual Regression:** 7.2/10 (Benchmark >= 6.5/10: **Pass**)

#### 2. Critical Issues & "Red Flags" (The "Kill List")

**Reverse-engineered ground truth map**
- **Data flow (public):** `/s/[slug]` page -> `getSiteForSignIn` -> `findSiteByPublicSlug` + `getActiveTemplateForSite` -> `submitSignIn` -> `createPublicSignIn` writes `SignInRecord` + `InductionResponse` -> audit log write (`visitor.sign_in`) (`apps/web/src/app/s/[slug]/page.tsx:44`, `apps/web/src/app/s/[slug]/actions.ts:125`, `apps/web/src/lib/repository/site.repository.ts:110`, `apps/web/src/lib/repository/template.repository.ts:327`, `apps/web/src/lib/repository/public-signin.repository.ts:62`).
- **Data flow (admin auth):** login action -> `session.login()` -> `publicDb.user.findFirst` bootstrap + scoped writes + session cookie + audit logs (`apps/web/src/app/(auth)/actions.ts:55`, `apps/web/src/lib/auth/session.ts:99`).
- **RBAC:** permission matrix in `guards.ts`; enforced at page/action/route boundaries with `checkPermission*` and `checkSitePermission*` (`apps/web/src/lib/auth/guards.ts:28`, `apps/web/src/lib/auth/guards.ts:112`).
- **Infrastructure discovered in code:** Postgres/Neon (`NEON_POOLER_URL`) (`apps/web/src/lib/env-validation.ts:32`), Upstash Redis (`apps/web/src/lib/rate-limit/client.ts:24`), R2/S3 (`apps/web/src/lib/storage/s3.ts:5`), Resend (`apps/web/src/lib/email/resend.ts:1`).
- **Safety nets:** CI + integration + E2E + nightly + CodeQL are present (`.github/workflows/ci.yml`, `.github/workflows/nightly.yml`, `.github/workflows/codeql.yml`).

**Security red flags (launch blockers)**
- **Test session minting endpoint can be enabled outside `NODE_ENV=test`.** `create-session` accepts header override (`x-allow-test-runner`) and `ALLOW_TEST_RUNNER=1`; it can seal and set auth cookies (`apps/web/src/app/api/test/create-session/route.ts:28`, `apps/web/src/app/api/test/create-session/route.ts:44`, `apps/web/src/app/api/test/create-session/route.ts:221`, `apps/web/src/app/api/test/create-session/route.ts:246`).
- **Test user bootstrap endpoint also opens outside test mode when `ALLOW_TEST_RUNNER=1`.** (`apps/web/src/app/api/test/create-user/route.ts:15`).
- **Mutating API routes do not enforce `assertOrigin()` CSRF check.** Current protection is auth/permission only (`apps/web/src/app/api/storage/contractor-documents/presign/route.ts:19`, `apps/web/src/app/api/storage/contractor-documents/commit/route.ts:24`, `apps/web/src/app/api/auth/logout/route.ts:8`).
- **File upload pipeline validates MIME/size but not server-side magic bytes on commit path.** `validateFileMagicNumber` exists but is not used in presign/commit routes (`apps/web/src/lib/storage/validation.ts:30`, `apps/web/src/app/api/storage/contractor-documents/commit/route.ts:50`).
- **Contractor magic-link request path has no rate limiting / abuse throttle.** Can be used for high-volume mail abuse/enumeration attempts despite generic response messaging (`apps/web/src/app/(auth)/contractor/actions.ts:26`, `apps/web/src/app/(auth)/contractor/actions.ts:78`).
- **Cron auth posture is inconsistent.** `export-scheduler` uses secret + IP policy (`requireCronSecret`), but `digest` only checks bearer secret (`apps/web/src/app/api/cron/export-scheduler/route.ts:9`, `apps/web/src/lib/cron.ts:112`, `apps/web/src/app/api/cron/digest/route.ts:12`).

**Performance / reliability red flags**
- **Hot public path still does uncached DB lookups per request.** `getSiteForSignIn` is called in metadata + render path, with only rate-limit skip in metadata and no result caching layer (`apps/web/src/app/s/[slug]/page.tsx:26`, `apps/web/src/app/s/[slug]/page.tsx:44`, `apps/web/src/app/s/[slug]/actions.ts:125`).
- **Retention job performs per-company serial fan-out loops across multiple domains.** Works now, but this is an O(tenants x resources) maintenance pattern (`apps/web/src/lib/maintenance/retention.ts:21`).
- **`pg-boss` is installed but not used for durable queue semantics in app code; scheduler runs in-process interval.** Higher operational risk for missed jobs under restarts (`apps/web/package.json:61`, `apps/web/src/lib/export/scheduler.ts:10`).

**Architecture red flags**
- **E2E harness contains a very large “god fixture” with runtime DB/schema orchestration and process management, increasing flake/maintenance cost.** (`apps/web/e2e/test-fixtures.ts`).
- **At least one E2E spec is placeholder-level and does not validate real business behavior.** (`apps/web/e2e/logic-flow.spec.ts:5`).

#### 3. Gap Analysis to Reach "10/10"

**A. Security Posture (Target: 10/10)**
- **CSP:** implemented with nonce middleware (`apps/web/src/proxy.ts:158`), but middleware intentionally skips `/api/*` (`apps/web/src/proxy.ts:132`). Missing unified security header policy for API responses.
- **Centralized audit logging for all writes:** partially strong (many server actions log), but not centralized or enforced at one mutation boundary; write operations still depend on caller discipline.
- **Magic-bytes validation:** helper exists, not enforced in presign/commit routes. Missing guaranteed file-content validation before persistence.
- Missing global abuse controls on public/magic-link flows (rate limit + per-identity quota + challenge).
- Test-only routes still have production-adjacent footguns via permissive non-test runtime toggles.

**B. CI/CD Maturity (Target: 10/10)**
- **Preview environments on PRs:** not found in workflows.
- **Nightly build:** present and reasonably comprehensive (`.github/workflows/nightly.yml`).
- **Coverage quality gate:** coverage is collected and uploaded, but pipeline does not fail on threshold drop (no coverage threshold enforcement in Vitest config).
- Missing signed artifact/release provenance flow and explicit deployment promotion gates.

**C. Testing Strategy (Target: 10/10)**
- **Unit tests:** good breadth in repositories/auth/rate-limit; business logic (`evaluator.ts`) is covered.
- **Integration tests:** strong Testcontainers posture + explicit cross-tenant IDOR matrix (`apps/web/tests/integration/cross-tenant-idor.test.ts`).
- **E2E unhappy paths:** partial only; many scenarios are skipped or environment-dependent (`apps/web/e2e/public-signin.spec.ts:160` etc.), and there is no meaningful offline/network-failure workflow validation.
- Missing deterministic failure-injection strategy and contract tests for external services (Resend/R2/Upstash).

**D. UI/UX + Accessibility (Target: 10/10)**
- Keyboard/focus and labels are generally better than average (forms mostly labeled; skip link present on public page).
- A11y E2E exists but only covers limited routes (`apps/web/e2e/a11y.spec.ts`).
- No observable skeleton-loading pattern in app routes/components (search did not find `loading.tsx`/Skeleton usage).
- Missing enforced accessibility budget (axe thresholds per page family in CI) and keyboard-only journey coverage for key admin workflows.

**E. Visual Regression Testing (Benchmark: 6.5/10 -> 10/10)**
- Current suite is above baseline: includes desktop + mobile projects and mixes region-based captures with full-page snapshots (`apps/web/playwright.config.ts:71`, `apps/web/e2e/visual-regression.spec.ts`).
- Still fragile: multiple conditional skips and broad diff tolerances; several full-page shots remain inherently flaky.
- Missing component-level deterministic baselines for high-volatility UI areas and stronger anti-flake budget per browser.

## Next Steps
| Issue | Severity | Suggested Fix |
|---|---|---|
| Test session/user endpoints can run outside strict test runtime | Critical | Require both `NODE_ENV === "test"` and signed internal test secret; remove header override path; disable route registration outside test builds. |
| Missing CSRF origin enforcement on mutating API routes | Critical | Add `await assertOrigin()` (or shared API mutation guard) to all state-changing route handlers. |
| Upload commit path lacks magic-bytes validation | High | On `commit`, fetch first bytes from uploaded object and enforce `validateFileMagicNumber` before DB write/audit success. |
| Contractor magic-link request has no abuse throttle | High | Add per-IP + per-email + per-site rate limits and daily outbound mail quotas; optionally CAPTCHA for repeated failures. |
| Cron digest route weaker than other cron endpoints | High | Replace bearer-only check with `requireCronSecret` (secret + IP allowlist + proxy trust policy). |
| Uncached public sign-in read path | Medium | Add bounded caching (`unstable_cache`) for site/template reads with explicit invalidation on site/template updates. |
| E2E reliability debt (skips/placeholders) | Medium | Replace placeholder logic test with true scenario; convert skip-heavy tests into deterministic seeded fixtures and failure-injection tests. |
| No coverage drop gate in CI | Medium | Add Vitest thresholds and fail CI when project or changed-file coverage drops below floor. |
| No PR preview environments | Medium | Add ephemeral preview deploy workflow with smoke/a11y checks before merge. |
| No centralized write-audit enforcement | Medium | Introduce a write service boundary or wrapper that requires audit event metadata for every mutation. |
