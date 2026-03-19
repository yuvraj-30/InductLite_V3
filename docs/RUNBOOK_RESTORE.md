# Runbook — Backup Restore

## Objectives

- RPO: 24 hours (MVP default)
- RTO: 4 hours (MVP default)

## Preconditions

- Neon PITR enabled or scheduled backups configured.
- Access to Render/Neon console.

## Steps (Neon)

1. Create a PITR restore to a new database branch/time.
2. Verify schema and data integrity.
3. Update production DATABASE_URL to point to restored DB.
4. Run Prisma migrations if required.
5. Run smoke tests (health, login, public sign-in, export).
6. Re-enable cron API routes / scheduled GitHub workflows.

## Validation

- Confirm health endpoint returns OK.
- Verify recent sign-ins and audit logs.

## Follow-Up

- Document restore time and issues.
- Save the drill artifact under `docs/drills/restore/YYYY-MM-DD.md`.
- Adjust retention or backup schedules if needed.
