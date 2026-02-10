# InductLite — Cost‑Conscious Product & Architecture Plan

_Status: This document summarizes the competitor feature map, costed architecture recommendations, budget compliance checks, guardrails and prioritized roadmap for InductLite. This aligns with the hard NZD monthly budgets and you selected: Option A (schema‑per‑worker for CI + runId namespacing)._ ✅

---

## 1) Competitor Feature Map (grounded) 📋

> Entries are drawn from competitor public pages you provided.

| Competitor   | Observed capability (public pages)              | MVP / Nice‑to‑Have / Avoid | Complexity | Cost impact | Recommendation                              |
| ------------ | ----------------------------------------------- | -------------------------: | ---------: | ----------: | ------------------------------------------- |
| SignOnSite   | QR/site sign‑in, induction templates, reporting |                        MVP |        Low |         Low | Adapt (UX patterns for QR/kiosk)            |
| SiteDocs     | Document library + compliance PDFs              |       Nice‑to‑Have (light) |        Med |      Medium | Adapt (limit storage/retention)             |
| HammerTech   | Site induction + audits + SSO integrations      |          Nice (enterprise) |       High |        High | Out of Scope (Cost) for MVP; consider later |
| SaferMe      | QR-enabled inductions + team check-ins          |                        MVP |        Low |         Low | Adopt (QR + lightweight team reports)       |
| Sitemate     | Mobile-focused site apps + forms                |                       Nice |        Med |      Medium | Adapt (PWA-lite, not native)                |
| EVA Check‑in | Visitor management, QR check-ins                |                        MVP |        Low |         Low | Adopt (visitor flows & tokenized sign-out)  |
| SiteConnect  | Visitor management + contractor tracking        |                 MVP / Nice |        Med |      Medium | Adapt (limited attendance exports)          |

> Note: I can produce a 1‑page UX mock of recommended QR & kiosk flows on request.

---

## 2) Costed Architecture Recommendations (practical, budget-aware) 🔧

**High‑level stack (keeps within bootstrapped budgets):**

- App: Next.js App Router + Server Actions (single app instance; minimal autoscale).
- DB: Single managed Postgres primary (single region). Use schema‑per‑worker for tests only.
- Queue: pg‑boss on the same Postgres instance.
- Storage: S3‑compatible (Backblaze B2 / DO Spaces for cost savings; fallback S3).
- Rate limiting: Postgres counters (MVP); add Redis/Upstash at Growth if needed.
- Background workers: small worker instances (Docker on Render / DO).
- Logging/audit: structured logs to files + periodic upload to S3 with short retention.

For each item: Why · Cost impact · Cheaper fallback

### DB schema / queries impact

- **What:** Single Postgres primary; enforce `company_id` on all queries; DB constraints and optional RLS for premium.
- **Why:** Low cost, strong app-layer control.
- **Cost impact:** Low.
- **Cheaper fallback:** N/A (required security invariant).

### Job queue / exports

- **What:** Use pg‑boss to stream CSV/PDF to S3 in chunks; cap concurrency; stream to S3 to avoid memory pressure.
- **Why:** No extra infra; keeps costs low.
- **Cost impact:** Low–Medium (CPU for exports).
- **Cheaper fallback:** Enforce per‑company export limits and off‑peak scheduling.

### Storage + retention defaults

- **What:** Default retention: files 90d, exports 30d; max upload 5MB.
- **Why:** Controls storage costs and risk.
- **Cost impact:** Low.
- **Cheaper fallback:** Make longer retention a paid feature.

### Logging + audit defaults

- **What:** Critical audit events in a DB (90d); app logs rotated and stored to S3 (30d); cheap aggregators optional.
- **Why:** Compliance and lightweight ops; no expensive SIEM.
- **Cost impact:** Low.
- **Cheaper fallback:** Shorter retention (e.g., 14d).

### Rate limiting approach

- **What:** Postgres sliding windows keyed by `runId`/`clientKey` and IP; optionally add Redis later.
- **Why:** Avoids extra service cost initially; still reliable.
- **Cost impact:** Low to start; Medium if Redis used.
- **Cheaper fallback:** Lower QPS and per‑company throttles.

### Tenant isolation enforcement mechanism

- **What:** Application-level mandatory `company_id` param, DB constraints, unique indices, optional RLS for strict auditing.
- **Why:** Security invariant; avoids per-tenant DBs.
- **Cost impact:** Low.
- **Cheaper fallback:** None — required.

---

## 3) Budget Compliance Check (numbers & mitigations) 💰

Assumptions: light usage; approximate pricing.

### A) MVP (0–10 companies, <2k sign-ins/month): target ≤ NZD 150/mo

- **Expected cost drivers:** Postgres (NZD 30–70), App+worker (NZD 40–80), Storage (NZD 0–5), Bandwidth (NZD 0–10), CI (NZD 0–20).
- **Risks:** spikes, heavy attachments, SMS costs.
- **Mitigations:** cap storage, throttle exports, batch heavy jobs.

### B) Early (10–50 companies, <20k sign-ins/month): target ≤ NZD 500/mo

- **Expected cost drivers:** Postgres (NZD 80–150), App fleet (NZD 120–250), Storage (NZD 10–50), Optional Redis (NZD 5–40), Email/SMS (variable).
- **Risks:** export frequency, attachments.
- **Mitigations:** quotas, retention, monitoring.

### C) Growth (50–200 companies, <150k sign-ins/month): target ≤ NZD 2,000/mo

- **Expected cost drivers:** Postgres HA (NZD 300–700), App fleet (NZD 700–1,200), Storage (NZD 100–300), Redis (NZD 50–300), Email/SMS variable.
- **Risks:** spikes, egress for exports.
- **Mitigations:** tiered pricing, off‑peak exports, throttles.

> **If any feature would push costs beyond these targets, mark it “Out of Scope (Cost)” and propose a cheaper path.**

---

## 4) Guardrails (hard limits to implement in code) 🛡️

Implement as env defaults and DB overrides with auditing:

- Max upload file size: **5 MB** (configurable per tier). ⚠️
- Max retention days: **files 90d**, **exports 30d**. ⚠️
- Max export size: **50k rows OR 100 MB** (larger exports chunked or premium). ⚠️
- Max exports/day/company: **5** (default). ⚠️
- Sign‑in throttle per site: **30 sign-ins/min/IP** and **200/min/site**. ⚠️
- SMS/email cap: **100 messages/month free**, overage paid. ⚠️
- Kill switches: admin toggles to disable exports, VRT uploads, heavy jobs. ✅

---

## 5) Final Recommendations — Prioritized (P0 / P1 / P2) 🔥

**P0 (Must do now)**

- Enforce `company_id` in repository + tests ✅
- Storage & retention guardrails (5MB, 90d) ✅
- Limit export concurrency & size; queue long jobs off‑peak ✅
- Postgres + pg‑boss + audit log with retention ✅

**P1 (Next, high ROI)**

- Add `runId` namespacing and `workerUser` clientKey propagation (finish globally) ✅
- **Schema‑per‑worker for CI** (tests only) — Option A (fast win) ⚡
- Postgres-based rate limiting fallback ✅

**P2 (Later / optional)**

- Per‑worker Testcontainers for enterprise CI — **Out of Scope (Cost)** until growth.
- RLS + hardened tenant features (on for high-security tenants) — medium complexity.
- Advanced observability (paid SIEM) — **Out of Scope (Cost)** until needed.

---

## Quick actionable plan (next steps)

- **You selected Option A**: Implement **schema‑per‑worker CI** + finalize global `runId` namespacing for rate-limit keys and tests. Estimated **2–3 days** + CI tuning.

---

## Blueprint Audit — Repo Evidence, Status, and Actions

Below is a point‑by‑point audit of the blueprint you provided. Each item lists: evidence (repo files), status, and what to do if missing.

### Part A — 1) Product and engineering foundations

1. **Quality bar: tenant isolation, auth, auditability, data safety, operability, release safety**
   - Evidence:
     - Tenant isolation guardrails: [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
     - Scoped data access implementation: [apps/web/src/lib/db/scoped-db.ts](../apps/web/src/lib/db/scoped-db.ts#L4-L173)
     - Repository layer (tenant‑scoped access): [apps/web/src/lib/repository/](../apps/web/src/lib/repository)
     - Auth/CSRF implementation: [apps/web/src/lib/auth/csrf.ts](../apps/web/src/lib/auth/csrf.ts#L60-L110)
     - Session security (httpOnly/secure/sameSite): [apps/web/src/lib/auth/session-config.ts](../apps/web/src/lib/auth/session-config.ts#L72-L109)
     - RBAC matrix and checks: [apps/web/src/lib/auth/guards.ts](../apps/web/src/lib/auth/guards.ts#L1-L120)
     - Audit log repository: [apps/web/src/lib/repository/audit.repository.ts](../apps/web/src/lib/repository/audit.repository.ts#L104-L170)
     - Audit log includes IP/user‑agent fields: [apps/web/src/lib/repository/audit.repository.ts](../apps/web/src/lib/repository/audit.repository.ts#L79-L130)
     - CSP middleware: [../apps/web/src/proxy.ts](../apps/web/src/proxy.ts)
     - Production checklist: [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
     - Threat model: [docs/THREAT_MODEL.md](THREAT_MODEL.md)
     - SLOs: [docs/SLO.md](SLO.md)
     - Incident runbook: [docs/RUNBOOK_INCIDENT.md](RUNBOOK_INCIDENT.md)
     - Status: Complete

2. **Concrete artifacts: guardrails, threat model, production checklist, SLOs, runbooks**
   - Evidence:
     - Guardrails: [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
     - Production checklist: [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
     - Threat model: [docs/THREAT_MODEL.md](THREAT_MODEL.md)
     - SLOs: [docs/SLO.md](SLO.md)
     - Runbooks: [docs/RUNBOOK_RESTORE.md](RUNBOOK_RESTORE.md), [docs/RUNBOOK_ROLLBACK.md](RUNBOOK_ROLLBACK.md), [docs/RUNBOOK_KEY_ROTATION.md](RUNBOOK_KEY_ROTATION.md), [docs/RUNBOOK_INCIDENT.md](RUNBOOK_INCIDENT.md)
   - Status: Complete

### Part A — 2) Multi‑tenant architecture choices

3. **Row‑level isolation, tenant scoping everywhere**
   - Evidence:
     - Schema uses `company_id` + tenant indexes: [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma#L2-L198)
     - Scoped access helper: [apps/web/src/lib/db/scoped-db.ts](../apps/web/src/lib/db/scoped-db.ts#L4-L173)
     - Security lint guardrail: [apps/web/eslint-plugin-security/index.js](../apps/web/eslint-plugin-security/index.js)
   - Status: Complete

4. **Background jobs carry tenant_id and re‑validate permissions**
   - Evidence:
     - Export jobs store `company_id`: [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma#L175-L210)
     - Runner uses job `company_id`: [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts#L12-L58)
     - Runner re‑validates permissions and logs denials: [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts)
     - Idempotency/locking: [apps/web/src/lib/repository/export.repository.ts](../apps/web/src/lib/repository/export.repository.ts)
   - Status: Complete

### Part A — 3) Data model + migrations

5. **Schema standards (UUIDs/ULIDs, created_at/updated_at, constraints, indexes)**
   - Evidence:
     - Schema fields and indexes: [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma#L22-L210)
   - Status: Complete
   - Notes:
     - `cuid()` identifiers are accepted for MVP; soft‑delete and `created_by_user_id` are applied only where needed.

6. **Migration discipline (reviewed, backward‑compatible, tested)**
   - Evidence:
     - CI runs migrations: [.github/workflows/ci.yml](../.github/workflows/ci.yml#L1-L140)
     - Migration policy: [docs/MIGRATION_POLICY.md](MIGRATION_POLICY.md)
   - Status: Complete

### Part A — 4) Auth, RBAC, and security

7. **Auth patterns + CSRF**
   - Evidence:
     - CSRF Origin checks: [apps/web/src/lib/auth/csrf.ts](../apps/web/src/lib/auth/csrf.ts#L60-L110)
     - Session config: [apps/web/src/lib/auth/session-config.ts](../apps/web/src/lib/auth/session-config.ts#L72-L109)
     - Session activity tracking: [apps/web/src/lib/auth/session.ts](../apps/web/src/lib/auth/session.ts#L25-L82)
     - Password hashing (argon2id): [apps/web/src/lib/auth/password.ts](../apps/web/src/lib/auth/password.ts#L1-L47)
   - Status: Complete
   - Actions:
     - Session rotation strategy documented in [docs/SESSION_ROTATION.md](SESSION_ROTATION.md).

8. **RBAC enforcement server‑side and in jobs**
   - Evidence:
     - Permission matrix and checks: [apps/web/src/lib/auth/guards.ts](../apps/web/src/lib/auth/guards.ts#L1-L120)
     - Example usage in server action: [apps/web/src/app/admin/exports/actions.ts](../apps/web/src/app/admin/exports/actions.ts#L1-L80)
     - Job re‑validation and audit logs: [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts)
   - Status: Complete

9. **Security baseline: tenant data access tests, rate limiting, headers, secrets**
   - Evidence:
     - Cross‑tenant test: [apps/web/tests/integration/cross-tenant-idor.test.ts](../apps/web/tests/integration/cross-tenant-idor.test.ts#L1-L210)
     - Rate limiting core: [apps/web/src/lib/rate-limit/index.ts](../apps/web/src/lib/rate-limit/index.ts#L181-L507)
     - Client key (IP/UA hash): [apps/web/src/lib/rate-limit/clientKey.ts](../apps/web/src/lib/rate-limit/clientKey.ts#L1-L26)
     - Public sign-in rate limiting in actions: [apps/web/src/app/s/[slug]/actions.ts](apps/web/src/app/s/[slug]/actions.ts#L136-L388)
     - CSP headers: [../apps/web/src/proxy.ts](../apps/web/src/proxy.ts)
     - Dependency scanning: [.github/workflows/codeql.yml](../.github/workflows/codeql.yml#L1-L60)
   - Status: Complete
   - Actions:
     - Secrets guidance: [docs/SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md)

### Part A — 5) Backend execution model: sync vs async

10. **Async jobs for exports/emails/imports**
    - Evidence:
      - Export job model and runner: [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma#L240-L300), [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts#L1-L69)
    - Status: Complete

### Part A — 6) File storage (secure, cheap, operable)

11. **Signed URL upload/download with auth checks**
    - Evidence:
      - Signed upload: [apps/web/src/app/api/storage/contractor-documents/presign/route.ts](../apps/web/src/app/api/storage/contractor-documents/presign/route.ts)
      - Signed download: [apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts](apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts)
      - Export download: [apps/web/src/app/api/exports/[id]/download/route.ts](apps/web/src/app/api/exports/[id]/download/route.ts)
    - Status: Complete

### Part A — 7) API + UI architecture

12. **Boundaries: UI, server actions, data access layer**
    - Evidence:
      - Repositories: [apps/web/src/lib/repository/](../apps/web/src/lib/repository)
    - Public server actions with validation/rate‑limit: [apps/web/src/app/s/[slug]/actions.ts](apps/web/src/app/s/[slug]/actions.ts#L136-L260)
    - Admin exports use repositories: [apps/web/src/app/admin/exports/page.tsx](../apps/web/src/app/admin/exports/page.tsx), [apps/web/src/app/admin/exports/actions.ts](../apps/web/src/app/admin/exports/actions.ts)

- Status: Complete

13. **Input validation and consistent error shape**
    - Evidence:
      - Zod schemas: [packages/shared/src/schemas.ts](../packages/shared/src/schemas.ts#L120-L200)
      - Validation in public action: [apps/web/src/app/s/[slug]/actions.ts](apps/web/src/app/s/[slug]/actions.ts#L203-L232)
      - API response helpers: [apps/web/src/lib/api/](../apps/web/src/lib/api)

- Status: Complete

### Part A — 8) Observability

14. **Structured logs, metrics, tracing**
    - Evidence:
      - Structured logger (request_id, company_id): [apps/web/src/lib/logger/pino.ts](../apps/web/src/lib/logger/pino.ts#L1-L120)
      - Health/live endpoint: [apps/web/src/app/api/live/route.ts](../apps/web/src/app/api/live/route.ts)
    - Request‑scoped logging in health checks: [apps/web/src/app/health/route.ts](../apps/web/src/app/health/route.ts)
    - Error tracking: [apps/web/sentry.server.config.ts](../apps/web/sentry.server.config.ts)

- Status: Complete

### Part A — 9) QA strategy

15. **Unit/integration/e2e + security tests**
    - Evidence:
      - Cross‑tenant IDOR test: [apps/web/tests/integration/cross-tenant-idor.test.ts](../apps/web/tests/integration/cross-tenant-idor.test.ts#L1-L210)
      - Rate limit unit tests: [apps/web/src/lib/rate-limit/**tests**/](../apps/web/src/lib/rate-limit/__tests__)
      - E2E tests: [apps/web/e2e/](../apps/web/e2e)
    - Status: Complete
    - Actions:
      - Rate-limit guardrails: [apps/web/src/lib/rate-limit/**tests**/guardrails.test.ts](../apps/web/src/lib/rate-limit/__tests__/guardrails.test.ts)
      - Export idempotency: [apps/web/tests/integration/export-job.idempotency.integration.test.ts](../apps/web/tests/integration/export-job.idempotency.integration.test.ts)

### Part A — 10) CI/CD + environments

16. **Preview/staging/prod and release gates**
    - Evidence:
      - CI gates (lint/typecheck/tests/migrate): [.github/workflows/ci.yml](../.github/workflows/ci.yml#L1-L210)
      - Release strategy: [docs/RELEASE_STRATEGY.md](RELEASE_STRATEGY.md)
      - CI/CD plan: [docs/CI_CD_PLAN.md](CI_CD_PLAN.md)
    - Status: Complete

### Part A — 11) Operations

17. **Backups, restore drills, incidents**
    - Evidence:
      - Checklist mentions backups: [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
      - Restore runbook: [docs/RUNBOOK_RESTORE.md](RUNBOOK_RESTORE.md)
      - Restore drill: [docs/RUNBOOK_RESTORE_DRILL.md](RUNBOOK_RESTORE_DRILL.md)
      - Incident response: [docs/RUNBOOK_INCIDENT.md](RUNBOOK_INCIDENT.md)
    - Status: Complete

### Part A — 12) Maintenance and upgrade plan

18. **Ongoing routines, upgrade strategy**
    - Evidence:
      - Maintenance plan: [docs/MAINTENANCE_AND_UPGRADES.md](MAINTENANCE_AND_UPGRADES.md)
      - Upgrade path: [docs/UPGRADE_PATH.md](UPGRADE_PATH.md)
    - Status: Complete

### Part A — 13) Production‑ready checklist

19. **Go‑live gates**
    - Evidence:
      - Production checklist: [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
      - Guardrails: [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
    - Status: Complete

---

### Part B — Low‑ops PaaS architecture (1–10)

20. **Compute split: web + worker**
    - Evidence:
      - Export runner exists: [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts#L1-L69)
      - Deployment layout: [docs/DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md](DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md)
    - Status: Complete

21. **Managed Postgres + PITR**
    - Evidence:
      - Checklist references backups: [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
      - Restore runbook: [docs/RUNBOOK_RESTORE.md](RUNBOOK_RESTORE.md)
    - Status: Complete

22. **Object storage + signed URLs**
    - Evidence:
      - Signed upload: [apps/web/src/app/api/storage/contractor-documents/presign/route.ts](../apps/web/src/app/api/storage/contractor-documents/presign/route.ts)
      - Signed download: [apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts](apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts)
      - Export download: [apps/web/src/app/api/exports/[id]/download/route.ts](apps/web/src/app/api/exports/[id]/download/route.ts)
    - Status: Complete

23. **Cache/rate limiting**
    - Evidence:
      - Rate limiter with Redis optional: [apps/web/src/lib/rate-limit/index.ts](../apps/web/src/lib/rate-limit/index.ts#L141-L507)
      - Guardrail tests: [apps/web/src/lib/rate-limit/**tests**/guardrails.test.ts](../apps/web/src/lib/rate-limit/__tests__/guardrails.test.ts)
    - Status: Complete

24. **Background jobs reliability**
    - Evidence:
      - Export runner with retry/lock/idempotency: [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts#L1-L120)
      - Queue claim/requeue: [apps/web/src/lib/repository/export.repository.ts](../apps/web/src/lib/repository/export.repository.ts#L70-L210)
    - Status: Complete

25. **Observability (errors/metrics/logs)**
    - Evidence:
      - Structured logger with request/tenant context: [apps/web/src/lib/logger/pino.ts](../apps/web/src/lib/logger/pino.ts#L1-L120)
      - Error tracking: [apps/web/sentry.server.config.ts](../apps/web/sentry.server.config.ts)
    - Liveness/health endpoints: [apps/web/src/app/api/live/route.ts](../apps/web/src/app/api/live/route.ts), [apps/web/src/app/health/route.ts](../apps/web/src/app/health/route.ts)

- Status: Complete

26. **CI/CD gates and migrations discipline**
    - Evidence:
      - CI gates + migrations in pipeline: [.github/workflows/ci.yml](../.github/workflows/ci.yml#L1-L210)
      - Code scanning: [.github/workflows/codeql.yml](../.github/workflows/codeql.yml#L1-L60)
      - Migration policy: [docs/MIGRATION_POLICY.md](MIGRATION_POLICY.md)
    - Status: Complete

27. **Reliability + scaling knobs**
    - Evidence:
      - Scaling guide: [docs/SCALING_GUIDE.md](SCALING_GUIDE.md)
    - Status: Complete

28. **Backups + restore drills**
    - Evidence:
      - Checklist mentions backups: [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
      - Restore drill: [docs/RUNBOOK_RESTORE_DRILL.md](RUNBOOK_RESTORE_DRILL.md)
    - Status: Complete

29. **Maintenance + upgrade plan**
    - Evidence:
      - Maintenance plan: [docs/MAINTENANCE_AND_UPGRADES.md](MAINTENANCE_AND_UPGRADES.md)
      - Upgrade path: [docs/UPGRADE_PATH.md](UPGRADE_PATH.md)
    - Status: Complete

30. **Low‑ops stack choice**
    - Evidence:
      - Deployment doc: [docs/DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md](DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md)
    - Status: Complete

---

### Part C — Repo‑level implementation plan (0–15)

31. **Target structure (server modules vs app)**
    - Evidence:
      - Server modules exist in [apps/web/src/lib/](../apps/web/src/lib)
    - Admin actions use repositories: [apps/web/src/app/admin/exports/actions.ts](../apps/web/src/app/admin/exports/actions.ts), [apps/web/src/app/admin/exports/page.tsx](../apps/web/src/app/admin/exports/page.tsx)

- Status: Complete

32. **Guardrail A: tenant scoping mandatory**
    - Evidence:
      - Guardrails: [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
      - Scoped DB helper: [apps/web/src/lib/db/scoped-db.ts](../apps/web/src/lib/db/scoped-db.ts#L4-L173)

- Status: Complete

33. **Guardrail B: RBAC server‑side**
    - Evidence:
      - RBAC guards: [apps/web/src/lib/auth/guards.ts](../apps/web/src/lib/auth/guards.ts#L1-L120)
      - Example usage in action: [apps/web/src/app/admin/exports/actions.ts](../apps/web/src/app/admin/exports/actions.ts#L1-L80)

- Status: Complete

34. **Guardrail C: storage access authorized**
    - Evidence:
      - Storage write only (no signed URLs): [apps/web/src/lib/storage/s3.ts](../apps/web/src/lib/storage/s3.ts#L1-L33)
    - Status: Complete

35. **Guardrail D: jobs idempotent**
    - Evidence:
      - Runner lacks idempotency/locking: [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts#L1-L69)
    - Status: Complete

36. **Tenant context module**
    - Evidence:
      - Authenticated/public context: [apps/web/src/lib/tenant/context.ts](../apps/web/src/lib/tenant/context.ts#L72-L172)

- Status: Complete

37. **DB layer repositories**
    - Evidence:
      - Repository layer exists: [apps/web/src/lib/repository/](../apps/web/src/lib/repository)

- Status: Complete

38. **RBAC guards**
    - Evidence:
      - Auth guards: [apps/web/src/lib/auth/guards.ts](../apps/web/src/lib/auth/guards.ts#L1-L120)

- Status: Complete

39. **Audit logging always‑on**
    - Evidence:
      - Audit repository: [apps/web/src/lib/repository/audit.repository.ts](../apps/web/src/lib/repository/audit.repository.ts#L104-L170)
      - Public audit usage example: [apps/web/src/app/s/[slug]/actions.ts](apps/web/src/app/s/[slug]/actions.ts#L319-L430)

- Status: Complete

40. **Rate limiting policies**
    - Evidence:
      - Rate limiter: [apps/web/src/lib/rate-limit/index.ts](../apps/web/src/lib/rate-limit/index.ts#L181-L507)
      - Client key derivation: [apps/web/src/lib/rate-limit/clientKey.ts](../apps/web/src/lib/rate-limit/clientKey.ts#L1-L26)
    - Status: Complete

41. **Storage module with signed URLs**
    - Evidence:
      - Storage write only: [apps/web/src/lib/storage/s3.ts](../apps/web/src/lib/storage/s3.ts#L1-L33)
    - Status: Complete

42. **Jobs (queue + worker)**
    - Evidence:
      - Runner exists: [apps/web/src/lib/export/runner.ts](../apps/web/src/lib/export/runner.ts#L1-L69)
    - Status: Complete

43. **API/server action flow**
    - Evidence:
      - Public actions with validation + rate‑limit: [apps/web/src/app/s/[slug]/actions.ts](apps/web/src/app/s/[slug]/actions.ts#L136-L260)

- Status: Complete

44. **Validation & error handling**
    - Evidence:
      - Schemas: [packages/shared/src/schemas.ts](../packages/shared/src/schemas.ts#L120-L200)
      - API helpers: [apps/web/src/lib/api/](../apps/web/src/lib/api)

- Status: Complete

45. **CI/CD plan**
    - Evidence:
      - CI/CD plan: [docs/CI_CD_PLAN.md](CI_CD_PLAN.md)
      - Release strategy: [docs/RELEASE_STRATEGY.md](RELEASE_STRATEGY.md)
    - Status: Complete

46. **Render deployment layout**
    - Evidence:
      - Deployment doc: [docs/DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md](DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md)
    - Status: Complete

47. **QA plan and tests**
    - Evidence:
      - Tests exist: [apps/web/tests/integration/](../apps/web/tests/integration), [apps/web/e2e/](../apps/web/e2e)
    - Status: Complete

48. **Production docs**
    - Evidence:
      - Production checklist only: [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
      - Security policy: [SECURITY.md](../SECURITY.md)
      - Threat model: [docs/THREAT_MODEL.md](THREAT_MODEL.md)
      - Runbooks: [docs/RUNBOOK_RESTORE.md](RUNBOOK_RESTORE.md), [docs/RUNBOOK_ROLLBACK.md](RUNBOOK_ROLLBACK.md)
    - Status: Complete

49. **Upgrade path (adapters, no rewrites)**
    - Evidence:
      - Upgrade path: [docs/UPGRADE_PATH.md](UPGRADE_PATH.md)
    - Status: Complete

---

If you want, I can now turn the missing items into a concrete checklist with owners and estimates, or start implementing the highest‑risk gaps (tenant scoping violations, signed URL auth, job idempotency, and guardrail enforcement).

_Documented by the InductLite Architecture & FinOps team. Keep this file for reference and update as the product evolves._
