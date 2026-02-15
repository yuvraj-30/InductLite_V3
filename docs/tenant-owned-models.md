# Tenant Owned Models

Version: `v1`
Updated: `2026-02-15`
Source: `apps/web/prisma/schema.prisma`

This file is the canonical `TENANT_OWNED_MODELS` registry.
It must be auto-generated from Prisma schema in CI.
Manual edits are not allowed.

## Models With `company_id`

- `User`
- `Site`
- `InductionTemplate`
- `SignInRecord`
- `EmailNotification`
- `Contractor`
- `SiteManagerAssignment`
- `MagicLinkToken`
- `ExportJob`
- `AuditLog`

## Child Models Without `company_id` (Parent-Scoped Only)

- `SitePublicLink` (scoped by `site_id -> Site.company_id`)
- `InductionQuestion` (scoped by `template_id -> InductionTemplate.company_id`)
- `InductionResponse` (scoped by `sign_in_record_id -> SignInRecord.company_id`)
- `ContractorDocument` (scoped by `contractor_id -> Contractor.company_id`)

## Enforcement Notes

- Direct Prisma access to these models outside approved scoped DB modules must fail CI.
- Any model list change must include schema diff + updated tests.
