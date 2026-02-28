# MASTER_FOUNDER_PLAN

Date: 2026-02-22
Scope: Whole-company audit across product/legal, engineering/security, and operations.

This is an engineering/compliance planning document, not legal advice. Validate legal interpretation with NZ counsel before launch.

## Section 1: The Must Build Roadmap (PM/Legal)

- Feature: Notifiable Event Workflow + 5-Year Retention Lock
  Why: NZ law requires keeping records of each notifiable event for at least 5 years. Current defaults (`retention_days=365`, `AUDIT_RETENTION_DAYS=90`) can purge evidence too early.
  Priority: **Critical**
  Status: Implemented (data model + workflow fields + retention enforcement) on 2026-02-22.

- Feature: Emergency Plan Drill/Test Register
  Why: NZ regulations require emergency plans to be prepared, maintained, and tested (including annual testing where no trigger event occurs). Current schema has emergency contacts/procedures but no drill history.
  Priority: **Critical**
  Status: Implemented (site-level drill register + audit events + retention semantics) on 2026-02-22.

- Feature: Regulator-Ready Incident Fields
  Why: `IncidentReport` lacks explicit WorkSafe notification metadata (`is_notifiable`, `notified_at`, `reference_number`, `notified_by`) needed for defensible compliance exports.
  Priority: **Critical**
  Status: Implemented on 2026-02-22.

- Feature: Legal Hold + Compliance Retention Classes
  Why: A single tenant retention value is too blunt for mixed legal obligations (incidents, inductions, audits). Add per-record-class retention and legal-hold override.
  Priority: **Critical**
  Status: Implemented on 2026-02-23 (company-level legal hold now hard-overrides sign-in/induction, incident, drill, and audit retention purges; class-level retention windows now cover incidents, emergency drills, induction evidence/sign-in records, and audit logs, with admin settings UI to configure retention classes in-app).

- Feature: Worker Competency/Briefing Evidence Layer
  Why: HSWA primary duty includes providing information/training/supervision. Answers JSON proves completion but not competency state, refresher status, or supervisor verification.
  Priority: **Critical**
  Status: Implemented on 2026-02-22 (induction competency state, briefing timestamp, refresher scheduling, and supervisor-verification evidence are now persisted in `InductionResponse` and immutable completion snapshots).

- Feature: Critical-Event Escalation Workflow
  Why: Red-flag/critical induction answers currently capture data but do not force escalation/approval workflow before entry.
  Priority: **Critical**
  Status: Implemented (server-side red-flag gate + queued manager alerts + stateful supervisor approve/deny workflow in admin) on 2026-02-22.

## Section 2: The Tech Debt Cleanup (Engineering/SRE)

- File: `apps/web/src/lib/env-validation.ts`
  Issue: Public rate-limit env vars are validated, but admin rate-limit guardrails (`RL_ADMIN_*`) are not validated/enforced.
  Fix: Add `RL_ADMIN_PER_USER_PER_MIN`, `RL_ADMIN_PER_IP_PER_MIN`, `RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN` validation + defaults + tests.

- File: `apps/web/src/lib/rate-limit/index.ts`
  Issue: Only public/login/contractor/CSP limiters exist; no admin mutation limiter path.
  Fix: Add admin limit helpers and wire them into admin Server Actions and admin Route Handlers.

- File: `apps/web/src/app/(auth)/verify/route.ts`
  Issue: Magic-link consume endpoint has no explicit rate limiter.
  Fix: Add token/IP scoped limiter and failure telemetry before token verification.

- File: `apps/web/src/lib/repository/export.repository.ts`
  Issue: Export queue enforces count/concurrency but not daily byte guardrails (`MAX_EXPORT_BYTES_GLOBAL_PER_DAY`, download byte caps).
  Fix: Add byte-budget accounting and deny/queue behavior with deterministic control IDs.

- File: `apps/web/src/app/api/exports/[id]/download/route.ts`
  Issue: Download path audits access but does not enforce per-company/global daily download byte limits.
  Fix: Enforce download-byte guardrails before issuing local file response/signed URL.

- File: `apps/web/src/app/health/route.ts`
  Issue: Uses raw SQL ping (`$queryRaw`) despite repository policy direction to avoid raw SQL.
  Fix: Replace with a scoped ORM readiness check utility shared with `/api/ready`.
  Status: Implemented on 2026-02-22.

- File: `apps/web/src/app/api/ready/route.ts`
  Issue: Rate limiter is process-local `Map`, so protection is inconsistent under horizontal scaling.
  Fix: Use shared limiter backend (same strategy as `lib/rate-limit`) and keep in-memory only as explicit dev fallback.
  Status: Implemented on 2026-02-22.

- File: `apps/web/src/app/(auth)/actions.ts`
  Issue: Registration flow performs multi-entity writes directly against `publicDb` in app-layer action.
  Fix: Move signup transaction into dedicated auth/service repository boundary for consistency and testability.
  Status: Implemented on 2026-02-22 (`registerCompanyWithAdmin` repository boundary now owns signup transaction).

- File: `apps/web/src/app/error.tsx`
  Issue: Client error boundary logs with `console.error`, not structured ingestion.
  Fix: Post error events to a server endpoint that logs via structured logger with request correlation.
  Status: Implemented on 2026-02-22.

- File: `apps/web/src/app/global-error.tsx`
  Issue: Root error boundary also uses `console.error`; critical client crashes may be invisible in centralized logs.
  Fix: Mirror global boundary errors to centralized structured logging.
  Status: Implemented on 2026-02-22.

## Section 3: The UX Polish List (CSM)

- Flow: Public induction stepper (`/s/[slug]`)
  Friction: Progress circles and labels are visually small for fast field use (`h-8 w-8`, `text-xs`), reducing glove/dirty-hand readability.
  Fix: Add "Field Mode" with larger stepper targets, larger labels, and stronger contrast.
  Status: Implemented on 2026-02-22.

- Flow: Public load-failure state (`/s/[slug]`)
  Friction: "Unable to Load" screen has no explicit retry action.
  Fix: Add a primary `Retry` button and offline-aware fallback messaging.
  Status: Implemented on 2026-02-22.

- Flow: Signature step (`/s/[slug]`)
  Friction: Users can store signatures locally, but risk tradeoff is not explicit for shared devices.
  Fix: Add a clear "shared device" warning and one-tap "don't save on this device" default in kiosk mode.
  Status: Implemented on 2026-02-22.

- Flow: First-run admin onboarding
  Friction: Dashboard checklist exists, but setup guidance is not persistent across all empty-state pages.
  Fix: Add global onboarding state + contextual next-step prompts on Sites/Templates/Live Register until first successful induction.
  Status: Implemented on 2026-02-22.

- Flow: Contractor magic-link failure path
  Friction: Invalid/expired link redirects to status page without guided recovery CTA.
  Fix: Add explicit "Request new link" CTA and timer/explanation to reduce support load.
  Status: Implemented on 2026-02-22.

- Flow: Public emergency information presentation
  Friction: Emergency contacts/procedures render as dense text blocks on smaller screens.
  Fix: Add tap-first cards with quick-call action and clearer hierarchy for urgent scenarios.
  Status: Implemented on 2026-02-22.
