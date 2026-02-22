# Project Implementation Plan

Source of requirements: `docs/MASTER_FOUNDER_PLAN.md`  
Scope: architectural execution map plus implementation completion record.

## Execution Completion (2026-02-21)

- Phase 0 complete: planning freeze and dependency order established.
- Phase 1 complete: Prisma schema + migrations shipped for hazards, emergency data, legal versioning/signature evidence, and incident reporting.
- Phase 2 complete: repository/service layer shipped for hazards, emergency, legal consent, signature persistence, exports boundary, and incident reports.
- Phase 3 complete: security/ops hardening shipped (structured logging expansion, sanitized health/readiness, sitemap repository boundary, rate-limit telemetry updates).
- Phase 4 complete: public/admin UX shipped (legal pages/links, hazard register UI, emergency setup UI, incident register UI, live-register incident shortcut, offline queue modules).
- Phase 5 complete: test sweep complete (unit + integration + e2e + guardrail checks).
- Phase 6 complete: docs/runbooks synchronized with implementation and tenant-owned model registry updated.

## 1. Execution Principles

1. `Prisma schema + migration` changes must land before any repository/action/UI changes that depend on new fields/tables.
2. `Repository/service` changes must land before `Server Actions/Route Handlers`.
3. `Server Actions/Route Handlers` must land before `UI` wiring that calls new payload shapes.
4. `Guardrails/docs/env contracts` must be updated in the same phase as feature toggles or new limits.
5. `Tests` are phase-gated; each phase must pass its required checks before the next phase starts.

## 2. Strict Phase Sequence (Dependency-Safe)

| Phase | Name | Depends On | Blocks |
| --- | --- | --- | --- |
| 0 | Baseline + Planning Freeze | None | All implementation work |
| 1 | Data Model + Migration Foundation | Phase 0 | Repositories, Actions, UI |
| 2 | Repository + Service Layer | Phase 1 | Actions/Routes, UI |
| 3 | Security/Audit + Operational Hardening | Phase 2 | UI completion, release |
| 4 | Public/Admin UX Delivery | Phase 2-3 | E2E completion, release |
| 5 | Test & Verification Sweep | Phase 1-4 | Documentation finalization |
| 6 | Documentation + Release Readiness | Phase 5 | Merge/release |

## 3. Phase-by-Phase File Touch Map

## Phase 0: Baseline + Planning Freeze
Goal: lock execution order and acceptance criteria.

Create:
- `project-implementation-plan.md` (this file)

Reference (no edits required in this phase):
- `docs/MASTER_FOUNDER_PLAN.md`
- `ARCHITECTURE_GUARDRAILS.md`
- `AI_AGENT_INSTRUCTIONS.md`

Exit criteria:
- Approved file map and sequencing.
- No application code changes.

---

## Phase 1: Data Model + Migration Foundation
Goal: introduce compliance-safe schema changes first.

Modify:
- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/seed.ts` (only if seed data required for new admin UX or e2e)

Create:
- `apps/web/prisma/migrations/<timestamp>_master_founder_phase1/migration.sql`

Expected schema additions (architectural targets):
- Hazard register domain (site-scoped).
- Emergency contacts/procedures (site-scoped).
- Signature evidence persistence fields connected to induction response.
- Versioned legal consent evidence fields (terms/privacy version references + acceptance metadata).

Docs/contracts to update in this phase:
- `docs/guardrail-control-matrix.md` (if new limits/env vars are introduced)
- `docs/tenant-owned-models.md` (regenerated artifact flow only; do not hand-edit if CI enforces generation)

Mandatory sequence:
1. Edit `schema.prisma`.
2. Generate and inspect migration SQL.
3. Run Prisma generate/migrate.
4. Only then move to repositories.

Exit criteria:
- Migration applies cleanly.
- Prisma client generated.
- No repository/action/UI changes merged before this is stable.

---

## Phase 2: Repository + Service Layer
Goal: make new schema usable through tenant-safe repository boundaries.

Modify:
- `apps/web/src/lib/repository/public-signin.repository.ts`
- `apps/web/src/lib/repository/export.repository.ts`
- `apps/web/src/lib/repository/site.repository.ts`
- `apps/web/src/lib/repository/audit.repository.ts`
- `apps/web/src/lib/repository/index.ts`
- `apps/web/src/lib/auth/magic-link.ts`
- `apps/web/src/lib/repository/magic-link.repository.ts`
- `apps/web/src/lib/security/data-protection.ts` (only if extra encryption/hash utilities are needed)

Create:
- `apps/web/src/lib/repository/hazard.repository.ts`
- `apps/web/src/lib/repository/emergency.repository.ts`
- `apps/web/src/lib/legal/consent-versioning.ts`

Key architectural requirements implemented in this phase:
- Persist signature evidence end-to-end in repository write path.
- Add tenant-scoped CRUD/query methods for hazards/emergency contacts.
- Move export queue/concurrency transaction logic out of app action into repository/service.
- Add audit events for magic-link issue/consume/failure.

Mandatory sequence:
1. Repository interfaces/types.
2. Repository implementation.
3. Audit action enum expansion in `audit.repository.ts`.
4. Barrel exports in `repository/index.ts`.
5. Unit tests for repository changes.

Exit criteria:
- All data writes reachable via repository boundary.
- No app route directly depends on unavailable repository methods.

---

## Phase 3: Security/Audit + Operational Hardening
Goal: align runtime behavior with security and observability requirements.

Modify:
- `apps/web/src/app/health/route.ts`
- `apps/web/src/app/api/ready/route.ts`
- `apps/web/src/app/sitemap.xml/route.ts`
- `apps/web/src/app/(auth)/contractor/actions.ts`
- `apps/web/src/app/(auth)/verify/route.ts`
- `apps/web/src/lib/rate-limit/index.ts` (if health/ready throttles are added)
- `apps/web/src/lib/rate-limit/telemetry.ts`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/history/page.tsx`
- `apps/web/src/app/admin/live-register/page.tsx`
- `apps/web/src/instrumentation.ts` (if logger standardization includes startup path)

Create:
- `apps/web/src/lib/repository/sitemap.repository.ts`

Key architectural requirements implemented in this phase:
- Remove route-layer direct Prisma usage where planned (`sitemap.xml`).
- Replace ad-hoc `console.*` operational logging in key admin pages/telemetry paths with structured logger.
- Sanitize health/readiness outward error payloads.
- Add/confirm audit trails for magic-link operations.

Mandatory sequence:
1. Repository refactor for sitemap and dependent imports.
2. Logging standardization.
3. Health/ready behavior hardening.
4. Route-level security/audit updates.

Exit criteria:
- Structured logging path used consistently in targeted areas.
- Health/ready routes no longer leak sensitive detail.

---

## Phase 4: Public/Admin UX Delivery
Goal: implement UX/compliance surface changes after backend contracts are stable.

Modify:
- `apps/web/src/app/s/[slug]/actions.ts`
- `apps/web/src/app/s/[slug]/components/SignInFlow.tsx`
- `apps/web/src/app/s/[slug]/components/InductionQuestions.tsx`
- `apps/web/src/app/s/[slug]/components/SuccessScreen.tsx`
- `apps/web/src/components/ui/public-shell.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/sites/[id]/page.tsx`
- `apps/web/src/app/admin/sites/actions.ts`
- `apps/web/src/lib/validation/schemas.ts`
- `apps/web/next.config.js` (only if offline strategy/caching changes are required)

Create:
- `apps/web/src/app/privacy/page.tsx`
- `apps/web/src/app/terms/page.tsx`
- `apps/web/src/app/admin/hazards/page.tsx`
- `apps/web/src/app/admin/hazards/actions.ts`
- `apps/web/src/app/admin/sites/[id]/emergency/page.tsx`
- `apps/web/src/app/admin/sites/[id]/emergency/actions.ts`
- `apps/web/src/lib/offline/signin-queue.ts`
- `apps/web/src/lib/offline/signin-sync.ts`

Key architectural requirements implemented in this phase:
- Fat-finger-friendly public induction controls.
- Terms/privacy links and legal version visibility.
- First-run admin onboarding checklist.
- Hazard and emergency admin workflows.
- Offline submission queue/sync UX foundations.

Mandatory sequence:
1. Validation schema updates.
2. Server action payload wiring.
3. Public/admin UI wiring.
4. Offline queue UX integration.

Exit criteria:
- UI consumes only already-shipped server contracts.
- No UI path relies on schema fields absent from migration.

---

## Phase 5: Test & Verification Sweep
Goal: prevent regressions and validate guardrails.

Modify:
- `apps/web/src/lib/repository/__tests__/public-signin.repository.unit.test.ts`
- `apps/web/src/app/s/[slug]/actions.test.ts`
- `apps/web/src/lib/auth/__tests__/magic-link.test.ts`
- `apps/web/e2e/public-signin.spec.ts`
- `apps/web/e2e/admin-auth.spec.ts` (only if auth/legal nav impact)

Create:
- `apps/web/tests/integration/hazard-register.integration.test.ts`
- `apps/web/tests/integration/emergency-contacts.integration.test.ts`
- `apps/web/tests/integration/legal-consent-signature.integration.test.ts`
- `apps/web/tests/integration/health-ready-hardening.integration.test.ts`
- `apps/web/e2e/admin-hazards.spec.ts`
- `apps/web/e2e/admin-emergency-contacts.spec.ts`

Required command sequence:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `cd apps/web && npm run test:integration`
5. `cd apps/web && npm run test:e2e:smoke`
6. `npm run guardrails-lint && npm run guardrails-tests && npm run policy-check`

Exit criteria:
- All changed-layer tests pass before docs/release updates.

---

## Phase 6: Documentation + Release Readiness
Goal: finalize operational/legal docs and release artifacts.

Modify:
- `docs/MASTER_FOUNDER_PLAN.md` (status updates/checklist outcomes)
- `docs/PRODUCT_CRITIQUE.md` (if used as active product narrative)
- `docs/guardrail-control-matrix.md` (new controls/limits)
- `docs/critical-paths.md` (if BUDGET_PROTECT/critical flow behavior changed)
- `README.md` (new pages/routes/feature summary)
- `AI_AGENT_INSTRUCTIONS.md` (if conventions/env contracts changed)
- `.env.example` and `.env.production.example` (only if new env vars are required)

Create (if absent):
- `docs/LEGAL_COMPLIANCE_IMPLEMENTATION.md` (evidence mapping to feature set)
- `docs/OPERATIONS_OBSERVABILITY_RUNBOOK.md` (logger/error/health behavior)

Exit criteria:
- Docs match implementation and scripts.
- Links and commands validated.
- Plan marked complete and ready for approval.

## 4. Hard Dependency Guardrails (Must Not Violate)

1. Do not modify `apps/web/src/app/**` to consume new fields before Phase 1 migration is merged and Prisma client is regenerated.
2. Do not modify UI payload handling before repository contracts are finalized in Phase 2.
3. Do not introduce public-route logging or health behavior changes without concurrent tests (Phase 5).
4. Do not add new env vars without same-phase `.env.example` and docs updates.
5. Do not bypass tenant scoping (`company_id`) in any new repository method.

## 5. Approval Gates

1. Gate A (after Phase 1): migration/schema sign-off.
2. Gate B (after Phase 2): repository/service contract sign-off.
3. Gate C (after Phase 3): security/ops sign-off.
4. Gate D (after Phase 4): UX/product sign-off.
5. Gate E (after Phase 5-6): release readiness sign-off.
