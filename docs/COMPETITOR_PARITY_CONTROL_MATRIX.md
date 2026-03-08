# Competitor Parity Control Matrix

## Purpose

Use this file as the single release gate for competitor-parity commitments:

1. `required` rows are release-blocking.
2. `monitor` rows are tracked for roadmap and differentiation.
3. Every `required` row must stay `implemented` with code and test references.

Gate script:

```bash
npm run parity-gate
```

## Status Definitions

- `implemented`: feature is production-usable in the referenced paths.
- `partial`: feature exists but does not yet match full market expectation.
- `missing`: feature is not present in product scope.
- `planned`: feature has defined design but is not yet shippable.

## Parity Matrix

| Control ID | Competitor Signal | Capability | Plan Target | Gate Class | Entitlement Key | Status | Implementation Refs | Test Refs | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAR-001 | Common NZ baseline | QR sign-in/sign-out workflow | Standard | required | N/A | implemented | apps/web/src/app/s/[slug]/page.tsx; apps/web/src/lib/repository/public-signin.repository.ts | apps/web/e2e/public-signin.spec.ts | Core public entrypoint must stay stable. |
| PAR-002 | Common NZ baseline | Digital induction forms with signature capture | Standard | required | N/A | implemented | apps/web/src/app/s/[slug]/components/SignInFlow.tsx; apps/web/src/app/admin/templates/actions.ts | apps/web/e2e/public-signin.spec.ts; apps/web/e2e/logic-flow.spec.ts | Covers induction question flow depth. |
| PAR-003 | Common NZ baseline | Badge and label printing | Standard | required | BADGE_PRINTING | implemented | apps/web/src/app/s/[slug]/actions.ts; apps/web/src/lib/plans/entitlements.ts | apps/web/src/app/s/[slug]/actions.test.ts | Enforced by plan entitlement guard. |
| PAR-004 | Common NZ baseline | Host notifications for arrivals | Standard | required | HOST_NOTIFICATIONS | implemented | apps/web/src/app/s/[slug]/actions.ts; apps/web/src/lib/repository/email.repository.ts | apps/web/src/app/s/[slug]/actions.test.ts; apps/web/e2e/public-signin.spec.ts | Email and in-app path maintained. |
| PAR-005 | Safety-focused tools | Emergency roll-call and muster operations | Standard | required | ROLLCALL_V2 | implemented | apps/web/src/app/admin/sites/[id]/emergency/actions.ts; apps/web/src/app/admin/sites/[id]/emergency/page.tsx | apps/web/src/app/admin/sites/[id]/emergency/actions.test.ts; apps/web/e2e/admin-emergency-contacts.spec.ts | Must remain available for site incidents. |
| PAR-006 | Common NZ baseline | Location capture and radius audit indicator | Standard | required | LOCATION_AUDIT | implemented | apps/web/src/app/s/[slug]/actions.ts; apps/web/src/app/s/[slug]/components/SignInFlow.tsx | apps/web/src/app/s/[slug]/actions.test.ts; apps/web/e2e/public-signin.spec.ts | Standard uses audit mode, not hard deny by default. |
| PAR-007 | Contractor-focused tools | Contractor docs and expiry reminder automation | Standard | required | REMINDERS_ENHANCED | implemented | apps/web/src/lib/repository/contractor.repository.ts; apps/web/src/lib/email/worker.ts | apps/web/src/lib/email/__tests__/worker.unit.test.ts | Reminder workflow is cost-gated and deduped. |
| PAR-008 | Common NZ baseline | Pre-registration invite lifecycle | Standard | required | PREREG_INVITES | implemented | apps/web/src/app/admin/pre-registrations/actions.ts; apps/web/src/lib/repository/pre-registration.repository.ts | apps/web/src/app/admin/pre-registrations/actions.test.ts; apps/web/e2e/public-signin.spec.ts | Includes invite token and prefill path. |
| PAR-009 | Field operation expectation | Offline-capable sign-in queue and sync | Standard | required | N/A | implemented | apps/web/src/lib/offline/signin-queue.ts; apps/web/src/app/s/[slug]/components/SignInFlow.tsx | apps/web/e2e/kiosk-mode.spec.ts | PWA/web-first offline behavior. |
| PAR-010 | Enterprise visitor controls | Visitor approval workflow | Plus | required | VISITOR_APPROVALS_V1 | implemented | apps/web/src/app/admin/approvals/actions.ts; apps/web/src/app/s/[slug]/actions.ts | apps/web/e2e/escalation-approval.spec.ts | Approval gates are tenant-scoped and auditable. |
| PAR-011 | Enterprise visitor controls | Identity hardening controls | Plus | required | ID_HARDENING_V1 | implemented | apps/web/src/app/admin/approvals/actions.ts; apps/web/src/lib/repository/visitor-approval.repository.ts | apps/web/e2e/escalation-approval.spec.ts | Keeps verification and watchlist pathways in scope. |
| PAR-012 | Integration-ready platforms | Outbound webhook reliability with retries | Standard | required | WEBHOOKS_OUTBOUND | implemented | apps/web/src/app/admin/sites/[id]/webhooks/actions.ts; apps/web/src/lib/webhook/worker.ts | apps/web/src/app/admin/sites/[id]/webhooks/actions.test.ts; apps/web/src/lib/webhook/__tests__/worker.unit.test.ts | Delivery retries/dead-letter are required baseline. |
| PAR-013 | Construction workflow depth | Permit workflow operations | Standard | monitor | PERMITS_V1 | implemented | apps/web/src/app/admin/permits/actions.ts; apps/web/src/app/s/[slug]/actions.ts | apps/web/e2e/command-mode.spec.ts | Tracked as depth and UX quality monitor. |
| PAR-014 | Construction workflow depth | Contractor prequalification controls | Standard | monitor | PREQUALIFICATION_V1 | implemented | apps/web/src/app/admin/permits/actions.ts; apps/web/src/lib/operations/market-ops.ts | apps/web/e2e/command-mode.spec.ts | Keep policy depth and analytics quality improving. |
| PAR-015 | Mobile-first competitors | Native mobile app auto check-in/out | Plus | monitor | MOBILE_OFFLINE_ASSIST_V1 | implemented | apps/web/src/app/api/mobile/enrollment-token/route.ts; apps/web/src/app/api/mobile/geofence-events/route.ts; apps/web/src/app/admin/mobile/actions.ts; apps/web/src/app/admin/mobile/page.tsx; apps/web/src/lib/mobile/enrollment-token.ts | apps/web/src/lib/mobile/__tests__/enrollment-token.unit.test.ts; apps/web/src/app/api/mobile/geofence-events/route.test.ts | Secure enrollment tokens, device revocation, and automated mobile event processing are now available via API. |
| PAR-016 | Visitor ops suites | Delivery and mailroom management | Standard | monitor | N/A | implemented | apps/web/src/app/admin/deliveries/page.tsx; apps/web/src/app/admin/deliveries/actions.ts; apps/web/src/lib/repository/delivery.repository.ts | apps/web/src/lib/repository/__tests__/delivery.repository.unit.test.ts | Delivery lifecycle now covers arrival, notification, collection/return, and audit notes. |
| PAR-017 | Visitor ops suites | Resource and desk booking workflows | Standard | monitor | N/A | implemented | apps/web/src/app/admin/resources/page.tsx; apps/web/src/app/admin/resources/actions.ts; apps/web/src/lib/repository/resource-booking.repository.ts | apps/web/src/lib/repository/__tests__/resource-booking.repository.unit.test.ts | Conflict-safe booking and cancellation flows are now available per site/resource. |
| PAR-018 | Mobile-first competitors | Background geofence auto check-in/out | Plus | monitor | GEOFENCE_ENFORCEMENT | implemented | apps/web/src/app/api/mobile/geofence-events/route.ts; apps/web/src/lib/access-control/config.ts; apps/web/src/app/admin/sites/[id]/access/actions.ts; apps/web/src/app/admin/sites/[id]/access/site-access-settings-form.tsx | apps/web/src/app/api/mobile/geofence-events/route.test.ts; apps/web/src/lib/access-control/__tests__/config.unit.test.ts; apps/web/src/app/admin/sites/[id]/access/actions.test.ts | Site-level OFF/ASSIST/AUTO policy with idempotent background event handling and auto check-out guardrail thresholds is implemented. |
| PAR-019 | Differentiation | Tamper-evident evidence verification | Pro | monitor | EVIDENCE_TAMPER_V1 | implemented | apps/web/src/app/admin/evidence/actions.ts; apps/web/src/app/api/evidence/verify/route.ts | apps/web/src/app/api/evidence/verify/route.test.ts | Differentiation strength over simple visitor logs. |
| PAR-020 | Differentiation | Safety policy simulator exports | Plus | monitor | POLICY_SIMULATOR_V1 | implemented | apps/web/src/app/admin/policy-simulator/actions.ts; apps/web/src/app/api/policy-simulator/runs/[runId]/export/route.ts | apps/web/src/app/api/policy-simulator/runs/[runId]/export/route.test.ts | Differentiation for enterprise buyers. |
| PAR-021 | Differentiation | Contractor risk passport scoring | Plus | monitor | RISK_PASSPORT_V1 | implemented | apps/web/src/app/admin/risk-passport/actions.ts; apps/web/src/lib/repository/risk-passport.repository.ts | apps/web/src/app/admin/risk-passport/actions.test.ts | Differentiation for contractor governance. |
| PAR-022 | Add-on | SMS operational workflows | Add-on | monitor | SMS_WORKFLOWS | implemented | apps/web/src/lib/sms/wrapper.ts | apps/web/src/lib/sms/__tests__/wrapper.unit.test.ts | Keep quota-capped as paid add-on. |
| PAR-023 | Add-on | Gate and turnstile hardware integration | Add-on | monitor | HARDWARE_ACCESS | implemented | apps/web/src/lib/hardware/adapter.ts; apps/web/src/app/admin/sites/[id]/access/actions.ts | apps/web/src/lib/hardware/__tests__/adapter.unit.test.ts; apps/web/src/app/admin/sites/[id]/access/actions.test.ts | Kept as paid integration surface. |
| PAR-024 | Integration-ready enterprise buyers | Named Procore connector workflows | Pro | monitor | LMS_CONNECTOR | implemented | apps/web/src/app/admin/integrations/procore/page.tsx; apps/web/src/app/admin/integrations/procore/actions.ts; apps/web/src/lib/integrations/procore/sync.ts | apps/web/src/lib/integrations/procore/__tests__/config.unit.test.ts | Includes configurable outbound snapshots and inbound updates with existing webhook retry/dead-letter worker. |
| PAR-025 | NZ compliance procurement | External prequalification exchange import/apply | Plus | monitor | PREQUALIFICATION_V1 | implemented | apps/web/src/app/admin/prequalification-exchange/page.tsx; apps/web/src/app/admin/prequalification-exchange/actions.ts; apps/web/src/app/api/integrations/procore/workers/route.ts | - | Supports Totika/SiteWise style payload imports, contractor mapping, and auditable internal apply. |
| PAR-026 | Differentiation | AI safety copilot workflow | Plus | monitor | POLICY_SIMULATOR_V1 | implemented | apps/web/src/app/admin/safety-copilot/page.tsx; apps/web/src/app/admin/safety-copilot/actions.ts; apps/web/src/lib/differentiation/safety-copilot.ts | - | Tenant-scoped copilot guidance with daily quota controls and run history. |
| PAR-027 | Differentiation | Contractor trust graph | Plus | monitor | RISK_PASSPORT_V1 | implemented | apps/web/src/app/admin/trust-graph/page.tsx; apps/web/src/lib/differentiation/trust-graph.ts | - | Combines internal risk and external prequalification signals into confidence-scored trust nodes. |
| PAR-028 | Differentiation | Predictive benchmarks with explainability | Pro | monitor | ANALYTICS_ADVANCED | implemented | apps/web/src/app/admin/benchmarks/page.tsx; apps/web/src/lib/differentiation/benchmark.ts | - | Adds projected KPI benchmarks with percentile and plain-language explainability. |

## Operating Rules

1. Any `required` row regression must block release until status is restored to `implemented`.
2. New competitor capabilities must be added here with a new `Control ID`.
3. `monitor` rows are reviewed monthly; promote to `required` when market standard shifts.
