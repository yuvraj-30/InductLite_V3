# Runbook - Prisma Migrations (Neon + Render Free Tier)

## Purpose

Use this runbook for production schema changes when Render shell is unavailable.
It covers:

- Safe migration rollout to Neon
- Post-migration verification
- Rollback options
- Long/heavy migration strategy

## Scope and Safety Rules

1. Use `prisma migrate deploy` (`npm run -w apps/web db:migrate`) for production.
2. Do not use `db push` in production except emergency break-glass.
3. Treat rollback as restore/switch (Neon branch or PITR), not down-migrations.
4. Keep migrations backward compatible (expand/contract).

## Prerequisites

- Production secrets available locally (temporary shell session only):
  - `DATABASE_URL` (Neon pooler, port 6543)
  - `DATABASE_DIRECT_URL` (Neon direct, port 5432)
- Current branch synced to deploy commit.
- Neon PITR enabled.
- Render deploy hook URL (optional but recommended for post-migrate deploy).

Reference: [Deployment Guide](./DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md)

## Standard Release Workflow

### 1) Preflight

Run from repo root:

```bash
npm run -w apps/web db:generate
npm run db:status
```

Expected:
- Prisma client generates successfully.
- No migration history mismatch errors.

### 2) Set production DB env vars in local shell

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://...-pooler...:6543/...?...";
$env:DATABASE_DIRECT_URL="postgresql://...-direct...:5432/...?...";
```

Bash:

```bash
export DATABASE_URL='postgresql://...-pooler...:6543/...?...'
export DATABASE_DIRECT_URL='postgresql://...-direct...:5432/...?...'
```

### 3) Apply migrations to Neon

```bash
npm run -w apps/web db:migrate
npm run db:status
```

Expected:
- New migrations marked as applied.
- Status reports database is up to date.

### 4) Deploy app code

- Trigger Render deploy (manual or deploy hook).
- Ensure deployed commit matches the migration set.

### 5) Smoke-test after deploy

Minimum checks:

1. `GET /api/ready`
2. Admin login
3. Public sign-in path (`/s/<slug>`)
4. One admin mutation (for example create/update a record)
5. Export request + download flow (if enabled)

## Rollback Runbook (DB + App)

If production errors begin after migration:

1. Stop further deploys.
2. Identify last known-good timestamp/commit.
3. Create Neon restore target:
  - Preferred: restore branch from PITR timestamp.
4. Point `DATABASE_URL` and `DATABASE_DIRECT_URL` to restored DB.
5. Redeploy app.
6. Re-run smoke tests.
7. Record incident and root cause.

Related docs:
- [Rollback Runbook](./RUNBOOK_ROLLBACK.md)
- [Restore Runbook](./RUNBOOK_RESTORE.md)
- [Restore Drill](./RUNBOOK_RESTORE_DRILL.md)

## Long/Heavy Migration Strategy

Use expand/contract in multiple releases.

### Phase A: Expand (safe additive)

1. Add new nullable columns/tables/indexes.
2. Deploy code that can read old + new schema.
3. Start dual-write where needed.

### Phase B: Backfill (out-of-band)

1. Backfill in small batches (id range or timestamp windows).
2. Add progress checkpointing and retry support.
3. Run off-peak; monitor DB load and lock waits.

### Phase C: Contract (cleanup)

1. Enforce constraints once backfill is complete.
2. Remove old reads/writes in code.
3. Drop old columns/tables in a later release.

## Emergency Break-Glass

Only if `migrate deploy` is blocked and service is down:

```bash
npm run -w apps/web db:push
```

Then immediately:

1. Create a corrective migration in repo.
2. Reconcile migration history.
3. Document incident in release notes.

## CI and Governance Recommendations

1. Add a dedicated migration GitHub Action (single concurrency group).
2. Run migration before production deploy.
3. Block destructive migrations unless explicitly approved.
4. Require rollback plan for any migration touching large/high-traffic tables.

## Operator Checklist

Before migration:
- [ ] Confirm target commit SHA
- [ ] Confirm Neon URLs (pooler/direct) are correct
- [ ] Confirm PITR available

After migration:
- [ ] `npm run db:status` is clean
- [ ] Render deploy complete
- [ ] Smoke tests pass

After incident:
- [ ] Rollback completed and validated
- [ ] Postmortem recorded
- [ ] Runbook updated
