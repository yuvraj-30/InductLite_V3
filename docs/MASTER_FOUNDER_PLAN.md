# MASTER_FOUNDER_PLAN

Date: 2026-02-19
Scope: Whole-company audit across product/legal, engineering/security, and operations.

This plan is a product and engineering assessment, not legal advice. Treat legal items as implementation requirements to validate with NZ counsel.

## Execution Status (2026-02-21)

- Phase 1 complete: schema + migration foundation shipped for hazards, emergency data, legal versioning, signature evidence metadata, and incident/near-miss reporting.
- Phase 2 complete: repository/service wiring shipped for signature persistence, legal consent linkage, hazards, emergency data, incident reports, and export queue boundaries.
- Phase 3 complete: structured logging expanded, health/readiness hardening applied, sitemap moved behind repository boundary, and magic-link/rate-limit telemetry auditability improved.
- Phase 4 complete: public legal pages and links shipped, emergency admin/public UX shipped, hazard register UI shipped, incident register UI shipped, and live-register incident shortcuts added.
- Phase 5 complete: unit/integration/e2e/guardrail suites pass in this environment.
- Phase 6 complete: compliance + operations runbooks updated and tenant-owned model registry refreshed.

## Section 1: The Must Build Roadmap (PM/Legal)

| Feature | Why | Priority |
| --- | --- | --- |
| Hazard Register (site-level hazard log with controls, owner, status, close-out evidence) | WorkSafe-style hazard identification/control requires a durable register, not just questionnaire answers. | Critical |
| Emergency Contacts and Emergency Procedures per site | Workers need immediate emergency contacts/evacuation info at induction time. | Critical |
| Persist Digital Signature Evidence | Legally defensible acknowledgement requires durable signature payload + metadata persistence. | Critical |
| Versioned Terms + Privacy Notice with explicit consent record | Informed consent requires durable linkage to legal document version and timestamped acceptance. | Critical |
| Evidence-grade Induction Completion Record | Add immutable snapshot of template content, legal copy version, signer metadata, and consent timestamp to strengthen compliance exports. | Critical |
| Incident / Near-miss capture tied to sign-ins and sites | Required for practical H&S operations and post-incident investigations. | High |
| Offline submission queue for field use | Field teams need submission resilience in low-connectivity environments. | High |

## Section 2: The Tech Debt Cleanup (Engineering/SRE)

| File | Issue | Fix |
| --- | --- | --- |
| `apps/web/src/app/s/[slug]/components/SignInFlow.tsx` | Signature is captured client-side but only passed upstream; no persistence guarantee. | Keep signature in request payload and add checksum/size validation before storage. |
| `apps/web/src/app/s/[slug]/actions.ts` | `submitSignIn` validates signature presence but does not pass it into durable storage contract. | Extend repository input type with `signatureData` and persist through the create path. |
| `apps/web/src/lib/repository/public-signin.repository.ts` | `inductionResponse.create` writes answers only; `signature_url` remains unused. | Store encrypted signature blob/object URL and hash in `InductionResponse`. |
| `apps/web/src/app/admin/exports/actions.ts` | App-layer action performs direct transaction (`publicDb` + `scopedDb`) instead of going through repository/service boundary. | Move queue/limit transaction logic into `src/lib/repository/export.repository.ts` (or export service) and keep action orchestration-only. |
| `apps/web/src/app/sitemap.xml/route.ts` | Route uses direct Prisma client in app layer. | Move sitemap query to a repository function to align with data-access pattern guardrails. |
| `apps/web/src/app/admin/dashboard/page.tsx` | Uses `console.error` fallback logging without structured request context. | Replace with `createRequestLogger` and structured fields (`request_id`, `company_id`, action). |
| `apps/web/src/app/admin/history/page.tsx` | Uses unstructured `console.error` for partial data failures. | Standardize on structured logger and include deterministic error codes for UI fallbacks. |
| `apps/web/src/app/admin/live-register/page.tsx` | Uses unstructured `console.error` and generic failure banners. | Standardize logging + add typed failure reasons for better incident triage. |
| `apps/web/src/app/health/route.ts` | Returns raw DB error message in health payload, which can leak internals. | Return generic external error text; log detailed error server-side only. |
| `apps/web/src/app/api/ready/route.ts` | Public readiness endpoint does DB ping with no abuse control. | Restrict by network/proxy layer or add lightweight rate limiting. |
| `apps/web/src/lib/auth/magic-link.ts` | Magic-link creation/consumption has no audit log event. | Add `createAuditLog` events for issue/consume/failure outcomes. |
| `apps/web/src/lib/rate-limit/telemetry.ts` | Uses `console.warn` telemetry path. | Route telemetry through structured logger for consistent ingestion. |

## Section 3: The UX Polish List (CSM)

| Flow | Friction | Fix |
| --- | --- | --- |
| Public sign-in details (`/s/[slug]`) | Small controls (`text-sm`, `h-4 w-4`, `py-2`) are not glove/dirty-hand friendly. | Introduce a field-work UI density mode: larger targets, 44px minimum touch areas, larger type. |
| Public induction step | Required details + induction + signature can feel heavy with no progress persistence on refresh. | Add draft autosave (session/local) and resume-on-reload for same device. |
| Signature step | Checkbox and clear/confirm controls are compact; no explicit "legal text version" shown before sign-off. | Enlarge controls and show plain-language legal summary with linked full terms/privacy. |
| New admin first run (dashboard) | Dashboard shows metrics but lacks guided setup checklist (create site -> create template -> test QR). | Add onboarding checklist card with completion states and CTA links. |
| Empty states across admin | Good single-page empty states exist, but no cross-product "getting started" sequence. | Add global first-run state and contextual nudges until first successful induction. |
| Offline experience | Offline page only offers reload; no queued sign-ins for later sync. | Implement offline queue with sync status and conflict handling for kiosk/public flow. |
| Public trust signals | Homepage/public shell lacks visible legal links and data-use messaging. | Add footer links to Terms, Privacy, and support contact on all public pages. |

## Truth Snapshot

What is working well:
- Tenant-scoped repository pattern is broadly implemented.
- Mutating server actions generally enforce `assertOrigin()` and Zod validation.
- Audit log table and many admin/public mutation audit events are present.
- Error boundaries exist with user-facing retry paths.

What is currently blocking a stronger compliance and market-fit story:
- Counsel-reviewed legal copy is still recommended before production launch.
- Offline queue data is device-local; browser-at-rest encryption is not implemented.
