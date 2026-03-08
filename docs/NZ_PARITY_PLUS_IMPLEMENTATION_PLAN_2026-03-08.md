# NZ Parity-Plus Implementation Plan (2026-03-08)

## Objective

Deliver full NZ competitor parity and clear differentiation beyond competitor standard plans, using:

1. [NZ_PARITY_PLUS_2026_CHECKLIST_2026-03-08.md](NZ_PARITY_PLUS_2026_CHECKLIST_2026-03-08.md)
2. [COMPETITOR_PARITY_CONTROL_MATRIX.md](COMPETITOR_PARITY_CONTROL_MATRIX.md)
3. [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
4. [AI_AGENT_INSTRUCTIONS.md](../AI_AGENT_INSTRUCTIONS.md)

## Execution Update (2026-03-08)

Completed in-code from this plan:

1. `P-18` tenant-facing data residency controls (settings UI/action/repository + attestation metadata).
2. `P-19` visitor photo/ID workflow (site policy controls, public capture flow, encrypted persistence, admin retrieval audit route).
3. `P-20` partner API v1 baseline (scoped key auth, rotation, monthly quota + rate controls, versioned endpoints, docs).
4. `P-13` mobile reliability hardening (heartbeat endpoint, replay endpoint, stale-device diagnostics).
5. `P-14` native runtime readiness controls (iOS/Android runtime metadata + admin distribution panel).
6. `P-16` named connector implementation (Procore admin config, queued outbound snapshots, inbound apply endpoint).
7. `P-17` prequalification exchange interoperability (provider payload import, mapping, auditable apply pipeline).
8. `D-08` safety copilot workflow (tenant-scoped copilot runs + quota controls + recommendation history).
9. `D-09` contractor trust graph (internal risk + external prequalification combined scoring with reason codes).
10. `D-10` predictive benchmarking (projected KPI cards + percentile + explainability surface).

## Scope in this plan

This plan closes all checklist items currently marked `partial` or `missing`.

1. `P-13` geofence reliability depth.
2. `P-14` native iOS/Android distribution.
3. `P-16` named connector (Procore-class).
4. `P-17` NZ prequalification interoperability.
5. `P-18` tenant-facing data residency controls.
6. `P-19` visitor photo/ID workflow.
7. `P-20` partner API productization.
8. `D-08` AI permit/safety copilot.
9. `D-09` cross-network contractor trust graph.
10. `D-10` predictive benchmark analytics.

## Non-negotiable constraints

1. Tenant isolation by construction (`company_id`, `scopedDb(companyId)`).
2. CSRF defenses remain enforced for mutating actions (`assertOrigin()` baseline).
3. No raw SQL.
4. Environment budget ceilings remain within `ARCHITECTURE_GUARDRAILS.md`.
5. High-cost capabilities are entitlement-gated and add-on capable.
6. Any new integration/AI spend has hard quotas and kill switches.

## Definition of done

1. All 10 scoped items move to `implemented` in the checklist and parity matrix.
2. Feature flags, entitlements, and pricing behavior are production-usable.
3. Unit, integration, and E2E gates pass with updated evidence logs.
4. Documentation, runbooks, and pricing/packaging pages are aligned to shipped behavior.

## Delivery model

Use five phases:

1. Phase 0: Foundations and architecture decisions.
2. Phase 1: Mobile parity closure.
3. Phase 2: Integration and ecosystem parity closure.
4. Phase 3: Identity, API, and residency parity closure.
5. Phase 4: Differentiation moat expansion.
6. Phase 5: Hardening, go-live, and release gate sign-off.

## Phase 0 (1 week): Foundations

### Goals

1. Lock technical decisions for each gap.
2. Add feature flags and entitlements for all new capabilities.
3. Freeze acceptance criteria and release gates.

### Tickets

| Ticket | Scope | Deliverables | Acceptance |
| --- | --- | --- | --- |
| PL0-001 | Flag and entitlement expansion | Add keys for native app runtime, named connector, prequal exchange, visitor photo ID, partner API, residency control, AI modules | Denials return deterministic `CONTROL_ID` payloads |
| PL0-002 | ADR set | ADRs for native wrapper strategy, connector contract, prequal exchange schema, AI model/provider policy | ADRs approved by product + engineering |
| PL0-003 | Cost guardrails | Quotas/caps for new API and AI paths | Startup/env validation blocks unsafe config |

## Phase 1 (3-4 weeks): Mobile parity closure (`P-13`, `P-14`)

### Goals

1. Close reliability gaps in geofence automation.
2. Ship native app wrappers for iOS and Android while reusing existing web/PWA flow.

### Build scope

1. Introduce thin native wrapper shells around existing flow.
2. Add background event reliability queue with stronger idempotency keys and retry telemetry.
3. Add native push registration bridge to existing subscription APIs.
4. Add device diagnostics and policy controls in `/admin/mobile`.

### Data and API

1. Extend device subscription metadata (app version, os version, wrapper channel, health status).
2. Add event replay endpoint for delayed background events.
3. Add device heartbeat endpoint for stale-device detection.

### Testing

1. Unit tests for native token bridge validators.
2. Integration tests for geofence event idempotency/replay.
3. E2E flows for auto check-in/out including offline-resume.

### Exit criteria

1. Geofence event false-positive controls are enforced and audited.
2. iOS and Android builds complete and can enroll devices.
3. `P-13`, `P-14` status moves to `implemented`.

## Phase 2 (4-5 weeks): Integration and ecosystem parity (`P-16`, `P-17`)

### Goals

1. Deliver first named connector.
2. Deliver prequalification ecosystem interoperability.

### Build scope

1. Connector v1 (start with one named connector):
   - outbound event sync
   - inbound reference sync
   - cursor-based retries and dead-letter controls
2. Prequalification exchange v1:
   - external provider profile mapping
   - sync/import pipeline
   - operator review queue before apply

### Data and API

1. Add integration connection and sync cursor models.
2. Add provider mapping and external profile snapshot models.
3. Add admin pages for connector config and sync health.

### Testing

1. Contract tests for connector payload compatibility.
2. Integration tests for retry, backoff, and dedupe.
3. E2E tests for admin setup and sync visibility.

### Exit criteria

1. One named connector is production-usable.
2. External prequal exchange path is production-usable.
3. `P-16`, `P-17` status moves to `implemented`.

## Phase 3 (3-4 weeks): Identity, API, and residency parity (`P-18`, `P-19`, `P-20`)

### Goals

1. Make data residency buyer-visible.
2. Add privacy-safe visitor photo/ID workflow.
3. Productize partner API surface.

### Build scope

1. Residency controls:
   - tenant-facing residency metadata and admin view
   - immutable residency policy audit trail
   - compliance export includes residency evidence
2. Visitor photo/ID:
   - optional capture/upload at sign-in
   - explicit consent text and retention controls
   - strict storage validation and secure retrieval
3. Partner API:
   - versioned API namespace
   - API credential lifecycle (issue, rotate, revoke)
   - per-key scopes, quotas, and audit events

### Testing

1. Security tests for unauthorized media access attempts.
2. Integration tests for key scope enforcement and rotation.
3. E2E for optional photo/ID flow and partner API usage sample.

### Exit criteria

1. Residency, photo/ID, and partner API are documented and usable.
2. `P-18`, `P-19`, `P-20` status moves to `implemented`.

## Phase 4 (5-7 weeks): Differentiation moat (`D-08`, `D-09`, `D-10`)

### Goals

1. Ship AI-assisted safety copilot with strict guardrails.
2. Ship trust-graph model combining internal and external risk signals.
3. Ship predictive benchmark analytics with explainability.

### Build scope

1. AI copilot:
   - permit/safety assistant for policy guidance and risk prompts
   - response grounding to tenant-scoped evidence only
   - budget caps and rate limits per tenant and environment
2. Trust graph:
   - contractor risk edges across internal behavior and linked external status
   - confidence scoring and reason codes
3. Benchmark analytics:
   - cohort baselines
   - trend projections
   - explainability cards in admin dashboard

### Testing

1. Red-team tests for cross-tenant prompt/data leakage.
2. Deterministic unit tests for scoring and threshold logic.
3. Integration tests for AI fallback behavior when budget/quotas are exceeded.

### Exit criteria

1. `D-08`, `D-09`, `D-10` status moves to `implemented`.
2. Add-on and plan gating keeps baseline cost within guardrails.

## Phase 5 (1-2 weeks): Hardening and go-live

### Goals

1. Prove production readiness.
2. Finalize commercialization artifacts.

### Gates

1. `npm run -w apps/web lint`
2. `npm run -w apps/web typecheck`
3. `npm run -w apps/web test`
4. `npm run -w apps/web test:integration`
5. `npm run parity-gate`
6. `node tools/manual-flow-verify.mjs`
7. Migration + seed verification:
   - `npm run -w apps/web db:migrate`
   - `npm run -w apps/web db:seed`

### Exit criteria

1. All gates pass.
2. Checklist and matrix docs updated to final status.
3. Runbooks updated for rollback, incident response, and feature kill-switches.

## Cost and packaging strategy

### Keep in Standard (mandatory parity floor)

1. Core sign-in, induction, roll-call, contractor compliance, pre-reg, webhook baseline.
2. Existing implemented parity rows that are already market floor.

### Keep as Plus/Pro or Add-on (cost/risk heavy)

1. Native app advanced automation controls.
2. Named connector packs.
3. External prequalification exchange.
4. Photo/ID verification workflow.
5. Partner API premium limits.
6. AI copilot, trust graph, predictive benchmarks.

### Cost-control controls required before rollout

1. Quotas for AI calls, connector sync jobs, and media storage.
2. Per-feature circuit breakers.
3. Entitlement checks at every server mutation and API boundary.
4. Environment budget-protect behavior tested in staging.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Native wrapper complexity delays parity | Timeline slip | Thin wrapper approach first, reuse existing web flow |
| Connector API volatility | Integration failures | Contract tests + cursor retries + dead-letter queue |
| Photo/ID privacy compliance risk | Legal/compliance risk | Explicit consent, strict retention, role-based access, full audit |
| AI cost spikes | Budget breach | Hard token caps, fail-closed quotas, paid add-on gating |
| Cross-tenant leakage risk in AI/analytics | Security incident | Strict tenant scoping, red-team tests, deny-by-default access |

## Documentation updates required during execution

1. Update parity checklist and control matrix after each phase.
2. Update pricing and packaging pages when plan entitlements change.
3. Update runbooks and guardrail control matrix for new controls.
4. Keep command examples aligned to `package.json` scripts.

## Milestone checklist

1. M1: Phase 0 complete and approved.
2. M2: Mobile parity complete (`P-13`, `P-14`).
3. M3: Integration parity complete (`P-16`, `P-17`).
4. M4: Identity/API/residency parity complete (`P-18`, `P-19`, `P-20`).
5. M5: Differentiation expansion complete (`D-08`, `D-09`, `D-10`).
6. M6: Release gates passed and go-live approved.
