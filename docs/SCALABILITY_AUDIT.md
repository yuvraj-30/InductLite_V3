# SCALABILITY AUDIT: PERFORMANCE KILLERS AT 10K USERS

## 1) Performance Scorecard (0-10)
- **Database Hygiene:** 6.8/10
- **Frontend Efficiency:** 7.1/10
- **Scalability:** 6.4/10

## 2) The "Bottleneck" List

### Critical
- **Missing FK index: `SignInRecord.signed_out_by`**
  - Evidence: FK exists at `apps/web/prisma/schema.prisma:199` but no `@@index([signed_out_by])` in `SignInRecord`.
  - Why this breaks at scale: joins or lookups by sign-out user degrade to table scans as sign-in rows grow.

- **Missing FK index: `EmailNotification.user_id`**
  - Evidence: FK exists at `apps/web/prisma/schema.prisma:248` but no `@@index([user_id])` in `EmailNotification`.
  - Why this breaks at scale: user-targeted notification queries and relation joins become progressively slower.

- **Unbounded red-flag batch scan in email worker**
  - Evidence: `publicDb.inductionResponse.findMany` with no `take`/cursor at `apps/web/src/lib/email/worker.ts:16`.
  - Why this breaks at scale: reads entire 24h window into memory, then performs nested processing/email fan-out.

- **Unbounded XML sitemap generation**
  - Evidence: `prisma.sitePublicLink.findMany` with no paging at `apps/web/src/app/sitemap.xml/route.ts:13` and full string assembly via `.join` at `apps/web/src/app/sitemap.xml/route.ts:28`.
  - Why this breaks at scale: memory growth and slow response time proportional to active link count.

### High
- **Sequential data fetching waterfalls in server pages**
  - `apps/web/src/app/admin/sites/[id]/page.tsx:75` -> `:81` -> `:87` -> `:94` -> `:97`
  - `apps/web/src/app/admin/templates/[id]/page.tsx:30` -> `:41` -> `:42` -> `:45`
  - `apps/web/src/app/admin/templates/page.tsx:60` -> `:71` -> `:72` -> `:76`
  - `apps/web/src/app/admin/sites/page.tsx:33` -> `:42|:44` -> `:48` -> `:58`
  - `apps/web/src/app/admin/exports/page.tsx:22` -> `:28` -> `:29`
  - Impact: increased TTFB from avoidable serialized IO; hurts Core Web Vitals under load.

- **N-per-document signed URL generation in contractor portal**
  - Evidence: per-document `getSignedDownloadUrl` in mapped `Promise.all` at `apps/web/src/app/contractor/portal/page.tsx:35` and `:38`.
  - Impact: burst of storage-signing calls per request; latency and provider cost scale with document count.

- **Contains/insensitive search patterns likely causing seq scans**
  - Evidence:
    - `apps/web/src/lib/repository/signin.repository.ts:250`
    - `apps/web/src/lib/repository/signin.repository.ts:251`
    - `apps/web/src/lib/repository/contractor.repository.ts:192`
    - `apps/web/src/lib/repository/user.repository.ts:178`
    - `apps/web/src/lib/repository/template.repository.ts:291`
  - Impact: `%...%`-style text matching on large tables gets expensive quickly without dedicated search indexing strategy.

### Medium
- **JSON-heavy payload storage in hot paths**
  - JSON columns: `apps/web/prisma/schema.prisma:158`, `apps/web/prisma/schema.prisma:162`, `apps/web/prisma/schema.prisma:232`, `apps/web/prisma/schema.prisma:372`, `apps/web/prisma/schema.prisma:423`.
  - Current state: no evidence of JSON key filtering (good), but large JSON payloads increase row size, IO, and serialization cost.

- **No `<img>` CLS issue detected**
  - Scan result: no raw `<img>` tags found in `apps/web/src/app` and `apps/web/src/components`.
  - Residual risk: low for CLS from image dimensions.

- **Bundle bloat risk is localized, not systemic**
  - Heavy client libs observed in client components:
    - `react-signature-canvas` at `apps/web/src/app/s/[slug]/components/SignInFlow.tsx:13`
    - `qrcode.react` at `apps/web/src/app/admin/sites/[id]/QRCodeButton.tsx:4`
  - No evidence of client import of server DB libs or `zod` from app/components.

- **Server bundle/cold-start weight risk**
  - Evidence: `serverExternalPackages` includes `puppeteer` at `apps/web/next.config.js:51`.
  - Impact: larger standalone artifact and slower cold starts in constrained/serverless environments.

- **Console leftovers (not a major hot-loop issue)**
  - Production-path examples: `apps/web/src/app/sitemap.xml/route.ts:47`, `apps/web/src/lib/repository/audit.repository.ts:354`.
  - No major `console.log` inside hot production loops found.

- **Zombie components in `src/components`**
  - Result: none detected. Current component files are imported:
    - `apps/web/src/components/ui/alert.tsx`
    - `apps/web/src/components/ui/public-shell.tsx`

## 3) Optimization Plan

| Bottleneck | Impact | Fix |
|---|---|---|
| Missing index on `SignInRecord.signed_out_by` | Slow joins/lookups as sign-in table grows | Add `@@index([signed_out_by])` in `SignInRecord` (`apps/web/prisma/schema.prisma`). |
| Missing index on `EmailNotification.user_id` | Slower user-centric notification queries and joins | Add `@@index([user_id])` in `EmailNotification` (`apps/web/prisma/schema.prisma`). |
| Unbounded red-flag worker scan | Memory spikes and long cron duration | Convert `findMany` to chunked cursor loop with `take` (e.g., 200-500), process/flush each chunk (`apps/web/src/lib/email/worker.ts`). |
| Unbounded sitemap generation | Slow response and memory growth with many active links | Generate sitemap in pages/chunks or cap entries per request and split sitemap index (`apps/web/src/app/sitemap.xml/route.ts`). |
| Sequential awaits in page loaders | Higher TTFB and weaker Core Web Vitals | Parallelize independent reads with `Promise.all` in listed `page.tsx` files. |
| Per-document URL signing | Latency + request amplification to storage signer | Batch signing API or lazy-sign on click/download endpoint (`apps/web/src/app/contractor/portal/page.tsx`). |
| `%contains%` filters on large tables | Expensive scans at high row counts | For hot filters, switch to prefix search where possible or add DB search strategy (trigram/full-text) and cap search windows. |
| JSON payload growth in response tables | Larger rows, slower serialization and backups | Keep JSON for flexible fields, but add tighter size/depth guards and archive/partition large historical records over time. |

## 4) Guardrail-Aligned Notes (Cost/Security)
- **Cost impact of fixes:** mostly low-medium. Adding indexes and parallelized reads is cheap; biggest savings come from chunked workers and avoiding oversized scans.
- **Security impact:** neutral-positive. No tenant isolation or CSRF guardrails need to be weakened for any proposed optimization.
- **Cheaper fallback first:** prioritize indexes + `Promise.all` + worker chunking before adding new infra.

## 5) Quick Wins (Execution Order)
1. Add the 2 missing FK indexes (`signed_out_by`, `user_id`) and migrate.
2. Chunk `email/worker.ts` red-flag processing and sitemap output.
3. Remove obvious page-level waterfalls with `Promise.all`.
4. Re-test Core Web Vitals (TTFB/LCP) on admin routes and public sign-in.
