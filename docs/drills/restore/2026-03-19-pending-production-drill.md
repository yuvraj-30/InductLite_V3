# Restore Drill Evidence - Pending Production Execution

Status: `pending execution`
Prepared: `2026-03-19`
Environment: `production-like restore target`
Owner role: `Platform / SRE`
Runbook: `docs/OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md`

## Required Fields

- Operator
- Restore point timestamp
- Release SHA
- Neon branch / database identifier
- App URL used for smoke validation
- Actual RPO
- Actual RTO
- Smoke command results
- Issues found
- Remediation owner
- Sign-off

## Smoke Commands

- `npm run -w apps/web db:status`
- `npm run -w apps/web test:e2e:smoke`

## Pass Criteria

- Restored database is reachable
- Smoke commands succeed
- Actual RPO and RTO are recorded
- Release SHA and operator are recorded

## Notes

- This placeholder exists so the repo has a dated artifact path ready for the first real restore drill.
- Replace this file with the executed drill record; do not leave the status as `pending execution` for go-live approval.
