# Feature Completion and Full Validation Plan (as of 2026-03-05)

## Objective
Close all remaining feature-depth and validation gaps so the product is fully functional across scenarios, not partially implemented or placeholder-tested.

This plan is aligned to:
1. [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
2. [AI_AGENT_INSTRUCTIONS.md](../AI_AGENT_INSTRUCTIONS.md)
3. [NZ_COMPETITOR_FEATURE_PARITY_TABLE_2026-03-05.md](NZ_COMPETITOR_FEATURE_PARITY_TABLE_2026-03-05.md)
4. [NZ_MARKET_PARITY_AND_DIFFERENTIATION_IMPLEMENTATION_PLAN_2026-03-05.md](NZ_MARKET_PARITY_AND_DIFFERENTIATION_IMPLEMENTATION_PLAN_2026-03-05.md)

## Current baseline (evidence)
1. Full E2E run (305 tests) result: `292 passed`, `6 failed`, `7 skipped`.
2. One E2E spec is still placeholder-level and does not verify real behavior:
   - `apps/web/e2e/logic-flow.spec.ts`
3. Known skip conditions exist in:
   - `apps/web/e2e/kiosk-mode.spec.ts` (Windows/mobile skip conditions)
   - `apps/web/e2e/escalation-approval.spec.ts` (WebKit skip for approval replay)
4. Remaining failures are in WebKit escalation and visual regression stability lanes.

## Definition of done
1. Full E2E suite is green: `305/305 passed`, `0 skipped`, `0 flaky quarantines`.
2. No placeholder E2E specs remain.
3. All competitor-parity `Partially` features are either:
   - fully implemented and tested, or
   - explicitly de-scoped with written rationale and packaging decision.
4. Manual full run produces no non-allowlisted app errors in server logs.
5. Standard/Plus/Pro and add-on behavior is enforced server-side and validated in tests.

## Workstream A: Close remaining feature-depth gaps

### A1) Worker access controls and permits (depth completion)
Scope:
1. Add multi-stage approval and hold-point enforcement in permit lifecycle.
2. Enforce permit condition completion before `ACTIVE` and before sign-in unlock.
3. Add stronger permit breach analytics and actions in command mode.

Implementation areas:
1. `apps/web/src/lib/repository/permit.repository.ts`
2. `apps/web/src/app/admin/permits/actions.ts`
3. `apps/web/src/app/admin/permits/page.tsx`
4. `apps/web/src/app/s/[slug]/actions.ts`

Validation:
1. Unit tests for lifecycle transitions and invalid transitions.
2. Integration tests for staged approvals + hold-point blocks.
3. E2E scenarios for permit-required sign-in and breach handling.

### A2) Visitor approval workflow breadth and identity hardening
Scope:
1. Expand policy rules for risk triggers and escalation SLAs.
2. Complete identity verification evidence workflow (status, expiry, audit detail).
3. Add deterministic watchlist + random-check decisioning coverage.

Implementation areas:
1. `apps/web/src/lib/repository/visitor-approval.repository.ts`
2. `apps/web/src/app/admin/approvals/actions.ts`
3. `apps/web/src/app/admin/approvals/page.tsx`
4. `apps/web/src/app/s/[slug]/actions.ts`

Validation:
1. Unit tests for policy engine and watchlist matching.
2. Integration tests for approval decision idempotency and denial paths.
3. E2E coverage for approve/deny/retry across all browsers.

### A3) Emergency alerts and mustering depth
Scope:
1. Complete ack SLA tracking and escalation paths for emergency broadcast.
2. Tighten roll-call and broadcast linkage as one incident timeline.
3. Ensure channel failures downgrade safely without dropping core emergency flow.

Implementation areas:
1. `apps/web/src/lib/repository/communication.repository.ts`
2. `apps/web/src/app/admin/communications/actions.ts`
3. `apps/web/src/app/admin/communications/page.tsx`
4. `apps/web/src/app/admin/command-mode/page.tsx`

Validation:
1. Integration tests for ack state machine and expiry windows.
2. E2E tests for broadcast create, recipient fan-out, and ack update.
3. Export evidence verification for roll-call + broadcast correlation.

### A4) Custom fields/forms and smart forms
Scope:
1. Add a configurable form schema layer for site-specific extra fields.
2. Support conditional visibility and validation rules (smart form behavior).
3. Persist and export custom responses in audit-safe format.

Implementation areas:
1. `apps/web/src/lib/repository/template.repository.ts`
2. `apps/web/src/app/admin/templates/**`
3. `apps/web/src/app/s/[slug]/components/**`
4. `apps/web/src/app/s/[slug]/actions.ts`

Validation:
1. Unit tests for schema parsing and conditional logic.
2. Integration tests for response persistence and export projection.
3. E2E tests for dynamic question flow across desktop/mobile.

### A5) Man-hour tracking
Scope:
1. Add explicit per-visit labor-hour attribution and aggregation.
2. Add site/date/company rollups with timezone-safe calculations.
3. Expose report UI + export output.

Implementation areas:
1. `apps/web/src/lib/repository/signin.repository.ts`
2. `apps/web/src/lib/repository/dashboard.repository.ts`
3. `apps/web/src/app/admin/dashboard/page.tsx`
4. `apps/web/src/app/admin/exports/**`

Validation:
1. Integration tests for sign-in/sign-out duration math.
2. E2E tests for dashboard and export parity.
3. Regression tests for overnight shifts and missing sign-out edge cases.

### A6) Compliance and expiry depth (documents + induction)
Scope:
1. Complete induction expiry policy and renewal workflow depth.
2. Add explicit retake override controls and admin actions.
3. Unify contractor doc expiry, induction expiry, and reminders in one compliance status.

Implementation areas:
1. `apps/web/src/lib/repository/template.repository.ts`
2. `apps/web/src/lib/repository/public-signin.repository.ts`
3. `apps/web/src/lib/email/worker.ts`
4. `apps/web/src/app/admin/templates/[id]/template-header.tsx`

Validation:
1. Unit tests for expiry/retake policy resolution.
2. Integration tests for reminder dedupe and cooldown behavior.
3. E2E tests for retake limits and expiry-triggered access blocks.

### A7) Contractor prequalification and gate/turnstile trace depth
Scope:
1. Complete prequalification scoring/status workflow depth.
2. Add stronger gate decision handshake observability and retry outcomes.
3. Expose outage/fallback SLOs in access-ops UI.

Implementation areas:
1. `apps/web/src/lib/repository/permit.repository.ts`
2. `apps/web/src/lib/repository/hardware-trace.repository.ts`
3. `apps/web/src/lib/hardware/adapter.ts`
4. `apps/web/src/app/admin/access-ops/**`

Validation:
1. Integration tests for queue retry + eventual failure paths.
2. E2E tests for gate decision correlation on sign-in.
3. Failure-injection tests for hardware outage and fallback continuity.

## Workstream B: Full validation hardening (tests and reliability)

### B1) Remove placeholder and skipped E2E scenarios
Tasks:
1. Replace `apps/web/e2e/logic-flow.spec.ts` with real skip-logic scenario seeding and assertions.
2. Remove WebKit skip in escalation approval by stabilizing replay flow and polling conditions.
3. Remove kiosk skips by stabilizing canvas and hydration timing for Windows/mobile projects.

Acceptance:
1. No `test.skip` remains in critical suite files.
2. No placeholder assertions (`expect(true).toBe(true)`) remain.

### B2) Fix all current failing E2E tests
Current failing groups:
1. WebKit escalation denial flow.
2. Firefox visual induction/signature.
3. Mobile Chrome/Safari visual baselines for public sign-in and live register heading.

Tasks:
1. Stabilize visual regions and typography dependencies.
2. Rebaseline snapshots only after deterministic rendering controls are in place.
3. Stabilize escalation deny flow with deterministic state sync between public page and admin decision.

Acceptance:
1. `npm run -w apps/web test:e2e` passes with `0 failed`.

### B3) Add scenario matrix coverage
Matrix dimensions:
1. Browser projects: chromium, firefox, webkit, mobile-chrome, mobile-safari.
2. Plan tiers: Standard, Plus, Pro.
3. Feature states: enabled, disabled, entitlement-denied.
4. Operational modes: normal, kiosk, permit-required, approval-required, emergency event active.
5. Failure modes: webhook down, hardware endpoint down, message quota reached.

Acceptance:
1. Each critical feature has at least one positive and one negative E2E scenario in matrix.
2. CI publishes matrix summary artifact per run.

### B4) Log hygiene and runtime diagnostics
Tasks:
1. Classify expected test-induced errors vs true defects.
2. Downgrade expected-path noise (where appropriate) from `error` to `warn/info`.
3. Add log assertions in E2E/manual run to fail on non-allowlisted errors.

Acceptance:
1. Manual full run logs contain no non-allowlisted errors.
2. Alert-worthy failures remain high-signal and actionable.

## Workstream C: Packaging and go-live hardening

### C1) Plan/entitlement enforcement verification
Tasks:
1. Add cross-plan tests for Standard/Plus/Pro and site overrides.
2. Validate add-on behavior under missing quota/env guardrails (must fail closed).
3. Verify billing preview and invoice sync reflect effective entitlements.

Acceptance:
1. Unauthorized feature usage is blocked server-side in all entry points.
2. Pricing and entitlement state remain consistent across UI/API/export.

### C2) Operational readiness
Tasks:
1. Complete runbooks for incident response and feature rollback switches.
2. Add one-command validation script for pre-release checks.
3. Define release gates for canary and rollback.

Acceptance:
1. Release candidate can be validated via a single documented checklist and command set.
2. Rollback is tested and documented.

## Execution sequence
1. Phase 1: B1 + B2 first (green and deterministic test baseline).
2. Phase 2: A1, A2, A3, A6 (highest customer risk paths).
3. Phase 3: A4, A5, A7 (remaining parity-depth tracks).
4. Phase 4: B3 + B4 + C1 + C2 (final hardening and go-live gating).

## Release gates (must pass)
1. `npm run -w apps/web lint`
2. `npm run -w apps/web typecheck`
3. `npm run -w apps/web test`
4. `npm run -w apps/web test:integration`
5. `node tools/manual-flow-verify.mjs` with:
   - full suite pass
   - zero skipped
   - screenshot artifacts generated
   - no non-allowlisted server errors

## Cost and guardrail constraints
1. No new always-on paid infrastructure is added by default.
2. High-cost channels remain add-on and quota-gated.
3. All new compute/message flows must respect environment and tenant budget controls.
4. Any cap increase must include cheaper fallback and rollback switch.

