# Competitor Parity + Differentiation Execution Backlog (Planning Only)

## Status

- Date: 2026-03-08
- Mode: **Phase 3/4 implementation complete and release-gated**
- Primary goal: achieve competitor-parity coverage for tracked NZ market capabilities and ship clear differentiation that improves win-rate.
- Validation evidence:
  - `node tools/manual-flow-verify.mjs` -> `305 passed` on 2026-03-08.
  - release gates passed locally: `parity-gate`, `lint`, `typecheck`, `test`, `test:integration`.
  - latest E2E run log: `apps/web/manual-evidence/all-e2e-2026-03-07T11-42-10-504Z.log`.

## Inputs (source of truth)

1. [COMPETITOR_PARITY_CONTROL_MATRIX.md](COMPETITOR_PARITY_CONTROL_MATRIX.md)
2. [NZ_MARKET_TRENDS_AND_DIFFERENTIATION_2026-03-05.md](NZ_MARKET_TRENDS_AND_DIFFERENTIATION_2026-03-05.md)
3. [NZ_MARKET_PARITY_AND_DIFFERENTIATION_IMPLEMENTATION_PLAN_2026-03-05.md](NZ_MARKET_PARITY_AND_DIFFERENTIATION_IMPLEMENTATION_PLAN_2026-03-05.md)
4. [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)

## Program outcomes

1. **Parity floor complete** for tracked competitor gaps:
   - `PAR-015`, `PAR-016`, `PAR-017`, `PAR-018` are moved to `implemented`.
2. **Differentiation moat strengthened**:
   - `PAR-019`, `PAR-020`, `PAR-021` become fully productized and sales-ready.
3. **Commercial readiness**:
   - plan packaging, pricing pages, and evidence-backed sales assets reflect final capability state.

## Delivery model

Use two parallel tracks:

1. `Track A: Parity floor` (must-have to avoid deal loss)
2. `Track B: Differentiation moat` (must-win to increase conversion)

## Phase plan

## Phase 0: Baseline + architecture decisions (1 week)

### Objectives

1. Freeze parity definitions for this release cycle.
2. Approve architecture for native/mobile and new operations modules.
3. Lock plan-tier packaging and cost guardrails before build.

### Backlog tickets

| Ticket | Scope | Outputs | Acceptance |
| --- | --- | --- | --- |
| P0-001 | Freeze parity matrix scope | Matrix rows + statuses approved for this cycle | Product + Engineering sign-off on `PAR-015..018` target behavior |
| P0-002 | Mobile architecture decision | ADR: `PWA-only` vs `native wrapper` vs `React Native` | Selected option includes auth/session/security design |
| P0-003 | Delivery/mailroom design | Domain model + UI flows + role permissions | Approved ERD + API contract |
| P0-004 | Resource booking design | Domain model + capacity/conflict rules | Approved ERD + API contract |
| P0-005 | Cost and guardrail review | Updated expected monthly run-cost by tier | Finance/engineering approval with fallback path |

## Phase 1: Parity completion, mobile and geofence automation (4-6 weeks)

### Scope

1. Close `PAR-015` native mobile auto check-in/out.
2. Close `PAR-018` background geofence auto check-in/out.

### Backlog tickets

| Ticket | Scope | Implementation targets | Acceptance |
| --- | --- | --- | --- |
| P1-001 | Device session + secure enrollment | mobile session flows, subscription/device binding, audit trail | Device enrollment is tenant-scoped and revocable |
| P1-002 | Background geofence event pipeline | geofence entry/exit detection, dedupe, retry queue | Entry/exit events processed idempotently |
| P1-003 | Auto check-in policy engine | per-site policy modes (`OFF`, `ASSIST`, `AUTO`) | Policy behavior is deterministic and auditable |
| P1-004 | Auto check-out guardrails | stale-session heuristics and false-positive controls | False-positive rate below agreed threshold |
| P1-005 | Mobile admin controls | mobile ops UI for policy, diagnostics, and overrides | Site admins can configure and troubleshoot without DB access |

### Test/evidence requirements

1. E2E: mobile geofence scenarios (positive + negative + outage mode).
2. Integration: idempotency and retry behavior for background events.
3. Security: tenant isolation + origin checks + PII redaction in logs.

## Phase 2: Parity completion, delivery/mailroom + resource booking (4-6 weeks)

### Scope

1. Close `PAR-016` delivery and mailroom management.
2. Close `PAR-017` resource/desk booking workflows.

### Backlog tickets

| Ticket | Scope | Implementation targets | Acceptance |
| --- | --- | --- | --- |
| P2-001 | Delivery/mailroom data model | `DeliveryItem`, `DeliveryEvent`, recipient mapping, SLA fields | Full lifecycle: arrived -> notified -> collected |
| P2-002 | Delivery operations UI | intake, status board, recipient confirmation, history | End-to-end workflow via admin UI with audit logs |
| P2-003 | Delivery notifications | host/recipient alert routing + retries | Notifications emitted and tracked with delivery diagnostics |
| P2-004 | Resource booking data model | `Resource`, `Booking`, conflict handling, site scoping | Conflict-free bookings with deterministic validation |
| P2-005 | Booking UI | availability view, create/edit/cancel flow | Users can book and manage resources per permissions |
| P2-006 | Booking reminders + exports | reminders, usage logs, export support | Export output matches in-app state and audit evidence |

### Test/evidence requirements

1. E2E: full delivery lifecycle and booking conflict workflows.
2. Integration: concurrency/race tests for booking collisions.
3. Guardrails: quota/rate-limit behavior for notification spikes.

## Phase 3: Differentiation productization (3-4 weeks)

### Scope

Productize and sales-enable features that can beat competitor defaults:

1. `PAR-019` tamper-evident evidence
2. `PAR-020` policy simulator
3. `PAR-021` risk passport

### Backlog tickets

| Ticket | Scope | Implementation targets | Acceptance |
| --- | --- | --- | --- |
| P3-001 | Evidence verification hardening | signed manifests, verification UX/API, export chain-of-custody | Verifier catches tampering and produces deterministic report |
| P3-002 | Policy simulator UX completion | scenario templates, impact summaries, exportable recommendations | Ops users can run simulations without engineering help |
| P3-003 | Risk passport decision hooks | threshold actions for approvals/escalations | Risk score actively affects policy outcomes per configured rules |
| P3-004 | Differentiation analytics | usage + outcome metrics for these three modules | KPIs available in admin analytics and GTM dashboard |

## Phase 4: Commercialization + rollout (2-3 weeks)

### Scope

1. Convert engineering capability into sales leverage.
2. Ensure packaging does not erode margins.

### Backlog tickets

| Ticket | Scope | Outputs | Acceptance |
| --- | --- | --- | --- |
| P4-001 | Plan packaging alignment | final Standard/Plus/Pro/add-on mapping | Pricing pages + entitlements + invoice preview align |
| P4-002 | Public comparison refresh | update `/compare` and supporting sales collateral | All claims map to test-backed feature evidence |
| P4-003 | Pilot rollout | 3-5 pilot sites, monitored adoption/quality metrics | Pilot KPIs meet target thresholds |
| P4-004 | GA release gates | release checklist with rollback/kill-switches | All gates pass before GA cutover |

## Parity mapping checklist

| Control | Current | Target | Phase |
| --- | --- | --- | --- |
| PAR-015 Native mobile auto check-in/out | implemented | implemented | Phase 1 |
| PAR-016 Delivery and mailroom management | implemented | implemented | Phase 2 |
| PAR-017 Resource/desk booking workflows | implemented | implemented | Phase 2 |
| PAR-018 Background geofence auto check-in/out | implemented | implemented | Phase 1 |

## Differentiation mapping checklist

| Control | Current | Target | Phase |
| --- | --- | --- | --- |
| PAR-019 Tamper-evident evidence | implemented | productized + GTM-evidenced | Phase 3-4 |
| PAR-020 Policy simulator | implemented | productized + GTM-evidenced | Phase 3-4 |
| PAR-021 Risk passport | implemented | productized + GTM-evidenced | Phase 3-4 |

## Release gates (must pass)

1. `npm run parity-gate`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run -w apps/web test:integration`
6. `node tools/manual-flow-verify.mjs`

## Cost and guardrail constraints

1. No always-on premium infrastructure unless approved by guardrail policy.
2. High-cost features remain entitlement-gated and default-off when env/quotas are absent.
3. SMS/hardware remain add-ons unless explicitly re-baselined.
4. Every new module must include:
   - tenant isolation by `company_id`
   - CSRF-safe mutating actions (`assertOrigin()`)
   - quota and rate-limit controls
   - audit logging for state changes

## Definition of completion for this backlog

1. `PAR-015..018` status moved to `implemented` with code refs + test refs.
2. Differentiation controls have measurable usage and conversion impact.
3. Updated parity matrix and CI gate remain green after each phase.
4. Sales-facing comparison and pricing assets match actual shipped behavior.

## What is explicitly out of scope in this document

1. Plan-tier price changes now.
2. Native mobile app binaries (iOS/Android project scaffolding).
