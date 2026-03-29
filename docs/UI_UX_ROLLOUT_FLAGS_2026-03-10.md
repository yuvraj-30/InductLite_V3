# UI/UX Rollout Flags

Date: 2026-03-10

This document defines rollout and kill-switch controls for the UI/UX trend execution backlog.

## Progressive rollout plan

1. Stage 0: internal pilot tenants (5-10 tenants).
2. Stage 1: 25% tenant rollout.
3. Stage 2: 50% tenant rollout.
4. Stage 3: 100% tenant rollout.

Each stage requires a 24-hour hold with passing quality, guardrail, and KPI checks before promotion.

## Flags and defaults

All flags default to `false` (fail-safe).

1. `UIX_S1_VISUAL`: visual system hardening (token migration, surface consistency).
2. `UIX_S2_FLOW`: core flow friction reduction (auth flow and state handling).
3. `UIX_S3_MOBILE`: mobile admin redesign.
4. `UIX_S4_AI`: AI-native workflow UX overlays.
5. `UIX_S5_A11Y`: accessibility and performance hardening rollout.

Environment contract:

- `.env.example` contains all five flags with default `false`.
- `apps/web/src/lib/feature-flags.ts` resolves runtime booleans.
- `apps/web/src/lib/env-validation.ts` validates flag presence/format as optional controls.

## Kill-switch behavior

If a rollout causes regression, disable the corresponding flag and redeploy.

1. `UIX_S1_VISUAL=false`: revert to pre-rollout visual behavior.
2. `UIX_S2_FLOW=false`: disable new flow UX behavior.
3. `UIX_S3_MOBILE=false`: disable the default-on mobile admin redesign behavior.
4. `UIX_S4_AI=false`: disable AI-native inline UX overlays.
5. `UIX_S5_A11Y=false`: disable final a11y/perf rollout toggles.

## Current usage map

1. `UIX_S2_FLOW` currently gates login intent split on `/login`:
   - When enabled, users choose `Password` or `SSO` before forms render.
   - When disabled, legacy combined password + SSO layout is shown.
2. `UIX_S2_FLOW` also gates shared state UI patterns on admin routes:
   - Shared empty/warning/loading primitives on top traffic pages (`/admin/sites`, `/admin/templates`, `/admin/users`, `/admin/live-register`, `/admin/history`, `/admin/exports`, `/admin/audit-log`, `/admin/contractors`, `/admin/pre-registrations`, `/admin/hazards`, `/admin/incidents`).
   - `admin/loading.tsx` and `admin/error.tsx` provide deterministic loading/error states.
3. `UIX_S2_FLOW` gates admin information-architecture compression:
   - Flag-on: visible sidebar labels are reduced to <= 22 through progressive disclosure.
   - Flag-off: legacy full sidebar remains available.
   - Deep routes remain accessible through command palette (`Cmd/Ctrl+K`) in both modes.
4. `UIX_S3_MOBILE` gates the live-default mobile-first admin navigation shell behavior:
   - Default/flag-on: mobile nav shows current route context plus quick-switch tasks for top workflows.
   - Default/flag-on: nav search and section controls follow mobile-first focus order (context, quick-switch, search, then section links).
   - Default/flag-on: `/admin/sites` and `/admin/live-register` render mobile-first card workflows with tap-safe actions and compact status density.
   - Flag-off: fall back to the legacy nav-first mobile shell during rollback.
5. `UIX_S4_AI` currently gates in-context copilot guidance on operations pages:
   - Flag-on: advisory Safety Copilot panels render on `/admin/hazards`, `/admin/incidents`, and `/admin/permits`.
   - Flag-on: suggestions are draft-only and require explicit user action in existing workflows.
   - Flag-off: these inline AI guidance panels are hidden.
6. `UIX_S5_A11Y` gates accessibility hardening class injection at root layout:
   - Flag-on: `uix-s5-a11y` focus treatment is enabled for stronger visible focus indicators.
   - Flag-off: baseline token focus behavior remains active.

## Rollback verification commands

1. `npm run parity-gate`
2. `npm run guardrails-lint && npm run guardrails-tests && npm run policy-check`
3. `npm run -w apps/web test:e2e:smoke`
4. `npm run -w apps/web test:e2e:perf-budget`
5. `npm run report:ux-perf-budget`

## Owners

1. Engineering owner: Web Platform lead.
2. Product owner: Product design lead.
3. Security reviewer: Security owner (tenant + CSRF invariants).

## S0 telemetry hooks

Baseline instrumentation introduced in S0:

1. `POST /api/ux-events` records:
   - `ux.admin.nav_search`
   - `ux.induction.step_transition`
2. Baseline export script:
   - `npm run -w apps/web report:ux-baseline -- --days=30 --out=docs/ux-baseline.csv`

The telemetry payload is intentionally bounded and excludes secrets/PII.
