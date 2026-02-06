# Service Level Objectives (SLO)

## Scope

Defines SLIs/SLOs for MVP operations. Targets are cost-aware and can tighten over time.

## SLOs

### Public Sign-In

- Availability: 99.5% monthly
- Latency: p95 < 2.5s for sign-in submit

### Admin Dashboard

- Availability: 99.5% monthly
- Latency: p95 < 2.0s for core pages

### Export Jobs

- Success rate: 99% of queued jobs succeed
- Completion: 95% complete within 5 minutes (MVP scale)

## SLIs

- Availability: successful responses / total requests
- Latency: server-side response time per endpoint
- Export success: jobs with status SUCCEEDED / total jobs

## Error Budget

- Monthly error budget = 0.5% of request volume
- If exhausted: freeze non-critical changes and focus on reliability

## Measurement

- App logs (stdout)
- Sentry error rates
- Export job status in Postgres

## Alerting (MVP)

- Availability < 99% in rolling 1h
- Export failures > 5% in rolling 1h
- Elevated 5xx response rate
