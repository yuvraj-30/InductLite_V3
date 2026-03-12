# Launch Checklist

This checklist is for moving from a free-tier build setup to a production-ready launch.

Related docs:
- [Deployment (Render + Neon + R2 + Upstash)](./DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md)
- [Production Checklist](../PRODUCTION_CHECKLIST.md)
- [Secrets Management](./SECRETS_MANAGEMENT.md)
- [Rollback Runbook](./RUNBOOK_ROLLBACK.md)
- [Restore Runbook](./RUNBOOK_RESTORE.md)
- [Key Rotation Runbook](./RUNBOOK_KEY_ROTATION.md)

## T-14 Days: Infra + Security Baseline

- [ ] Upgrade Render web service from Free to Starter (minimum before customer rollout).
- [ ] Confirm `TRUST_PROXY=1`.
- [ ] Set `CRON_ENFORCE_IP=1`.
- [ ] Set `CRON_ALLOW_GITHUB_ACTIONS=1`.
- [ ] Set `CRON_ALLOW_PRIVATE_IPS=0` (explicitly set it, do not leave implicit).
- [ ] Confirm `STORAGE_MODE=s3`.
- [ ] Rotate and reissue `SESSION_SECRET`, `CRON_SECRET`, and `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Add `SESSION_SECRET_PREVIOUS` for cookie/session secret rotation safety.
- [ ] Confirm Neon PITR/backups are enabled.
- [ ] Confirm object storage bucket is private and downloads use signed URLs.

## T-10 Days: Capacity + Data Integrity

- [ ] Run staging load test (minimum 200-500 concurrent sign-ins).
- [ ] Record p95 sign-in latency and DB connection usage.
- [ ] Verify queue processing clears backlog (email, webhook, export).
- [ ] Verify failed jobs are visible and replayable.

## T-7 Days: Observability + Alerting

- [ ] Set `SENTRY_DSN` in production.
- [ ] Configure alerts for 5xx spikes.
- [ ] Configure alerts for cron endpoint failures.
- [ ] Configure alerts for export job failures/dead jobs.
- [ ] Configure alerts for webhook dead-letter growth.
- [ ] Confirm alert recipients and escalation path.

## T-3 Days: Runbook Drill

- [ ] Simulate Redis outage and confirm app behavior.
- [ ] Simulate DB slowdown and observe queue recovery.
- [ ] Simulate cron secret mismatch and verify rejection path.
- [ ] Practice rollback and replay of failed queued work.

## T-1 Day: Release Freeze

- [ ] Freeze schema and environment variable changes.
- [ ] Run full CI on release commit.
- [ ] Confirm GitHub Secrets exist and match environment:
  - [ ] `RENDER_APP_URL`
  - [ ] `CRON_SECRET`

## Launch Day

- [ ] Deploy and verify `/health`.
- [ ] Trigger cron routes once:
  - [ ] `/api/cron/export-scheduler`
  - [ ] `/api/cron/maintenance`
- [ ] Execute one end-to-end production smoke flow:
  - [ ] Public sign-in
  - [ ] Admin visibility of sign-in
  - [ ] Export generation and download
  - [ ] Webhook dispatch and audit trail
- [ ] Monitor logs and Sentry for 2-4 hours post deploy.

## Production Environment Target

```env
TRUST_PROXY=1
STORAGE_MODE=s3
CRON_ALLOW_GITHUB_ACTIONS=1
CRON_ALLOW_PRIVATE_IPS=0
CRON_ENFORCE_IP=1
NEXT_PUBLIC_APP_URL=https://inductlite-app.onrender.com
```

## Sign-Off

- [ ] Engineering sign-off
- [ ] Security sign-off
- [ ] Operations sign-off
