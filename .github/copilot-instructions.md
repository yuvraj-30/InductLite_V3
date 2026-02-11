# Copilot Instructions for InductLite

> Multi-tenant SaaS (Next.js 14+ App Router, Prisma, Postgres) for NZ construction companies. QR-based site sign-ins + inductions.

## Critical Architecture: Tenant Isolation (Security Invariant)

**Every database query for tenant-owned data MUST use `scopedDb(companyId)`.**

```ts
// ✅ CORRECT: Repository pattern with scopedDb
import { scopedDb } from "@/lib/db/scoped-db";
export async function findSiteById(companyId: string, siteId: string) {
  const db = scopedDb(companyId);
  return db.site.findFirst({ where: { id: siteId } }); // company_id auto-injected
}

// ❌ WRONG: Raw prisma on tenant models = IDOR vulnerability
import { prisma } from "@/lib/db/prisma";
await prisma.site.findFirst({ where: { id: siteId } }); // NEVER for tenant data
```

**Tenant models** (require `scopedDb`): `user`, `site`, `inductionTemplate`, `signInRecord`, `contractor`, `contractorDocument`, `auditLog`, `exportJob`

**Blocked Prisma operations** on tenant models: `findUnique`, `update`, `delete`, `upsert` — use `findFirst/findMany` + `updateMany/deleteMany` instead. The `scopedDb` proxy throws at runtime if you try.

**Unscoped access (`publicDb`)**: Only for slug lookups in public sign-in flow. See [public-db.ts](../apps/web/src/lib/db/public-db.ts).

## Server Actions Pattern

All mutating actions follow this structure:

```ts
"use server";
import { assertOrigin } from "@/lib/auth/csrf";
import { checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createSite } from "@/lib/repository";

export async function createSiteAction(formData: FormData): Promise<ActionResult> {
  await assertOrigin();                                    // 1. CSRF check (required for mutations)
  const guard = await checkPermission("site:manage");      // 2. Permission check
  if (!guard.success) return { success: false, error: guard.error };
  const ctx = await requireAuthenticatedContextReadOnly(); // 3. Get tenant context
  const validated = schema.safeParse(Object.fromEntries(formData)); // 4. Zod validation
  const site = await createSite(ctx.companyId, validated.data); // 5. Repository call
  revalidatePath("/admin/sites");                          // 6. Revalidate cache
}
```

Reference: [apps/web/src/app/admin/sites/actions.ts](../apps/web/src/app/admin/sites/actions.ts)

## Two Context Patterns

```ts
// Admin routes: company from authenticated session
const ctx = await requireAuthenticatedContextReadOnly();

// Public QR routes (/s/[slug]): company derived from site slug
const ctx = await requirePublicContext(slug);
```

Both return `{ companyId, ... }` for use with `scopedDb()`.

## Key Directories

| Concern | Path |
|---------|------|
| Tenant scoping | [apps/web/src/lib/db/scoped-db.ts](../apps/web/src/lib/db/scoped-db.ts) |
| Repository layer | [apps/web/src/lib/repository/](../apps/web/src/lib/repository) |
| Auth + CSRF | [apps/web/src/lib/auth/](../apps/web/src/lib/auth) |
| Rate limiting | [apps/web/src/lib/rate-limit/](../apps/web/src/lib/rate-limit) |
| Export jobs | [apps/web/src/lib/export/](../apps/web/src/lib/export) |
| ESLint security | [apps/web/eslint-plugin-security/](../apps/web/eslint-plugin-security) |
| Prisma schema | [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma) |

## Commands

```bash
# Development
npm install && docker compose up db -d
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev                                    # Turborepo: starts all packages

# Required before PR
npm run lint && npm run typecheck

# Testing
npm run test                                   # Unit tests (Vitest)
cd apps/web && npm run test:integration        # Real Postgres via Testcontainers
cd apps/web && npm run test:e2e                # Playwright E2E
cd apps/web && npm run test:e2e:smoke          # Quick smoke tests
```

## ESLint Security Rules (CI-enforced)

Custom plugin at `apps/web/eslint-plugin-security/`:
- **no-raw-sql**: Blocks `$executeRaw`, `$queryRaw` — use Prisma query builder
- **require-company-id**: Flags repository queries missing `company_id`
- **no-env-secrets-client**: Prevents `process.env.SECRET_*` in client code

## Background Jobs: Export Pattern

Exports run async via pg-boss, never inline:

```ts
// Server Action: enqueue only (check quota first)
await prisma.exportJob.create({
  data: { company_id: ctx.companyId, export_type: "SIGN_IN_CSV", status: "QUEUED" }
});

// Worker picks up jobs: apps/web/src/lib/export/runner.ts
```

Guardrails: Max 50k rows, 100MB, 5 exports/company/day, 120s timeout.

## Guardrails (ARCHITECTURE_GUARDRAILS.md)

- **Uploads**: Max 5MB, allowlist: `pdf,jpg,jpeg,png`
- **Rate limiting keys**: `hash(ip + userAgent)` for anonymous, `userId` for authenticated
- **Budget constraint**: MVP ≤ NZD 150/mo infra — avoid Datadog/Kafka/multi-region

## Adding New Tenant Tables

1. Add model to [schema.prisma](../apps/web/prisma/schema.prisma) with `company_id` + `@@index([company_id])`
2. Add model name to `TENANT_MODELS` array in [scoped-db.ts](../apps/web/src/lib/db/scoped-db.ts)
3. Add to ESLint `tenantTables` in [eslint-plugin-security/index.js](../apps/web/eslint-plugin-security/index.js)
4. Create repository in `apps/web/src/lib/repository/` using `scopedDb` pattern
5. Add IDOR test in [tests/integration/cross-tenant-idor.test.ts](../apps/web/tests/integration/cross-tenant-idor.test.ts)

## Error Handling: RepositoryError Pattern

Repository methods throw typed `RepositoryError` with specific codes. Map them in server actions:

```ts
import { RepositoryError } from "@/lib/repository/base";

try {
  await createSite(ctx.companyId, data);
} catch (error) {
  if (error instanceof RepositoryError) {
    switch (error.code) {
      case "NOT_FOUND":      return { success: false, error: "Resource not found" };
      case "ALREADY_EXISTS": return { success: false, error: "Already exists" };
      case "FORBIDDEN":      return { success: false, error: "Access denied" };
      case "VALIDATION":     return { success: false, error: error.message };
      case "FOREIGN_KEY":    return { success: false, error: "Referenced entity missing" };
      default:               return { success: false, error: "Database error" };
    }
  }
  throw error; // Re-throw unexpected errors
}
```

**Error codes**: `NOT_FOUND`, `ALREADY_EXISTS`, `DUPLICATE`, `FORBIDDEN`, `INVALID_INPUT`, `VALIDATION`, `FOREIGN_KEY`, `DATABASE_ERROR`

Use `handlePrismaError(error, "EntityName")` in repositories to auto-convert Prisma errors.

## Rate Limiting Configuration

Three rate limiters with different thresholds. Uses Upstash Redis in production, in-memory fallback for dev.

| Endpoint | Limit | Window | Key Pattern |
|----------|-------|--------|-------------|
| Login | 5 requests | 15 min | `login:{clientKey}:{email}` |
| Public sign-in | 10 requests | 1 hour | `signin:{clientKey}:{siteSlug}` |
| Public slug access | 10 requests | 1 min | `public-slug:{clientKey}` |

**clientKey** = `hash(ip + userAgent)` — see [clientKey.ts](../apps/web/src/lib/rate-limit/clientKey.ts)

```ts
// Usage in server actions
import { checkLoginRateLimit, checkSignInRateLimit } from "@/lib/rate-limit";

const rateLimit = await checkLoginRateLimit(email);
if (!rateLimit.success) {
  return { success: false, error: "Too many attempts. Try again later." };
}
```

**Proxy trust**: Set `TRUST_PROXY=1` to use `x-forwarded-for` header for IP extraction.

## CSP & Middleware

[middleware.ts](../apps/web/src/proxy.ts) applies nonce-based Content Security Policy on every request.

**Key behaviors**:
- Generates per-request nonce via `crypto.getRandomValues`
- Passes nonce to components via `x-nonce` header
- Production: strict CSP, no `unsafe-eval` or `unsafe-inline`
- Development: relaxed for HMR/tooling

**CSP environment variables** (for Report-Only testing):
- `CSP_REPORT_ONLY=1` — enable stricter report-only policy
- `CSP_REPORT_ENDPOINT=/api/csp-report` — violation report endpoint
- `CSP_RO_CONNECT_SRC`, `CSP_RO_IMG_SRC`, `CSP_RO_FONT_SRC` — allowlist overrides

**Adding external scripts/styles**: Use the nonce from headers, or add origin to CSP allowlist:
```tsx
// In server component
const nonce = headers().get("x-nonce") ?? "";
<script nonce={nonce} src="..." />
```

**Skipped paths**: `/_next/static`, `/_next/image`, `/favicon`, `/api/*`

## Before Proposing Changes

For security-sensitive areas (auth, tenant scoping, exports, uploads, rate limiting):
1. Read `ARCHITECTURE_GUARDRAILS.md` first
2. State cost impact (DB/storage/egress) and security impact (tenant isolation/PII)
3. Find existing pattern in `apps/web/src/lib/` — follow it
4. Add tests proving the invariant holds (especially IDOR prevention)
