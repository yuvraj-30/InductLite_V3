# Critical Paths

Version: `v2`
Updated: `2026-03-19`
Owner: `Architecture + Security`

This file is the canonical allowlist for `BUDGET_PROTECT` mode.
Runtime enforcement lives in `apps/web/src/lib/cost/budget-service.ts`.

## Allowed Critical Paths

- `auth.login`
- `auth.logout`
- `auth.session.refresh`
- `public.signin.create`
- `public.signout.complete`
- `compliance.export.download`

## Denied In BUDGET_PROTECT

- All non-compliance exports
- Visual regression jobs
- Bulk admin mutations
- Optional notifications (SMS/email)

## Change Control

- Changes require Security + Architecture CODEOWNERS approval.
- Every change must reference impacted controls in `docs/guardrail-control-matrix.md`.
