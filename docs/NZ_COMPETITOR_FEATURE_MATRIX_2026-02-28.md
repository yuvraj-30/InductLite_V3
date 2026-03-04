# NZ Competitor Feature Matrix (as of 2026-02-28)

## Scope and method
- Goal: identify NZ-market apps similar to InductLite (site sign-in, inductions, contractor/safety workflows), extract feature signals from web sources, then compare against this repo.
- Inclusion rule: app has NZ-specific product page, `.nz` domain presence, or NZ marketplace listing.
- Source preference: official product/help pages first; marketplace listing only when needed for NZ availability context.
- Note: this is high-coverage for major discoverable products, but not guaranteed to be every app in NZ.
- Detailed evidence notes per competitor: [NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md](NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md)
- Implementation plan for all partial/missing gaps: [NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md](NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md)

## NZ-like apps found (web scan)

| App | NZ availability evidence | Feature signals observed | Sources |
| --- | --- | --- | --- |
| 1Breadcrumb (formerly SignOnSite) | NZ-specific page | Site attendance, digital inductions, real-time onboarding, emergency/site alerts, worker access controls | [1Breadcrumb NZ](https://1breadcrumb.com/nz/induct-lite), [Site attendance](https://1breadcrumb.com/field/safety/site-attendance), [Inductions guide](https://support.1breadcrumb.com/docs/a-guide-to-inductions) |
| Site App Pro | NZ page | QR code sign-in, geolocation capture, offline support, custom fields, document/training checks, man-hour tracking | [Site App Pro NZ](https://www.siteapppro.com/nz/), [QR code sign-in feature](https://www.siteapppro.com/features/qr-code-sign-in), [Template builder answer types](https://help.siteapppro.com/en/articles/8943949-using-select-resources-in-template-builder) |
| HazardCo | NZ page | Smart forms, onboarding/inductions, scan in/out, site docs, hazard and incident tracking | [HazardCo NZ feature](https://www.hazardco.com/nz/features/hazard-register) |
| ThinkSafe | `.nz` domain | Online inductions, QR sign-in with geolocation, visitor management, compliance docs, incidents, emergency plans | [ThinkSafe online inductions](https://www.thinksafe.nz/features/online-inductions/), [ThinkSafe site management](https://www.thinksafe.nz/features/site-management/) |
| SiteMate | NZ page | Digital orientation forms, signatures, photos/videos, automated reminder flows, multi-language options | [SiteMate NZ online induction software](https://sitemate.com/nz/software/online-induction-software) |
| SaferMe | NZ marketplace listing + product docs | QR site inductions, certification uploads, expiry reminders, configurable forms/workflows | [SaferMe training help](https://saferme.com/help/training), [SaferMe in NZ marketplace](https://www.capterra.com.au/software/110251/saferme) |
| VisTab | AU/NZ positioning on site | Conditional entry from questionnaires, QR scanner + badge flow, emergency evacuation tooling, induction signatures + expiry tracking | [VisTab health and safety](https://www.vistab.com/health-and-safety) |
| Tickbox Tool | NZ/Australia positioning | QR sign-in, digital inductions/forms, emergency alerts + mustering, contractor management | [Tickbox Tool](https://www.tickboxtool.com/) |
| SwipedOn | NZ-specific docs/pricing context | Pre-arrival inductions, screening logic, badge printing, contractor workflows, NZ SMS support | [SwipedOn inductions](https://www.swipedon.com/what-s-new/introducing-inductions), [Screening questions](https://www.swipedon.com/feature/screening-questions), [Contractor management](https://www.swipedon.com/feature/contractor-management), [SMS in NZ](https://www.swipedon.com/blog/new-text-message-add-on) |
| HammerTech | NZ marketplace listing | Online induction builder, pass-rate controls, retries, expiry rules, mobile-first completion | [HammerTech online inductions](https://www.hammertech.com/product/online-inductions), [HammerTech in NZ marketplace](https://www.capterra.com.au/software/150669/hammertech) |

## Consolidated market feature set

Most commonly recurring capabilities across the list above:

1. QR/public-link sign-in and attendance tracking.
2. Configurable digital induction forms/questions.
3. E-signature capture.
4. Conditional entry / safety gating.
5. Quiz-style pass/fail controls (correct answers, pass mark, retries).
6. Media-rich induction content (PDF/video/docs/slides).
7. Credential/document lifecycle (upload + expiry/reminders).
8. Emergency workflows (evacuation/muster/alerts).
9. Offline operation.
10. Geolocation/geofencing signals.
11. Badge printing and kiosk flows.
12. Integrations/webhooks/reporting exports.

## InductLite comparison (repo-based)

| Feature | InductLite status | Evidence in repo | Notes |
| --- | --- | --- | --- |
| QR/public-link sign-in + sign-out | Complete | [SitePublicLink schema](../apps/web/prisma/schema.prisma), [public sign-in page](../apps/web/src/app/s/[slug]/page.tsx), [site QR management](../apps/web/src/app/admin/sites/[id]/page.tsx), [sign-out action](../apps/web/src/app/s/[slug]/actions.ts) | Core flow is present and production-shaped. |
| Configurable induction questions/templates | Complete | [question builder UI](../apps/web/src/app/admin/templates/[id]/question-builder.tsx), [template actions](../apps/web/src/app/admin/templates/actions.ts), [question types rendering](../apps/web/src/app/s/[slug]/components/InductionQuestions.tsx) | Supports TEXT, MULTIPLE_CHOICE, CHECKBOX, YES_NO, ACKNOWLEDGMENT. |
| E-signature capture + stored evidence | Complete | [signature UI](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [signature validation + persistence](../apps/web/src/lib/repository/public-signin.repository.ts), [signature fields schema](../apps/web/prisma/schema.prisma) | Includes hash/meta capture and encryption path. |
| Red-flag safety gating + supervisor escalation | Complete | [red-flag evaluation + escalation](../apps/web/src/app/s/[slug]/actions.ts), [escalation model](../apps/web/prisma/schema.prisma), [admin escalation decisions](../apps/web/src/app/admin/escalations/actions.ts) | Entry can be blocked pending supervisor review. |
| Contractor document upload/download controls | Complete | [presign route](../apps/web/src/app/api/storage/contractor-documents/presign/route.ts), [commit route](../apps/web/src/app/api/storage/contractor-documents/commit/route.ts), [download route](../apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts) | Includes MIME/magic-bytes validation and tenant key checks. |
| Emergency info and emergency admin tools | Complete | [public emergency display](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [emergency admin page](../apps/web/src/app/admin/sites/[id]/emergency/page.tsx), [emergency models](../apps/web/prisma/schema.prisma) | Contacts/procedures/drills exist. |
| Offline sign-in queue/sync | Complete | [offline queue usage](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [queue helpers](../apps/web/src/lib/offline/signin-queue.ts), [sync helper](../apps/web/src/lib/offline/signin-sync.ts) | Local queue then sync when online. |
| Export/reporting (CSV/PDF/ZIP) | Complete | [export types schema](../apps/web/prisma/schema.prisma), [admin export UI](../apps/web/src/app/admin/exports/ExportQueuePanel.tsx), [export worker](../apps/web/src/lib/export/worker.ts) | Includes queued exports and download path. |
| Quiz scoring engine (pass mark, retries, overall score) | Complete | [quiz scoring evaluator](../apps/web/src/lib/quiz/scoring.ts), [policy enforcement in public sign-in](../apps/web/src/app/s/[slug]/actions.ts), [attempt-state persistence](../apps/web/src/lib/repository/induction-quiz-attempt.repository.ts), [analytics aggregation](../apps/web/src/lib/repository/dashboard.repository.ts) | Pass thresholds, retries, cooldown, blocking behavior, and reporting are delivered. |
| Evacuation roll call operations | Complete | [emergency site event lifecycle](../apps/web/src/app/admin/sites/[id]/emergency/actions.ts), [roll-call snapshot management](../apps/web/src/lib/repository/emergency.repository.ts), [CSV export path](../apps/web/src/app/admin/sites/[id]/emergency/page.tsx) | Event start/close lifecycle with accounted/missing transitions and export evidence is delivered. |
| Integrations/webhooks/SSO | Complete baseline | [webhook delivery queue model](../apps/web/prisma/schema.prisma), [webhook worker retries/dead-letter](../apps/web/src/lib/webhook/worker.ts), [endpoint management UI](../apps/web/src/app/admin/webhooks/page.tsx), [SSO start route](../apps/web/src/app/api/auth/sso/start/route.ts), [SSO callback route](../apps/web/src/app/api/auth/sso/callback/route.ts), [directory sync API](../apps/web/src/app/api/auth/directory-sync/route.ts), [SSO settings UI](../apps/web/src/app/admin/settings/sso-settings-panel.tsx) | Secure outbound webhooks plus tenant-scoped OIDC/Entra SSO and directory-sync token workflows are delivered. |
| Certification/expiry reminder automation | Complete baseline | [reminder dispatch logic](../apps/web/src/lib/email/worker.ts), [maintenance scheduler](../apps/web/src/lib/maintenance/scheduler.ts), [document expiry reporting](../apps/web/src/lib/repository/dashboard.repository.ts) | Automated 30/14/7/1 reminder windows with dedupe and dashboard/reporting visibility are delivered. |
| PDF/video/doc learning step inside induction flow | Complete | [media-config parser](../apps/web/src/lib/template/media-config.ts), [public media-first flow](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [server-side media acknowledgement enforcement](../apps/web/src/app/s/[slug]/actions.ts) | Dedicated content-consumption stage with required acknowledgement and evidence capture is delivered. |
| Geolocation / geofencing at sign-in | Complete baseline + add-on depth | [location capture in public flow](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [site location configuration](../apps/web/src/app/admin/sites/[id]/edit-site-form.tsx), [geofence policy enforcement](../apps/web/src/app/s/[slug]/actions.ts) | Standard audit-mode verification is delivered; strict geofence deny/override is delivered as entitlement/policy-gated add-on. |
| Badge printing | Complete | [success screen print controls](../apps/web/src/app/s/[slug]/components/SuccessScreen.tsx), [badge print action + audit](../apps/web/src/app/s/[slug]/actions.ts), [bulk QR print profiles](../apps/web/src/app/admin/sites/[id]/page.tsx) | Visitor badge print pipeline is delivered with profile support and audit evidence. |
| Hardware gate/turnstile access integration | Complete add-on foundation | [hardware adapter](../apps/web/src/lib/hardware/adapter.ts), [access-control config parsing](../apps/web/src/lib/access-control/config.ts), [webhook worker hardware headers](../apps/web/src/lib/webhook/worker.ts) | Hardware decision adapter layer is delivered behind entitlement/policy controls. |
| SMS workflow for inductions/alerts | Complete add-on foundation | [sms wrapper with quotas](../apps/web/src/lib/sms/wrapper.ts), [env validation gates](../apps/web/src/lib/env-validation.ts), [public flow dispatch integration](../apps/web/src/app/s/[slug]/actions.ts) | SMS workflow foundation is delivered with quotas and policy default-off controls. |

## Implementation buckets (direct answer)

### Completely implemented
1. QR/public-link sign-in and sign-out.
2. Configurable induction templates/questions.
3. E-signature capture and storage.
4. Red-flag escalation with supervisor approval/denial.
5. Contractor document upload/download guardrails.
6. Emergency contact/procedure/drill management.
7. Offline sign-in queue and sync.
8. Export/reporting pipeline (CSV/PDF/ZIP).
9. Quiz scoring engine (threshold/retries/cooldown).
10. Roll-call event lifecycle with attendance exports.
11. Secure webhook delivery pipeline with logs/retries.
12. Expiry reminder automation windows and dedupe.
13. Media-first induction content stage.
14. Location verification baseline and strict geofence add-on.
15. Badge printing workflow.
16. Hardware adapter and SMS wrapper add-on foundations.

### Partially implemented
1. None.

### Not implemented
1. None for baseline parity scope in this matrix.
