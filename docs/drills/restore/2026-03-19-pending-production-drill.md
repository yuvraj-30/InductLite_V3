# Restore Drill Evidence - Executed

Status: `pass`
Prepared: `2026-03-19`
Executed: `2026-03-25 23:11:00 +13:00` to `2026-03-25 23:30:46 +13:00`
Environment: `local prod-like app target against restored Neon branch`
Owner role: `Platform / SRE`
Runbook: `docs/OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md`

## Execution Record

- Operator: `Yuvraj Singh`
- Restore point timestamp: `2026-03-25T10:00:00Z`
- Release SHA: `f34014b67ffbba7232627921176f8bbccd575182`
- Neon branch / database identifier:
  - Branch name: `production_old_2026-03-25T10:00:00Z`
  - Branch id: `br-fancy-thunder-a70fernz`
  - Compute id: `ep-floral-poetry-a7s6skv7`
  - Database: `neondb`
- App URL used for smoke validation: `http://127.0.0.1:3000`

## Actual Recovery Metrics

- Actual RPO: `~11 minutes`
  - Restore point was `2026-03-25T10:00:00Z` (`23:00 NZDT`)
  - Restore was initiated at approximately `23:11 NZDT`
- Actual RTO: `~20 minutes end-to-end`
  - From restore initiation to green smoke completion

## Command Results

1. Initial schema check:

```text
npm run -w apps/web db:status
Result: FAIL
Reason: restored branch was one migration behind the current release
Pending migration: 20260317183000_add_ehs_action_inspection_competency_resource_readiness
```

2. Recovery remediation on restored target:

```text
npm run -w apps/web db:migrate
Result: PASS
Applied migration: 20260317183000_add_ehs_action_inspection_competency_resource_readiness
```

3. Schema re-check:

```text
npm run -w apps/web db:status
Result: PASS
Database schema is up to date
Datasource target: ep-floral-poetry-a7s6skv7.ap-southeast-2.aws.neon.tech / neondb
```

4. Smoke verification:

```text
npm run -w apps/web test:e2e:smoke
Result: PASS
Summary: 39 passed
Mode: E2E_SERVER_MODE=prod
Key runtime preflight: dbPresent=true, dbReady=true
```

## Issues Found

- The restored Neon branch did not include the latest release migration at first validation.
- Recovery required a `db:migrate` step before the restored target matched the release candidate schema.
- A PostgreSQL client warning about future `sslmode=require` behavior was emitted during the smoke run, but it did not block validation.

## Remediation Owner

- Platform / Release: keep restore runbook explicit that restored targets must pass `db:status` and run `db:migrate` before smoke when the release schema is ahead of the restore point.

## Final Decision

- Pass criteria met:
  - restored database became reachable
  - schema compatibility was re-established
  - smoke suite passed against the restored target
  - actual RPO and actual RTO were recorded
  - operator and release SHA were recorded

- Final result: `PASS`

## Sign-off

- Operator sign-off: `Yuvraj Singh`
- Date: `2026-03-25`
