# NZ Feature Cost Model (as of 2026-02-28)

## What this estimates
- Monthly recurring infrastructure/vendor cost impact if you implement the partial + not-yet-implemented features from:
  - [NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md](NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md)
  - [NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md](NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md)
  - [NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md](NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md)
- This is an estimation model, not an invoice.

## Constraints from your repo
- Budget caps in [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md):
  - MVP <= NZD 150/month
  - Early <= NZD 500/month
  - Growth <= NZD 2000/month
- Geofencing is currently disallowed by default policy.
- SMS is disabled by default policy.

## Assumptions used

### Traffic tiers
- MVP: up to 2,000 sign-ins/month.
- Early: up to 20,000 sign-ins/month.
- Growth: up to 150,000 sign-ins/month.

### Existing stack assumption (from repo docs)
- App/worker on Render.
- Postgres on Neon.
- Object storage on Cloudflare R2 (S3-compatible).
- Rate limit/cache on Upstash Redis.
- Email on Resend.

References:
- [DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md](DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md)
- [README.md](../README.md)

### Pricing inputs (USD, then converted)
- Render Web/Worker compute: Starter `$7/mo`, Standard `$25/mo` ([Render pricing](https://render.com/pricing))
- Render Postgres (if used): storage add-on `$0.30/GB` ([Render pricing](https://render.com/pricing))
- Neon Launch: `$0.106/CU-hour`, `$0.35/GB-month` ([Neon pricing](https://neon.com/pricing))
- Cloudflare R2 Standard: `$0.015/GB-month`, Class A `$4.50/M`, Class B `$0.36/M` ([R2 pricing](https://developers.cloudflare.com/r2/pricing/))
- Upstash Redis PAYG: `$0.20/100K requests`, `$0.25/GB storage` ([Upstash pricing](https://upstash.com/docs/redis/overall/pricing))
- Resend: Pro `$20/mo` for 50K emails, overage `$0.90/1K`, Scale `$90/mo` ([Resend pricing](https://resend.com/pricing), [overage changelog](https://resend.com/changelog/pay-as-you-go-pricing))
- Twilio NZ SMS: outbound `$0.105` per segment, failed-processing fee `$0.001`, number starts at `$1.15/mo` ([Twilio NZ SMS pricing](https://www.twilio.com/en-us/sms/pricing/nz))

### FX assumption
- Planning conversion used: `1 USD ~ 1.70 NZD` (approximation for budgeting, not fixed billing).

## Feature-by-feature cost breakdown

Ranges below are estimated **incremental monthly cost** (NZD).

| Feature | Infra used | Why it costs | MVP | Early | Growth |
| --- | --- | --- | --- | --- | --- |
| 1. Quiz scoring engine | Existing app compute + Neon DB | Extra grading compute, extra DB writes/indices, retry tracking data | `NZD 1-5` | `NZD 3-12` | `NZD 10-30` |
| 2. Webhook hardening (retry, signatures, delivery logs) | Render worker, Neon tables, optional Upstash keys | Retry worker runtime + delivery log storage + outbound request volume | `NZD 12-25` | `NZD 25-60` | `NZD 60-180` |
| 3. Expiry reminder automation | Resend + scheduler worker + Neon reminder state | Email volume is the main cost; scheduler/DB overhead is small | `NZD 0-15` | `NZD 30-80` | `NZD 50-220` |
| 4. Media-first induction content (PDF/image/text) | R2 storage + signed URL reads/writes + app rendering | Storage and object operations; no R2 egress charge helps keep low | `NZD 0-3` | `NZD 2-12` | `NZD 8-60` |
| 5. Evacuation roll-call maturity | Neon event tables + app/worker + optional email alerts | More state snapshots + notifications + report generation | `NZD 1-8` | `NZD 5-20` | `NZD 10-40` |
| 6. Badge printing (software side) | Browser print templates + minimal DB audit writes | Mostly UI; almost no cloud cost unless advanced print services are added | `NZD 0-5` | `NZD 2-8` | `NZD 5-20` |
| 7. LMS/eLearning integration | Webhook/integration worker + mapping logs in DB | Connector runtime + retries + audit logs; vendor API quotas may apply | `NZD 5-20` | `NZD 20-70` | `NZD 50-220` |
| 8. Geolocation capture (audit-only stage) | Client GPS + DB fields + validation logic | Light compute/storage only; no third-party API needed if no geocoding | `NZD 0-3` | `NZD 2-10` | `NZD 5-30` |
| 9. SMS workflows (policy-gated) | Twilio SMS + message logs | Per-message billing dominates cost in NZ | `NZD 180-220` | `NZD 850-1100` | `NZD 3400-4200` |
| 10. Hardware gate integration (policy-gated/enterprise) | Integration worker + vendor access-control platform | External vendor license + integration runtime + reliability tooling | `NZD 150-500` | `NZD 900-2500` | `NZD 3500-9000` |

## Important non-cloud costs often missed

### Badge printing physical ops (optional but common)
- One-time hardware: thermal badge printer ~`NZD 250-600` per unit.
- Consumables: ~`NZD 0.03-0.08` per printed badge.
- This is outside core cloud invoice but real operating cost.

### Hardware integration vendor costs
- Many gate/turnstile vendors charge per site/door/controller.
- Typical real-world spend can exceed pure cloud cost quickly.

## Total projected monthly cost impact

## A) Policy-safe roadmap only (exclude SMS + hardware integration)
- Included: features 1-8.

| Tier | Incremental monthly cost |
| --- | --- |
| MVP | `NZD 19-84` |
| Early | `NZD 89-272` |
| Growth | `NZD 198-800` |

Interpretation:
- MVP can likely remain near budget with strict scope.
- Early can exceed `NZD 500` depending on reminder/webhook/LMS volume.
- Growth can exceed `NZD 2000` unless tightly optimized.

## B) Full feature set (include SMS + hardware integration)
- Included: features 1-10.

| Tier | Incremental monthly cost |
| --- | --- |
| MVP | `NZD 349-804` |
| Early | `NZD 1839-3872` |
| Growth | `NZD 7098-14000` |

Interpretation:
- Full implementation with SMS + hardware is far beyond current guardrail budgets.

## Why the totals jump so much

1. SMS in NZ is expensive on a per-message basis.
2. Hardware integrations usually include external platform licensing, not just API calls.
3. Core software-only features (quiz/media/webhooks/reminders) are comparatively inexpensive.

## "Total cost of my repo" planning view

To estimate **total monthly run cost**, use:

`Current baseline monthly cost` + `incremental feature cost from this model`

If your current baseline sits around the middle of your budget tiers:
- MVP baseline ~`NZD 120` -> with policy-safe set: ~`NZD 139-204`, with full set: ~`NZD 469-924`
- Early baseline ~`NZD 350` -> with policy-safe set: ~`NZD 439-622`, with full set: ~`NZD 2189-4222`
- Growth baseline ~`NZD 1500` -> with policy-safe set: ~`NZD 1698-2300`, with full set: ~`NZD 8598-15500`

## Cheaper alternatives per expensive feature

1. SMS: keep email/push only, or tenant-paid SMS add-on with strict caps.
2. Hardware integration: webhook-to-client middleware instead of native adapters.
3. LMS: start with CSV export/import and one-way sync before bi-directional connectors.
4. Geofencing: capture location for audit only; skip hard enforcement unless policy changes.

## Confidence and caveats

- High confidence:
  - Relative ranking of cost drivers (SMS/hardware highest; scoring/media lower).
  - Directional tier impact.
- Medium confidence:
  - Exact dollar amounts, because usage patterns and vendor contracts vary.
- Recalculate before go-live:
  - Pull fresh price sheets and current FX.
  - Run your real usage telemetry through this model.

