# NZ Market Parity and Differentiation End-to-End Implementation Plan (as of 2026-03-05)

## Objective
Deliver a production-ready roadmap that closes market-requested gaps and adds defensible differentiation, based on:
1. [NZ_MARKET_TRENDS_AND_DIFFERENTIATION_2026-03-05.md](NZ_MARKET_TRENDS_AND_DIFFERENTIATION_2026-03-05.md)
2. [NZ_COMPETITOR_FEATURE_PARITY_TABLE_2026-03-05.md](NZ_COMPETITOR_FEATURE_PARITY_TABLE_2026-03-05.md)

This plan is aligned to:
1. [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
2. [AI_AGENT_INSTRUCTIONS.md](../AI_AGENT_INSTRUCTIONS.md)

## Executive summary
1. Highest-priority missing demand items are `Permit-to-Work`, `Identity hardening`, `Emergency broadcast communications`, and `Teams/Slack integrations`.
2. Highest-priority differentiation items are `Tamper-evident compliance packs`, `Safety policy simulator`, and `Cross-site contractor risk passport`.
3. Use a staged release strategy: `Foundation -> Market-parity -> Differentiation -> Commercialization`.
4. Keep high-cost capabilities gated as add-ons to stay inside budget guardrails.

## Success criteria (definition of done)
1. All market-trend `Not implemented` items have shipped baseline capability and are entitlement-gated.
2. All parity-table `Partially` items are either fully implemented or explicitly de-scoped with documented rationale.
3. No tenant-isolation, CSRF, rate-limit, export, upload, or messaging guardrails regress.
4. `Standard`, `Plus`, `Pro`, and add-on packaging is enforceable server-side with auditable billing effects.
5. Production rollout completes with pilot KPIs meeting thresholds for reliability, adoption, and cost.

## Source backlog normalization

### A) Market-trend gaps from source file
1. Permit-to-Work / Control-of-Work.
2. Identity hardening (ID scan, watchlists, random checks, stricter approval).
3. Mobile-first auto check-in/out + push (partial today).
4. Emergency communications maturity (partial today).
5. Teams/Slack collaboration approval loops.

### B) Parity-table partials from source file
1. Emergency/site alerts.
2. Worker access controls and permits.
3. Custom fields/forms and smart forms.
4. Man-hour tracking.
5. Site safety document/compliance handling depth.
6. Visitor approval workflow breadth.
7. Configurable workflow depth.
8. Emergency alerts + mustering depth.
9. Auto/manual retake controls.
10. Induction expiry tracking depth.
11. Contractor prequalification workflow.
12. Gate/turnstile-linked sign-in depth.

### C) Differentiation opportunities from source file
1. Tamper-evident compliance evidence packs.
2. Safety policy simulator.
3. Cross-site contractor risk passport.
4. Self-serve plan configurator with per-site modular pricing.
5. Unified communication hub (email/SMS/Teams/Slack/emergency acknowledgements).

## Program constraints (must-pass)
1. Tenant isolation by construction via `company_id` and `scopedDb(companyId)`.
2. Mutating server actions retain `assertOrigin()` protection.
3. No raw SQL.
4. Keep within environment budget tier ceilings and budget-protect behavior.
5. High-cost channels remain entitlement-gated and disabled by default when required envs/quotas are absent.
6. Any geofence-hardening expansion must remain policy-gated and reviewed against guardrails.

## Target packaging model

| Capability area | Standard | Plus | Pro | Add-on |
| --- | --- | --- | --- | --- |
| Permit-to-Work | Basic permit issue/approve/close | Multi-stage approvals + hold points | API integrations + advanced analytics | N/A |
| Identity hardening | Manual approval + random checks | Watchlists + advanced approval policies | External identity provider connectors | External identity checks |
| Emergency comms | Email broadcast + acknowledgement | Multi-channel orchestration | Incident-command dashboard + automation | SMS emergency boost pack |
| Teams/Slack | Basic notifications | Approval actions in channel | Workflow automation and escalations | N/A |
| Mobile capability | PWA install + web push | Enhanced offline assist and cached views | Optional native wrapper management | Native mobile app package |
| Tamper-evident evidence packs | N/A | Signed manifest bundles | Verify API + chain-of-custody controls | Legal evidence vault |
| Policy simulator | N/A | Scenario simulator | Batch simulation + recommended policy tuning | N/A |
| Contractor risk passport | N/A | Site-level scoring | Cross-site risk model + policy hooks | N/A |
| Self-serve plan configurator | N/A | N/A | Admin/self-serve provisioning controls | White-label commercial portal |

## Delivery phases and timeline

## Phase 0: Foundation and controls (2 weeks)

### Scope
1. Feature flag and entitlement skeleton for all new epics.
2. Guardrail control-matrix updates and env contracts.
3. Baseline audit taxonomy for all new actions.

### Deliverables
1. New feature flags:
   - `FF_PERMITS_V1`
   - `FF_ID_HARDENING_V1`
   - `FF_EMERGENCY_COMMS_V1`
   - `FF_TEAMS_SLACK_V1`
   - `FF_PWA_PUSH_V1`
   - `FF_EVIDENCE_TAMPER_V1`
   - `FF_POLICY_SIMULATOR_V1`
   - `FF_RISK_PASSPORT_V1`
   - `FF_SELF_SERVE_CONFIG_V1`
2. Entitlement keys and default plan mapping in `plans/entitlements.ts`.
3. `.env.example` additions for new integrations and quotas.

### Exit criteria
1. Flags and entitlement checks are enforced server-side with deterministic denial payloads.
2. Guardrail docs and env validations pass CI.

## Phase 1: Market parity core (6 weeks)

### Epic 1: Permit-to-Work and contractor prequalification

### Functional scope
1. Permit templates (`hot work`, `confined space`, `excavation`, custom).
2. Permit lifecycle (`draft -> requested -> approved -> active -> suspended -> closed`).
3. Permit-to-sign-in linkage and permit status checks.
4. Contractor prequalification checklist linked to permits.

### Data model additions (Prisma)
1. `PermitTemplate` (company/site scoped, approval policy JSON).
2. `PermitRequest` (requestor, assignee, lifecycle status, validity window).
3. `PermitApproval` (approver, decision, stage, timestamp).
4. `PermitCondition` (pre-start checks, hold points, closeout checks).
5. `ContractorPrequalification` (score/status, expiry, evidence refs).

### API and service work
1. `lib/repository/permit.repository.ts`.
2. Admin actions/routes for create/update/approve/activate/close.
3. Sign-in flow hook to enforce permit policy for configured sites.
4. Worker reminder jobs for expiring permits and prequalification renewals.

### UI work
1. `/admin/permits` dashboard and filters.
2. `/admin/permits/templates` builder.
3. Permit board widget in site detail and command mode.
4. Contractor profile prequalification panel.

### Acceptance criteria
1. Permit status changes are auditable and tenant-scoped.
2. Required permit sites block unauthorized entry with clear action message.
3. Expiry reminders run with dedupe and quota enforcement.

### Epic 2: Visitor approval workflow depth and ID hardening baseline

### Functional scope
1. Policy-based visitor approval requirements by site/template/risk conditions.
2. Randomized checks for configured percentage of sign-ins.
3. Watchlist match checks (internal list baseline).
4. Manual ID verification workflow with evidence attachment.

### Data model additions
1. `VisitorApprovalPolicy` (rules JSON, random check percentage).
2. `VisitorApprovalRequest` (pending/approved/denied/revoked).
3. `VisitorWatchlistEntry` (match keys and status).
4. `IdentityVerificationRecord` (method, reviewer, evidence pointer, result).

### API and service work
1. Approval decision endpoints and queue.
2. Watchlist matching service with normalized keys.
3. Sign-in gating extension for approval-required cases.

### UI work
1. `/admin/approvals` queue and SLA indicators.
2. Approval cards in `/admin/escalations` or dedicated module.
3. Watchlist management page.

### Acceptance criteria
1. Policy conditions trigger approvals deterministically.
2. Random checks are reproducible and audited.
3. No PII leakage in logs and exports.

## Phase 2: Communications and collaboration (5 weeks)

### Epic 3: Emergency communication maturity + unified communication hub

### Functional scope
1. Emergency broadcast messages scoped by active site attendance.
2. Multi-channel delivery orchestration (email first, optional SMS).
3. Acknowledgement tracking and read-state.
4. Roll-call linkage for missing-person escalation.

### Data model additions
1. `EmergencyBroadcast` (scope, severity, message, initiator).
2. `BroadcastRecipient` (channel, status, acknowledged_at, retries).
3. `CommunicationEvent` (normalized outbound/inbound event log).

### API and service work
1. Broadcast orchestration service and message queue.
2. ACK ingestion endpoints and timeout escalations.
3. Dashboard aggregation metrics for delivery/ack rates.

### UI work
1. `/admin/command-mode` broadcast composer.
2. `/admin/communications` unified feed with filters.
3. Site manager alert center with SLA timers.

### Acceptance criteria
1. Broadcast reaches all intended recipients with retry behavior.
2. ACK states update in near-real-time.
3. Roll-call and broadcast artifacts export together for incident evidence.

### Epic 4: Teams/Slack integration

### Functional scope
1. Channel notifications for arrivals, approvals, emergency events.
2. Actionable approvals from channel cards/buttons.
3. Mapping rules by site and event type.

### Data model additions
1. `ChannelIntegrationConfig` (provider, endpoint, auth, mappings).
2. `ChannelDelivery` (request/response metadata with retry status).

### API and service work
1. Integration config endpoints and secret rotation.
2. Outbound connectors in webhook worker pipeline.
3. Signed callback endpoints for action responses.

### UI work
1. `/admin/integrations/channels` settings and test-send controls.
2. Delivery diagnostics panel.

### Acceptance criteria
1. Channel notifications can be enabled/disabled per site.
2. Approval actions from Teams/Slack resolve requests idempotently.
3. Delivery errors are visible and auditable.

## Phase 3: Mobile and access operations (4 weeks)

### Epic 5: Mobile-first enhancements (policy-safe)

### Functional scope
1. PWA push notifications and install prompts.
2. Auto check-out assistance (non-invasive policy mode first).
3. Enhanced offline support for critical sign-in data capture.
4. Optional native-wrapper feasibility gate (not default execution).

### Data model additions
1. `DeviceSubscription` for web push.
2. `PresenceHint` for auto check-out recommendations.

### API and service work
1. Push subscription endpoints and dispatch worker integration.
2. Auto check-out recommendation engine.

### UI work
1. User/device notification preferences.
2. Mobile-focused command and alert views.

### Acceptance criteria
1. Push opt-in/out and delivery status tracked per device.
2. Auto check-out assistance reduces stale on-site records without false-denial side effects.
3. Feature remains compliant with guardrail policy defaults.

### Epic 6: Gate/turnstile-linked sign-in depth

### Functional scope
1. Two-way handshake for access decision correlation.
2. Decision latency and failure analytics.
3. Retry and fallback modes for hardware outages.

### Data model additions
1. `AccessDecisionTrace` with request/decision/ack timestamps.
2. `HardwareOutageEvent` for reliability reporting.

### Acceptance criteria
1. Access decisions are traceable end-to-end by correlation ID.
2. Fallback mode preserves sign-in continuity under hardware outage.

## Phase 4: Differentiation launch (6 weeks)

### Epic 7: Tamper-evident compliance evidence packs

### Functional scope
1. Signed manifest file for each compliance export bundle.
2. Hash chaining per included artifact.
3. Verification endpoint for external auditors.

### Data model additions
1. `EvidenceManifest` (hash root, signer, signature, algorithm, expiry).
2. `EvidenceArtifact` (path, hash, size, type).

### API and service work
1. Export worker enhancement to generate signed manifests.
2. Verification route for checksum and signature validation.

### Acceptance criteria
1. Bundle integrity verification succeeds for untampered exports.
2. Any artifact mutation is detected and reported deterministically.

### Epic 8: Safety policy simulator

### Functional scope
1. Scenario builder for geofence/quiz/escalation/approval rules.
2. Replay against historical anonymized snapshots.
3. Estimated impact report (blocked entries, approval load, false positives).

### Data model additions
1. `PolicySimulation` and `PolicySimulationRun`.
2. `PolicySimulationResult` summary and breakdown JSON.

### Acceptance criteria
1. Simulator runs are reproducible from same snapshot + inputs.
2. Results are exportable for governance review.

### Epic 9: Cross-site contractor risk passport

### Functional scope
1. Configurable risk scoring model using incidents, expiring documents, quiz failures, permit breaches.
2. Threshold hooks for approvals and notifications.
3. Risk trend view by contractor and by site.

### Data model additions
1. `ContractorRiskScore` (current score, components, last calculated).
2. `RiskScoreHistory` (time-series for trend reporting).

### Acceptance criteria
1. Score refresh jobs run within configured cadence.
2. Policy hooks can use risk thresholds without manual intervention.

### Epic 10: Self-serve plan configurator and commercialization

### Functional scope
1. Per-site modular feature selection with mandatory/removable enforcement.
2. Live price preview and effective-date scheduling.
3. Add-on purchase flow with guardrail-safe default quotas.

### Data model additions
1. `PlanChangeRequest` and `PlanChangeHistory`.
2. Extended `feature_credit_overrides` metadata for customer-facing labels.

### Acceptance criteria
1. Price changes are transparent and auditable before commit.
2. Entitlement updates take effect at scheduled boundaries with rollback support.

## Cross-cutting implementation details

## Security impact
1. All new tenant-owned entities include `company_id` and scoped repository access.
2. All mutating server actions enforce `assertOrigin()`.
3. ID verification and watchlist data are encrypted at rest and masked in UI/logs.
4. Every approval/permit/broadcast decision is written to audit log with actor and context.

## Cost impact (estimated monthly deltas at MVP scale)
1. Permit + approvals: `+NZD 10-30` (DB + job volume).
2. Emergency comms hub: `+NZD 15-60` depending message volumes.
3. Teams/Slack connectors: `+NZD 0-10`.
4. PWA push: `+NZD 5-20`.
5. Tamper-evident evidence packs: `+NZD 5-15`.
6. Policy simulator + risk scoring: `+NZD 10-35`.
7. Native mobile app (if approved): implementation-heavy and likely budget-exception work.

## Guardrails/env impact
1. Add explicit quotas:
   - `MAX_BROADCASTS_PER_COMPANY_PER_DAY`
   - `MAX_BROADCAST_RECIPIENTS_PER_EVENT`
   - `MAX_PUSH_NOTIFICATIONS_PER_COMPANY_PER_MONTH`
   - `MAX_POLICY_SIM_RUNS_PER_COMPANY_PER_DAY`
   - `MAX_RISK_SCORE_RECALC_JOBS_PER_DAY`
2. Reuse existing export/upload/messaging caps and budget-protect mode.
3. Fail closed when integration credentials or quota envs are missing.

## Cheaper fallback strategy (if budget pressure occurs)
1. Ship permit baseline without staged approvals first.
2. Keep identity hardening to internal watchlists/manual verification before paid third-party identity checks.
3. Prioritize Teams or Slack (one connector first), not both.
4. Ship PWA push before any native app work.
5. Keep simulator batch frequency low and run off-peak.

## QA and test strategy

## Required automated tests per epic
1. Unit:
   - Rule engines (permit gating, approval policy, risk scoring).
   - Hash/signature verification for evidence packs.
2. Integration:
   - Repository tenancy guarantees for all new models.
   - Lifecycle transitions with race-condition handling (approval, permit closeout, broadcast ACK).
3. E2E:
   - Permit-required sign-in flow.
   - Approval queue and channel action approvals.
   - Emergency broadcast + acknowledgement + roll-call linkage.
   - Self-serve plan configurator price-change flow.

## Mandatory command gate before each release candidate
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run -w apps/web test:integration`
5. `npm run -w apps/web test:e2e:stable`
6. `npm run -w apps/web test:e2e`

## Rollout plan

## Stage 1: Internal alpha
1. Enable features for internal test tenant only.
2. Validate cost counters, audit payloads, and denial responses.

## Stage 2: Design-partner beta (3-5 tenants)
1. Enable permit + approval + emergency comms first.
2. Weekly KPI review:
   - Permit cycle time.
   - Approval queue SLA.
   - Broadcast acknowledgement rate.
   - Incremental infra cost.

## Stage 3: Controlled GA
1. Roll out Standard/Plus/Pro packaging.
2. Keep high-cost capabilities as explicit add-ons.
3. Monitor budget-protect and quota behavior for first full month.

## Rollback and contingency
1. Feature-flag rollback path for each epic.
2. Keep schema changes additive until post-GA cleanup window.
3. Maintain export/legal retrieval paths during any budget-protect mode.

## Milestone plan (target)
1. `M1 (Week 2)`: Foundation complete.
2. `M2 (Week 8)`: Market parity core complete.
3. `M3 (Week 13)`: Communications + mobile/access depth complete.
4. `M4 (Week 19)`: Differentiation launch complete.
5. `M5 (Week 20)`: Production hardening, docs, training, and GA readiness sign-off.

## Ownership model
1. Product: scope and plan packaging decisions.
2. Platform/Backend: schema, repositories, workers, guardrails.
3. Frontend: admin/public UX and self-serve flows.
4. Security/Compliance: identity data handling, audit and evidence controls.
5. QA/Release: automated coverage and staged rollout quality gates.

## Final go-live checklist
1. All epics have acceptance criteria met and signed.
2. Cost-at-cap simulation remains within current environment budget tier.
3. Security review completed for ID, approvals, and communication features.
4. Runbooks published for permits, emergency comms, integrations, and incident rollback.
5. Sales enablement updated with Standard/Plus/Pro/add-on boundaries and customer-facing value narrative.

