# Critical Paths

Version: `v1`
Updated: `2026-02-15`
Owner: `Architecture + Security`

This file is the canonical allowlist for `BUDGET_PROTECT` mode.

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
