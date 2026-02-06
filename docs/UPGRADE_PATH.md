# Upgrade Path (Adapters, No Rewrites)

## Adapter Boundaries

- Storage: `apps/web/src/lib/storage/*`
- Rate limiting: `apps/web/src/lib/rate-limit/*`
- Queue/exports: `apps/web/src/lib/export/*`

## Strategy

- Swap providers behind adapters (R2 ↔ S3)
- Keep repository interfaces stable
- Prefer small, reversible migrations
