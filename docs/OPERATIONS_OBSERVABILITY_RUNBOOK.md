# Operations Observability Runbook

Updated: `2026-02-21`
Scope: Runtime behavior for logging, health, readiness, and operational triage.

## Logging Standard

- Use request-scoped logger: `createRequestLogger(generateRequestId(), context)`.
- Include stable keys for triage:
  - `request_id`
  - `company_id` (when available)
  - route/action hint (`path`, `method`, or explicit action)
- Avoid logging secrets or sensitive PII.

Primary updated paths:

- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/history/page.tsx`
- `apps/web/src/app/admin/live-register/page.tsx`
- `apps/web/src/app/admin/sites/[id]/page.tsx`
- `apps/web/src/lib/rate-limit/telemetry.ts`
- `apps/web/src/app/sitemap.xml/route.ts`

## Health and Readiness Behavior

- `GET /health`
  - Returns `200` when DB probe succeeds.
  - Returns `503` with sanitized message `Database unavailable` when DB probe fails.
  - Detailed error remains server-side log only.
- `GET /api/ready`
  - Returns `200` when env validation + DB probe pass.
  - Returns `503` when env validation fails or DB probe fails.
  - Adds lightweight per-IP throttle (120 requests/minute) and returns `429` with `retry-after: 60` when exceeded.

## Incident Triage Checklist

1. Confirm failing path and response class (`429`, `503`, `5xx`).
2. Query logs by `request_id` and `path`.
3. If readiness failures spike:
   - verify env validation output
   - verify DB reachability and connection saturation
4. If public sign-in failures spike:
   - inspect rate-limit telemetry
   - inspect audit log trends for `visitor.sign_in` and `visitor.sign_out`
5. For legal/compliance export questions:
   - verify `sign_in_record` links to legal version ids
   - verify `induction_response` has signature metadata fields

## Verification Commands

Run from repo root:

```bash
npm run lint
npm run typecheck
cd apps/web && npm run test
cd apps/web && npm run test:integration
```

Note: integration tests require Prisma client generation with query engine available (no engine lock).
