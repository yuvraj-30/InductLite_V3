# InductLite Go-Live Checklist (Render + Neon + R2 + Upstash)

Owner: You

Status legend: [ ] todo [x] done [!] blocked

## Day 0-1: Security and Compliance

- [ ] Rotate production secrets (session, admin seed, storage, Upstash).
  - Pass: Secrets set in Render/Neon/R2/Upstash; none in repo.
- [ ] Resolve or accept first-party CodeQL alerts.
  - Pass: CodeQL clean for product code or documented risk acceptance; archived competitor/vendor artifacts stay excluded from scanning.
- [ ] CSP rollout (report-only -> enforce).
  - Pass: No new violations after 24-48h; enforcement enabled.

## Day 1-2: Infrastructure

- [ ] Provision Neon production DB with PITR + backups.
  - Pass: PITR enabled; backup schedule visible.
- [ ] Configure R2 bucket lifecycle and retention.
  - Pass: Upload/download tested; retention rule visible.
- [ ] Configure Upstash Redis for rate limiting.
  - Pass: Production env uses Upstash; startup fails closed without Upstash credentials; rate limits hit as expected.

## Day 2-3: Deployments

- [ ] Deploy Render web service (Next.js app).
  - Pass: /health and /api/live return 200.
- [ ] Verify cron API routes and scheduled workflows (exports + maintenance).
  - Pass: Export scheduler, retention, email queue, and webhook maintenance routes run successfully from GitHub Actions/cron.

## Day 3: Observability

- [ ] Verify Sentry + OpenTelemetry in production.
  - Pass: Test error shows in Sentry; traces visible.
- [ ] Set logging level to info/warn in production.
  - Pass: No debug spam; PII redaction verified.

## Day 3-4: Data and Guardrails

- [ ] Enable retention jobs (files/exports/audit).
  - Pass: Cleanup job runs and logs success.
- [ ] Verify upload size guardrail (5MB) in prod.
  - Pass: Oversized upload blocked.
- [ ] Verify export guardrails (rows/size/day).
  - Pass: Guardrails enforced under load.
- [ ] Verify inbound channel callback hardening.
  - Pass: Signed callbacks require `X-InductLite-Timestamp`, stale callbacks are rejected, and callback-specific rate limits trigger `429`.

## Day 4: Final Verification

- [ ] Run production smoke tests (login, public sign-in, export, upload).
  - Pass: All flows succeed end-to-end.
- [ ] Perform rollback test (Render rollback + DB sanity).
  - Pass: Rollback works; schema compatible.

## Day 5: Launch

- [ ] Create release tag and deploy to production.
  - Pass: Tag exists; deployment stable for 1-2h.
- [ ] Post-launch monitoring for 48h.
  - Pass: Error rate below threshold; no stuck jobs.

## Notes

- Keep costs within NZD 150/mo budget target by enforcing guardrails.
- Keep backups and restore drills aligned with runbooks in docs/.
- Production budget telemetry must refresh at least hourly from provider billing manifests; stale telemetry >6h must disable non-critical paths via `BUDGET_PROTECT`.
- Before launch, Platform + Finance must run `npm run provider-billing-check -- --file docs/artifacts/provider-billing/provider-billing-manifest.json --required render,neon,cloudflare_r2,upstash,resend` and attach the validated manifest plus command output to the release record.
- Provider billing manifest schema and execution steps live in [PROVIDER_BILLING_TELEMETRY_RUNBOOK.md](./PROVIDER_BILLING_TELEMETRY_RUNBOOK.md).
