# Migration Policy

## Principles

- Prefer additive, backward-compatible migrations.
- Avoid destructive changes without a backfill/rollout plan.
- Run migrations in low-traffic windows.

## Process

1. Add migration in Prisma.
2. Validate locally with `npm run db:migrate:dev`.
3. Run CI migrations on ephemeral DBs.
4. Deploy to staging and smoke test.
5. Promote to production.

## Rollback

- Prefer forward fixes over down-migrations.
- If a migration fails, use restore runbook or corrective migration.
