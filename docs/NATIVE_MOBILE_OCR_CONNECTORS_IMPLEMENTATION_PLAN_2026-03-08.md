# Native Mobile, OCR Identity, and Access Connector Implementation Plan (2026-03-08)

## 1) Change summary
Build three production-grade capabilities as a single program:
1. Real native iOS/Android wrappers for reliable background geofence entry/exit processing.
2. Optional OCR-based ID-document verification workflow that is consented, privacy-safe, and region-aware.
3. Turnkey access-control connectors beyond generic webhook forwarding.

This plan is designed to fit your current architecture (`apps/web` monolith + Prisma + outbound queue worker) and existing plan-entitlement model.

## 2) Current baseline (already in repo)

### Mobile/geofence baseline
- Enrollment and event APIs already exist:
  - `apps/web/src/app/api/mobile/enrollment-token/route.ts`
  - `apps/web/src/app/api/mobile/geofence-events/route.ts`
  - `apps/web/src/app/api/mobile/geofence-events/replay/route.ts`
  - `apps/web/src/app/api/mobile/heartbeat/route.ts`
- Admin operational UI exists:
  - `apps/web/src/app/admin/mobile/page.tsx`
  - `apps/web/src/app/admin/mobile/native/page.tsx`
- Device subscription and presence-hint persistence exists:
  - `apps/web/src/lib/repository/mobile-ops.repository.ts`

### Identity evidence baseline
- Identity evidence capture and consent checks already exist in public sign-in flow:
  - `apps/web/src/app/s/[slug]/components/SignInFlow.tsx`
  - `apps/web/src/app/s/[slug]/actions.ts`
  - `apps/web/src/lib/repository/public-signin.repository.ts`
- Identity evidence retrieval endpoint exists:
  - `apps/web/src/app/api/sign-ins/[id]/identity-evidence/route.ts`
- Site access control already has identity toggles:
  - `apps/web/src/lib/access-control/config.ts`
  - `apps/web/src/app/admin/sites/[id]/access/actions.ts`

### Connector baseline
- Generic outbound webhook queue and retry/dead-letter worker already exists:
  - `apps/web/src/lib/repository/webhook-delivery.repository.ts`
  - `apps/web/src/lib/webhook/worker.ts`
- Hardware adapter exists but currently depends on generic endpoint dispatch:
  - `apps/web/src/lib/hardware/adapter.ts`
- One named connector pattern exists (Procore):
  - `apps/web/src/lib/integrations/procore/*`

## 3) Security and cost guardrails
This plan must keep all existing guardrails intact:
- Tenant isolation by construction (`company_id` scoping via `scopedDb`).
- CSRF defenses (`assertOrigin`) on all mutating server actions.
- No raw SQL (`$queryRaw`, `$executeRaw`).
- Budget controls and kill switches from `ARCHITECTURE_GUARDRAILS.md`.

New capabilities must default to `off` and require explicit feature entitlement + rollout flag.

## 4) Target outcomes and acceptance criteria

### Program-level success criteria
1. Native app wrappers are in App Store/TestFlight and Play Internal Testing with reliable background geofence event replay.
2. OCR verification can be enabled per company/site, with explicit consent and region-aware provider routing.
3. At least 2 named access-control connectors are production-usable with provider-specific auth and diagnostics.
4. Existing 305 E2E suite remains green; new tests added for each capability.
5. Cost controls prevent runaway spend (quotas, caps, kill switches, graceful fallback).

## 5) Workstream A: Native iOS/Android wrappers for background geofence reliability

### A0 - Architecture decision and scope lock (1 week)
Deliverables:
- ADR selecting thin wrapper strategy (recommended: Capacitor-style wrapper over existing web flows, native geofence module for background reliability).
- Explicit non-goals: no full native rewrite, no offline-first business logic engine.
- Mobile app release channels and version policy documented.

Key design decisions:
- Keep sign-in UX in existing web/public flow.
- Move background geofence + queueing + heartbeat to native runtime.
- Use existing backend enrollment token and geofence APIs.

Acceptance criteria:
- ADR approved by engineering + product.
- Data flow and threat model signed off.

### A1 - Native runtime foundation (2-3 weeks)
Deliverables:
- New workspace for mobile shell (`apps/mobile`) with iOS + Android targets.
- Runtime metadata emission (`platform`, `appVersion`, `osVersion`, `wrapperChannel`) aligned with current admin UI.
- Secure device secret storage (Keychain/Keystore) and enrollment token lifecycle (issue, rotate, revoke).

Backend changes:
- Extend enrollment token claims with `deviceId`, `runtime`, and optional anti-replay nonce.
- Add token revocation/version checks in geofence + heartbeat endpoints.

Acceptance criteria:
- Device enrollment succeeds end-to-end.
- Revoked tokens are denied immediately.

### A2 - Background geofence reliability (3-4 weeks)
Deliverables:
- iOS native geofence implementation using region monitoring + background delivery.
- Android native geofence implementation using geofencing client + boot resilience.
- Local durable event queue (idempotent `eventId`) and replay worker.
- Heartbeat and health signals displayed in `/admin/mobile`.

Backend changes:
- Idempotency hardening and duplicate event handling improvements in `/api/mobile/geofence-events`.
- Add event freshness window and stale-event policy.

Acceptance criteria:
- Entry/exit events survive app restarts and temporary network loss.
- Replay endpoint drains queued events without duplicates.
- Admin health statuses (`Healthy`, `Degraded`, `Stale`) reflect real runtime state.

### A3 - Mobile release and operations (1-2 weeks)
Deliverables:
- CI lane for mobile builds + signing + artifact retention.
- TestFlight and Play Internal rollout.
- Runbooks: provisioning, certificate rotation, mobile incident response.

Acceptance criteria:
- At least one production-like tenant pilot can run fully on native wrappers.

## 6) Workstream B: Optional OCR/ID-document verification (privacy-safe, consented, region-aware)

### B0 - Policy and privacy model (1 week)
Deliverables:
- OCR feature policy: optional add-on, explicit consent required, default disabled.
- Data minimization rules:
  - No biometric matching by default.
  - Store only required extracted fields + confidence + decision metadata.
  - Raw ID images retained for minimal configured retention window.
- Region routing policy tied to company residency fields (`data_residency_region`, `data_residency_scope`).

Acceptance criteria:
- Legal/privacy review complete and approved for NZ/AU tenancy posture.

### B1 - OCR provider abstraction (2 weeks)
Deliverables:
- New provider abstraction:
  - `apps/web/src/lib/identity-ocr/providers/base.ts`
  - `apps/web/src/lib/identity-ocr/providers/<provider>.ts`
- Recommended first provider: AWS Textract in AP region(s), behind adapter.
- Fallback path: manual verification when provider unavailable.

Backend changes:
- New OCR verification service + result model (linked to sign-in or identity verification record).
- Provider request/response normalization (doc type, expiry date, name match score, confidence).

Acceptance criteria:
- OCR pipeline works in mocked and sandbox modes.
- Provider outage falls back gracefully without blocking all sign-ins (policy-driven).

### B2 - Product workflow integration (2-3 weeks)
Deliverables:
- Access settings enhancements:
  - `identity.requireOcrVerification`
  - `identity.allowedDocumentTypes`
  - `identity.ocrDecisionMode` (`assist` or `strict`)
- Public flow enhancements:
  - Consent UX for OCR processing.
  - OCR progress and fallback messaging.
- Admin approvals enhancements:
  - OCR outcome timeline and evidence pointer.
  - Retry/manual override workflow.

Backend/API changes:
- New server action or API route for OCR verification request.
- Audit events for OCR request/result/manual override.

Acceptance criteria:
- Consent is mandatory when OCR is enabled.
- OCR result influences approval/escalation according to configured policy.

### B3 - Cost and retention controls (1 week)
Deliverables:
- New env guardrails (examples):
  - `OCR_ENABLED=false`
  - `MAX_OCR_REQUESTS_PER_COMPANY_PER_MONTH`
  - `MAX_OCR_REQUESTS_GLOBAL_PER_DAY`
  - `OCR_IMAGE_RETENTION_DAYS`
- Feature flag + entitlement enforcement (`ID_OCR_VERIFICATION_V1` suggested).
- Budget-protect behavior to auto-disable OCR when thresholds are exceeded.

Acceptance criteria:
- OCR cannot run without explicit flags/entitlements.
- Quota exceedance returns deterministic control-id response.

## 7) Workstream C: Turnkey access-control connectors (beyond generic webhook)

### C0 - Connector target shortlist and contracts (1 week)
Deliverables:
- Prioritized connector roadmap (recommended first wave):
  1. HID (existing provider hint already in payload path)
  2. Gallagher or Brivo (based on customer demand + sandbox/API availability)
- Provider contract definitions:
  - auth flow
  - required fields
  - expected response semantics
  - retry/idempotency behavior

Acceptance criteria:
- First-wave providers approved with integration contracts.

### C1 - Connector framework extraction (2 weeks)
Deliverables:
- Provider plugin architecture:
  - `apps/web/src/lib/access-connectors/core.ts`
  - `apps/web/src/lib/access-connectors/providers/*`
- Normalize command model: `grant`, `deny`, `heartbeat`, `status`.
- Move provider branching out of `hardware/adapter.ts` into provider modules.

Backend changes:
- Connector config model/versioning with encrypted secrets.
- Per-provider health tracking and outage event model.

Acceptance criteria:
- Hardware adapter calls connector framework, not provider-specific inline logic.

### C2 - Provider-specific implementations (3-4 weeks)
Deliverables:
- Implement first two named connectors with:
  - token management/rotation
  - command dispatch
  - response mapping
  - retries + dead-letter handling
- Admin setup wizard in `admin/access-ops` (or `admin/sites/[id]/access`) for each provider.

Acceptance criteria:
- Each provider has successful integration test path + manual UAT checklist.
- Connector diagnostics visible in admin UI (last success/failure, error reason, retry count).

### C3 - Operational hardening and fallback (1 week)
Deliverables:
- Circuit-breaker per provider.
- Automatic fallback to generic webhook mode when provider is degraded.
- Alerting and runbook updates.

Acceptance criteria:
- Provider outage does not block core sign-in flow.
- Clear audit trail for fallback decisions.

## 8) Cross-workstream release phases

### Phase 0 - Program prep (1 week)
- Finalize ADRs, provider decisions, and entitlement mapping.
- Add feature flags and guardrail env scaffolding.

### Phase 1 - Build foundation (3-4 weeks)
- Native shell + enrollment hardening.
- OCR provider abstraction + storage/retention scaffolding.
- Connector framework extraction.

### Phase 2 - Product integration (4-6 weeks)
- Native background geofence + replay reliability.
- OCR UX + policy integration.
- First two named access connectors.

### Phase 3 - Hardening and go-live (2-3 weeks)
- Security review, load/reliability tests, full regression.
- Staged rollout (internal -> pilot tenants -> GA).

Estimated total: 10-14 weeks, depending on provider sandbox/API approvals.

## 9) Data model and API change plan

### Planned Prisma additions
- `MobileDeviceRuntimeEvent` (optional) for richer runtime diagnostics.
- `IdentityOcrVerification` for OCR request/result lifecycle.
- `AccessConnectorConfig` and `AccessConnectorHealthEvent` for provider-first connectors.

### Planned API additions
- `POST /api/mobile/device-bootstrap` (optional convenience wrapper).
- `POST /api/identity/ocr/verify` (or server action equivalent).
- `POST /api/access-connectors/<provider>/test` for admin validation.

All tenant-owned entities must include `company_id` and use scoped repository patterns.

## 10) Entitlements, pricing banding, and add-on controls

Recommended packaging:
- Standard: keep current baseline features; no OCR, no premium connectors by default.
- Plus: native mobile geofence assist as optional enablement.
- Pro: full connector suite + advanced OCR policy modes.
- Add-ons:
  - OCR verification bundle
  - Premium access-control connectors

Implementation rules:
- Add explicit feature keys and enforce in all routes/actions.
- Keep expensive capabilities off by default and quota-limited.

## 11) Cost impact (monthly)

### A) Native wrappers
- Infra delta: low-to-moderate (more geofence events + heartbeats + storage for device diagnostics).
- Non-infra delta: app-store operations and mobile CI runtime.

### B) OCR verification
- Infra delta: moderate/variable (per-document OCR API charges + temporary storage + processing).
- Highest spend risk in this program; must be hard-capped and add-on gated.

### C) Named connectors
- Infra delta: low-to-moderate (extra queue volume, retries, diagnostics storage).
- Mostly engineering + partner integration effort rather than heavy infra spend.

## 12) Security impact
- Positive if executed as planned: stronger identity assurance + better access-control determinism.
- Primary risks to mitigate:
  - OCR image handling and retention (PII exposure risk).
  - Mobile token compromise and replay.
  - Connector credential leakage.

Mandatory controls:
- Encrypt sensitive fields at rest.
- Short-lived signed URLs for evidence access.
- Strict audit events for OCR/connector/manual overrides.
- Token versioning and revocation support.

## 13) Guardrails/env vars affected
Planned additions (examples):
- `FEATURE_NATIVE_MOBILE_RUNTIME`
- `FEATURE_IDENTITY_OCR`
- `FEATURE_ACCESS_CONNECTORS`
- `MAX_MOBILE_GEOFENCE_EVENTS_PER_COMPANY_PER_DAY`
- `MAX_OCR_REQUESTS_PER_COMPANY_PER_MONTH`
- `MAX_OCR_REQUESTS_GLOBAL_PER_DAY`
- `OCR_IMAGE_RETENTION_DAYS`
- `MAX_CONNECTOR_DELIVERIES_PER_COMPANY_PER_DAY`

Existing guardrails remain mandatory (exports/uploads/messaging/budget-protect).

## 14) Cheaper fallback options
1. Native wrappers fallback: keep PWA + assist-mode geofence only (no strict auto mode) until native launch.
2. OCR fallback: manual ID verification with evidence upload pointer and policy-based approvals.
3. Connector fallback: continue generic webhook adapter with enriched payload templates.

## 15) Testing and validation plan (exact commands)

### Core gates
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run test:integration`
5. `node tools/manual-flow-verify.mjs` (full 305 E2E suite)

### New targeted suites to add
1. Mobile API reliability tests:
   - `npm run -w apps/web test -- src/app/api/mobile/**/*.test.ts`
2. OCR policy/consent + provider adapter tests:
   - `npm run -w apps/web test -- src/lib/identity-ocr/**/*.test.ts src/app/api/identity/**/*.test.ts`
3. Connector framework and provider contract tests:
   - `npm run -w apps/web test -- src/lib/access-connectors/**/*.test.ts`
4. Regression for sign-in and approvals with identity controls:
   - `npm run -w apps/web test:e2e -- e2e/public-signin.spec.ts e2e/escalation-approval.spec.ts`

### Release gates
- Gate 1: all above tests green in CI.
- Gate 2: pilot tenant runbook signed off.
- Gate 3: no Sev1/Sev2 issues in 2-week pilot window.

## 16) External references used for planning (market and platform)
- SwipedOn plans/pricing: https://www.swipedon.com/pricing/
- Site App Pro feature/pricing pages: https://www.siteapppro.com/all-features and https://www.siteapppro.com/pricing
- Sign In App plans: https://signinapp.com/pricing/
- Sine plans: https://www.sine.co/plans/
- Android geofencing guidance: https://developer.android.com/develop/sensors-and-location/location/geofencing
- Apple Core Location docs (region/background location): https://developer.apple.com/documentation/corelocation
- AWS Textract docs/pricing entry points:
  - https://docs.aws.amazon.com/textract/
  - https://aws.amazon.com/textract/pricing/

## 17) Implementation status in repo (2026-03-08)

Implemented in codebase:
- Native mobile wrapper workspace (`apps/mobile`) with Expo app shell, background geofence task scaffolding, enrollment token storage, replay queue, and runtime metadata transport.
- Mobile runtime hardening:
  - token-version rotation in enrollment flow
  - token-version/device checks in geofence + heartbeat + bootstrap routes
  - runtime event persistence (`MobileDeviceRuntimeEvent`)
  - per-company daily geofence guardrail check.
- OCR foundation and policy wiring:
  - `IdentityOcrVerification` model/repository/service
  - feature flag + entitlement + quota guardrail gating
  - provider routing by company data residency (`NZ`, `AU`, `APAC`, `GLOBAL`) with env overrides (`OCR_PROVIDER_*`)
  - production adapter support for AWS Textract (`TEXTRACT` / `TEXTRACT_<REGION>`) with MOCK fallback
  - admin site access settings for OCR policy:
    - `requireOcrVerification`
    - `allowedDocumentTypes`
    - `ocrDecisionMode`
  - public sign-in strict-mode OCR blocking behavior
  - admin OCR verification endpoint: `POST /api/identity/ocr/verify`.
- Access connector foundation:
  - connector config + health models/repository
  - provider framework (`GENERIC`, `HID_ORIGO`, `BRIVO`, `GALLAGHER`, `LENELS2`, `GENETEC`)
  - hardware adapter dispatch through connector core
  - per-company connector delivery guardrail check
  - connector test endpoint: `POST /api/access-connectors/[provider]/test`
  - worker support for connector auth token resolution from connector config.

Still requires external credentials/accounts before production release:
- Apple Developer / App Store Connect signing and submit credentials.
- Google Play Console service account + signing setup.
- OCR production provider credentials (if non-mock provider is selected).

