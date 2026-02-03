# AI_AGENT_INSTRUCTIONS.md — InductLite (Updated: 2026-02-03)

> **Read this first (non‑negotiable):** `ARCHITECTURE_GUARDRAILS.md` is the **authoritative** cost + security spec for InductLite.  
> Any proposal or code change must explicitly reference those guardrails and follow the **Required Output Format** (cost/security/guardrails/fallback/tests).

This file tells an AI coding agent (or any contributor) how to be productive in this repo **without breaking tenant isolation, security posture, or FinOps guardrails**.

---

## 0) 2026 baseline “gold standards” for this stack

**Runtime baseline (Feb 2026):**
- **Node.js:** Prefer **Node 24 (Active LTS)** for dev/CI/prod. Node 20 is in **Maintenance LTS** and approaching end-of-support sooner; treat it as minimum compatibility only.  
  Sources: Node release status and dates.  
- **Next.js:** Follow the official Next.js security guidance for Server Components/Actions and data exposure risk.  
- **AppSec:** Treat **SameSite cookies as defense-in-depth** and still enforce server-side CSRF protections on state-changing operations.  
  Sources: OWASP + MDN.

**Security “defaults” to preserve or improve:**
- **Tenant isolation by construction** (`company_id` scoping) is the primary invariant.
- **Defense-in-depth CSRF:** SameSite + origin/referrer checks, and use tokens for high-risk operations. OWASP also endorses modern **Fetch Metadata** checks as an effective approach.
- **Security headers:** HSTS, X-Content-Type-Options, frame protections, and a production-safe CSP (avoid `unsafe-inline`/`unsafe-eval` in prod where possible).  
  Sources: OWASP HTTP headers guidance.

**Supply-chain / hygiene (what recruiters and security reviews expect in 2026):**
- Pin and regularly update dependencies; run `npm ci` in CI; keep Next + eslint-config-next versions aligned.
- Avoid adding heavy observability/infra that violates `ARCHITECTURE_GUARDRAILS.md` budgets.

(References are linked in the chat response citations.)

---

## 1) Quick commands (local)

Repo root uses Turborepo:

- Dev (all): `npm run dev`
- Web app only: `cd apps/web && npm run dev`
- Lint / typecheck: `npm run lint` / `npm run typecheck`
- Unit tests: `npm run test` (or `cd apps/web && npm run test`)
- Integration tests (Testcontainers + real Postgres): `cd apps/web && npm run test:integration`
- E2E tests (Playwright): `cd apps/web && npm run test:e2e`
- Visual regression (Playwright snapshot suite): `cd apps/web && npm run test:visual`
- DB: `npm run db:migrate` / `npm run db:seed` (root forwards to `apps/web`)
- Prisma generate: `npm run db:generate`

---

## 2) Repo map (high signal)

- Web app: `apps/web`
- App code: `apps/web/src/app/**`
- Auth + CSRF + session: `apps/web/src/lib/auth/**`
- Tenant context: `apps/web/src/lib/tenant/context.ts`
- Scoped tenant DB access:
  - `apps/web/src/lib/db/scoped-db.ts` (**primary “by construction” tenant scoping**)
  - `apps/web/src/lib/db/scoped.ts` (additional scoped helpers)
- Repositories: `apps/web/src/lib/repository/**` (should use `scopedDb(companyId)`)
- Rate limiting: `apps/web/src/lib/rate-limit/**`
- ESLint security guardrails: `apps/web/eslint-plugin-security/**`
- E2E: `apps/web/e2e/**`

---

## 3) High-signal conventions to follow

### 3.1 Server Actions & CSRF (mutations)
**Rule:** Any Server Action that mutates state must do **CSRF validation first**.

In this repo:
- Use `await assertOrigin()` from `apps/web/src/lib/auth/csrf.ts` for mutating Server Actions.
- For “high-risk” mutations (password changes, security settings, role changes), also require a CSRF token check (see `src/lib/auth/csrf.ts` + session token patterns).

**Do not weaken this even if Next.js provides built-in origin matching for Server Actions**—treat framework protections as helpful, not sufficient.

**Recommended upgrade (gold standard):**
- Add a Fetch Metadata check (e.g. `Sec-Fetch-Site`) to `validateOrigin()` as an additional robust signal for rejecting cross-site requests, per OWASP guidance.

### 3.2 Tenant isolation (company_id) — “by construction”
**Rule:** Any access to tenant-owned tables MUST be scoped by `company_id` through one of:
- `scopedDb(companyId)` (preferred; enforces company_id and blocks unsafe ops)
- `requireAuthenticatedContextReadOnly()` then pass `companyId` explicitly to repos

**Do:**
- Always get `companyId` from `requireAuthenticatedContextReadOnly()` (or public context) and pass it to repository methods.
- Prefer `findFirst/findMany + updateMany/deleteMany` patterns when targeting tenant-owned rows.

**Do NOT:**
- Bypass scoping with “global” Prisma calls for tenant models.
- Use unique operations (`findUnique/update/delete/upsert`) on tenant models; `scopedDb` intentionally blocks these.

### 3.3 Raw SQL ban
- Do not use `prisma.$executeRaw`, `$queryRaw`, or unsafe variants. The ESLint rule `no-raw-sql` enforces this.

### 3.4 Secrets and env vars
- Never access non-`NEXT_PUBLIC_*` env vars from client components; the `no-env-secrets-client` rule enforces this.
- Keep `.env` out of git; use `.env.example` as the contract.

### 3.5 Logging and audit logging (PII-safe)
- Use a request-scoped logger:
  - `generateRequestId()` (in `src/lib/auth/csrf.ts`)
  - `createRequestLogger()` (in `src/lib/logger`)
- Never log secrets or high-risk PII (passwords, session tokens, raw phone numbers). If you must log identifiers, log hashed/last-4 forms.

### 3.6 Rate limiting (public endpoints)
- Stable, spoof-resistant client keys are mandatory.
- Do **not** trust `x-forwarded-for` unless `TRUST_PROXY` is enabled and IP parsing is validated (see `src/lib/auth/csrf.ts` and `src/lib/rate-limit/clientKey.ts`).

---

## 4) Practical “gold standard” snippets

### 4.1 Mutating Server Action (CSRF + auth + tenant scope)

```ts
"use server";

import { assertOrigin } from "@/lib/auth/csrf";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { scopedDb } from "@/lib/db/scoped-db";

export async function createSite(form: FormData) {
  await assertOrigin(); // CSRF defense-in-depth
  const ctx = await requireAuthenticatedContextReadOnly();

  const db = scopedDb(ctx.companyId);
  // Example mutation: always tenant-scoped
  await db.site.create({ data: { name: String(form.get("name") ?? "") } });
}
```

### 4.2 Tenant-scoped repository call pattern

```ts
import { scopedDb } from "@/lib/db/scoped-db";

export async function deactivateContractor(companyId: string, contractorId: string) {
  const db = scopedDb(companyId);
  // Safe pattern: updateMany + company guard
  return db.contractor.updateMany({
    where: { id: contractorId },
    data: { active: false },
  });
}
```

### 4.3 Rate limit key design (production-stable)

```ts
// conceptually (see src/lib/rate-limit/*):
// clientKey = stable hash(ip + userAgent) or authenticated userId
// scopeKey = `${companyId}:${siteSlug}:${endpoint}`
```

### 4.4 Exports: reject early, enqueue job, enforce quotas
- Enforce `MAX_EXPORT_ROWS`, `MAX_EXPORT_BYTES`, per-company/day quotas and concurrency from `ARCHITECTURE_GUARDRAILS.md`.
- Never generate large exports inside the request/Server Action—enqueue via `pg-boss`, then stream to S3 in the worker.

---

## 5) Testing & CI expectations

### 5.1 Unit tests (Vitest)
- Add unit tests for any new server-side logic.
- Place near the code under `apps/web/src/**/__tests__/**` when practical.

### 5.2 Integration tests (real Postgres)
- If you change repository/DB behavior, add/adjust `apps/web/tests/integration/**/*.test.ts` and run:
  - `cd apps/web && npm run test:integration`

### 5.3 E2E tests (Playwright)
- If you change user-visible flows, update `apps/web/e2e/**` and run:
  - `cd apps/web && npm run test:e2e`

### 5.4 Security guardrails tests
- If you change `apps/web/eslint-plugin-security/**`, update rule tests accordingly (RuleTester-based).

---

## 6) PR checklist (mandatory)

Before opening a PR:

1. `npm run lint` and `npm run typecheck` pass.
2. Unit tests updated and passing: `npm run test`.
3. Integration tests updated if DB logic changed: `cd apps/web && npm run test:integration`.
4. E2E tests updated if flows/UI changed: `cd apps/web && npm run test:e2e`.
5. DB migrations included and verified locally: `npm run db:migrate && npm run db:seed`.
6. Security invariants preserved:
   - **Mutating** Server Actions: `await assertOrigin()` and validation.
   - Tenant isolation: `scopedDb(companyId)` or equivalent scoping.
   - No raw SQL.
   - No secret env vars in client code.
7. Any guardrail/env var change is reflected in:
   - `ARCHITECTURE_GUARDRAILS.md` (if policy changes)
   - `.env.example` (as the contract)
   - tests proving enforcement

---

## 7) Proposal template (required in PR description)

Include **all** sections below (copy/paste):

1. **Change summary** — what + why.
2. **Cost impact** — DB reads/writes, storage, egress, job volume, SMS/email volume (bounds OK).
3. **Security impact** — tenant isolation, auth, CSRF, PII handling, logging.
4. **Guardrails affected** — env vars/caps involved (from `ARCHITECTURE_GUARDRAILS.md`).
5. **Cheaper fallback** — alternative approach within budget.
6. **Test plan** — unit/integration/e2e + exact commands.

---

## 8) “If unclear” rule

If a change touches **auth, session, tenant scoping, exports, uploads, rate limiting, or audit logs**:
- stop and re-check `ARCHITECTURE_GUARDRAILS.md`,
- find an existing pattern in `apps/web/src/`,
- then implement + add tests.

