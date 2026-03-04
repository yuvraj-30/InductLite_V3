# Deployment — Render + Neon + R2 + Upstash

## Services

- Web (Next.js + cron API routes)

## Build/Start Commands (Render)

- Build: `npm install && npx turbo run build --filter=@inductlite/web`
- Start: `cd apps/web && npm run start`

## Environment Variables

### Core

- DATABASE_URL (Neon pooler endpoint, port 6543) — runtime DB URL; in Render you may set this to `NEON_POOLER_URL`
- NEON_POOLER_URL (optional) — Neon pooler endpoint (port 6543)
- DATABASE_DIRECT_URL (Neon direct endpoint, port 5432, for migrations)
- SESSION_SECRET
- SESSION_SECRET_PREVIOUS (optional)
- DATA_ENCRYPTION_KEY (required in production, minimum 32 characters)
- NEXT_PUBLIC_APP_URL
- TRUST_PROXY=1
- CRON_SECRET
- CRON_ALLOWED_IPS (optional)
- CRON_ALLOW_GITHUB_ACTIONS=1
- CRON_ALLOW_PRIVATE_IPS=0
- CRON_ENFORCE_IP=1 (optional; set `0` for secret-only cron auth)

Note: IP allowlist matching supports IPv4 and IPv6 CIDR entries.

### Storage (R2/S3)

- STORAGE_MODE=s3
- R2_ENDPOINT
- R2_BUCKET
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY

### Rate Limits

- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

### Outbound Webhooks

- WEBHOOK_SIGNING_SECRET (optional, min 16 chars; enables `X-InductLite-Signature` HMAC header on outbound webhook deliveries)
- Site-level webhook endpoints and signing-secret overrides are managed in admin at `/admin/sites/:siteId/webhooks`; if site secret is unset, deliveries fall back to `WEBHOOK_SIGNING_SECRET`.

### Sentry

- SENTRY_DSN

## Notes

- Enable Neon PITR for production.
- Keep R2 buckets private; use signed URLs only.
- Single Render service keeps free-tier hours under control.
- GitHub Actions cron triggers export + maintenance via API routes.
  - Maintenance route now runs retention tasks plus queued-email processing (including pre-registration reminder batches and contractor document expiry reminders) and outbound webhook queue processing (retry/backoff/dead-letter handling).
- Apply schema migrations before first traffic after deploy:
  - One-off command: `cd apps/web && npm run db:migrate`
- For production migration/rollback operations (including Render free tier without shell), use:
  - [Migration Runbook](./MIGRATION_RUNBOOK.md)
  - [Rollback Runbook](./RUNBOOK_ROLLBACK.md)
  - [Restore Runbook](./RUNBOOK_RESTORE.md)

## Keep-Alive + Cron (Free Tier)

Render free-tier services can sleep when idle. A periodic health check reduces cold starts.

**Recommended (best for this repo): GitHub Actions cron**

- Free for public repos.
- Simple to maintain and lives in the same repo.
- Uses cron API routes to replace the worker + maintenance services.

Workflow included: `.github/workflows/render-keep-alive.yml`

Required GitHub secrets:

- `RENDER_APP_URL` (example: `https://your-domain.onrender.com`)
- `CRON_SECRET` (must match Render env)

Example values:

- `RENDER_APP_URL`: `https://inductlite.onrender.com`
- `CRON_SECRET`: `change-this-32+chars`

Rotation: update `CRON_SECRET` in both Render env vars and GitHub Secrets at the same time.
Avoid reusing `CRON_SECRET` across environments (dev/staging/prod).

Troubleshooting keep-alive failures:

- If GitHub Actions reports HTTP `403` on `/api/cron/export-scheduler`:
  - Confirm Render env has `TRUST_PROXY=1`.
  - Confirm `CRON_ALLOW_GITHUB_ACTIONS=1` (or set explicit `CRON_ALLOWED_IPS` CIDRs).
  - Confirm `CRON_SECRET` value matches exactly between Render env and GitHub Secrets.
  - Check response JSON body for `code` values:
    - `cron_secret_mismatch`
    - `cron_ip_missing`
    - `cron_ip_not_allowed`
  - For `cron_ip_not_allowed`, use `debug` fields in the JSON response to inspect parsed `client_ips` and GitHub meta lookup status.
  - If proxy/CDN IP forwarding is inconsistent and you need reliability over IP filtering, set `CRON_ENFORCE_IP=0` (secret-only auth for cron routes).
- Workflow now logs `/health` build metadata when available (`build.commit`, `build.source`).
  - If the logged commit does not match the workflow SHA, Render is serving an older deployment.

**Alternative (also free): UptimeRobot**

- 5-minute checks on the free plan.
- Good if you want an external monitor without CI usage.
