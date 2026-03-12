# 8-Week Execution Plan (Production Hardening + References + Flagship Integrations)

Start date: 2026-03-16  
Target outcome date: 2026-05-10

## Objective

In 8 weeks, reach launch-ready buyer confidence by delivering:
- Production hardening (reliability + security + recovery confidence)
- Public references (quotes/case study/logo permissions)
- Two flagship integrations in real customer use

Assumed flagship integrations:
- Microsoft Entra SSO
- Procore connector

## Weekly Plan

## Week 1: Production Baseline

Owner: Platform/Backend

- [ ] Upgrade Render web service to Starter.
- [ ] Set `TRUST_PROXY=1`.
- [ ] Set `STORAGE_MODE=s3`.
- [ ] Set `CRON_ENFORCE_IP=1`.
- [ ] Set `CRON_ALLOW_PRIVATE_IPS=0`.
- [ ] Rotate `SESSION_SECRET`.
- [ ] Rotate `CRON_SECRET`.
- [ ] Rotate `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Set `SENTRY_DSN`.

Exit criteria:
- [ ] Production env baseline is applied and verified.
- [ ] App health checks pass after secret rotation.

## Week 2: Reliability Hardening

Owner: Platform/Backend

- [ ] Configure alerts for:
  - [ ] 5xx spikes
  - [ ] cron failures
  - [ ] failed/dead export jobs
  - [ ] webhook dead-letter growth
- [ ] Run outage drill: cron secret mismatch.
- [ ] Run outage drill: Redis outage simulation.
- [ ] Run outage drill: DB slowdown simulation.
- [ ] Validate replay/recovery workflow for failed queued work.

Exit criteria:
- [ ] Alerts fire correctly and route to responsible owners.
- [ ] Recovery runbooks work in practice.

## Week 3: Load + Performance Gate

Owner: Backend

- [ ] Run staging load test for realistic peak traffic.
- [ ] Capture p95 sign-in latency and error rate.
- [ ] Review DB connection pressure and query hotspots.
- [ ] Tune limits/caps where needed.

Exit criteria:
- [ ] Peak profile is handled without queue collapse.
- [ ] p95 latency and error rates are within acceptable launch targets.

## Week 4: Integration #1 (Entra SSO) Productionization

Owner: Backend + Frontend

- [ ] Finalize SSO admin setup UX.
- [ ] Validate full login flow for target customer role set.
- [ ] Add diagnostic logging for common auth failures.
- [ ] Add support notes/playbook for SSO troubleshooting.
- [ ] Run integration regression tests.

Exit criteria:
- [ ] One pilot can use Entra SSO in production without manual babysitting.

## Week 5: Integration #2 (Procore) Productionization

Owner: Backend

- [ ] Finalize connector setup and validation UX.
- [ ] Verify retry/backoff and idempotency behavior.
- [ ] Expose operator-friendly diagnostics for failed syncs.
- [ ] Add minimal support runbook for connector failures.

Exit criteria:
- [ ] One pilot runs Procore sync reliably in production.

## Week 6: Pilot Onboarding

Owner: Product + Customer Success

- [ ] Onboard 3 design-partner customers.
- [ ] Track baseline metrics per customer:
  - [ ] check-in time
  - [ ] compliance misses
  - [ ] admin effort/time
- [ ] Capture weekly pilot issues and close top blockers.

Exit criteria:
- [ ] 3 active pilots with measurable usage.

## Week 7: Reference Capture

Owner: Product/Founder

- [ ] Capture 2 customer quotes.
- [ ] Capture 1 short case study with measurable outcomes.
- [ ] Obtain logo usage permission.
- [ ] Publish references on marketing/sales surfaces.

Exit criteria:
- [ ] Public proof assets are live and approved for sales use.

## Week 8: Launch Readiness Gate

Owner: Engineering + Product

- [ ] Run full quality gate on release commit.
- [ ] Run production smoke tests after deployment.
- [ ] Run rollback drill once.
- [ ] Final go/no-go review with evidence.

Exit criteria:
- [ ] Launch decision made with technical + customer evidence.

## Release Command Gate (every release week)

Run from repo root:

```bash
npm run lint
npm run typecheck
npm run test:integration
npm run test:e2e:smoke
```

## Deployment Smoke Checklist (every deployment)

- [ ] `/health` returns 200.
- [ ] Cron endpoints respond successfully:
  - [ ] `/api/cron/export-scheduler`
  - [ ] `/api/cron/maintenance`
- [ ] One end-to-end business flow succeeds:
  - [ ] public sign-in
  - [ ] admin visibility
  - [ ] export generation/download
  - [ ] webhook/audit evidence recorded

## Evidence to Keep

- [ ] Alert screenshots/config export
- [ ] Load test report
- [ ] Incident drill notes
- [ ] Pilot KPI sheet
- [ ] Customer quotes and permissions
- [ ] Integration setup docs

## Definition of Done (Program Level)

- [ ] Production is stable, monitored, and recoverable.
- [ ] At least 2 public references + 1 measurable case study exist.
- [ ] Entra SSO + Procore are live for real pilots.
