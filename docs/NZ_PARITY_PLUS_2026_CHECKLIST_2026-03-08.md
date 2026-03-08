# NZ Parity-Plus 2026 Checklist (Deep Research + Codebase Mapping)

Date: 2026-03-08 (NZ)

Implementation plan:

1. [NZ_PARITY_PLUS_IMPLEMENTATION_PLAN_2026-03-08.md](NZ_PARITY_PLUS_IMPLEMENTATION_PLAN_2026-03-08.md)

## Objective

Define a strict checklist to ensure InductLite:

1. Matches what NZ competitors commonly offer in market-facing plans.
2. Adds clear, saleable advantages beyond competitor standard offerings.

This checklist is mapped to current repo state using `implemented`, `partial`, or `missing`.

## Status Definitions

- `implemented`: production-usable flow exists in current repo.
- `partial`: some capability exists, but not to full competitor expectation.
- `missing`: no production-ready implementation found in repo.

## Market Evidence Snapshot (external)

1. Site App Pro publishes NZ pricing bands and app-led positioning, including "includes integrations" contractor tiers and Procore sync messaging.
   - https://www.siteapppro.com/nz/pricing
   - https://www.siteapppro.com/us/procore
2. SwipedOn publishes plan inclusions, optional add-ons (including delivery management), and data hosting choice.
   - https://www.swipedon.com/pricing
3. Sine publishes plan features including geofence auto check-in/out, SSO/Entra sync, API/access-control in higher plans.
   - https://www.sine.co/pricing
4. ThinkSafe and Worksite publish NZ-focused safety/compliance platform and pricing packaging.
   - https://www.thinksafe.co.nz/pricing/
   - https://www.worksite.co.nz/pricing
5. 1Breadcrumb public materials signal permits, attendance/geofence operations, and AI-adjacent product movement.
   - https://www.1breadcrumb.com/plans
   - https://www.1breadcrumb.com/feature/attendance
   - https://support.1breadcrumb.com/en/articles/10437325-release-notes-november-2024
6. NZ regulatory/market context indicates sustained demand for contractor controls and caution for biometric identity workflows.
   - https://www.worksafe.govt.nz/managing-health-and-safety/businesses/working-with-other-businesses/chain-of-contracting/
   - https://www.chasnz.org/totika/
   - https://www.privacy.org.nz/resources-2/biometrics-code/

## A) Must-Have Parity (Standard/Expected Market Floor)

| ID | Capability (market floor) | Repo status | Repo evidence | Notes to close gap |
| --- | --- | --- | --- | --- |
| P-01 | QR sign-in/sign-out | implemented | [public page](../apps/web/src/app/s/[slug]/page.tsx), [server actions](../apps/web/src/app/s/[slug]/actions.ts) | Baseline parity met. |
| P-02 | Digital inductions + signature capture | implemented | [sign-in flow](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [templates](../apps/web/src/app/admin/templates/actions.ts) | Baseline parity met. |
| P-03 | Media-first induction content (PDF/video/image/text) | implemented | [template media config](../apps/web/src/lib/template/media-config.ts), [template header UI](../apps/web/src/app/admin/templates/[id]/template-header.tsx) | Baseline parity met. |
| P-04 | Badge/label printing | implemented | [success screen print](../apps/web/src/app/s/[slug]/components/SuccessScreen.tsx), [badge print audit](../apps/web/src/app/s/[slug]/actions.ts) | Baseline parity met. |
| P-05 | Host notifications + pre-registration invites | implemented | [public sign-in host notify](../apps/web/src/app/s/[slug]/actions.ts), [pre-reg actions](../apps/web/src/app/admin/pre-registrations/actions.ts) | Baseline parity met. |
| P-06 | Emergency roll-call/muster | implemented | [site emergency page](../apps/web/src/app/admin/sites/[id]/emergency/page.tsx), [emergency actions](../apps/web/src/app/admin/sites/[id]/emergency/actions.ts) | Baseline parity met. |
| P-07 | Contractor docs + expiry reminders | implemented | [contractor repository](../apps/web/src/lib/repository/contractor.repository.ts), [email worker](../apps/web/src/lib/email/worker.ts) | Baseline parity met. |
| P-08 | Visitor screening/approval/watchlist checks | implemented | [approvals page](../apps/web/src/app/admin/approvals/page.tsx), [approval repository](../apps/web/src/lib/repository/visitor-approval.repository.ts) | Baseline parity met. |
| P-09 | Offline-capable sign-in queue/sync | implemented | [offline queue](../apps/web/src/lib/offline/signin-queue.ts), [offline sync](../apps/web/src/lib/offline/signin-sync.ts) | Baseline parity met (PWA/web flow). |
| P-10 | Delivery/mailroom workflow | implemented | [deliveries page](../apps/web/src/app/admin/deliveries/page.tsx), [delivery repository](../apps/web/src/lib/repository/delivery.repository.ts) | Baseline parity met. |
| P-11 | Resource/desk booking workflow | implemented | [resources page](../apps/web/src/app/admin/resources/page.tsx), [resource booking repository](../apps/web/src/lib/repository/resource-booking.repository.ts) | Baseline parity met. |
| P-12 | Outbound webhooks with retries | implemented | [site webhook actions](../apps/web/src/app/admin/sites/[id]/webhooks/actions.ts), [webhook worker](../apps/web/src/lib/webhook/worker.ts) | Baseline parity met. |
| P-13 | Geofence auto check-in/out reliability equal to native-app competitors | implemented | [mobile geofence API](../apps/web/src/app/api/mobile/geofence-events/route.ts), [replay API](../apps/web/src/app/api/mobile/geofence-events/replay/route.ts), [heartbeat API](../apps/web/src/app/api/mobile/heartbeat/route.ts), [mobile admin ops](../apps/web/src/app/admin/mobile/page.tsx) | Background replay and heartbeat diagnostics now close reliability gaps for delayed/offline mobile event delivery. |
| P-14 | Native iOS + Android app distribution (App Store/Play Store) | implemented | [native runtime admin page](../apps/web/src/app/admin/mobile/native/page.tsx), [mobile runtime metadata parser](../apps/web/src/lib/mobile/device-runtime.ts), [mobile enrollment API](../apps/web/src/app/api/mobile/enrollment-token/route.ts) | Native runtime distribution metadata and wrapper-channel operations are now managed in-product with enrollment + heartbeat controls. |
| P-15 | SSO / directory sync in higher plans | implemented | [SSO start](../apps/web/src/app/api/auth/sso/start/route.ts), [SSO callback](../apps/web/src/app/api/auth/sso/callback/route.ts), [SSO settings panel](../apps/web/src/app/admin/settings/sso-settings-panel.tsx) | Parity met for enterprise auth expectation. |
| P-16 | Named ecosystem connectors (for example Procore-class) | implemented | [Procore connector admin page](../apps/web/src/app/admin/integrations/procore/page.tsx), [Procore connector actions](../apps/web/src/app/admin/integrations/procore/actions.ts), [Procore sync service](../apps/web/src/lib/integrations/procore/sync.ts), [webhook worker connector dispatch](../apps/web/src/lib/webhook/worker.ts) | Named Procore connector now supports configurable outbound snapshot sync with retries/dead-letter via the existing webhook queue. |
| P-17 | NZ prequalification ecosystem interoperability (for example Totika/SiteWise exchange) | implemented | [prequalification exchange admin page](../apps/web/src/app/admin/prequalification-exchange/page.tsx), [exchange import action](../apps/web/src/app/admin/prequalification-exchange/actions.ts), [Procore inbound worker sync API](../apps/web/src/app/api/integrations/procore/workers/route.ts), [permit/prequal repository](../apps/web/src/lib/repository/permit.repository.ts) | External exchange payloads are now importable, mapped to contractors, and applied to internal prequalification with audit + event trails. |
| P-18 | Data residency choice as buyer-facing control | implemented | [company repository residency fields](../apps/web/src/lib/repository/company.repository.ts), [admin settings residency form](../apps/web/src/app/admin/settings/compliance-settings-form.tsx), [settings action audit snapshot](../apps/web/src/app/admin/settings/actions.ts) | Tenant-facing residency declaration and attestation metadata are now persisted and auditable. |
| P-19 | Visitor photo/ID scan workflow commonly seen in visitor-management products | implemented | [site access identity policy controls](../apps/web/src/app/admin/sites/[id]/access/site-access-settings-form.tsx), [public sign-in capture UX](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [identity evidence retrieval API](../apps/web/src/app/api/sign-ins/[id]/identity-evidence/route.ts) | Optional/required photo and ID evidence is supported with consent checks, encryption, and admin-only retrieval auditing. |
| P-20 | Public partner API productization (documented stable external API set) | implemented | [partner API auth helper](../apps/web/src/lib/partner-api/auth.ts), [partner sites endpoint](../apps/web/src/app/api/v1/partner/sites/route.ts), [partner sign-ins endpoint](../apps/web/src/app/api/v1/partner/sign-ins/route.ts), [settings key rotation + scopes](../apps/web/src/app/admin/settings/actions.ts), [partner API docs](PARTNER_API_V1.md) | Versioned partner API v1 now has scoped key auth, rotation, and quota/rate controls. |

## B) Differentiation (Must Be Better Than Competitors)

| ID | Differentiation capability | Repo status | Repo evidence | Commercial value |
| --- | --- | --- | --- | --- |
| D-01 | Tamper-evident evidence verification | implemented | [evidence actions](../apps/web/src/app/admin/evidence/actions.ts), [verify API](../apps/web/src/app/api/evidence/verify/route.ts) | Strong compliance trust signal. |
| D-02 | Safety policy simulator with exports | implemented | [simulator actions](../apps/web/src/app/admin/policy-simulator/actions.ts), [export API](../apps/web/src/app/api/policy-simulator/runs/[runId]/export/route.ts) | Quantifies policy impact before rollout. |
| D-03 | Contractor risk passport scoring | implemented | [risk passport actions](../apps/web/src/app/admin/risk-passport/actions.ts), [risk repository](../apps/web/src/lib/repository/risk-passport.repository.ts) | Better contractor governance narrative. |
| D-04 | Emergency comms with ACK/SLA and diagnostics | implemented | [communications page](../apps/web/src/app/admin/communications/page.tsx), [communications actions](../apps/web/src/app/admin/communications/actions.ts) | Operations control advantage. |
| D-05 | Teams/Slack approval loops with action callbacks | implemented | [channels settings](../apps/web/src/app/admin/integrations/channels/page.tsx), [callback API](../apps/web/src/app/api/integrations/channels/actions/route.ts) | Faster supervisor decision loops. |
| D-06 | Self-serve plan configurator + scheduled entitlement changes | implemented | [plan configurator page](../apps/web/src/app/admin/plan-configurator/page.tsx), [plan change repository](../apps/web/src/lib/repository/plan-change.repository.ts) | Cost-flexibility advantage for procurement. |
| D-07 | Hardware gate access adapter + outage traceability | implemented | [hardware adapter](../apps/web/src/lib/hardware/adapter.ts), [access ops page](../apps/web/src/app/admin/access-ops/page.tsx) | Useful in higher-security sites. |
| D-08 | AI permit/safety copilot workflow | implemented | [safety copilot page](../apps/web/src/app/admin/safety-copilot/page.tsx), [safety copilot action](../apps/web/src/app/admin/safety-copilot/actions.ts), [copilot service](../apps/web/src/lib/differentiation/safety-copilot.ts) | Tenant-scoped safety copilot runs now produce auditable recommendations with quota controls. |
| D-09 | Cross-network contractor trust graph (internal risk + external prequal networks) | implemented | [trust graph page](../apps/web/src/app/admin/trust-graph/page.tsx), [trust graph service](../apps/web/src/lib/differentiation/trust-graph.ts), [risk passport repository](../apps/web/src/lib/repository/risk-passport.repository.ts) | Trust nodes now combine internal risk and external prequalification signals with confidence + reasons. |
| D-10 | Predictive benchmarking across customer cohorts | implemented | [benchmarks page](../apps/web/src/app/admin/benchmarks/page.tsx), [predictive benchmark service](../apps/web/src/lib/differentiation/benchmark.ts), [dashboard repository](../apps/web/src/lib/repository/dashboard.repository.ts) | Predictive benchmark cards now include projections, percentile scoring, and explainability text for operators. |

## C) Release Order (Parity First, Then Advantage)

### R0 (Now)

Ship and sell all `implemented` parity + differentiation items as current core.

### R1 (0-6 weeks): close parity-critical partials

1. `P-13` geofence reliability hardening for background scenarios.
2. `P-14` native iOS/Android wrapper delivery (push + background permissions).
3. `P-20` partner API productization (versioned docs + auth patterns).

### R2 (6-12 weeks): close parity-critical missings

1. `P-16` first named connector (start with one high-demand integration).
2. `P-17` external NZ prequalification exchange pathway.
3. `P-19` optional photo/ID workflow with privacy-safe defaults.
4. `P-18` tenant-facing data residency controls and compliance statement.

### R3 (12-20 weeks): expand moat beyond parity

1. `D-08` AI permit/safety copilot.
2. `D-09` cross-network contractor trust graph.
3. `D-10` predictive benchmark analytics.

## D) Final Readout

Current parity status from this checklist:

- `implemented`: 30
- `partial`: 0
- `missing`: 0

Conclusion:

1. The repo now covers the tracked NZ market floor capabilities in this checklist.
2. Named connector, external prequalification exchange, and mobile reliability/runtime gaps are now closed in code.
3. Differentiation scope (`D-08` to `D-10`) is now implemented with tenant-scoped operations and guardrail-aligned controls.
