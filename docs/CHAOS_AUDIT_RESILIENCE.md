# CHAOS AUDIT: RESILIENCE UNDER FAILURE & ATTACK

## 1) Fragility Scorecard (0-10)
- **Resilience:** 5.9/10
- **Data Integrity:** 6.1/10
- **Observability:** 6.4/10
- **Abuse Resistance:** 6.0/10

## 2) The "What If?" Logic Torture (Silent Killers)

### A. The "Race" Trap

1. **Export quota race can over-enqueue jobs under concurrent clicks**
- Evidence: quota checks and job create are split across separate calls (`apps/web/src/app/admin/exports/actions.ts:67`, `apps/web/src/app/admin/exports/actions.ts:83`).
- Failure mode: Two admins click export at the same millisecond. Both pass `countExportJobsSince`/`countRunningExportJobs`, both enqueue, exceeding per-company day/concurrency policy.
- Impact: quota bypass, queue pressure, unpredictable backlog.

2. **Global export concurrency check is non-atomic with claim**
- Evidence: global running count then separate `findFirst` then separate `updateMany` claim (`apps/web/src/lib/repository/export.repository.ts:165`, `apps/web/src/lib/repository/export.repository.ts:170`, `apps/web/src/lib/repository/export.repository.ts:181`).
- Failure mode: Multiple workers can all see `running < limit` and each claim one job. The per-job claim is safe, but the *global cap* can still be exceeded transiently.
- Impact: resource spikes and SLO violations exactly during high queue contention.

3. **Template version creation is read-then-write outside lock**
- Evidence: reads latest version then computes `newVersion` then creates row (`apps/web/src/lib/repository/template.repository.ts:728`, `apps/web/src/lib/repository/template.repository.ts:738`, `apps/web/src/lib/repository/template.repository.ts:744`).
- Failure mode: Two version requests can compute same `newVersion`; one fails at unique constraint.
- Impact: user-visible flake/error storms during coordinated edits.

4. **Question append order can duplicate under concurrency**
- Evidence: read max `display_order` then create with `max + 1` (`apps/web/src/lib/repository/question.repository.ts:208`, `apps/web/src/lib/repository/question.repository.ts:213`, `apps/web/src/lib/repository/question.repository.ts:217`).
- Failure mode: parallel creates pick same next order.
- Impact: unstable ordering and UI inconsistencies.

5. **Magic-link token consume is TOCTOU (double-consume window)**
- Evidence: `findFirst(used_at: null)` then separate `updateMany` without `used_at: null` guard (`apps/web/src/lib/repository/magic-link.repository.ts:69`, `apps/web/src/lib/repository/magic-link.repository.ts:88`).
- Failure mode: two requests with same token can both pass read and both mint sessions.
- Impact: replay window for token reuse.

### B. The "Zombie" State

1. **Admin sessions do not re-check user active/lock state after login**
- Evidence: session read path trusts cookie payload and inactivity only (`apps/web/src/lib/auth/session.ts:40`, `apps/web/src/lib/auth/session.ts:68`, `apps/web/src/lib/auth/session.ts:83`); guards use session user directly (`apps/web/src/lib/auth/guards.ts:73`).
- Failure mode: User is deactivated (`is_active=false`) or locked in DB, but existing cookie remains valid until inactivity timeout.
- Impact: disabled users can keep mutating tenant data.

2. **Contractor portal session ignores contractor active status**
- Evidence: contractor session only verifies HMAC + expiry (`apps/web/src/lib/auth/contractor-session.ts:97`); portal fetch does not require `is_active: true` (`apps/web/src/app/contractor/portal/page.tsx:22`, `apps/web/src/lib/repository/contractor.repository.ts:144`).
- Failure mode: Contractor is deactivated, but old magic-cookie still grants portal access for TTL.
- Impact: zombie contractor access.

### C. The "Swallowed" Error

1. **Magic-link request always returns success even on downstream failures**
- Evidence: catch only logs and still returns generic success (`apps/web/src/app/(auth)/contractor/actions.ts:99`, `apps/web/src/app/(auth)/contractor/actions.ts:104`).
- Failure mode: email provider outage, DB timeout, or token write failure appears successful to caller.
- Impact: silent user-facing failure; support cannot distinguish abuse vs outage quickly.

2. **Weekly digest route leaks internal error strings to caller**
- Evidence: returns raw error message in JSON (`apps/web/src/app/api/cron/digest/route.ts:16`, `apps/web/src/app/api/cron/digest/route.ts:18`).
- Failure mode: DB/provider internals bubble to API client.
- Impact: information leakage and noisy attacker feedback.

3. **Critical background jobs swallow top-level failures and keep running**
- Evidence: email worker catches all and only logs (`apps/web/src/lib/email/worker.ts:195`, `apps/web/src/lib/email/worker.ts:315`); maintenance loops continue per-item with warnings (`apps/web/src/lib/maintenance/retention.ts:28`, `apps/web/src/lib/maintenance/retention.ts:47`).
- Failure mode: persistent partial-failure state (poisoned records / repeated retries) without hard fail/alerting surface.
- Impact: "green" cron invocation with degraded business outcomes.

### D. The "API Bypass" (Validation vs DB/Storage)

1. **Schema-level hard length caps are mostly absent in Prisma**
- Evidence: major string fields are unconstrained `String` (`apps/web/prisma/schema.prisma:190`, `apps/web/prisma/schema.prisma:280`, `apps/web/prisma/schema.prisma:338`, `apps/web/prisma/schema.prisma:420`).
- Failure mode: if any non-UI/client path bypasses Zod, oversized payloads can be persisted and later crash/slow render paths.
- Impact: memory amplification and rendering instability.

2. **Public sign-in answers accept unbounded JSON payloads**
- Evidence: schema uses `z.unknown()` for `answer` and no payload-size guard (`apps/web/src/lib/validation/schemas.ts:56`); repository accepts and stores JSON (`apps/web/src/lib/repository/public-signin.repository.ts:181`); DB column is unconstrained JSON (`apps/web/prisma/schema.prisma:232`).
- Failure mode: very large nested `answers` body drives DB bloat and high CPU during serialization/render.
- Impact: DoS-by-payload and storage blow-up.

3. **Upload commit trusts caller-supplied storage key in local mode**
- Evidence: commit accepts arbitrary `key` (`apps/web/src/app/api/storage/contractor-documents/commit/route.ts:20`), opens it directly on disk (`apps/web/src/app/api/storage/contractor-documents/commit/route.ts:35`), persists it as `file_path` (`apps/web/src/app/api/storage/contractor-documents/commit/route.ts:125`), and download route reads that path (`apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts:44`).
- Failure mode: attacker with contractor-manage can register server-local paths as documents and download file contents in local storage deployments.
- Impact: arbitrary local file read by privileged insider/account takeover.

4. **Origin checks were brittle in some API routes (remediated)**
- Evidence (historical): routes previously used header substring checks instead of shared CSRF validation.
- Current state: storage presign/commit and logout now use shared `assertOrigin()` defense (`apps/web/src/app/api/storage/contractor-documents/presign/route.ts`, `apps/web/src/app/api/storage/contractor-documents/commit/route.ts`, `apps/web/src/app/api/auth/logout/route.ts`).
- Residual risk: other mutating routes should continue to standardize on `assertOrigin()` where browser-originated.

## 3) Silent Killers List (with concrete hotspots)

### Missing transaction / atomicity risks
- Export enqueue quota check then create: `apps/web/src/app/admin/exports/actions.ts:67` and `apps/web/src/app/admin/exports/actions.ts:83`.
- Global claim cap non-atomic: `apps/web/src/lib/repository/export.repository.ts:165` to `apps/web/src/lib/repository/export.repository.ts:181`.
- Magic-link consume read-then-write: `apps/web/src/lib/repository/magic-link.repository.ts:69` to `apps/web/src/lib/repository/magic-link.repository.ts:90`.
- Question append ordering race: `apps/web/src/lib/repository/question.repository.ts:208` to `apps/web/src/lib/repository/question.repository.ts:224`.
- Template new-version race: `apps/web/src/lib/repository/template.repository.ts:728` to `apps/web/src/lib/repository/template.repository.ts:750`.

### Vague/unsafe error handling
- Generic unexpected error to client (loss of actionable class): `apps/web/src/app/(auth)/actions.ts:126`, `apps/web/src/app/admin/sites/actions.ts:175`, `apps/web/src/app/admin/templates/actions.ts:240`.
- Silent success on failure for contractor magic-link request: `apps/web/src/app/(auth)/contractor/actions.ts:99` and `apps/web/src/app/(auth)/contractor/actions.ts:104`.
- Internal error message leaked by digest cron API: `apps/web/src/app/api/cron/digest/route.ts:18`.

### Missing hard limits / unbounded reads
- Live register loads all currently on-site records without cap/pagination: `apps/web/src/lib/repository/signin.repository.ts:132`, consumed directly in UI at `apps/web/src/app/admin/live-register/page.tsx:40`.
- Weekly digest aggregates across all companies and pulls matching documents unbounded: `apps/web/src/lib/email/worker.ts:208`, `apps/web/src/lib/email/worker.ts:243`.
- Red-flag scanner reads all 24h responses without explicit cap: `apps/web/src/lib/email/worker.ts:16`.
- Sitemap loads all active public links in one response: `apps/web/src/app/sitemap.xml/route.ts:13`.

## 4) Operational Maturity Check

1. **Do cron paths risk serverless timeout cutoffs?**
- Yes. Retention and digest work can become long-running fan-outs (`apps/web/src/lib/maintenance/retention.ts:27`, `apps/web/src/lib/email/worker.ts:274`) and there is no chunk checkpointing/continuation token.
- Export/maintenance are triggered by HTTP cron endpoints (`apps/web/src/app/api/cron/export-scheduler/route.ts:15`, `apps/web/src/app/api/cron/maintenance/route.ts:15`), so platform request timeout can interrupt jobs mid-run.

2. **Region/time hardcoding risk?**
- Mixed posture. Some logic is timezone-aware elsewhere, but several operational windows use `Date.now()` directly (digest windows, retention) and inherit server timezone semantics for formatting/report edges (`apps/web/src/lib/email/worker.ts:219`, `apps/web/src/lib/maintenance/retention.ts:21`).
- Not an immediate exploit, but a source of off-by-one operational bugs around DST/cutover.

3. **Optimistic UI without rollback?**
- Mostly server-action driven with page revalidation (safe baseline), but there are mutation paths where failure is flattened to generic messages and UI cannot distinguish race conflict vs infrastructure outage (`apps/web/src/app/admin/templates/actions.ts:386`, `apps/web/src/app/admin/sites/actions.ts:260`).
- This is less data corruption risk, more operator diagnosis and user confusion risk.

## 5) Required Fixes for 100% Uptime

| Issue | Attack Vector | Fix |
|---|---|---|
| Export enqueue race bypasses quotas | Two admins enqueue simultaneously -> daily/concurrency caps exceeded | Move quota check + enqueue into one DB transaction; enforce via per-company counter row or advisory lock surrogate table with `updateMany` guard. |
| Global export cap is non-atomic | Multiple workers pass global count gate simultaneously | Replace count+claim split with atomic claim gate (single statement via queue table semantics or lease row); if raw SQL remains banned, use dedicated lock table + `create`/unique token. |
| Magic-link double-consume window | Same token replayed concurrently -> multiple valid sessions | Consume with atomic `updateMany` including `used_at: null` + `expires_at > now`, then fetch row if `count===1`; do not return token payload from pre-update read. |
| Zombie admin sessions | User deactivated/locked but existing cookie still works | On each privileged guard, re-check DB `is_active`/`locked_until`; destroy session if invalid. Cache short-term (e.g. 30-60s) to control DB load. |
| Zombie contractor sessions | Deactivated contractor keeps portal access until cookie expiry | Enforce `is_active=true` and optional revocation timestamp check in portal auth path before data access. |
| Local storage path injection in upload commit | Privileged attacker sets `key` to arbitrary file path -> download exfiltration | Validate key prefix and structure (`contractors/{company}/{contractor}/{docId}-...`) on commit; resolve and enforce path under dedicated storage root; reject absolute/parent traversal. |
| Weak origin checks on mutating API routes | Crafted Origin/Host edge cases bypass substring check | Implemented for storage presign/commit + logout via `await assertOrigin()`; continue rollout to any future browser-originated mutating routes. |
| Unbounded live-register and digest scans | Large tenant/event volume -> memory spikes and slow responses | Add pagination/chunking (`take` + cursor) and streaming/iterative processing; persist checkpoints for cron resumability. |
| Public sign-in answers can be huge JSON | Payload amplification DoS and storage bloat | Add max request body size + max answers count + per-answer size/depth checks before DB write; enforce DB-side `CHECK` where possible. |
| High-noise generic error paths | Ops cannot distinguish transient DB timeout from validation issue | Add structured error classes and stable error codes in action responses/logs; include retryability metadata for UI and alert routing. |

## 6) Bottom Line
- Current design is **feature-complete but not chaos-hardened**.
- Primary failure classes under real load are: **non-atomic concurrency controls**, **zombie auth state**, **unbounded batch reads**, and **storage key trust assumptions**.
- Fixing the table above will materially improve survival under slow DB, retry storms, and malicious traffic.
