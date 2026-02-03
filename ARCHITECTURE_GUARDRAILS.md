# InductLite — FinOps + Architecture Guardrails (MUST READ FIRST)

> **Authoritative control spec** for InductLite.  
> Any AI or contributor must **read and obey this spec before changing anything** in the repo.  
> If a proposal conflicts with this spec, it must be marked **Out of Scope (Cost/Policy)** and replaced with a cheaper/safer alternative.

---

## AI System Prompt (Short Copy-Paste)

Use this at the start of any AI session working on the repo:

> You are working on **InductLite**, a multi-tenant SaaS (Next.js + Prisma + Postgres) for NZ construction/maintenance companies (QR sign-in + inductions).  
> **Non-negotiables:** (1) strict tenant isolation by construction (`company_id`), (2) bootstrapped monthly infra budgets (MVP ≤ NZD 150, Early ≤ 500, Growth ≤ 2000), (3) enforce hard guardrails (exports/uploads/rate limits/SMS caps), (4) CI-only `runId` + schema-per-worker; **never** use `runId` for production keys.  
> Before any repo change or feature suggestion, you must: (a) reference `ARCHITECTURE_GUARDRAILS.md`, (b) state cost impact (DB/storage/egress/jobs/SMS), (c) state security impact (tenant isolation/PII), (d) list which guardrails/env vars apply, (e) propose cheaper fallback, (f) give a test plan.  
> If something exceeds budgets or weakens tenant isolation, mark it **Out of Scope** and propose an alternative.

---

## 0) Product Definition (Scope)

InductLite is a **multi-tenant SaaS** for **NZ construction/maintenance companies** focused on:

- QR/link-based **public site sign-in/sign-out**
- **Public inductions** (template questions completed at sign-in)
- Admin dashboard for: sites, templates, contractors, exports, audit logs

### Core invariants (non-negotiable)
- Strict tenant isolation (`company_id`) is a **security invariant**.
- Cost control is a **design invariant** and must be enforced in code (caps + quotas + retention + throttles).

---

## 1) Hard Monthly Budget Constraints (NZD, all-in infra)

### MVP (0–10 companies, <2k sign-ins/month): **≤ $150/mo**
### Early (10–50 companies, <20k sign-ins/month): **≤ $500/mo**
### Growth (50–200 companies, <150k sign-ins/month): **≤ $2,000/mo**

**Rule:** If any feature/architecture likely exceeds these targets, it must be flagged:
- **Out of Scope (Cost)** + provide a cheaper alternative.

---

## 2) Allowed/Preferred Services & Patterns

### Preferred (default)
- **Single-region managed Postgres** (single primary)
- **pg-boss** jobs on the same Postgres (no extra broker)
- **S3-compatible object storage** + signed URLs
- **Structured logs to stdout** (platform log retention/drain)
- Minimal observability: basic health checks + coarse metrics
- **PWA-lite** for mobile usability (avoid native apps)

### Allowed only when justified & budgeted
- Redis/Upstash (rate limiting at higher scale or to relieve Postgres contention)
- DB read replicas (Growth only)
- RLS (Postgres Row Level Security) as a **paid/premium** hardening option

### Disallowed by default (must justify + offer fallback)
- Datadog/New Relic/ELK always-on stacks
- Kafka/event streaming
- Multi-region DB
- Offline-first native apps
- Geofencing (support + permissions complexity)
- SMS/phone verification at every step

---

## 3) Mandatory Technical Invariants (ENFORCEMENT, not “guidelines”)

### 3.1 Tenant Isolation — guaranteed “by construction”
**Rule:** No repository may access tenant-owned models without scoping.

**Required enforcement mechanism:**
1. Repositories must use `scopedDb(companyId)` (or equivalent) for tenant models.
2. Raw Prisma imports are **banned** in `src/lib/repository/**`.
3. Unsafe Prisma ops on tenant models are **forbidden** (prefer safe/atomic patterns):
   - `findUnique`, `update`, `delete`, `upsert`
   - Use `findFirst/findMany` + `updateMany/deleteMany` scoped by tenant.
4. CI must include an integration test detecting bypass attempts.

#### Allowlist for unscoped (`publicDb`) operations (must stay small)
Only allowed for:
- `SitePublicLink` lookup by `slug` (public QR entry)
- `User` lookup by `email` for login bootstrap
- Public sign-out lookup by globally unique ID/token hash
- Child models without `company_id` only if scoped by verified parent relation in the same operation/transaction

To expand allowlist, AI must:
- justify safety,
- add/modify tests proving it,
- state cost/security impact.

---

### 3.2 CI vs Production isolation (never mix concepts)
**CI-only concepts:**
- `runId` namespacing
- schema-per-worker DB schemas
- test data prefixes

**Production must never use `runId` for:**
- rate limiting keys
- tenant keys
- user identity
- storage paths (except build artifacts)

---

### 3.3 Rate Limiting — stable keys, safe IP extraction
**Production keys must be stable:**
- `clientKey = ipHash + userAgentHash` (or session user id when authenticated)
- `scopeKey = companyId/siteSlug + endpoint`

**MVP default:** Postgres-based counters/sliding windows.  
**Growth:** Redis optional if Postgres contention appears.

**Security requirement:** Do not trust spoofable headers unless proxy trust is explicitly configured (`TRUST_PROXY=true`) and IP parsing/validation is enforced.

---

### 3.4 Logging + Audit — durable audit, cheap logs
- **Audit logs (DB)** are the durable compliance trail.
- App logs must go to **stdout** (not local container files).
- Expensive retention must be tiered/paid (do not make MVP depend on it).

---

## 4) Guardrails (Hard Limits) — MUST be implemented in code

These defaults must exist as env vars and be enforced in server actions/repositories/jobs.

### 4.1 Storage & Uploads
- `MAX_UPLOAD_MB=5` (Starter default)
- `UPLOAD_ALLOWED_MIME=pdf,jpg,jpeg,png` (tight allowlist)
- `FILES_RETENTION_DAYS=90`
- `EXPORTS_RETENTION_DAYS=30`

**Enforce in:**
- upload handler (reject early)
- background retention job (daily)

---

### 4.2 Exports (biggest cost spike area)
- `MAX_EXPORT_ROWS=50000`
- `MAX_EXPORT_BYTES=104857600` (100MB)
- `MAX_EXPORTS_PER_COMPANY_PER_DAY=5`
- `MAX_EXPORT_RUNTIME_SECONDS=120`
- `MAX_CONCURRENT_EXPORTS_GLOBAL=1` (MVP default)
- `MAX_CONCURRENT_EXPORTS_PER_COMPANY=1`
- `EXPORT_OFFPEAK_ONLY=false` (flip to true if needed)

**Enforce in:**
- export request handler: quota check + enqueue only (no heavy work inline)
- worker: chunked streaming to S3 + runtime limit + fail fast on limit breach

---

### 4.3 Public Sign-in Abuse Controls
- `RL_PUBLIC_SLUG_PER_IP_PER_MIN=30`
- `RL_SIGNIN_PER_IP_PER_MIN=30`
- `RL_SIGNIN_PER_SITE_PER_MIN=200`
- `RL_SIGNOUT_PER_IP_PER_MIN=30`

**Enforce in:**
- server actions in `/src/app/s/[slug]/actions.ts`
- stable production keys (no runId)

---

### 4.4 SMS/Email Controls (cost trap controls)
**Default stance:** SMS is OFF unless explicitly enabled.
- `SMS_ENABLED=false`
- `MAX_MESSAGES_PER_COMPANY_PER_MONTH=0` (Starter default)

If enabled (paid tier):
- `MAX_MESSAGES_PER_COMPANY_PER_MONTH=100` (or lower)
- Provider must be pay-as-you-go.

**Enforce in:**
- single message-sending wrapper (centralized)

---

### 4.5 Logging/Audit Retention
- `AUDIT_RETENTION_DAYS=90` (Starter default)
- `LOG_RETENTION_DAYS=14` (platform/log drain retention)

**Enforce in:**
- scheduled DB cleanup job for audit logs
- rely on platform for stdout retention

---

### 4.6 Kill Switches (must exist)
- `FEATURE_EXPORTS_ENABLED=true`
- `FEATURE_UPLOADS_ENABLED=true`
- `FEATURE_VISUAL_REGRESSION_ENABLED=false` (prod default)
- `FEATURE_PUBLIC_SIGNIN_ENABLED=true`

**Enforce in:**
- early in server actions + job enqueue functions

---

## 5) Architecture Defaults (Cost-aware)

### 5.1 App
- Next.js App Router + Server Actions
- Single app instance MVP; scale horizontally only when needed

### 5.2 Database
- One Postgres primary, single region
- Prefer compound unique indexes and safe update patterns
- Optional RLS only for premium; do not make MVP depend on it

### 5.3 Jobs
- pg-boss backed by Postgres
- Strict concurrency limits, chunked streaming for exports

### 5.4 Storage
- S3-compatible storage
- Signed URLs for downloads
- Lifecycle cleanup for exports

---

## 6) Competitor Feature Mapping Rules (Grounding required)
When mapping competitor features:
- Only claim a capability if it is **explicitly visible** in provided inputs.
- Add an **Evidence** field: URL + section heading (or a short snippet ≤ 25 words).
- If not proven, mark **Unverified**.

---

## 7) Required Output Format for Any AI Proposal

Any AI proposing changes must output:

1) Change summary  
2) Cost impact (DB reads/writes, storage, egress, job volume, SMS/email volume)  
3) Security impact (tenant isolation, auth, PII handling)  
4) Guardrails affected (env vars/caps involved)  
5) Cheaper fallback  
6) Test plan (unit/integration/e2e)

If cost impact cannot be estimated, state assumptions and bounds.

---

## 8) Priorities (P0 + P1 are BOTH “NOW”)

### NOW (P0 + P1 — implement together)
**Security + cost controls + CI reliability in one push:**

- Tenant isolation by construction (`scopedDb`, ban raw prisma in repos, tests)
- Public abuse controls (rate limits + stable keys)
- Export caps + concurrency + retention jobs
- Durable audit logging in DB
- CI schema-per-worker (Option A) + test run isolation (runId)
- Postgres-based rate limiting fallback (if Redis not used)
- Session/flow resilience for kiosk/public induction (save progress)

### Later (P2 / paid tiers)
- RLS (high-security tenants)
- Advanced observability (only when revenue supports)
- Deeper compliance suite (documents, SWMS/JSA libraries) only if paid

---

## 9) CI Option Selection (Option A)
**Selected:** Option A — schema-per-worker in CI + runId namespacing (CI-only)

- Each test worker uses schema: `test_<runId>_<workerId>`
- Test fixtures and test rate-limit keys are namespaced by runId
- Production must never rely on runId

---

## 10) Out of Scope (Cost/Policy) examples (unless paid tier justifies)
- Always-on SIEM/Datadog
- Native offline apps
- Geofencing
- SMS at every sign-in/sign-out
- Per-tenant DB isolation

---

**This document must be referenced before implementing any feature or refactor.**  
If there is a conflict, propose an alternative that stays within budget and preserves tenant isolation.
