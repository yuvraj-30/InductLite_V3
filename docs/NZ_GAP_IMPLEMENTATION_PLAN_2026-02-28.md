# NZ Gap Implementation Plan (as of 2026-02-28)

## Objective
- Deliver a practical implementation roadmap for all capabilities currently marked `Partial` or `Not implemented` across:
  - [NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md](NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md)
  - [NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md](NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md)
- Keep changes compliant with tenant isolation, CSRF, and cost/security guardrails in [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md).

## Execution Status Update (2026-03-03)
1. All gaps listed in this plan are now implemented in baseline scope.
2. EPIC-1 through EPIC-10 have been delivered, including previously policy-gated add-on foundations:
   - LMS baseline connector mappings (F-11),
   - Advanced audit analytics dashboard (F-12),
   - SMS wrapper with quotas (F-15),
   - Hardware adapter framework (F-16),
   - Geofence deny/override enforcement (F-17).
3. Cross-browser stabilization for language/media/quiz flows has been completed (Chromium, Firefox, WebKit targeted E2E).
4. This document is now a historical implementation record; active status tracking lives in:
   - [MASTER_FEATURE_REQUIREMENTS_AND_IMPLEMENTATION_2026-02-28.md](MASTER_FEATURE_REQUIREMENTS_AND_IMPLEMENTATION_2026-02-28.md)
   - [PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md](PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md)

## Scope (Union of Gaps)

### Current open gaps
1. None for the defined baseline scope.
2. Future work is optional expansion depth (for example, additional LMS providers or enterprise SSO catalogs), not baseline parity completion.

## Policy and Constraint Gates

1. `Geofencing`: baseline implementation is now delivered but remains policy-gated and disabled unless entitlement + site configuration explicitly enable strict enforcement.
2. `SMS`: implementation is delivered with quota controls; production use remains default-off (`SMS_ENABLED=false`) unless explicitly enabled with guardrail caps.
3. Any feature that adds recurring spend must document cost impact and cheaper fallback before merge.
4. All new tenant-owned data models must stay `company_id` scoped and repository-accessed via scoped DB patterns.

## Delivery Strategy (Waves)

### Wave 1 (highest ROI, policy-safe)
- Quiz scoring engine.
- Webhook hardening and event delivery reliability.
- Expiry reminder automation upgrades.

### Wave 2 (UX/compliance enhancement)
- Media-first induction content blocks (PDF/images first, video optional later).
- Roll-call and evacuation workflow maturity.
- Badge printing (browser print templates).

### Wave 3 (integration expansion)
- LMS/eLearning baseline integration.
- Optional geolocation capture (audit-only, non-geofence).

### Wave 4 (policy-gated/enterprise)
- Geofence enforcement.
- SMS workflows.
- Hardware access-control integrations.

## Epic Implementation Plans

## EPIC-1: Quiz Scoring Engine (Partial -> Complete)
Goal:
- Add configurable grading rules with pass thresholds, retries, and deterministic pass/fail outcomes.

Implementation:
1. Data model:
   - Add template-level grading settings:
     - `pass_threshold_percent` (0-100),
     - `max_attempts`,
     - `retry_cooldown_minutes`,
     - `require_pass_for_entry`.
   - Add response-level scoring fields:
     - `score_percent`,
     - `correct_count`,
     - `scored_question_count`,
     - `attempt_number`,
     - `grading_result` (`PASS|FAIL|MANUAL_REVIEW`).
2. Repository/service:
   - Implement `gradeInductionAnswers(templateQuestions, answers)` shared utility.
   - Enforce attempts/cooldown before accepting new submission for same person/site/day fingerprint.
3. Public sign-in flow:
   - Evaluate quiz before admission.
   - If failed and `require_pass_for_entry=true`, block sign-in and return structured reason.
4. Admin UX:
   - Add grading controls in template editor.
   - Show per-response score in admin history/live register detail.

Acceptance criteria:
1. Score and grading result are persisted for graded submissions.
2. Pass threshold and retry limits are enforced exactly.
3. Non-graded templates continue existing behavior.

Tests:
1. Unit tests for grading rules by question type.
2. Integration tests for attempt limit and cooldown behavior.
3. E2E: fail -> retry -> pass path.

Cheaper fallback:
- Phase 1 supports only `YES_NO` and `MULTIPLE_CHOICE` scoring; treat other types as non-scored.

## EPIC-2: Webhooks and Integrations Hardening (Partial -> Complete)
Goal:
- Replace simple fire-and-forget webhooks with secure, auditable, retriable delivery.

Implementation:
1. Data model:
   - Add `WebhookEndpoint` and `WebhookDelivery` tables.
2. Security:
   - HMAC signatures, timestamp tolerance, idempotency key per delivery.
3. Delivery engine:
   - Queue-driven delivery with retries/backoff and dead-letter state.
4. Admin UX:
   - Endpoint management UI (secret rotate, event subscriptions, test send).
   - Delivery logs with status/filtering.

Acceptance criteria:
1. Every webhook attempt recorded with request/response metadata.
2. Replay-safe signature verification model documented.
3. Endpoint-specific rate limits enforced.

Tests:
1. Unit tests for signing/verification.
2. Integration tests for retry and idempotency.
3. E2E: endpoint registration + test event + failure retry.

Cheaper fallback:
- Keep only essential events (`induction.completed`, `sign_in.created`, `sign_out.completed`) in first release.

## EPIC-3: Expiry Reminder Automation (Partial -> Complete)
Goal:
- Move from digest-level awareness to proactive per-document reminder workflows.

Implementation:
1. Reminder scheduler:
   - Daily job for `expires_at` windows (30/14/7/1 days).
2. Notification policy:
   - Per-company reminder toggles and lead times.
3. Delivery:
   - Queue reminders through existing email notification pipeline.
4. Visibility:
   - Admin dashboard widgets for due/overdue counts.

Acceptance criteria:
1. Reminders are deduplicated per window/document.
2. Overdue docs are surfaced in dashboard and contractor views.

Tests:
1. Integration tests for scheduling windows and dedupe.
2. Unit tests for reminder decision logic.

Cheaper fallback:
- Email-only reminders (no SMS/push).

## EPIC-4: Media-First Induction Content (Not implemented -> Complete)
Goal:
- Allow workers to read/watch required induction content before quiz/sign-off.

Implementation:
1. Data model:
   - Add `InductionContentBlock` linked to templates:
     - `type` (`PDF|IMAGE|TEXT|VIDEO_LINK`),
     - `title`,
     - `storage_key_or_url`,
     - `is_required`,
     - `display_order`.
2. Upload/storage:
   - Reuse guarded upload pipeline and MIME validation.
3. Public UX:
   - New step in sign-in flow: `Content` before `Questions`.
   - Require acknowledgment per mandatory block.
4. Compliance snapshot:
   - Persist content block versions in completion snapshot.

Acceptance criteria:
1. Required content must be acknowledged before question step.
2. Completion snapshot includes content version evidence.

Tests:
1. E2E: cannot continue until required content acknowledged.
2. Integration tests for snapshot data correctness.

Cheaper fallback:
- Start with `PDF`, `IMAGE`, and `TEXT`; defer uploaded video files to later (link-only first).

## EPIC-5: Evacuation Roll-Call Maturity (Partial -> Complete)
Goal:
- Move from manual UI toggles to event-based, auditable evacuation operations.

Implementation:
1. Data model:
   - `EvacuationEvent` and `EvacuationAttendance` with snapshot of on-site roster.
2. Command mode:
   - Start/close event, mark accounted/missing, export roll-call report.
3. Alerts:
   - Optional email blast to site managers on event start.

Acceptance criteria:
1. Each evacuation has immutable snapshot and final attendance outcomes.
2. Roll-call report downloadable for audit.

Tests:
1. Integration tests for snapshot integrity.
2. E2E for event lifecycle and attendance updates.

Cheaper fallback:
- Email alerts only, no SMS/push in initial version.

## EPIC-6: Badge Printing (Not implemented -> Complete)
Goal:
- Add printable visitor badges for kiosk/reception workflows.

Implementation:
1. Badge template:
   - Visitor name, company, site, sign-in time, QR/short code.
2. Print flow:
   - Browser print-friendly badge layout from success screen/admin.
3. Audit:
   - Record badge print events.

Acceptance criteria:
1. Badge prints in standard thermal/printer page formats.
2. Print action is auditable.

Tests:
1. Component tests for badge rendering.
2. E2E smoke for print view generation.

Cheaper fallback:
- HTML/CSS print templates first; no vendor SDK integration.

## EPIC-7: LMS/eLearning Integration (Not implemented -> Partial/Complete)
Goal:
- Support training record sync with external learning systems.

Implementation:
1. Integration model:
   - Generic connector config (endpoint, auth, mapping profile).
2. Sync events:
   - Push induction completion, score, expiry metadata.
3. Retry/audit:
   - Queue-based delivery with status logs.

Acceptance criteria:
1. At least one generic webhook/REST connector profile operational.
2. Sync failures visible and retryable.

Tests:
1. Integration tests with mocked LMS endpoint.
2. E2E for connector setup and event sync.

Cheaper fallback:
- CSV export + scheduled pull pattern before bi-directional API sync.

## EPIC-8: Geolocation and Geofencing (Not implemented, policy-gated)
Goal:
- Add location-aware attendance controls without violating current policy defaults.

Implementation plan:
1. Stage A (policy-safe):
   - Optional consent-based GPS capture (audit-only).
   - No entry denial logic.
2. Stage B (policy exception required):
   - Geofence radius checks at sign-in.
   - Deterministic denial reasons and override workflow.

Acceptance criteria:
1. Stage A: location capture is optional, explicit-consent, and auditable.
2. Stage B: geofence enforcement only after approved policy update.

Tests:
1. Unit tests for coordinate validation.
2. E2E device-permission scenarios (allow/deny geolocation).

Cheaper fallback:
- Site self-attestation question ("I am physically on site") + audit logs.

## EPIC-9: SMS Workflows (Not implemented, policy-gated)
Goal:
- Add SMS alerts/reminders only when guardrail quotas are explicitly enabled.

Implementation plan:
1. Central messaging wrapper:
   - Respect `SMS_ENABLED` and per-company/global caps.
2. Use cases:
   - Expiry reminders, escalation notices, optional sign-out reminder.
3. Reliability:
   - Provider outage fallback to email-only.

Acceptance criteria:
1. SMS paths hard-disabled when `SMS_ENABLED=false`.
2. Quota denials return deterministic control payloads.

Tests:
1. Guardrail tests for disabled/enabled modes.
2. Integration tests for quota enforcement and fallback.

Cheaper fallback:
- Email-only notifications (default).

## EPIC-10: Hardware Access Integrations (Not implemented, enterprise)
Goal:
- Integrate sign-in decisions with gate/turnstile systems.

Implementation:
1. Adapter layer:
   - Outbound command interface (`grant|deny|revoke`) with provider-specific drivers.
2. Event binding:
   - Trigger on sign-in success, sign-out, escalation deny.
3. Safety:
   - Strict timeout/fail-safe rules and operator override.

Acceptance criteria:
1. Provider adapter can be enabled per site.
2. Failure to reach hardware endpoint does not corrupt sign-in state.

Tests:
1. Integration tests with mock hardware API.
2. Chaos tests for timeout/retry paths.

Cheaper fallback:
- Webhook-to-middleman approach managed by client IT (no native hardware SDK in-app).

## Cross-Epic Delivery Plan

### Milestone M1 (4-6 weeks)
1. EPIC-1 Quiz scoring.
2. EPIC-2 Webhook hardening.
3. EPIC-3 Expiry reminder automation.

### Milestone M2 (3-5 weeks)
1. EPIC-4 Media-first induction (PDF/image/text).
2. EPIC-5 Evacuation maturity.
3. EPIC-6 Badge printing.

### Milestone M3 (3-4 weeks)
1. EPIC-7 LMS baseline connector.
2. EPIC-8 Stage A geolocation capture (audit-only).

### Milestone M4 (policy-approved only)
1. EPIC-8 Stage B geofence enforcement.
2. EPIC-9 SMS workflows.
3. EPIC-10 Hardware integration.

## PR Slicing Model

1. `PR-A`: Schema + repository primitives for one epic.
2. `PR-B`: Server actions/routes and business logic.
3. `PR-C`: UI flows and admin settings.
4. `PR-D`: Tests + docs + guardrail matrix updates.

Rule:
- Ship one epic per PR chain to reduce rollback blast radius.

## Program-Level Acceptance Criteria

1. All features preserve tenant isolation and CSRF controls.
2. Any policy-gated feature is feature-flagged and disabled by default.
3. Guardrail and budget checks pass before enabling new paid capabilities.
4. Each shipped epic has unit + integration + E2E coverage on changed paths.
5. Docs, runbooks, and control matrices are updated in the same delivery window.

## Test Plan (Exact Commands)

From repo root:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run guardrails-lint`
5. `npm run guardrails-tests`
6. `npm run policy-check`

Targeted runs:
1. `cd apps/web && npm run test:integration`
2. `cd apps/web && npm run test:e2e`
3. `cd apps/web && npm run test:e2e:stable`

## Documentation Update Requirements per Epic

1. Update both competitor docs status sections after each epic release:
   - [NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md](NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md)
   - [NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md](NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md)
2. Update policy/guardrail docs when enabling policy-gated capabilities.
3. Update runbooks for new operational workflows (evacuation, webhooks, reminders).
