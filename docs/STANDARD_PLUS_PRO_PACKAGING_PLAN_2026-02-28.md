# Standard/Plus/Pro Packaging Plan (as of 2026-02-28)

## Goal
- Match competitor standard-plan expectations without increasing headline price.
- Keep expensive features out of base plan.
- Allow per-company/per-site feature removal with automatic price reduction.

## Non-negotiable constraints
1. Keep `SMS` and hardware access integrations as paid add-ons only.
2. Keep geofence enforcement policy-gated (do not include by default).
3. Maintain tenant isolation and guardrail caps from `ARCHITECTURE_GUARDRAILS.md`.

## Plan model

### Standard (headline: NZD 89/site/month, floor: NZD 69)
Mandatory features (cannot be removed):
1. QR/public-link sign-in and sign-out.
2. Induction templates/questions.
3. E-signature capture.
4. Offline queue/sync.
5. Red-flag safety escalation.
6. Basic evacuation roll-call.
7. Basic badge printing (browser print template).
8. Host notification via email/in-app (no SMS dependency).

Optional removable features in Standard (credit if disabled):
1. Location capture + radius warning (audit mode): `-NZD 3`.
2. Enhanced reminder automation windows: `-NZD 4`.
3. Advanced exports (full compliance ZIP/report bundles): `-NZD 4`.
4. Outbound webhook integrations: `-NZD 5`.
5. Multi-language induction packs: `-NZD 4`.

Rule:
- `Standard final price = 89 - enabled_credits`, minimum `NZD 69`.

### Plus (NZD 119/site/month)
Includes Standard +:
1. Full quiz scoring (pass mark, retries, cooldown).
2. Media-first induction content (PDF/image/text flow).
3. Webhook reliability features (retry logs/signature tooling).
4. Expanded reminder automation and dashboards.

### Pro (NZD 149/site/month)
Includes Plus +:
1. LMS baseline connector.
2. Advanced audit/analytics views.
3. Higher included quotas and priority support SLA.

## Paid add-ons only (all plans)
1. SMS workflows (per-segment billing + markup, hard quotas).
2. Hardware gate/turnstile integrations (setup + monthly).
3. Geofence enforcement mode (only with policy approval).

## How to keep price low while matching competitor standards
1. Implement low-cost versions first:
   - Badge printing via HTML/CSS print.
   - Host notifications via email/in-app only.
   - Location capture/radius warning without hard geofence denial.
2. Use hard usage caps per site/company for reminders/webhooks/exports.
3. Keep expensive variable-cost paths behind explicit add-ons.

## Entitlement implementation design
1. Add `company_plan` (`standard|plus|pro`).
2. Add `company_feature_overrides` (enabled/disabled + credit impact).
3. Add optional `site_feature_overrides` for per-site adjustments.
4. Implement `getEffectiveEntitlements(companyId, siteId)` and enforce in all feature entrypoints.
5. Billing must be computed from effective entitlements, not UI-only toggles.

## Pricing formula (per company)
1. `BasePlanPrice = plan price * active_sites`.
2. `CreditTotal = sum(disabled optional feature credits by site)`.
3. `AddOnTotal = sum(enabled add-ons and usage charges)`.
4. `InvoiceSubtotal = BasePlanPrice - CreditTotal + AddOnTotal`.
5. Apply floor rule per site before final total.

## Recommended rollout
1. Release entitlement model and billing math first.
2. Ship Standard parity gaps (badge, host notifications, stronger roll-call, location capture audit mode).
3. Launch Standard with credits model.
4. Launch Plus and Pro feature bundles.
5. Launch paid add-ons last with strict quotas and kill switches.
