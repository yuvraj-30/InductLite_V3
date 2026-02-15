# InductLite - FinOps + Architecture Guardrails (MUST READ FIRST)

> Authoritative control spec for InductLite.
> Any AI or contributor must read and obey this spec before changing anything.
> If a proposal conflicts with this spec, mark it Out of Scope (Cost/Policy) and propose a cheaper or safer alternative.

---

## AI System Prompt (Short Copy-Paste)

Use this at the start of any AI session working on this repo:

> You are working on InductLite, a multi-tenant SaaS (Next.js + Prisma + Postgres) for NZ construction and maintenance companies (QR sign-in + inductions).
> Non-negotiables: (1) strict tenant isolation by construction (`company_id`), (2) bootstrapped monthly infra budgets (MVP <= NZD 150, Early <= NZD 500, Growth <= NZD 2000), (3) hard guardrails for exports/uploads/rate limits/SMS and email caps, (4) CI-only `runId` and schema-per-worker, and never use `runId` for production keys.
> Before any change, you must: (a) reference this file, (b) state cost impact, (c) state security impact, (d) list impacted guardrails/env vars, (e) propose a cheaper fallback, (f) give an exact test plan.

---

## 0) Product Definition (Scope)

InductLite is a multi-tenant SaaS for NZ construction and maintenance companies focused on:

- QR/link-based public site sign-in/sign-out
- Public inductions completed at sign-in
- Admin dashboard for sites, templates, contractors, exports, and audit logs

### Core invariants (non-negotiable)

- Strict tenant isolation (`company_id`) is a security invariant.
- Cost control is a design invariant and must be enforced in code (caps, quotas, retention, and throttles).

---

## 1) Hard Monthly Budget Constraints (NZD, all-in infra)

### MVP (0-10 companies, <2k sign-ins/month): <= NZD 150/mo
### Early (10-50 companies, <20k sign-ins/month): <= NZD 500/mo
### Growth (50-200 companies, <150k sign-ins/month): <= NZD 2000/mo

Rule: If any feature or architecture likely exceeds these targets, it is Out of Scope (Cost) unless there is explicit approved exception.

### Monthly tier ceilings (required numeric caps + cost-at-cap)

- MVP (cost-at-cap <= NZD 150): `MAX_MONTHLY_EGRESS_GB<=100`, `MAX_MONTHLY_STORAGE_GB<=50`, `MAX_MONTHLY_JOB_MINUTES<=1000`, `MAX_MONTHLY_COMPUTE_INVOCATIONS<=1200000`, `MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES<=2500`, `MAX_MONTHLY_SERVER_ACTION_INVOCATIONS<=1000000`
- Early (cost-at-cap <= NZD 500): `MAX_MONTHLY_EGRESS_GB<=500`, `MAX_MONTHLY_STORAGE_GB<=250`, `MAX_MONTHLY_JOB_MINUTES<=5000`, `MAX_MONTHLY_COMPUTE_INVOCATIONS<=6000000`, `MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES<=12000`, `MAX_MONTHLY_SERVER_ACTION_INVOCATIONS<=5000000`
- Growth (cost-at-cap <= NZD 2000): `MAX_MONTHLY_EGRESS_GB<=2500`, `MAX_MONTHLY_STORAGE_GB<=1000`, `MAX_MONTHLY_JOB_MINUTES<=25000`, `MAX_MONTHLY_COMPUTE_INVOCATIONS<=24000000`, `MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES<=48000`, `MAX_MONTHLY_SERVER_ACTION_INVOCATIONS<=20000000`
- `Documented tier ceilings` means only numeric limits in this section. PR comments or env overrides are not valid ceilings.
- Tier ceilings must be recalibrated quarterly using the last 90 days of production usage and current provider price sheets, with signed Finance + Engineering approval.
- Any cap increase that raises projected monthly spend by more than 10% is a budget exception and requires CTO approval.

### Budget enforcement (mandatory)

- Production must enforce a monthly spend circuit breaker that disables non-critical features at 80% projected budget and hard-stops paid features at 100% projected budget.
- `Projected budget` must be computed as: trailing 30-day actual spend / elapsed days * days in month.
- `Actual spend` must come from provider billing APIs and third-party invoices. Manual estimates are non-compliant for enforcement decisions.
- Budget telemetry ingestion from billing sources must run at least hourly in production. If billing data is stale for >6 hours, the platform MUST enter fail-safe mode (`BUDGET_PROTECT`) until fresh data is restored.
- `Paid features` are only SMS/email notifications, premium observability, and optional RLS unless this document is updated.
- `Non-critical features` are only exports, visual regression tooling, and optional SMS/email notifications.
- At 100% projected budget, the system must enter `BUDGET_PROTECT` mode.
- `Critical paths` in `BUDGET_PROTECT` mode are only authentication, active sign-in/sign-out, and legal/compliance export retrieval.
- `Critical paths` allowed during `BUDGET_PROTECT` must be listed in `docs/critical-paths.md` and referenced by enforcement code.
- The platform must define and enforce hard monthly caps for egress, storage, job runtime, compute invocations/runtime, and server-action invocations per environment.
- `Environment` means each deployed stack (`dev`, `staging`, `prod`) with independent budgets, caps, and alerts.
- `Environment budget tier` is `ENV_BUDGET_TIER` (`MVP|EARLY|GROWTH`) and is the only valid source for environment-level budget ceilings.
- `Tenant plan tier` is runtime `company.planTier` (`MVP|EARLY|GROWTH`) and only controls tenant-level entitlements/quotas; it MUST NOT raise environment ceilings.
- When both environment and tenant limits apply, enforcement MUST apply the stricter limit (lowest remaining quota).
- `Job minutes` are worker wall-clock runtime from job start to completion/failure, aggregated per calendar month (UTC).
- `Server-action invocations` are counted at server action entry after auth/origin checks and before business logic, aggregated per environment per calendar month (UTC).
- `Compute invocations` are counted at entry of all externally reachable compute paths (Server Actions, Route Handlers, API routes, Middleware, webhooks, scheduled jobs), after basic auth/origin checks and before business logic.
- `Compute runtime minutes` are aggregate wall-clock runtime for all externally reachable compute paths per environment per calendar month (UTC).
- Startup must fail fast in all environments if any monthly cap env var exceeds the selected environment budget tier ceiling.
- If `company.planTier` is missing or invalid, tenant-level enforcement MUST default to MVP quotas and all paid features for that tenant MUST be disabled until corrected.
- If `ENV_BUDGET_TIER` is missing or invalid, startup MUST fail closed in all environments.
- Production `ENV_BUDGET_TIER` must be immutable per deployment and changeable only via audited configuration change control.
- Any change to `company.planTier` that affects tenant enforcement tier requires dual approval (Finance + Security) and an immutable audit log record.
- All `company.planTier` changes must occur through a single audited service function. Direct DB updates are forbidden.
- Budget calculations must include compute, database, storage, egress, logging, third-party API/SMS charges, object-storage request charges (PUT/GET/LIST), CDN transfer, backup snapshot/storage, and database IOPS/connection overage charges.
- Each monthly tier ceiling must include an estimated NZD cost-at-cap, and CI must fail if cost-at-cap exceeds the tier budget.
- Each cost-control env var must declare tier-specific max values; startup must fail if configured values exceed max.
- CI must run a monthly-cost simulation with current caps and current provider prices, and fail if projected spend exceeds the budget for `ENV_BUDGET_TIER`.
- Monthly-cost simulation MUST use versioned provider price snapshots not older than 30 days and MUST fail closed when pricing inputs are missing or stale.
- If trailing 7-day spend projects monthly overrun >15%, non-critical jobs must be disabled and export concurrency set to zero until recovery.
- Any compute entrypoint that does not emit required cost counters MUST fail CI and MUST be blocked from production release.
- If any required quota env var for a paid capability is missing, invalid, or unparsable, that capability must default to disabled.
- A monthly FinOps reconciliation report must compare projected spend to billed spend by category and trigger remediation within 5 business days when variance exceeds 10%.
- No third-party paid capability may be enabled in production unless explicit hard quota env vars and budget-protect behavior are defined in this document.
- No feature may be enabled in production without a measurable cost model, alert thresholds, and rollback switch.

---

## 2) Allowed/Preferred Services and Patterns

### Preferred (default)

- Single-region managed Postgres (single primary)
- pg-boss jobs on the same Postgres (no extra broker)
- S3-compatible object storage with signed URLs
- Structured logs to stdout
- Minimal observability (health checks + coarse metrics)
- PWA-lite for mobile usability

### Allowed only when justified and budgeted

`Justified and budgeted` means written approval by Engineering Manager and Finance Owner, with estimated monthly NZD delta, expiry date, and rollback plan.

- Redis/Upstash (only for proven contention or throughput limits)
- DB read replicas (only when monthly sign-ins >150,000 for 2 consecutive months AND p95 DB read latency >250ms for 14 consecutive days, with Architecture approval)
- RLS as paid/premium hardening

### Disallowed by default

- Always-on Datadog/New Relic/ELK stacks
- Kafka/event streaming
- Multi-region DB
- Offline-first native apps
- Geofencing
- SMS/phone verification at every step

---

## 3) Mandatory Technical Invariants (Enforcement, not guidance)

### 3.1 Tenant isolation by construction

Rule: No repository may access tenant-owned models without scoping.

Required enforcement mechanism:

1. Repositories must use `scopedDb(companyId)` (or equivalent) for tenant-owned models.
2. Raw Prisma imports are banned in `src/lib/repository/**`.
3. Tenant-owned model access via raw Prisma client is forbidden in `src/app/**`, `src/lib/**`, and server actions, except in approved DB infrastructure modules.
Approved DB infrastructure modules are limited to `src/lib/db/scoped-db.ts` and `src/lib/db/scoped.ts`; any additional module requires Security + Architecture CODEOWNERS approval and a CI rule update in the same PR.
4. Unsafe Prisma ops on tenant-owned models are forbidden: `findUnique`, `update`, `delete`, `upsert`.
5. Use `findFirst/findMany` and `updateMany/deleteMany` with tenant scope.
6. CI must include integration tests that detect bypass attempts.
7. CI must enforce tenant-scope and raw-client bans via static analysis across `src/app/**`, `src/lib/**`, and `src/server/**`.
8. `TENANT_OWNED_MODELS` must be defined only in `docs/tenant-owned-models.md`, auto-generated from Prisma schema in CI, and manual edits must fail CI.

Allowlist for unscoped (`publicDb`) operations (must stay small):

- `SitePublicLink` lookup by `slug` (public QR entry)
- `User` lookup by `email` for login bootstrap
- Public sign-out lookup by globally unique ID/token hash
- Child models without `company_id` only when scoped by verified parent relation in the same transaction

### 3.2 CI vs production isolation

CI-only concepts:

- `runId` namespacing
- schema-per-worker test schemas
- test data prefixes

Production must never use `runId` for:

- rate-limit keys
- tenant keys
- user identity
- storage paths (except build artifacts)

### 3.3 Rate limiting

Production keys:

- `clientKey = ipHash + userAgentHash` (or authenticated user id)
- `scopeKey = companyId/siteSlug + endpoint`

Security requirement: Do not trust spoofable headers unless `TRUST_PROXY=true` and strict IP parsing is enforced.

### 3.4 Logging and audit

- Audit logs in DB are the durable compliance trail.
- App logs must go to stdout (not local files).
- Expensive retention must be tiered and optional.

---

## 4) Guardrails (Hard limits that must be implemented in code)

- Startup must fail fast if any required guardrail env var is missing, invalid, non-numeric where numeric is required, or out of bounds.
- CI must block merge unless guardrail tests pass for tenant scope, rate limits, upload limits, export limits, and retention jobs.
- Every guardrail must define owner, trigger threshold, enforcement path, and test ID.
- Every MUST-level control must include default env var name, default value, enforcement path, and test ID in `docs/guardrail-control-matrix.md`.
- Every MUST-level control must include a unique machine-checkable `CONTROL_ID` in `docs/guardrail-control-matrix.md`; missing or duplicate IDs are release-blocking defects.
- Guardrail owners must re-approve cap values quarterly. Missing review invalidates release approval.
- Enforcement denials MUST return deterministic error payloads containing `CONTROL_ID`, violated limit, and current scope (`tenant` or `environment`); generic errors are non-compliant.

### 4.1 Storage and uploads

- `MAX_UPLOAD_MB=5`
- `UPLOAD_ALLOWED_MIME=application/pdf,image/jpeg,image/png`
- `UPLOAD_ALLOWED_EXTENSIONS=pdf,jpg,jpeg,png`
- `UPLOAD_REQUIRE_SERVER_MIME_SNIFF=true`
- `UPLOAD_REQUIRE_MAGIC_BYTES=true`
- `FILES_RETENTION_DAYS=90`
- `EXPORTS_RETENTION_DAYS=30`

Enforce in upload handler and daily retention jobs.
Server must validate extension, declared MIME, sniffed MIME, and magic bytes; any mismatch MUST be rejected before storage write.

### 4.2 Exports

- `MAX_EXPORT_ROWS=50000`
- `MAX_EXPORT_BYTES=104857600`
- `MAX_EXPORT_BYTES_GLOBAL_PER_DAY=2147483648`
- `MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY=536870912`
- `MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY=5368709120`
- `MAX_EXPORTS_PER_COMPANY_PER_DAY=5`
- `MAX_EXPORT_RUNTIME_SECONDS=120`
- `MAX_EXPORT_QUEUE_AGE_MINUTES=60`
- `MAX_CONCURRENT_EXPORTS_GLOBAL=1`
- `MAX_CONCURRENT_EXPORTS_PER_COMPANY=1`
- `EXPORT_OFFPEAK_ONLY=false`
- `EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT=20`
- `EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS=60`
- `EXPORT_OFFPEAK_AUTO_ENABLE_DAYS=7`

Enforce in request handler and worker:

- Quota check + enqueue only in request path
- Chunked streaming + runtime limit in worker
- Reject enqueue when global/day bytes or queue-age limit is breached
- Export scheduler MUST auto-enable `EXPORT_OFFPEAK_ONLY` when either auto-enable threshold is breached and MUST emit an audit log event with threshold metric, window, and actor=`system`.
- Export retrieval must enforce short-lived signed URLs (`<=300` seconds) and all retrieval bytes must count toward both download and monthly egress quotas, including legal/compliance retrieval in `BUDGET_PROTECT`.
- Export formats must be versioned (`csv_v1`, `json_v1`) with compatibility/deprecation policy

### 4.3 Public sign-in abuse controls

- `RL_PUBLIC_SLUG_PER_IP_PER_MIN=30`
- `RL_SIGNIN_PER_IP_PER_MIN=30`
- `RL_SIGNIN_PER_SITE_PER_MIN=200`
- `RL_SIGNOUT_PER_IP_PER_MIN=30`

### 4.4 Authenticated/admin abuse controls

- `RL_ADMIN_PER_USER_PER_MIN=60`
- `RL_ADMIN_PER_IP_PER_MIN=120`
- `RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN=60`
- Authenticated/admin endpoints must have dedicated rate/concurrency limits separate from public controls.

### 4.5 SMS and email controls

Default stance: SMS is OFF unless explicitly enabled.

- `SMS_ENABLED=false`
- `MAX_MESSAGES_PER_COMPANY_PER_MONTH=0`
- `MAX_EMAILS_PER_COMPANY_PER_MONTH=500`
- `MAX_EMAILS_GLOBAL_PER_DAY=2000`

If paid tier messaging is enabled:

- `MAX_MESSAGES_PER_COMPANY_PER_MONTH<=100` (or lower per plan)
- Provider must be pay-as-you-go

Enforce in one centralized messaging wrapper.

### 4.6 Logging/audit retention

- `AUDIT_RETENTION_DAYS=90`
- `LOG_RETENTION_DAYS=14`

### 4.7 Kill switches

- `FEATURE_EXPORTS_ENABLED=true`
- `FEATURE_UPLOADS_ENABLED=true`
- `FEATURE_VISUAL_REGRESSION_ENABLED=false`
- `FEATURE_PUBLIC_SIGNIN_ENABLED=true`

### 4.8 Per-tenant hard quotas (noisy-neighbor protection)

- `MAX_TENANT_STORAGE_GB=5`
- `MAX_TENANT_EGRESS_GB_PER_MONTH=20`
- `MAX_TENANT_JOB_MINUTES_PER_MONTH=300`
- `MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH=250000`
- Tenant-specific quota overrides by `company.planTier` must be defined in `docs/guardrail-control-matrix.md`; if missing, MVP values above are mandatory defaults.

Enforce at request/job admission time. Any tenant over quota must receive `429` with the violated `CONTROL_ID`, and cannot consume additional non-critical resources until quota reset or approved override.

---

## 5) Architecture defaults

- App: Next.js App Router + Server Actions; single app instance in MVP
- DB: One Postgres primary in one region; compound indexes on tenant keys
- Jobs: pg-boss on Postgres; strict concurrency and backpressure
- Storage: S3-compatible storage + signed URLs + lifecycle cleanup
- Residency: Production data and backups must remain in approved NZ/AU regions unless contract/legal exception exists

---

## 6) Required output format for AI proposals

Any proposal must include:

1. Change summary
2. Cost impact (reads/writes/storage/egress/jobs/SMS/email)
3. Security impact (tenant isolation/auth/PII)
4. Guardrails/env vars affected
5. Cheaper fallback
6. Test plan with exact commands

---

## 7) Governance, compliance, and resilience (mandatory)

- Guardrail changes require CODEOWNERS approval from Security + Architecture.
- Main branch must require passing `guardrails-lint`, `guardrails-tests`, and `policy-check` with no admin bypass.
- Weekly branch-protection validation must run as scheduled CI and fail if required rules are missing/altered.
- Required policy artifacts (`docs/critical-paths.md`, `docs/guardrail-control-matrix.md`, `docs/guardrail-exceptions.md`, `docs/tenant-owned-models.md`) must exist, be non-empty, and pass schema validation in CI.
- Schema validation for required policy artifacts MUST be defined by checked-in schema files under `docs/schemas/` and enforced in CI.
- If any required policy artifact is missing from default branch, CI must fail.
- This document must be UTF-8 and free of mojibake. CI must fail on known mojibake signatures (for example `\\u00C3`, `\\u00C2`, `\\u00E2\\u0080`).
- Any guardrail exception must be recorded in `docs/guardrail-exceptions.md` with owner, reason, scope hash, and expiry.
- Guardrail exceptions expire in 30 days and may be renewed once. Further extension requires CTO approval and a published risk acceptance record.
- Each MUST-level control in this file must map to a machine-checkable control ID in `docs/guardrail-control-matrix.md`.
- Webhooks must verify HMAC signatures, timestamp tolerance, idempotency keys, and endpoint-specific rate limits.
- All third-party integrations must define outage fallback behavior, max tolerated downtime, and fail-safe degradation mode.
- GDPR workflows must support export and deletion requests with SLA, audit log trail, and irreversible deletion semantics.
- Sensitive tenant fields (phone/email/signatures/health responses) must be encrypted at rest with audited access controls.
- Backup policy must define numeric RPO/RTO targets per environment and require regular restore verification.
- Backups containing tenant PII must be purged within 30 days of tenant deletion unless legal hold is recorded.
- Legal-hold workflow must define who can place/remove holds, required evidence, and mandatory audit fields.
- Platform must support tenant emergency suspension (read/write freeze) with audited actor/reason/timestamp and explicit recovery steps.
- Quarterly security-and-cost runaway game-day is mandatory (at least one tenant-isolation bypass scenario and one budget overrun scenario).
- Production secrets and encryption keys must rotate at least every 90 days.
- Key-compromise runbook must define maximum 24-hour rotation completion SLA and be tested quarterly.
- Incident response policy must define Sev1/Sev2 ownership, paging targets, breach-notification timelines, and mandatory postmortems.
- Monthly FinOps reconciliation report is mandatory; >10% projected-vs-billed variance requires remediation plan in 5 business days.

---

## 8) Policy artifacts (required)

- `docs/critical-paths.md`: canonical `BUDGET_PROTECT` allowlist and version history
- `docs/guardrail-control-matrix.md`: one row per MUST-level control with control ID, env var, default, bounds, code path, and test ID
- `docs/guardrail-exceptions.md`: active exception registry with expiry and approvers
- `docs/tenant-owned-models.md`: canonical tenant-owned model list auto-generated from Prisma schema

---

## 9) Glossary (normative)

- `MUST`: mandatory; no exceptions without approved exception record.
- `Environment budget tier`: deployment-level `ENV_BUDGET_TIER` value (`MVP|EARLY|GROWTH`) used for environment spend ceilings.
- `Tenant plan tier`: runtime `company.planTier` value (`MVP|EARLY|GROWTH`) used for tenant entitlements and tenant quotas.
- `Selected tier`: use explicit term `Environment budget tier` or `Tenant plan tier`; ambiguous `Selected tier` is forbidden in new controls.
- `Cost-at-cap`: estimated NZD spend when all tier ceilings are reached.
- `BUDGET_PROTECT`: degraded mode that disables non-critical features and constrains critical paths.
- `Critical paths`: endpoints/jobs listed in `docs/critical-paths.md`.
- `Guardrail env var`: policy-backed env var with default, bounds, and enforcement path in `docs/guardrail-control-matrix.md`.
- `Global`: per environment (`dev`, `staging`, `prod`) unless a control explicitly says `cross-environment`.
- `Per-day`: UTC calendar day boundaries.
- `Bytes`: base-2 units (`KiB`, `MiB`, `GiB`) unless explicitly stated otherwise.
- All quantitative limits MUST use explicit `ENV_VAR=value` syntax in this document; authoritative scope and unit definitions MUST live in `docs/guardrail-control-matrix.md`.

---

This document must be referenced before implementing any feature or refactor.
If any two guardrail rules conflict, the stricter rule (lower cap or stronger security requirement) prevails automatically.
If there is still a conflict, propose an alternative that remains within budget and preserves tenant isolation.
