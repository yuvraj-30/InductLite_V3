# Rollback Drill Evidence - Pending Production Execution

Status: `pending execution`
Prepared: `2026-03-19`
Environment: `production`
Owner role: `Release Manager + Platform`
Runbook: `docs/OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md`

## Required Fields

- Operator
- Rollback trigger
- Release SHA before rollback
- Release SHA after rollback
- Flag changes applied
- Smoke command results
- Cron route verification results
- Issues found
- Remediation owner
- Sign-off

## Smoke Commands

- `npm run parity-gate`
- `npm run guardrails-lint`
- `npm run guardrails-tests`
- `npm run policy-check`
- `npm run -w apps/web test:e2e:smoke`

## Pass Criteria

- Previous release is restored successfully
- Smoke commands succeed after rollback
- Cron route verification is recorded
- Release SHA before and after rollback is recorded

## Notes

- This placeholder exists so the repo has a dated rollback evidence path ready for execution.
- Replace this file with the executed rollback drill record before claiming operational recovery readiness.
