# Production Go-Live Implementation Plan (as of 2026-02-28)

## Objective
- Deliver an end-to-end, production-ready rollout for `Standard`, `Plus`, `Pro`, and add-ons using:
  - [MASTER_FEATURE_REQUIREMENTS_AND_IMPLEMENTATION_2026-02-28.md](MASTER_FEATURE_REQUIREMENTS_AND_IMPLEMENTATION_2026-02-28.md)
- Satisfy your requirement that `Standard` includes competitor-standard features before general release.

## Delivery progress update (2026-02-28)
1. F-13 entitlement enforcement foundation delivered and active for plan-gated paths.
2. F-14 billing preview and credit-line calculation integrated into admin settings.
3. F-01 host notification baseline delivered for successful arrivals (email queue + audit coverage).
4. F-02 badge-printing baseline delivered in public success flow (print template + audit event).
5. F-05 preregistration baseline delivered (admin invite management + public invite-prefill + token consumption tracking + QR invite rendering).
6. F-04 location-audit baseline delivered (site coordinates/radius config + browser capture + in/out indicator + persisted location audit fields).
7. F-06 dashboard reminder visibility advanced (overdue + 30/14/7/1 expiry windows now displayed).
8. F-03 roll-call baseline delivered (persistent site event start/close lifecycle + attendance status updates + CSV export evidence).
9. F-05 bulk prereg tooling delivered (CSV batch upload + row validation + optional invite-email queue + printable QR pack output).
10. F-03 command-mode reporting delivered (dashboard roll-call command summary + drill readiness summary cards).
11. F-01 host notification workflow advanced (public sign-in now supports explicit host recipient selection and targeted arrival email delivery).
12. F-05 reminder automation delivered (email worker now queues daily expiring-invite reminder batches with per-day dedupe audit evidence, and cron maintenance now processes the email queue path).
13. F-01 in-app parity delivered (dashboard now includes arrival-alert feed for admins/site managers, filtered by explicit host targeting when selected).
14. F-06 reminder automation delivered (email worker now dispatches contractor document expiry reminders for 30/14/7/1 windows with per-document/window dedupe audit keys).
15. F-02 badge-print profile coverage delivered (public success badges and admin bulk QR packs now support selectable A4 and thermal print profiles).
16. F-04 admin analytics closure delivered (dashboard now surfaces 30-day location-verification capture/within/outside/missing metrics).
17. F-08 reliability core delivered (outbound webhook queue persistence, maintenance-worker processing, HMAC signatures, retry/backoff, and dead-letter transitions).
18. F-09 scoring core delivered (template quiz policy fields, pass-threshold grading, retry/cooldown tracking, fail-block enforcement, and persisted quiz evidence in induction completion snapshots).
19. F-08 observability operations delivered (admin webhook-delivery log console with site/status filters and seven-day status counts).
20. F-08 admin endpoint controls delivered (per-site webhook endpoint management UI, signing-secret controls, and one-click secret rotation).
21. F-09 analytics reporting delivered (dashboard-level pass/fail/cooldown metrics plus risk-ranked template/site quiz pressure table).
22. F-10 baseline delivered (template-level media block configuration with optional acknowledgement gating, plus public-flow render/enforcement before induction questions).
23. F-07 baseline delivered (template-level language variant mapping, runtime public language selection, entitlement-aware language enforcement, and language evidence capture in sign-in snapshots/audit).
24. F-07 authoring UX advanced (admin template editor now includes guided language-variant and question-override controls, with fallback advanced JSON mode, and an added public-signin E2E language-switch scenario).
25. F-10 authoring UX advanced (admin template editor now includes guided media block controls with add/remove/reorder and type-aware fields, with fallback advanced JSON mode).
26. F-10 evidence workflow advanced (public induction completion snapshots now persist media acknowledgement/config evidence for compliance traceability, including escalation-approved and standard sign-in paths).
27. F-09/F-10 E2E scenarios expanded (public-signin Playwright suite now includes language-switch and media-acknowledgement plus quiz-threshold fail-block scenarios via seeded template modes).
28. F-13 enforcement coverage advanced (email reminder worker now enforces `PREREG_INVITES` and `REMINDERS_ENHANCED` entitlements per company before queuing reminder traffic, and public sign-in metadata now hides quiz scoring enablement when `QUIZ_SCORING_V2` is disabled).
29. F-10 storage-governance controls delivered (media parser now applies URL-length, cumulative body-text, and serialized config-byte budgets to prevent unbounded induction content payload growth).
30. F-09/F-10 plus-flow E2E coverage expanded further (public-signin Playwright suite now includes both failing and successful media-first quiz completion paths).
31. F-13 entitlement coverage expanded (template authoring now blocks quiz/media/language config writes when site/company entitlements are disabled, and webhook admin surfaces now enforce `WEBHOOKS_OUTBOUND` server-side).
32. F-14 accounting sync completed (admin settings now include billing preview sync action/UI with endpoint delivery metadata, optional request signing, env validation, and audit evidence).
33. F-11 baseline delivered (site-level LMS connector settings + entitlement gating + one-way `lms.completion` queue dispatch with worker-side auth-header support).
34. F-11 provider payload mappings delivered (`GENERIC`, `MOODLE`, `SCORM_CLOUD`) and integrated into completion dispatch.
35. F-12 delivered (advanced audit analytics repository + entitlement-gated admin analytics dashboard and nav integration).
36. F-15 delivered as add-on foundation (SMS wrapper with env/entitlement gating, monthly company quota enforcement, provider abstraction, and audit events).
37. F-16 delivered as add-on foundation (hardware decision adapter with entitlement gating, outbound delivery integration, and audit trail).
38. F-17 delivered as add-on foundation (site access-control configuration, geofence deny/override enforcement path, supervisor override verification, and geofence E2E flows).
39. F-07/F-09/F-10 stabilization completed across Chromium, Firefox, and WebKit for language-switch and media-first quiz fail/pass paths.

## Current remaining GA-1 gaps (2026-02-28)
1. No open GA-1 implementation gaps remain for features in scope.
2. Validation gate status: smoke E2E pass (`37/37`) and cross-browser targeted F-07/F-09/F-10 scenarios pass.

## Success criteria (go-live definition)
1. `Standard` mandatory parity features are implemented and enabled by default.
2. `Standard` removable features support per-company/per-site disable + billing credit.
3. Plan entitlements are enforced server-side for all protected capabilities.
4. Guardrail, security, and budget controls pass in production-like load tests.
5. Rollout completes with pilot -> staged -> GA and validated rollback path.

## Scope and release target

### In scope for first production release (GA-1)
1. `P0` + `P1` from master backlog:
   - F-01 Host notifications
   - F-02 Badge printing
   - F-03 Roll-call maturity
   - F-04 Location capture/radius verification (audit mode)
   - F-05 Pre-registration/invite flow
   - F-06 Expiry reminder automation
   - F-07 Multi-language induction packs
   - F-08 Webhook reliability
   - F-09 Quiz scoring engine
   - F-10 Media-first induction flow
   - F-13 Entitlements engine
   - F-14 Billing calculator integration
2. Standard mandatory/removable packaging model.
3. Plan UI and admin controls for company/site-level feature toggles.

### Originally out of scope for GA-1 (now baseline-delivered)
1. F-11 baseline LMS provider mapping and dispatch controls.
2. F-12 advanced audit analytics dashboard and aggregation layer.
3. F-15 SMS workflow wrapper (quota/policy-gated add-on).
4. F-16 hardware access adapter framework (policy-gated add-on).
5. F-17 geofence enforcement deny/override mode (policy-gated add-on).

## Program constraints (must-pass)
1. Preserve tenant isolation (`company_id`) and scoped DB patterns.
2. Preserve CSRF protection (`assertOrigin`) for all mutating server actions.
3. Respect `ARCHITECTURE_GUARDRAILS.md` cost ceilings and budget-protect behavior.
4. Keep SMS and hard geofence disabled by default unless policy exception is approved.

## Workstreams
1. Product and UX.
2. Data and backend services.
3. Entitlements and billing.
4. Security and guardrails.
5. QA and release engineering.
6. Operations and support readiness.

## Phase plan (end-to-end)

## Phase 0: Program setup and baselining (Week 1)

Deliverables:
1. Freeze GA-1 scope and acceptance criteria for F-01..F-10, F-13, F-14.
2. Create feature flags:
   - `FF_HOST_NOTIFICATIONS`
   - `FF_BADGE_PRINTING`
   - `FF_ROLLCALL_V2`
   - `FF_LOCATION_AUDIT`
   - `FF_PREREG_INVITES`
   - `FF_REMINDERS_V2`
   - `FF_I18N_INDUCTION`
   - `FF_WEBHOOKS_V2`
   - `FF_QUIZ_SCORING_V2`
   - `FF_CONTENT_BLOCKS`
   - `FF_ENTITLEMENTS_V1`
   - `FF_BILLING_CREDITS_V1`
3. Define release metrics:
   - Sign-in completion rate.
   - Induction completion rate.
   - Notification success/failure rate.
   - Roll-call completion time.
   - Budget utilization percent.

Execution tasks:
1. Map each feature to exact API routes/actions/components/repositories.
2. Create migration and rollback checklist per feature.
3. Add epic-level RFC docs in `docs/` for any schema-impacting changes.

Exit gate:
1. Feature inventory and dependency map approved.
2. Flags created and defaulted to `off` in production.

## Phase 1: Platform foundation (Weeks 2-3)

Primary goal:
- Ship F-13 and F-14 first so all later features are enforceable and billable.

Implementation tasks:
1. Schema:
   - Add `company_plan` (`standard|plus|pro`).
   - Add `company_feature_override` table.
   - Add `site_feature_override` table.
   - Add billing-credit mapping table or config model for removable features.
2. Service layer:
   - Build `getEffectiveEntitlements(companyId, siteId?)`.
   - Build `assertFeatureEnabled(featureKey, companyId, siteId?)`.
3. Enforcement:
   - Guard all feature entrypoints (actions/routes/workers).
4. Billing:
   - Compute site-level final price with floor logic.
   - Produce monthly line items for plan, credits, add-ons.

Testing:
1. Unit tests for entitlement merge precedence:
   - Plan default -> company override -> site override.
2. Integration tests for denial payload shape and deterministic codes.
3. Billing tests for floor-price and credit edge cases.

Exit gate:
1. Entitlements active in staging for existing features with no regressions.
2. Billing preview output matches pricing policy.

## Phase 2: Standard mandatory parity implementation (Weeks 4-7)

Primary goal:
- Close all Standard mandatory parity gaps before pricing launch.

Feature delivery sequence:
1. F-01 Host notifications.
2. F-02 Badge printing.
3. F-03 Roll-call maturity.
4. F-04 Location capture/radius indicator.
5. F-05 Pre-registration/invite.

Detailed tasks:
1. F-01 Host notifications:
   - Add host recipient model/rules.
   - Trigger arrival notifications from check-in flow.
   - Add retryable email queue path and audit events.
2. F-02 Badge printing:
   - Print template generator (A4 + thermal profile).
   - Badge QR payload standardization.
   - Audit record for print action.
3. F-03 Roll-call maturity:
   - `EvacuationEvent` and `EvacuationAttendance` models.
   - Snapshot on-site roster at event start.
   - Accounted/missing state transitions and report export.
4. F-04 Location audit mode:
   - Consent-aware client GPS capture.
   - Site radius calculation and in/out indicator.
   - No hard deny logic in Standard.
5. F-05 Pre-registration/invite:
   - Admin preregistration workflow.
   - Invite link and QR generation.
   - Auto-fill of visitor details on arrival.

Testing:
1. Unit tests for location/radius and roll-call transitions.
2. Integration tests for data integrity and tenant separation.
3. E2E tests:
   - Pre-register -> arrival -> host notified.
   - Badge print from successful sign-in.
   - Evacuation event lifecycle.

Exit gate:
1. All Standard mandatory features implemented and pass staging UAT.
2. Pilot customers can run full Standard flow without manual workarounds.

## Phase 3: Standard removable + Plus foundations (Weeks 8-10)

Primary goal:
- Ship Standard optional/removable and Plus-core differentiators.

Feature delivery sequence:
1. F-06 Reminder automation v2.
2. F-07 Multi-language packs.
3. F-08 Webhooks v2.
4. F-09 Quiz scoring v2.
5. F-10 Media-first induction.

Detailed tasks:
1. F-06 Reminder automation:
   - 30/14/7/1 windows.
   - Dedupe per document/window.
   - Dashboard counts for due/overdue.
2. F-07 Multi-language:
   - Template variant mapping by language code.
   - Runtime language selection in public flow.
3. F-08 Webhooks v2:
   - Endpoint model, secret rotate, event subscriptions.
   - Signed payload + retry/backoff + dead-letter state.
4. F-09 Quiz scoring:
   - Pass threshold, attempts, cooldown.
   - Fail-block behavior when required-for-entry.
5. F-10 Media-first content:
   - Content blocks (`PDF|IMAGE|TEXT` first).
   - Required acknowledgement before questions.
   - Completion snapshot of content version.

Testing:
1. Unit tests for grading/reminder/webhook signature logic.
2. Integration tests for retry/dedupe/snapshot consistency.
3. E2E tests for end-to-end content->quiz pass/fail flows.

Exit gate:
1. Standard removable toggles apply correctly at company/site level.
2. Plus features are production-ready behind plan entitlements.

## Phase 4: Hardening, performance, and compliance gates (Weeks 11-12)

Primary goal:
- Convert working features into release-safe production behavior.

Security and guardrails:
1. Validate all mutating actions retain `assertOrigin`.
2. Verify tenant scoping for all new repository access paths.
3. Add static-analysis coverage for new modules.
4. Validate messaging quotas and budget-protect fail-safe paths.

Performance and reliability:
1. Load test public sign-in and high-volume roll-call events.
2. Soak test webhook retries and queue backpressure behavior.
3. Validate cache/rate-limit behavior under spike traffic.

Data safety:
1. Run migration rehearsal in staging using production-like snapshot.
2. Run PITR restore drill and rollback drill.

Exit gate:
1. No critical or high vulnerabilities.
2. Performance and reliability thresholds meet release SLO targets.
3. Rollback rehearsed and signed off.

## Phase 5: Pilot and staged release (Weeks 13-14)

Pilot rollout:
1. Enable features for 2-5 pilot companies.
2. Enable Standard mandatory first.
3. Enable Standard removable and Plus features incrementally.

Pilot KPIs:
1. Sign-in completion success rate >= 99%.
2. Notification delivery success >= 98%.
3. Roll-call event completion without data mismatch >= 99%.
4. No budget-protect trigger due to new features for 14 days.

Staged rollout:
1. 10% of production tenants.
2. 50% after 3 stable days.
3. 100% GA after 7 stable days.

Rollback criteria:
1. Any Sev-1 incident.
2. P95 sign-in latency regression > 30% sustained 30 minutes.
3. Error rate > 2% for 15 minutes.
4. Budget projection > 100% due to feature release.

## Phase 6: GA launch and post-launch operations (Weeks 15-16)

Launch activities:
1. Publish final Standard/Plus/Pro packaging and add-on policy.
2. Enable `FF_ENTITLEMENTS_V1` and `FF_BILLING_CREDITS_V1` globally.
3. Release notes and customer-facing migration guide.

Post-launch (first 30 days):
1. Daily incident and KPI review.
2. Weekly FinOps review against tier budgets.
3. Weekly feature-adoption and conversion review.
4. Prioritize Pro/add-on backlog based on actual demand.

## Detailed production readiness checklist

## A) Architecture and code readiness
1. All new feature code paths are tenant-scoped.
2. All mutating actions enforce CSRF checks.
3. No raw SQL or secret leakage violations.
4. Feature flags and kill switches exist for each new capability.

## B) Data and migrations readiness
1. Migrations are backward-compatible (expand/contract).
2. Migration runbook validated for this release.
3. PITR restore tested within target RTO.

## C) Test readiness (must-pass commands)
From repo root:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run guardrails-lint`
5. `npm run guardrails-tests`
6. `npm run policy-check`

Targeted:
1. `cd apps/web && npm run test:integration`
2. `cd apps/web && npm run test:e2e`
3. `cd apps/web && npm run test:e2e:stable`

## D) Infrastructure and operations readiness
1. Render, Neon, R2, Upstash, Resend env vars verified.
2. Cron routes authenticated and keep-alive workflow validated.
3. Sentry and tracing pipeline tested with synthetic failures.
4. Retention and maintenance jobs verified in production.

## E) Business readiness
1. Final plan matrix approved (Standard/Plus/Pro/add-ons).
2. Billing credits and floor logic verified on sample invoices.
3. Sales and support playbooks updated.
4. Customer onboarding templates updated.

## RACI (minimal)
1. Product Owner: scope, pricing, launch decisions.
2. Tech Lead: architecture, security invariants, release gates.
3. Backend Engineer(s): schema/services/worker flows.
4. Frontend Engineer(s): public/admin UX and plan controls.
5. QA Lead: regression/UAT/performance sign-off.
6. Ops Owner: deployment, observability, rollback drills.

## Risks and mitigations
1. Risk: scope creep from Pro/add-on features delays Standard parity.
   - Mitigation: lock GA-1 scope to P0+P1 only.
2. Risk: notification volume increases cost unexpectedly.
   - Mitigation: caps, budget-protect triggers, email-first defaults.
3. Risk: location feature triggers privacy concerns.
   - Mitigation: explicit consent, audit-only mode, clear retention policy.
4. Risk: new entitlements logic causes access regressions.
   - Mitigation: staged rollout + shadow-read compare mode in staging.

## Required documents to update in each release PR chain
1. [MASTER_FEATURE_REQUIREMENTS_AND_IMPLEMENTATION_2026-02-28.md](MASTER_FEATURE_REQUIREMENTS_AND_IMPLEMENTATION_2026-02-28.md)
2. [STANDARD_PLUS_PRO_PACKAGING_PLAN_2026-02-28.md](STANDARD_PLUS_PRO_PACKAGING_PLAN_2026-02-28.md)
3. [NZ_FEATURE_COST_MODEL_2026-02-28.md](NZ_FEATURE_COST_MODEL_2026-02-28.md)
4. [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)
5. [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md)
6. [DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md](DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md)

## Go-live sign-off template
1. Change summary.
2. Cost impact.
3. Security impact.
4. Guardrails affected.
5. Cheaper fallback.
6. Test plan and results.
7. Rollback status and restore drill result.
8. Launch decision (`GO` or `NO-GO`).
