# Runbook - Restore Drill

## Purpose

This drill proves that Neon PITR restore, migration validation, and post-restore smoke checks can recover the production topology documented in [Deployment - Render + Neon + R2 + Upstash](./DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md).

## Frequency

- Quarterly at minimum
- Before any go-live that changes database, storage, cron orchestration, or export flow behavior

## Required Inputs

- Neon PITR enabled for the target environment
- Render deployment URL and current release SHA
- Latest migration status from `npm run -w apps/web db:status`
- Current smoke command bundle
- Evidence template under `docs/drills/restore/`

## Evidence Artifact

- Save each execution as `docs/drills/restore/YYYY-MM-DD.md`
- Include actual operator, environment, restore point, RPO, RTO, smoke results, issues, and sign-off

## Procedure

1. Capture the target restore timestamp, current release SHA, and active environment config snapshot.
2. Create a Neon PITR restore to a new branch/database at the chosen timestamp.
3. Point a production-like app instance at the restored database using the same single-web-service plus cron-routes topology.
4. Run `npm run -w apps/web db:status` and confirm schema compatibility before serving traffic.
5. Run smoke checks for `/health`, admin login, public sign-in, and export download.
6. Verify retention/maintenance cron routes can still run with the restored data.
7. Measure actual elapsed restore time and compare it with the RTO target.
8. Record failures, deviations, remediation owners, and final sign-off in the dated artifact.

## Exit Criteria

- PITR restore completed successfully
- Smoke checks passed on the restored stack
- Actual RPO and RTO were recorded
- Follow-up actions were assigned for any drift or failure

## Prepared Evidence Paths

- [Restore drill template (2026-03-19)](./drills/restore/2026-03-19-pending-production-drill.md)
