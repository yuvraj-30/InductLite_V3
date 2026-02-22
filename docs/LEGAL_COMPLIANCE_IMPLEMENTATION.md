# Legal Compliance Implementation

Updated: `2026-02-21`
Scope: NZ health and safety workflow evidence implemented from `docs/MASTER_FOUNDER_PLAN.md`.

## Implemented Controls

| Control Area | Implementation | Evidence Path |
| --- | --- | --- |
| Hazard register | Tenant-scoped hazard register model, repository, and admin workflow for create/list/close. | `apps/web/prisma/schema.prisma`, `apps/web/src/lib/repository/hazard.repository.ts`, `apps/web/src/app/admin/hazards/page.tsx` |
| Emergency contacts/procedures | Site-scoped emergency contacts and procedures with admin management and public display during induction. | `apps/web/prisma/schema.prisma`, `apps/web/src/lib/repository/emergency.repository.ts`, `apps/web/src/app/admin/sites/[id]/emergency/page.tsx`, `apps/web/src/app/s/[slug]/components/SignInFlow.tsx` |
| Signature evidence + immutable completion snapshot | Signature metadata plus immutable `completion_snapshot` (template questions, legal version links, consent statement, signature metadata) persisted with induction response. | `apps/web/prisma/schema.prisma`, `apps/web/src/lib/repository/public-signin.repository.ts` |
| Versioned legal consent | Legal document version model, active-version resolver, and sign-in consent linkage (`terms_version_id`, `privacy_version_id`, `consent_statement`). | `apps/web/prisma/schema.prisma`, `apps/web/src/lib/legal/consent-versioning.ts`, `apps/web/src/app/s/[slug]/actions.ts` |
| Incident / near-miss capture | Tenant-scoped incident register tied to `site_id` and optional `sign_in_record_id`, with close-out workflow and audit trail. | `apps/web/prisma/schema.prisma`, `apps/web/src/lib/repository/incident.repository.ts`, `apps/web/src/app/admin/incidents/page.tsx` |
| Terms and privacy visibility | Public legal pages and links surfaced on homepage and public shell. | `apps/web/src/app/terms/page.tsx`, `apps/web/src/app/privacy/page.tsx`, `apps/web/src/components/ui/public-shell.tsx`, `apps/web/src/app/page.tsx` |

## Auditability Notes

- Public sign-in and sign-out remain audit logged via `createAuditLog`.
- Magic-link issue/consume/failure events are audit logged in auth flows.
- Hazard and emergency mutations are audit logged with entity ids and request ids.
- Incident create/resolve mutations are audit logged with entity ids, site ids, and request ids.

## Residual Compliance Gaps

- Consent text is baseline platform text and should be reviewed by NZ counsel.
- Offline queued sign-in payloads are local-device only and not encrypted at rest in browser storage.
