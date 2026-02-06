# Runbook — Incident Response

## Severity

- SEV1: Full outage or data loss risk
- SEV2: Major feature degradation
- SEV3: Minor impact or partial degradation

## Initial Triage

1. Confirm impact and scope.
2. Identify recent deploys or migrations.
3. Check health endpoints and logs.
4. Decide severity.

## Containment

- Disable risky features via feature flags.
- Pause export worker if needed.

## Communication

- Internal update every 30–60 minutes.
- External status update for SEV1/SEV2.

## Recovery

- Roll back to last known good build.
- Restore from backup if data integrity is affected.

## Post-Incident

- Document root cause.
- Add regression tests.
- Update guardrails/runbooks.
