# Safety Forms Suite (SWMS/JSA/RAMS/Toolbox/Fatigue)

## Overview

InductLite now includes a construction safety form suite in admin:

- `SWMS`
- `JSA`
- `RAMS`
- `TOOLBOX_TALK`
- `FATIGUE_DECLARATION`

Admin route:

- `/admin/safety-forms`

## What is implemented

1. Default template installer (global or site-scoped).
2. Custom safety template creation with JSON field schema.
3. Submission capture with reviewer workflow (`SUBMITTED`, `REVIEWED`, `REJECTED`).
4. Tenant-scoped repository layer + audit events.

## Data model

- `SafetyFormTemplate`
- `SafetyFormSubmission`
- Enums:
  - `SafetyFormType`
  - `SafetyFormSubmissionStatus`

Migration:

- `apps/web/prisma/migrations/20260308231500_add_safety_forms_and_connector_providers/migration.sql`

## Audit actions

- `safety_form.template.install_defaults`
- `safety_form.template.create`
- `safety_form.template.deactivate`
- `safety_form.submission.create`
- `safety_form.submission.review`

## Notes

- Tenant isolation is enforced via `scopedDb(companyId)`.
- Mutating actions enforce origin checks with `assertOrigin()`.
- No raw SQL is used in runtime code paths.
