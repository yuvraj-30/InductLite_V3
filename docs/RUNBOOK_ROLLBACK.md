# Runbook — Deployment Rollback

## When to Roll Back

- Increased 5xx rates after deploy
- Data integrity issues
- Critical flow regression

## Steps (Render)

1. Identify last known good deploy.
2. Roll back web service to that deploy.
3. Roll back worker service if applicable.

## Database Migrations

- Prefer forward-only migrations.
- If a migration caused failure, restore from backup or apply a corrective migration.

## Verification

- Check /health and /ready.
- Verify public sign-in and admin login.
- Confirm exports queue and worker stability.
