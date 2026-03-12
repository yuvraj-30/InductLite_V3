# UI/UX Trend Execution Backlog (Jira/Linear Ready)

## Status

- Date: 2026-03-10
- Program window: 2026-03-11 to 2026-06-05
- Goal: align InductLite graphic, UI, and UX execution with 2026 market expectations without breaking security/cost guardrails.
- S1 gate checkpoint (2026-03-10): admin `bg-white` legacy utility usage is now zero (`rg -o "bg-white" apps/web/src/app/admin | Measure-Object`), and tokenized surface/button/input classes are the default across redesigned admin routes.
- Execution checkpoint (2026-03-10): `UX26-S2-001` implemented behind `UIX_S2_FLOW`; `UX26-S2-002` shared loading/empty/error states implemented on top admin routes behind `UIX_S2_FLOW` fallback behavior; `UX26-S2-003` sidebar IA compressed to <=22 visible labels when `UIX_S2_FLOW=true` while command palette keeps deep-route coverage.
- Mobile checkpoint (2026-03-10): `UX26-S3-001` admin mobile shell implemented behind `UIX_S3_MOBILE` with current-route context, horizontal quick-switch tasks, and focus-order-safe search/nav structure; `UX26-S3-002` sites page now uses mobile-first cards with tap-safe primary actions under `UIX_S3_MOBILE`; `UX26-S3-003` live register now uses mobile-dense cards, sticky filters, and intentional sign-out confirmation under `UIX_S3_MOBILE`.
- AI checkpoint (2026-03-10): `UX26-S4-001` phase 1 implemented behind `UIX_S4_AI` with in-context, draft-only copilot guidance embedded in hazards, incidents, and permits (no automatic mutations).
- AI trust/measurement checkpoint (2026-03-10): `UX26-S4-002` and `UX26-S4-003` implemented with suggestion-level confidence bands + source signals, explicit accept/reject/edit decision logging (`ai.copilot.decision`) with audit trail, and weekly adoption/outcome reporting (`npm run -w apps/web report:copilot-weekly`).
- A11y/performance checkpoint (2026-03-10): `UX26-S5-001` top-route axe automation expanded to 20 key routes with deterministic stable lane behavior; `UX26-S5-003` performance budget lane added for `/login`, `/admin/sites`, `/admin/live-register`, and `/s/:slug` with automated report generation.
- Rollout/GA checkpoint (2026-03-10): `UX26-S6-001` staged rollout + rollback playbook updated (`docs/RUNBOOK_ROLLBACK.md`), `UX26-S6-002` KPI readout tooling added (`tools/uiux-kpi-readout.mjs`), and `UX26-S6-003` docs/checklists refreshed for tier-complete validation.
- Visual checkpoint (2026-03-10): token-first surface migration expanded across templates (`/admin/templates`, `/admin/templates/new`, `/admin/templates/archived`), role detail pages (`/admin/users/[id]`, `/admin/contractors/[id]`, `/admin/sites/[id]`), site add-on pages (`/admin/sites/[id]/access`, `/admin/sites/[id]/lms`, `/admin/sites/[id]/webhooks`, `/admin/sites/[id]/emergency`), mobile native ops (`/admin/mobile/native`), and tier-gated operations pages (`/admin/access-ops`, `/admin/benchmarks`, `/admin/plan-configurator`, `/admin/policy-simulator`, `/admin/safety-copilot`, `/admin/risk-passport`, `/admin/trust-graph`, `/admin/prequalification-exchange`, `/admin/pre-registrations`, `/admin/integrations/channels`, `/admin/integrations/procore`, `/admin/permits/templates`).
- Tier coverage checkpoint (2026-03-10): shared warning/empty state patterns are now applied across entitlement-gated `standard`, `plus`, `pro`, and `add-on` routes (approvals, communications, permits, prequalification exchange, webhooks, channels/procore integrations, mobile ops, evidence, policy simulator, safety copilot, risk passport, trust graph, audit analytics, benchmarks, plan configurator, access operations, and site-level LMS/webhooks/emergency).
- Source context:
  - [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md)
  - [AI_AGENT_INSTRUCTIONS.md](../AI_AGENT_INSTRUCTIONS.md)
  - [UI_UX_CONSISTENCY_GUIDE.md](UI_UX_CONSISTENCY_GUIDE.md)
  - [UI_UX_ROLLOUT_FLAGS_2026-03-10.md](UI_UX_ROLLOUT_FLAGS_2026-03-10.md)
  - [UI_UX_HEURISTIC_AUDIT_TOP20_2026-03-10.md](UI_UX_HEURISTIC_AUDIT_TOP20_2026-03-10.md)
  - [UI_UX_PERFORMANCE_BUDGET_2026-03-10.md](UI_UX_PERFORMANCE_BUDGET_2026-03-10.md)
  - [RUNBOOK_ROLLBACK.md](RUNBOOK_ROLLBACK.md)
  - [NZ_MARKET_TRENDS_AND_DIFFERENTIATION_2026-03-05.md](NZ_MARKET_TRENDS_AND_DIFFERENTIATION_2026-03-05.md)

## Program KPIs (tracked weekly)

1. Public sign-in to completed induction conversion: improve by >= 15% from baseline.
2. Mobile admin task completion rate (top 5 tasks): improve by >= 25% from baseline.
3. Median time-on-task for top 5 admin tasks: reduce by >= 30%.
4. Accessibility: 0 critical and 0 serious violations on top 20 routes.
5. Performance: key pages maintain LCP <= 2.5s on target test profile.

## Non-negotiables

1. Preserve tenant isolation (`company_id`) in all new reads/writes.
2. Preserve CSRF protections for mutating server actions (`assertOrigin()`).
3. Keep cost flat or lower; no new always-on paid infra.
4. Keep rollout behind feature flags and kill switches.

## Sprint Calendar

| Sprint | Dates | Theme |
| --- | --- | --- |
| S0 | 2026-03-11 to 2026-03-18 | Baseline instrumentation and governance |
| S1 | 2026-03-19 to 2026-04-01 | Visual system hardening |
| S2 | 2026-04-02 to 2026-04-15 | Friction reduction in core flows |
| S3 | 2026-04-16 to 2026-04-29 | Mobile admin UX redesign |
| S4 | 2026-04-30 to 2026-05-13 | AI-native workflow integration |
| S5 | 2026-05-14 to 2026-05-27 | Accessibility + performance hardening |
| S6 | 2026-05-28 to 2026-06-05 | Rollout, measurement, and GA readiness |

## Global Verification Command Bundle

Run this bundle for every completed ticket unless scoped differently:

1. `npm run -w apps/web lint`
2. `npm run -w apps/web typecheck`
3. `npm run -w apps/web test`
4. `npm run -w apps/web test:integration`
5. `npm run -w apps/web test:e2e:smoke`
6. `npm run -w apps/web test:visual`
7. `npm run guardrails-lint && npm run guardrails-tests && npm run policy-check`

## Sprint Backlog

### Sprint S0 (2026-03-11 to 2026-03-18) - Baseline

| Ticket | Epic | Title | Scope | Dependencies | SP | Acceptance Criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX26-S0-001 | EPIC-UX-MEASURE | Instrument UX baseline events | `apps/web/src/app/(auth)/login/*`, `apps/web/src/app/s/[slug]/**`, `apps/web/src/app/admin/**`, `apps/web/scripts/export-ux-baseline.ts` | none | 5 | 1) Event taxonomy for login/password, SSO start/callback, induction step progression, and admin navigation search is implemented. 2) Events are tenant-safe and PII-safe (no secrets/raw identifiers). 3) Script outputs baseline CSV for funnel and task metrics. | Global bundle + `npm run -w apps/web report:ux-baseline -- --days=30 --out=docs/ux-baseline.csv` |
| UX26-S0-002 | EPIC-UX-MEASURE | Complete top-20 route heuristic audit | `docs/`, `apps/web/e2e/visual-regression.spec.ts-snapshots/` | UX26-S0-001 | 3 | 1) Heuristic audit completed for top 20 routes (severity scored). 2) Friction list ranked by impact and effort. 3) Screenshots linked per issue for before/after comparison. | `npm run -w apps/web test:visual` |
| UX26-S0-003 | EPIC-UX-GOVERN | Define rollout flags and kill-switch map | `.env.example`, `apps/web/src/lib/feature-flags/**`, `docs/` | UX26-S0-001 | 3 | 1) Feature flags added for each sprint capability (`UIX_S1_VISUAL`, `UIX_S2_FLOW`, `UIX_S3_MOBILE`, `UIX_S4_AI`, `UIX_S5_A11Y`). 2) Kill-switch behavior documented with owner and rollback steps. 3) Missing/invalid env defaults fail safe. | Global bundle |

### Sprint S1 (2026-03-19 to 2026-04-01) - Visual System Hardening

| Ticket | Epic | Title | Scope | Dependencies | SP | Acceptance Criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX26-S1-001 | EPIC-GFX-SYSTEM | Token-first migration for admin surfaces | `apps/web/src/app/globals.css`, `apps/web/src/app/admin/**` | UX26-S0-003 | 8 | 1) Legacy `bg-white` utility use in `apps/web/src/app/admin` reduced by >= 90% from baseline. 2) Shared surfaces/buttons/inputs use tokenized classes (`surface-panel`, `btn-*`, `input`). 3) No contrast regressions in both adaptive modes. | Global bundle + `rg -o "bg-white" apps/web/src/app/admin | Measure-Object` |
| UX26-S1-002 | EPIC-GFX-SYSTEM | Refresh auth and public shell visual identity | `apps/web/src/app/(auth)/**`, `apps/web/src/components/ui/public-shell.tsx`, `apps/web/src/design/modern-theme.json` | UX26-S1-001 | 5 | 1) Login and public sign-in use the same brand primitives and spacing rhythm. 2) Mobile and desktop snapshots pass and match updated references. 3) Reduced-motion behavior preserved. | Global bundle + `npm run -w apps/web test:e2e:stable:mobile-chrome` |
| UX26-S1-003 | EPIC-UI-HIERARCHY | Standardize high-traffic page hierarchy | `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/sites/page.tsx`, `apps/web/src/app/admin/live-register/page.tsx` | UX26-S1-001 | 5 | 1) Above-the-fold hierarchy is consistent: context label, headline, primary action, status summary. 2) Card spacing and typography rhythm follow guide tokens. 3) Visual regression baselines updated for affected routes. | Global bundle |

### Sprint S2 (2026-04-02 to 2026-04-15) - Core Flow Friction Reduction

| Ticket | Epic | Title | Scope | Dependencies | SP | Acceptance Criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX26-S2-001 | EPIC-UX-CONVERSION | Split login intent (Password vs SSO) | `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/(auth)/login/login-form.tsx`, related tests | UX26-S1-002 | 5 | 1) Login entry clearly offers two paths before fields render. 2) Selecting one path reduces visible controls to path-relevant fields only. 3) Existing auth security checks and redirect behavior remain unchanged. | Global bundle + `npm run -w apps/web test:e2e -- e2e/admin-auth.spec.ts` |
| UX26-S2-002 | EPIC-UX-CONVERSION | Unified loading/empty/error state components | `apps/web/src/components/ui/**`, top admin pages | UX26-S1-003 | 5 | 1) Shared state components exist and are reused on top 10 admin routes. 2) Every async page has deterministic loading, empty, and error handling with actionable next steps. 3) Error messages avoid sensitive data leakage. | Global bundle |
| UX26-S2-003 | EPIC-UI-NAV | Reduce admin IA cognitive load | `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/admin-nav.tsx`, `apps/web/src/app/admin/admin-command-palette.tsx` | UX26-S2-002 | 8 | 1) Top-level visible nav labels reduced from 35 to <= 22 through grouping and progressive disclosure. 2) Command palette remains complete and role-aware for deep navigation. 3) Keyboard navigation coverage retained (`Cmd/Ctrl+K`, arrows, Enter, Escape). | Global bundle + `npm run -w apps/web test:e2e -- e2e/command-mode.spec.ts` |

### Sprint S3 (2026-04-16 to 2026-04-29) - Mobile Admin UX Redesign

| Ticket | Epic | Title | Scope | Dependencies | SP | Acceptance Criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX26-S3-001 | EPIC-MOBILE-ADMIN | Mobile-first admin navigation shell | `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/admin-nav.tsx`, `apps/web/src/app/admin/nav-link.tsx` | UX26-S2-003 | 8 | 1) Mobile nav supports quick switch between top tasks in <= 2 taps. 2) Current route and section context are always visible on small screens. 3) Accessibility focus order is logical in mobile nav and search controls. | Global bundle + `npm run -w apps/web test:e2e:stable:mobile-chrome` |
| UX26-S3-002 | EPIC-MOBILE-ADMIN | Sites page mobile card workflow | `apps/web/src/app/admin/sites/page.tsx`, related components/tests | UX26-S3-001 | 5 | 1) Site status/actions are readable without horizontal scanning on 390px viewport. 2) Primary actions (`View`, activation state) remain reachable without accidental taps. 3) Mobile visual baseline approved for sites list. | Global bundle + `npm run -w apps/web test:visual` |
| UX26-S3-003 | EPIC-MOBILE-ADMIN | Live register mobile density + filters | `apps/web/src/app/admin/live-register/page.tsx`, `apps/web/src/app/admin/live-register/**` | UX26-S3-001 | 8 | 1) Live register uses compact, scannable cards/rows with sticky filters. 2) Overstay/safety urgency indicators remain obvious at mobile sizes. 3) Sign-out action remains protected and intentional. | Global bundle + `npm run -w apps/web test:e2e -- e2e/logic-flow.spec.ts` |

### Sprint S4 (2026-04-30 to 2026-05-13) - AI-Native Workflow Integration

| Ticket | Epic | Title | Scope | Dependencies | SP | Acceptance Criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX26-S4-001 | EPIC-AI-UX | Embed copilot guidance in hazards/incidents/permits | `apps/web/src/app/admin/hazards/**`, `apps/web/src/app/admin/incidents/**`, `apps/web/src/app/admin/permits/**`, `apps/web/src/lib/differentiation/safety-copilot.ts` | UX26-S3-003 | 8 | 1) AI guidance appears in-context where decisions are made, not only on standalone page. 2) Suggestions are draft-only (no auto mutation). 3) Tenant scope is enforced for every suggestion request/response. | Global bundle |
| UX26-S4-002 | EPIC-AI-TRUST | Add explainability and approval controls | `apps/web/src/app/admin/safety-copilot/**`, affected action handlers, audit logging paths | UX26-S4-001 | 5 | 1) Each AI suggestion includes source signals and confidence band. 2) Applying AI output requires explicit human action and audit record. 3) Entitlement/flag denials return deterministic control IDs. | Global bundle + `npm run -w apps/web test -- src/app/admin/safety-copilot/actions.test.ts` |
| UX26-S4-003 | EPIC-AI-MEASURE | Measure AI adoption and decision quality | `apps/web/src/lib/repository/**`, `apps/web/src/app/admin/benchmarks/page.tsx`, `docs/` | UX26-S4-002 | 3 | 1) Capture accept/reject/edit metrics for AI suggestions. 2) Weekly report shows adoption and downstream outcome deltas. 3) Metrics exclude sensitive free-text from logs/export. | Global bundle |

### Sprint S5 (2026-05-14 to 2026-05-27) - Accessibility + Performance

| Ticket | Epic | Title | Scope | Dependencies | SP | Acceptance Criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX26-S5-001 | EPIC-A11Y | Expand accessibility automation to top routes | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/**`, docs | UX26-S4-003 | 5 | 1) Axe checks cover top 20 public/admin routes. 2) Test output is deterministic in CI stable lane. 3) Any serious/critical violation fails CI for touched routes. | Global bundle + `npm run -w apps/web test:e2e -- e2e/a11y.spec.ts` |
| UX26-S5-002 | EPIC-A11Y | WCAG 2.2 remediation pass | `apps/web/src/app/**`, `apps/web/src/components/ui/**`, `apps/web/src/app/globals.css` | UX26-S5-001 | 8 | 1) All severe contrast/focus/label issues from S0 audit are closed. 2) Interactive controls maintain visible focus indicators in both themes. 3) Form labels and error associations satisfy WCAG 2.2 expectations. | Global bundle |
| UX26-S5-003 | EPIC-PERF | Frontend performance budget and remediation | `apps/web/src/app/**`, `apps/web/next.config.js`, `tools/` | UX26-S3-003 | 5 | 1) Performance budget defined for key routes (LCP, TBT surrogate, bundle size). 2) Route-level improvements land for login, sites, live register, induction. 3) Budget report is generated in CI and reviewed weekly. | Global bundle + `npm run -w apps/web build` |

### Sprint S6 (2026-05-28 to 2026-06-05) - Rollout and GA Readiness

| Ticket | Epic | Title | Scope | Dependencies | SP | Acceptance Criteria | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX26-S6-001 | EPIC-ROLLOUT | Progressive rollout and rollback playbook | feature flags, `docs/RUNBOOK_ROLLBACK.md`, release checklists | UX26-S5-003 | 3 | 1) Rollout staged to pilot tenants first, then broad release. 2) Rollback steps are documented and tested for each new flag. 3) Budget-protect and entitlement behavior remain intact. | Global bundle + `npm run parity-gate` |
| UX26-S6-002 | EPIC-MEASURE | Post-release KPI readout vs baseline | `docs/`, reporting scripts in `tools/` | UX26-S6-001 | 3 | 1) KPI readout compares baseline (S0) vs post-release with absolute deltas. 2) Success/fail decision is explicit per KPI threshold. 3) Follow-up backlog for misses is generated with owners/dates. | `node tools/test-confidence-gate.mjs --full` |
| UX26-S6-003 | EPIC-GTM | Final documentation and demo evidence refresh | `docs/UI_UX_CONSISTENCY_GUIDE.md`, `docs/MANUAL_FEATURE_VALIDATION_CHECKLIST_2026-03-09.md`, `apps/web/manual-evidence/**` | UX26-S6-002 | 2 | 1) Documentation reflects shipped UX patterns and commands. 2) Manual validation checklist includes updated UI paths and screenshots. 3) Demo evidence package is complete for sales/customer validation. | Global bundle + `node tools/manual-flow-verify.mjs` |

## Cost and Security Impact Summary (Program Level)

1. Cost: designed to stay inside existing infra profile by reusing current stack, feature flags, and test tooling.
2. Security: no relaxation of tenant scoping, auth/session, CSRF, or audit requirements.
3. Guardrails touched: feature flags and UI behavior only; no budget-cap increases planned.
4. Cheaper fallback: ship S1-S3 first, defer S4 AI expansion if budget or timeline pressure appears.

## Definition of Program Completion

1. All `UX26-*` tickets marked done with linked PRs and test evidence.
2. KPI targets met or documented with approved follow-up actions.
3. Docs and checklists updated to match implemented workflows.
4. Release passes guardrail, quality, and parity gates.
