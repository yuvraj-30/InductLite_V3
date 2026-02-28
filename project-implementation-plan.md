# Project Implementation Plan

Date: 2026-02-22  
Authoring role: Senior Software Architect  
Status: In progress (Phases 3-4 partial complete)

Source documents:
- `docs/MASTER_FOUNDER_PLAN.md`
- `ARCHITECTURE_GUARDRAILS.md`
- `AI_AGENT_INSTRUCTIONS.md`

## 1) Executive Summary

This plan converts `docs/MASTER_FOUNDER_PLAN.md` into an execution blueprint with strict ordering, risk controls, and test gates.

Primary outcome:
- Deliver legal-compliance-critical capabilities first (retention, notifiable workflow, emergency drill evidence).
- Close guardrail gaps (admin rate limiting, export download byte enforcement, route hardening).
- Improve field UX and resilience without violating tenant isolation or cost guardrails.

Progress snapshot (2026-02-23):
- Completed: admin + magic-link rate-limiting controls (Phase 3 subset).
- Completed: export byte-budget guardrails for queueing/downloads with deterministic control payloads (Phase 3 subset).
- Completed: reliability hardening for `/health` and `/api/ready` (shared ORM DB readiness check, shared rate-limit strategy for readiness).
- Completed: structured client crash telemetry path from `app/error.tsx` and `app/global-error.tsx` to `/api/client-errors`.
- Completed: compliance data model increment (notifiable incident metadata, emergency drill register, company/record legal-hold flags, incident/drill retention enforcement).
- Completed: public sign-in critical-event escalation gate (red-flag induction answers now block entry and create audit evidence).
- Completed: blocked red-flag escalation notifications are queued to site managers for follow-up.
- Completed: admin escalation queue with explicit approve/deny decisions that resolve blocked red-flag submissions.
- Completed: end-to-end escalation lifecycle coverage for both resolution outcomes (blocked red-flag submission -> admin approve/deny -> deterministic retry behavior on original worker session).
- Completed: escalation lifecycle E2E validation across Chromium/Firefox/WebKit and included in smoke suite gating.
- Completed: auth signup transaction moved from app-layer action to repository boundary (`registerCompanyWithAdmin`) with unit coverage.
- Completed: worker competency/briefing evidence layer (induction competency state, supervisor verification evidence, and refresher scheduling persisted with immutable completion snapshots).
- Completed: public induction UX hardening (larger stepper readability, explicit load-failure retry action with offline guidance, and shared-device signature safety defaults for kiosk mode).
- Completed: persistent admin onboarding guidance across empty states (Sites/Templates/Live Register now reuse shared onboarding progress checklist until first induction is completed).
- Completed: contractor magic-link recovery UX (invalid/expired path now includes explicit "Request New Link" CTA, expiry/timing guidance, and direct recovery path from expired portal sessions).
- Completed: public emergency information UX refresh (tap-first emergency cards with quick-call actions and clearer step hierarchy on the induction screen).
- Completed: legal-hold + retention class completion for compliance records (induction/sign-in and audit classes added; company compliance legal hold now hard-stops sign-in, incident, drill, and audit purges).
- Completed: admin compliance settings management for retention classes/legal hold (`/admin/settings`) with audit logging and permission-gated updates.
- Completed: E2E coverage for admin compliance settings save flow + legal-hold reason validation, and guardrail control-matrix entries for settings update controls (`COMP-001..003`).

## 2) Non-Negotiable Constraints

All work must preserve:
- Tenant isolation by construction (`company_id` scoping, repository boundary).
- CSRF protections on mutating server actions (`assertOrigin()` baseline).
- No raw SQL additions.
- Guardrail-first behavior for exports/uploads/rate limits.
- Cost ceilings and no new paid infra without explicit budget approval.

## 3) Program Scope

In scope:
- WorkSafe NZ compliance data and workflow coverage.
- Security and guardrail hardening listed in founder plan.
- Resilience and observability improvements.
- UX polish for induction/admin onboarding friction points.

Out of scope (this program increment):
- New infrastructure platforms.
- Mobile native app.
- Multi-region architecture changes.

## 4) Target Deliverables

1. Legal/Compliance
- Notifiable event data model and workflow.
- Emergency drill/test evidence register.
- Legal hold plus retention classes for compliance records.

2. Security/Guardrails
- Enforced admin rate limits (`RL_ADMIN_*`) in validation + runtime.
- Export download/day byte quota enforcement.
- Magic link consume route abuse controls.

3. Ops/Resilience
- Shared readiness limiter strategy (not process-local only).
- Structured crash/error telemetry path.
- Health/readiness contract hardening.

4. UX/CSM
- Field-friendly induction stepper and high-friction control improvements.
- Retry-first public error states.
- Persistent guided onboarding across admin empty states.

## 5) Workstreams

## WS-A: Compliance Data and Policy Controls
Goals:
- Model and retain evidence required for regulator-facing operations.

Primary files (expected):
- `apps/web/prisma/schema.prisma`
- `apps/web/src/lib/maintenance/retention.ts`
- `apps/web/src/lib/repository/incident.repository.ts`
- `apps/web/src/app/admin/incidents/actions.ts`
- `apps/web/src/app/admin/incidents/page.tsx`

## WS-B: Security and Guardrail Enforcement
Goals:
- Remove policy drift between documented controls and runtime behavior.

Primary files (expected):
- `apps/web/src/lib/env-validation.ts`
- `apps/web/src/lib/rate-limit/index.ts`
- `apps/web/src/app/(auth)/verify/route.ts`
- `apps/web/src/lib/repository/export.repository.ts`
- `apps/web/src/app/api/exports/[id]/download/route.ts`

## WS-C: Reliability and Observability
Goals:
- Improve production behavior under failure and improve diagnostics.

Primary files (expected):
- `apps/web/src/app/api/ready/route.ts`
- `apps/web/src/app/health/route.ts`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/global-error.tsx`
- `apps/web/src/lib/logger/pino.ts`

## WS-D: UX Friction Reduction
Goals:
- Improve field usability and first-run admin success path.

Primary files (expected):
- `apps/web/src/app/s/[slug]/components/SignInFlow.tsx`
- `apps/web/src/app/s/[slug]/components/InductionQuestions.tsx`
- `apps/web/src/app/s/[slug]/page.tsx`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/sites/page.tsx`
- `apps/web/src/app/admin/templates/page.tsx`

## 6) Phase Plan and Sequencing

## Phase 0: Planning Baseline and ADR Pack
Objective:
- Freeze architecture decisions and acceptance criteria before coding.

Tasks:
- Write ADRs for retention model, admin rate-limiter design, and export byte accounting.
- Define control IDs and error contracts for new denials.

Exit criteria:
- Signed technical scope and PR slicing strategy.

## Phase 1: Schema and Migration Foundation
Objective:
- Land additive schema changes for compliance and retention controls.

Tasks:
- Add notifiable-event fields and drill/test evidence models.
- Add legal-hold and retention classification fields.
- Generate migration and update type-safe repository contracts.

Exit criteria:
- Migration applies cleanly.
- Prisma client generated.
- No breaking changes to current routes.

## Phase 2: Repository and Service Layer
Objective:
- Implement all new data behavior behind scoped repositories.

Tasks:
- Implement compliant retention logic and legal-hold exclusions.
- Add repository methods for drill records and incident regulatory metadata.
- Add export byte budget accounting and query helpers.

Exit criteria:
- No app-layer direct data logic for new capabilities.
- Unit tests cover repository paths.

## Phase 3: Security and Guardrail Enforcement
Objective:
- Enforce missing controls in runtime paths.

Tasks:
- Add `RL_ADMIN_PER_USER_PER_MIN`, `RL_ADMIN_PER_IP_PER_MIN`, `RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN` to env validation.
- Add admin rate-limit checks to admin server actions and relevant API routes.
- Add magic-link consume rate limit on `/verify`.
- Enforce export download byte caps before download redirect/response.

Exit criteria:
- Guardrail denials are deterministic and include control metadata.
- Guardrail tests updated and passing.

## Phase 4: Reliability and Error-Path Hardening
Objective:
- Improve failure handling and observability quality.

Tasks:
- Replace process-local-only readiness throttle with shared limiter strategy.
- Ensure client crash paths emit structured telemetry.
- Harden public error states with retry UX.

Exit criteria:
- Failure flows are user-recoverable.
- Critical errors are observable in structured logs.

## Phase 5: UX and Adoption Improvements
Objective:
- Reduce first-use friction for workers/admins.

Tasks:
- Field mode visual updates for induction stepper and controls.
- Public retry and recovery affordances.
- Persistent onboarding guidance across admin empty states.

Exit criteria:
- E2E validates first induction setup path end-to-end.
- Mobile usability checks pass for induction flow.

## Phase 6: Verification, Documentation, and Release Gate
Objective:
- Validate all behavior and synchronize docs.

Tasks:
- Run full lint/typecheck/test/guardrail command matrix.
- Update docs for workflows, runbooks, and new env controls.
- Produce release notes with cost/security deltas and fallback options.

Exit criteria:
- All required checks green.
- Documentation and guardrail matrix reflect actual implementation.

## 7) PR Slicing Strategy

PR-1: Schema/migrations only  
PR-2: Repository/service implementation only  
PR-3: Guardrail/rate-limit enforcement in actions/routes  
PR-4: Ops/resilience changes (health/ready/error telemetry)  
PR-5: UX improvements and onboarding polish  
PR-6: Tests + docs + final policy updates

Rules:
- Keep PRs scoped to one phase where possible.
- Do not merge downstream PRs before upstream phase gate is complete.

## 8) Acceptance Criteria

Compliance:
- Incident workflows store and export regulator metadata.
- Compliance-critical records respect retention and legal-hold rules.

Security:
- Admin/public abuse controls align with documented guardrails.
- Export download byte quotas enforced per company and globally.

Reliability:
- Readiness and health behavior is deterministic and safe under scale.
- Crash/error events are centrally observable.

UX:
- Public induction flow is usable with high-friction field conditions.
- New admins receive persistent setup guidance until first successful induction.

## 9) Risk Register

1. Risk: Migration complexity on existing production data.  
Mitigation: additive-first migration strategy, backfill scripts, rollback checkpoints.

2. Risk: Guardrail over-enforcement causes workflow blockage.  
Mitigation: phased rollout, dry-run logging mode where appropriate, explicit control IDs.

3. Risk: Retention changes accidentally purge required legal data.  
Mitigation: legal-hold precedence, retention integration tests, staged retention jobs.

4. Risk: Rate-limiting changes create false positives for legitimate admins.  
Mitigation: separate user/ip/company scopes, telemetry on block reasons, bounded threshold tuning.

5. Risk: UX changes regress desktop workflows.  
Mitigation: responsive test matrix and targeted E2E coverage for desktop/mobile.

## 10) Test Plan (Exact Commands)

From repo root:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run test:integration`
5. `npm run test:e2e:smoke`
6. `npm run guardrails-lint`
7. `npm run guardrails-tests`
8. `npm run policy-check`

Targeted app-level runs when needed:
1. `cd apps/web && npm run test:integration`
2. `cd apps/web && npm run test:e2e:smoke`

## 11) Documentation Update Checklist

Must update in same implementation window:
- `docs/MASTER_FOUNDER_PLAN.md` (progress and outcomes)
- `docs/guardrail-control-matrix.md` (new/changed controls)
- `docs/critical-paths.md` (if critical-path behavior changes)
- `.env.example` and `apps/web/.env.example` if new env contracts are introduced
- `README.md` and relevant runbooks if operational behavior changes

## 12) Definition of Done (Program Level)

Done means all items below are true:
- Phase gates 0-6 completed.
- All test/guardrail/policy checks pass.
- No tenant isolation or CSRF regressions.
- Cost model remains within current guardrail tier budgets.
- Documentation accurately reflects shipped behavior.
