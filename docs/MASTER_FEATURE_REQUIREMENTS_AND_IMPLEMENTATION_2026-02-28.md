# Master Feature Requirements and Implementation Backlog (as of 2026-02-28)

## Goal
- One single source of truth for all features still needed across `Standard`, `Plus`, `Pro`, and add-ons.
- Enforce your directive: **Standard plan must cover features competitors include in their standard/entry plans**.
- Add "new market" demand signals showing what clients expect in standard plans.

## Inputs merged into this file
1. [NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md](NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md)
2. [NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md](NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md)
3. [NZ_COMPETITOR_PRICING_FEATURES_2026-02-28.md](NZ_COMPETITOR_PRICING_FEATURES_2026-02-28.md)
4. [NZ_STANDARD_PLAN_PARITY_CHECK_2026-02-28.md](NZ_STANDARD_PLAN_PARITY_CHECK_2026-02-28.md)
5. [NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md](NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md)
6. [STANDARD_PLUS_PRO_PACKAGING_PLAN_2026-02-28.md](STANDARD_PLUS_PRO_PACKAGING_PLAN_2026-02-28.md)
7. [NZ_FEATURE_COST_MODEL_2026-02-28.md](NZ_FEATURE_COST_MODEL_2026-02-28.md)
8. [MONTHLY_COST_CALCULATOR_TEMPLATE.csv](MONTHLY_COST_CALCULATOR_TEMPLATE.csv)

## Deep market research (new demand signals)

### What clients most want in standard plan (demand side)
1. Self check-in/out is rated critical/high importance by a large majority of buyers (`87%` on Capterra category page).
2. Visitor tracking/reporting is also high-importance (`80%` on Capterra category page).
3. Alerts/notifications are high-importance (`73%` on Capterra category page).
4. G2 category guidance highlights common expected features: visitor reporting, self check-in, notifications, preregistration.

### What market supply now bundles in entry plans (supply side)
1. SwipedOn Standard: badge printing + digital agreements + QR/device check-in.
2. Sine Small: host notifications + roll calls + geofence auto check-in/out.
3. EVA entry tiers: induction workflows, with higher tiers adding location/compliance depth.
4. Ezy SignIn Starter: host notifications, badge/label printing, contractor onboarding/docs, media-rich induction.

### Compliance expectations relevant to NZ buyers
1. WorkSafe guidance shows visitors should receive proportionate safety information; sign-in plus emergency procedure briefing is a practical pattern.
2. WorkSafe guidance requires emergency planning and accounting for people in emergencies.

## Standard Plan: Required Feature Set

Rule applied for this document:
- `Required in Standard` = features repeatedly present in competitor entry plans or strongly indicated as buyer-critical.

| Standard-required feature | Why required | Current app status | Implementation needed |
| --- | --- | --- | --- |
| QR/self-service check-in/out | Buyer-critical and common in all entry plans | Complete | No new core build needed |
| Visitor logs + reporting/export | Buyer-critical (`tracking/reporting`) | Complete | Keep as mandatory |
| Digital induction forms/questions | Standard market expectation | Complete | No new core build needed |
| E-signature/digital agreements | Common in entry plans | Complete | No new core build needed |
| Host notifications (email/in-app) | Strong buyer demand (`notifications`) + entry-plan parity | Complete for Standard baseline (arrival email workflow, explicit host recipient selection, and in-app dashboard arrival alert feed implemented) | No additional Standard baseline work required |
| Badge/label printing | Common in entry plans | Complete for Standard baseline (browser badge print template, print audit logging, and selectable A4/thermal print profiles in public and bulk QR workflows implemented) | No additional Standard baseline work required |
| Emergency roll-call workflow | Entry-plan parity + NZ safety expectation | Complete for Standard baseline (persistent event lifecycle, attendance snapshot tracking, CSV export evidence, and dashboard command/drill summary cards implemented) | No additional Standard baseline work required |
| Location-aware check-in (audit/verification mode) | Appears in several market offerings | Complete for Standard baseline (site-level capture, radius evaluation, live register/history visibility, and dashboard location-verification analytics implemented) | No additional Standard baseline work required |
| Contractor onboarding + document evidence | Common in contractor-focused entry tiers | Complete for Standard baseline (document capture + expiry windows + automated 30/14/7/1 reminder dispatch with dedupe) | No additional Standard baseline work required |
| Offline-capable field operation | Common market expectation | Complete | No new core build needed |
| Pre-registration / invite flow | Common in category guidance and major products | Complete for Standard baseline (admin create/deactivate invite workflow, invite-prefill sign-in path, token consumption tracking, invite QR generation, bulk CSV invite upload, printable QR pack output, optional invite-email queueing, and automated expiring-invite reminder batches to admins/site managers implemented) | No additional Standard baseline work required |
| Multi-language induction support | Frequently marketed in induction products | Complete baseline (template-configured language variants, guided admin authoring UI, runtime language selection in public flow, and cross-browser E2E coverage delivered) | No additional baseline work required |

Notes:
1. Hard geofence denial logic is policy-gated in your guardrails. Keep verification in Standard; keep strict enforcement as add-on exception.
2. SMS is not required for Standard to maintain cost control; email/in-app notifications satisfy baseline parity.

## Single Backlog: All Features To Implement

Only features that are partial/not implemented are listed.

| ID | Feature to implement | Target plan | Why needed | Current status | Priority |
| --- | --- | --- | --- | --- | --- |
| F-01 | Host notification workflow (arrival alerts via email/in-app) | Standard mandatory | Buyer-critical notifications + entry parity | Complete for Standard baseline (arrival email notifications, explicit host selection, and in-app dashboard arrival alerts implemented) | P0 |
| F-02 | Badge/label printing (HTML/CSS print, QR badge) | Standard mandatory | Entry-plan parity | Complete for Standard baseline (public badge print + audit logging + selectable A4/thermal profiles across public and bulk QR output) | P0 |
| F-03 | Roll-call maturity (event start/close, accounted/missing, export) | Standard mandatory | Entry parity + safety compliance expectation | Complete for Standard baseline (site emergency module supports persistent start/close lifecycle, accounted/missing transitions, CSV evidence export, and command-mode aggregation cards on dashboard) | P0 |
| F-04 | Location capture + radius verification indicator (no hard denial) | Standard mandatory | Entry parity while policy-safe | Complete for Standard baseline (public capture/evaluation, register/history visibility, and dashboard summary analytics shipped) | P0 |
| F-05 | Pre-registration/invite workflow | Standard mandatory | Common category expectation + competitor practice | Complete for Standard baseline (admin invite management + public prefill + invite lifecycle tracking + QR invite rendering + bulk prereg upload + printable QR pack + optional invite-email queue + automated expiring-invite reminder batches) | P0 |
| F-06 | Expiry reminders (30/14/7/1 windows + dedupe + dashboard cards) | Standard optional/removable | Improve contractor/compliance depth | Complete for baseline scope (dashboard windows + automated email reminder dispatch + per-document/window dedupe tracking) | P1 |
| F-07 | Multi-language induction packs | Standard optional/removable | Buyer expectation in diverse sites | Complete for baseline scope (template-level language variant config, guided admin authoring UI, runtime selector, server-side validation/entitlement checks, completion snapshot/audit evidence, and cross-browser E2E coverage) | P1 |
| F-08 | Webhook reliability (HMAC, retries, delivery logs, dead-letter) | Standard optional/removable (or Plus) | Integration parity + enterprise trust | Complete for baseline scope (delivery queue, HMAC signing, retry/backoff, dead-letter transitions, maintenance-worker processing, admin delivery-log monitoring, and per-site endpoint/secret management with secret rotation controls are implemented) | P1 |
| F-09 | Full quiz scoring engine (pass threshold, retries, cooldown) | Plus | Strong competitor differentiation | Complete for baseline scope (policy controls, pass-threshold scoring, retry/cooldown persistence, fail-block enforcement, analytics, and cross-browser media-first E2E fail/pass coverage) | P1 |
| F-10 | Media-first induction flow (PDF/image/text before quiz) | Plus | Entry-to-mid tier market parity | Complete for baseline scope (configurable media blocks, required acknowledgement enforcement, authoring UI, payload-budget guardrails, persisted completion evidence, and cross-browser E2E coverage) | P1 |
| F-11 | LMS baseline connector (one-way completion sync) | Pro | Enterprise requirement in larger deals | Complete for baseline scope (site-level LMS connector settings, entitlement gating, queued `lms.completion` deliveries, worker dispatch auth support, and provider payload mapping for generic/Moodle/SCORM Cloud) | P2 |
| F-12 | Advanced audit analytics dashboards | Pro | Pro-tier value and retention | Complete (repository analytics aggregation + entitlement-gated admin dashboard route and navigation) | P2 |
| F-13 | Entitlements engine (`company_plan`, feature overrides, per-site overrides) | Platform foundation | Needed to enforce mandatory/removable features and credits | Complete for current GA scope (schema/services/tests complete with server-side enforcement now active for host notifications, outbound webhooks + webhook admin controls, advanced exports, roll-call entrypoints, reminder worker dispatch paths, public quiz/media/language surfaces, badge print audit, pre-registration flows, and template feature authoring paths) | P0 |
| F-14 | Billing calculator integration for credits/add-ons | Platform foundation | Needed for per-site price reduction model | Complete for current GA scope (pricing calculator + invoice preview line-item generation integrated in admin settings, with accounting endpoint sync action/UI, signature support, audit logging, env validation, and tests) | P0 |
| F-15 | SMS messaging wrapper with hard quotas | Add-on only | Optional paid capability | Complete (entitlement + env-flag gated SMS wrapper, per-company monthly cap enforcement, webhook/mock provider support, and audit logging) | P3 |
| F-16 | Hardware gate/turnstile adapter framework | Add-on only | Enterprise optional integration | Complete (entitlement-gated adapter, outbound decision queueing, provider/auth header support, and audit evidence) | P3 |
| F-17 | Geofence enforcement deny/override mode | Add-on only | High-cost/policy-gated capability | Complete (site access-control config, deny/override enforcement in public sign-in, supervisor override verification, hardware deny notifications, and E2E coverage) | P3 |

## Mandatory vs Removable in Standard (for pricing flexibility)

### Mandatory in Standard (cannot be disabled)
1. QR/self check-in and sign-out.
2. Visitor logs/reporting.
3. Induction questions and e-signatures.
4. Host notifications (email/in-app).
5. Badge printing.
6. Roll-call emergency workflow.
7. Location verification (audit mode).
8. Contractor document baseline.
9. Offline support.
10. Pre-registration/invite flow.

### Removable in Standard (credit-eligible)
1. Enhanced reminder automation.
2. Advanced export bundles.
3. Webhook integrations.
4. Multi-language packs.
5. Optional location policy strictness (warning depth, not hard geofence).

## Cost-safety constraints while implementing this
1. Keep SMS, hardware, and hard geofence as add-ons only.
2. Enforce per-company/per-site quotas and circuit-breakers from guardrails.
3. Keep `email/in-app` as default notification channel in Standard.

## Definition of done for this master plan
1. Every `P0` and `P1` item has schema, API/service, UI, tests, and docs.
2. Entitlements are enforced server-side in all entrypoints (no UI-only gating).
3. Standard plan parity gaps are closed: host notifications, badge printing, roll-call maturity, location verification, preregistration.
4. Billing supports mandatory vs removable features with floor-price rules.

## Web research sources used for this document
- Capterra visitor management category: https://www.capterra.com/visitor-management-software/
- G2 visitor management category: https://www.g2.com/categories/visitor-management
- SwipedOn pricing/comparison: https://www.swipedon.com/pricing, https://www.swipedon.com/plan-comparison
- Sine plans: https://www.sine.co/plans/
- EVA pricing: https://www.evacheckin.com/pricing
- Ezy SignIn pricing: https://ezysignin.com/pricing/
- WorkSafe NZ practical guidance on visitors/sign-in/emergency planning:
  - https://www.worksafe.govt.nz/managing-health-and-safety/businesses/general-requirements-for-workplaces/general-risk-and-workplace-management-part-1/
  - https://www.worksafe.govt.nz/laws-and-regulations/operational-policy-framework/worksafe-positions/visitors-at-work/
  - https://construction.worksafe.govt.nz/topic-and-industry/vehicles-and-mobile-plant/site-traffic-management/keeping-healthy-and-safe-when-tipping-loads/
