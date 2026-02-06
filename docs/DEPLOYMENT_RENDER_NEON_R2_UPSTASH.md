# Deployment — Render + Neon + R2 + Upstash

## Services

- Web (Next.js)
- Worker (exports scheduler)
- Maintenance (daily retention)

## Build/Start Commands (Render)

- Build: `npm install && npx turbo run build --filter=@inductlite/web`
- Start (web): `cd apps/web && npm run start`
- Start (worker): `cd apps/web && npm run run:export-scheduler`
- Start (maintenance): `cd apps/web && npm run run:maintenance`

## Environment Variables

### Core

- DATABASE_URL
- SESSION_SECRET
- NEXT_PUBLIC_APP_URL
- TRUST_PROXY=1

### Storage (R2/S3)

- STORAGE_MODE=s3
- R2_ENDPOINT
- R2_BUCKET
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY

### Rate Limits

- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

### Sentry

- SENTRY_DSN

## Notes

- Enable Neon PITR for production.
- Keep R2 buckets private; use signed URLs only.
- Use separate Render services for web and worker.
