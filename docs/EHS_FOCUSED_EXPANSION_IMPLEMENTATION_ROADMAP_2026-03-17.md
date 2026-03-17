# EHS_FOCUSED_EXPANSION_IMPLEMENTATION_ROADMAP_2026-03-17

Date: 2026-03-17

Related docs:

- [COMPETITOR_MASTER_AUDIT_2026.md](./COMPETITOR_MASTER_AUDIT_2026.md)
- [COMPETITIVE_PRODUCT_EXECUTION_ROADMAP_2026-03-16.md](./COMPETITIVE_PRODUCT_EXECUTION_ROADMAP_2026-03-16.md)

## Goal

Close the highest-value EHS-adjacent product gaps without turning InductLite into a generic suite. The focus stays on the core clearance loop:

1. identify the worker
2. clear the worker for site
3. keep live operational state visible
4. prove what happened later

## Scope Decision

The recommended expansion path is:

- add follow-up control with one shared action register
- add scheduled inspections on top of the existing safety-forms engine
- add competency and certification rules directly into clearance
- add lightweight resource and equipment readiness controls

The roadmap explicitly avoids broad suite sprawl such as full occupational health, environmental reporting, or SDS management at this stage.

## Phases

| Phase | Outcome | Primary files | Status |
| --- | --- | --- | --- |
| 1 | Unified action register | [schema.prisma](../apps/web/prisma/schema.prisma), [action.repository.ts](../apps/web/src/lib/repository/action.repository.ts), [page.tsx](../apps/web/src/app/admin/actions/page.tsx), [incidents](../apps/web/src/app/admin/incidents), [hazards](../apps/web/src/app/admin/hazards) | Implemented |
| 2 | Inspections engine | [inspection.repository.ts](../apps/web/src/lib/repository/inspection.repository.ts), [page.tsx](../apps/web/src/app/admin/inspections/page.tsx), [actions.ts](../apps/web/src/app/admin/inspections/actions.ts), [safety-form.repository.ts](../apps/web/src/lib/repository/safety-form.repository.ts) | Implemented |
| 3 | Competency and certification matrix | [competency.repository.ts](../apps/web/src/lib/repository/competency.repository.ts), [page.tsx](../apps/web/src/app/admin/competency/page.tsx), [actions.ts](../apps/web/src/app/s/%5Bslug%5D/actions.ts), [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx), [SuccessScreen.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SuccessScreen.tsx) | Implemented |
| 4 | Resource and equipment readiness lite | [resource-booking.repository.ts](../apps/web/src/lib/repository/resource-booking.repository.ts), [page.tsx](../apps/web/src/app/admin/resources/page.tsx), [actions.ts](../apps/web/src/app/admin/resources/actions.ts) | Implemented |

## Phase 1

### Outcome

One shared follow-up system for incidents, hazards, permits, inspections, emergency work, competency gaps, and manual compliance tasks.

### Implemented changes

- Added `ActionRegisterEntry` and `ActionComment` models in [schema.prisma](../apps/web/prisma/schema.prisma)
- Added repository helpers in [action.repository.ts](../apps/web/src/lib/repository/action.repository.ts)
- Added the action register screen in [page.tsx](../apps/web/src/app/admin/actions/page.tsx)
- Added follow-up action creation into [incidents/actions.ts](../apps/web/src/app/admin/incidents/actions.ts) and [hazards/actions.ts](../apps/web/src/app/admin/hazards/actions.ts)
- Added dashboard and navigation visibility in [dashboard/page.tsx](../apps/web/src/app/admin/dashboard/page.tsx) and [layout.tsx](../apps/web/src/app/admin/layout.tsx)

### Why it matters

This closes the loop. Incidents and hazards now produce trackable work instead of isolated records.

## Phase 2

### Outcome

Recurring inspections now exist as a first-class operational workflow rather than an implied use of generic forms.

### Implemented changes

- Added `InspectionSchedule` and `InspectionRun` in [schema.prisma](../apps/web/prisma/schema.prisma)
- Added scheduling and run recording in [inspection.repository.ts](../apps/web/src/lib/repository/inspection.repository.ts)
- Added admin workflows in [page.tsx](../apps/web/src/app/admin/inspections/page.tsx) and [actions.ts](../apps/web/src/app/admin/inspections/actions.ts)
- Reused [safety-form.repository.ts](../apps/web/src/lib/repository/safety-form.repository.ts) for submission capture
- Wired failed inspection findings into follow-up actions automatically

### Why it matters

This is the cleanest path from flexible forms to a recognizable safety-operations module.

## Phase 3

### Outcome

Worker clearance can now consider site and role requirements, existing certifications, and expiring evidence instead of relying only on self-declaration.

### Implemented changes

- Added `CompetencyRequirement`, `WorkerCertification`, and `CompetencyDecision` in [schema.prisma](../apps/web/prisma/schema.prisma)
- Added requirement, certification, and evaluation logic in [competency.repository.ts](../apps/web/src/lib/repository/competency.repository.ts)
- Added the admin competency matrix in [page.tsx](../apps/web/src/app/admin/competency/page.tsx)
- Integrated competency evaluation into public sign-in in [actions.ts](../apps/web/src/app/s/%5Bslug%5D/actions.ts)
- Surfaced the clearance outcome in [SuccessScreen.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SuccessScreen.tsx)
- Added cross-linking from [risk-passport/page.tsx](../apps/web/src/app/admin/risk-passport/page.tsx)

### Why it matters

This strengthens the repeat-worker moat and makes clearance decisions explainable.

## Phase 4

### Outcome

Bookable resources and equipment now have readiness state, due dates, and inspection outcomes that can actively block unsafe bookings.

### Implemented changes

- Extended `BookableResource` and added `ResourceInspectionRecord` in [schema.prisma](../apps/web/prisma/schema.prisma)
- Added readiness and inspection support in [resource-booking.repository.ts](../apps/web/src/lib/repository/resource-booking.repository.ts)
- Added admin controls in [page.tsx](../apps/web/src/app/admin/resources/page.tsx) and [actions.ts](../apps/web/src/app/admin/resources/actions.ts)
- Blocked bookings automatically when inspection or service compliance is overdue

### Why it matters

This gives plant-heavy sites practical compliance protection without pulling the product into full CMMS scope.

## Out Of Scope For Now

- environmental management
- chemical and SDS register
- occupational health and return-to-work
- full legal obligations register

## Delivery Notes

- Cost impact: limited to application and database complexity already within the current product footprint
- Security impact: tenant scoping was extended through [scoped-db.ts](../apps/web/src/lib/db/scoped-db.ts) and [tenant-owned-models.md](./tenant-owned-models.md); no raw SQL was added to the app layer
- Guardrails affected: new tenant-owned models and one new Prisma migration
- Cheaper fallback: stop after phases 1 to 3 and defer resource readiness if customer demand stays low
