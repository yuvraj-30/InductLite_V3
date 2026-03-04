# NZ Competitor Evidence Notes (as of 2026-02-28)

## Purpose
- Provide evidence-backed notes for similar NZ-relevant site sign-in/induction apps.
- Show what capabilities competitors publicly advertise.
- Map those capabilities against InductLite to identify where we are complete, partial, or missing.
- Implementation roadmap for all partial/missing capabilities: [NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md](NZ_GAP_IMPLEMENTATION_PLAN_2026-02-28.md)

## Competitor Evidence Ledger

| App | Evidence-backed capability notes | Sources |
| --- | --- | --- |
| 1Breadcrumb (SignOnSite heritage) | Promotes site attendance + digital inductions + emergency/site alerts + access controls/permits. | https://1breadcrumb.com/nz/induct-lite, https://1breadcrumb.com/field/safety/site-attendance |
| Site App Pro | QR sign-in check-in; captures geolocation for attendance; offline operation with sync; custom fields/forms. | https://www.siteapppro.com/features/qr-code-sign-in, https://www.siteapppro.com/features/qr-code-sign-in-software, https://www.siteapppro.com/nz/ |
| ThinkSafe (NZ) | Online inductions + visitor management + geolocation + offline functionality on site. | https://www.thinksafe.nz/features/online-inductions/, https://www.thinksafe.nz/features/site-management/ |
| SwipedOn | Custom screening/induction questions, contractor document workflows, badge/label printing, SMS add-on. | https://www.swipedon.com/feature/screening-questions, https://www.swipedon.com/feature/contractor-management, https://www.swipedon.com/blog/new-text-message-add-on |
| SiteMate | Induction forms can include videos/images and attached PDF files; supports multi-language experience. | https://sitemate.com/nz/software/online-induction-software |
| SaferMe | QR check-ins, training/certification upload, expiry reminders, configurable forms/workflows. | https://saferme.com/help/training |
| VisTab | Questionnaire-based deny-entry logic, QR scanning + QR badges, visitor label printing, evacuation workflows. | https://www.vistab.com/health-and-safety |
| HammerTech | Online induction pass-rate controls, retake attempts/retries, mobile-first flow, multi-language options. | https://www.hammertech.com/product/online-inductions |
| Induct For Work | Upload videos/images/docs, enforce pass rates, allow auto/manual retakes, track induction expiry. | https://www.inductforwork.com/features/online-inductions |
| SiteConnect | eLearning/induction system with LMS integrations and contractor prequalification workflows. | https://siteconnect.com.au/ |
| Site Gateway | Sign-in + contractor/safety onboarding tied to gate/turnstile and geofence-oriented controls. | https://sitegateway.com.au/ |

## Capability Gap Notes vs InductLite

| Capability seen in competitor set | Competitor evidence examples | InductLite status | InductLite evidence | Gap note |
| --- | --- | --- | --- | --- |
| QR/public-link sign-in | Site App Pro, 1Breadcrumb, ThinkSafe | Complete | [SitePublicLink model](../apps/web/prisma/schema.prisma), [public sign-in route](../apps/web/src/app/s/[slug]/page.tsx), [QR management UI](../apps/web/src/app/admin/sites/[id]/page.tsx) | Already strong. |
| Digital induction question builder | 1Breadcrumb, HammerTech, SiteMate | Complete | [Question builder](../apps/web/src/app/admin/templates/[id]/question-builder.tsx), [question render flow](../apps/web/src/app/s/[slug]/components/InductionQuestions.tsx) | Already strong. |
| Signature capture | SiteMate, HammerTech, VisTab | Complete | [Signature step](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [signature persistence](../apps/web/src/lib/repository/public-signin.repository.ts) | Already strong. |
| Safety deny-entry gating | VisTab, SwipedOn (screening logic), HammerTech | Complete (for red-flag path) | [red-flag block and escalation](../apps/web/src/app/s/[slug]/actions.ts), [escalation model](../apps/web/prisma/schema.prisma) | Implemented via escalation approvals. |
| Full quiz scoring (pass mark + retries/retests) | HammerTech, Induct For Work | Complete for baseline scope | [quiz scoring utility](../apps/web/src/lib/quiz/scoring.ts), [quiz policy enforcement](../apps/web/src/app/s/[slug]/actions.ts), [attempt persistence](../apps/web/src/lib/repository/induction-quiz-attempt.repository.ts) | Pass thresholds, retry limits, cooldown, and fail-block behavior are implemented. |
| Media-first induction content (PDF/video/docs before questions) | SiteMate, Induct For Work | Complete for baseline scope | [media config parser](../apps/web/src/lib/template/media-config.ts), [public media-first flow](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [server-side acknowledgement enforcement](../apps/web/src/app/s/[slug]/actions.ts) | Dedicated content-consumption stage and evidence capture are implemented. |
| Geolocation/geofencing at check-in | Site App Pro, ThinkSafe, Site Gateway | Complete baseline + add-on depth | [location capture client flow](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [site location settings](../apps/web/src/app/admin/sites/[id]/edit-site-form.tsx), [geofence access-control config](../apps/web/src/lib/access-control/config.ts) | Standard audit-mode verification is implemented; strict deny/override geofence is implemented as policy-gated add-on. |
| Badge/label printing for visitors | SwipedOn, VisTab | Complete for baseline scope | [public success print controls](../apps/web/src/app/s/[slug]/components/SuccessScreen.tsx), [badge print audit action](../apps/web/src/app/s/[slug]/actions.ts), [bulk print profile controls](../apps/web/src/app/admin/sites/[id]/page.tsx) | Visitor badge/label workflow is implemented with audit evidence. |
| Hardware access-control integrations (gates/turnstiles) | Site Gateway | Complete add-on foundation | [hardware adapter](../apps/web/src/lib/hardware/adapter.ts), [site access-control config](../apps/web/src/lib/access-control/config.ts), [hardware delivery worker support](../apps/web/src/lib/webhook/worker.ts) | Adapter/workflow layer is implemented behind entitlement/policy controls. |
| SMS notifications in core workflow | SwipedOn (SMS add-on) | Complete add-on foundation (default-off) | [sms wrapper + quotas](../apps/web/src/lib/sms/wrapper.ts), [env validation guards](../apps/web/src/lib/env-validation.ts), [public sign-in dispatch hook](../apps/web/src/app/s/[slug]/actions.ts) | Policy default remains `SMS_ENABLED=false`, but production-safe wrapper and quota enforcement are implemented. |
| Offline sign-in capability | Site App Pro, ThinkSafe | Complete | [offline queue/sync flow](../apps/web/src/app/s/[slug]/components/SignInFlow.tsx), [offline helpers](../apps/web/src/lib/offline/signin-queue.ts) | Competitive parity achieved here. |
| Contractor docs + expiry handling | SaferMe, SwipedOn | Complete for baseline scope | [contractor document APIs](../apps/web/src/app/api/storage/contractor-documents/commit/route.ts), [automated reminder dispatch](../apps/web/src/lib/email/worker.ts), [dashboard expiry analytics](../apps/web/src/lib/repository/dashboard.repository.ts) | Document handling plus 30/14/7/1 reminder automation with dedupe is implemented. |
| Evacuation roll call | VisTab, Tickbox Tool | Complete for baseline scope | [site emergency actions](../apps/web/src/app/admin/sites/[id]/emergency/actions.ts), [emergency repository lifecycle logic](../apps/web/src/lib/repository/emergency.repository.ts), [emergency page exports](../apps/web/src/app/admin/sites/[id]/emergency/page.tsx) | Event lifecycle with accounted/missing state and CSV evidence is implemented. |
| LMS/eLearning integration | SiteConnect | Complete for baseline scope | [lms config parser](../apps/web/src/lib/lms/config.ts), [provider payload mappings](../apps/web/src/lib/lms/payload.ts), [sign-in dispatch integration](../apps/web/src/app/s/[slug]/actions.ts) | One-way LMS completion sync baseline is implemented with provider mapping support. |

## Direct "What Others Offer That We Lack"

High-confidence remaining depth gap:

1. None for current baseline parity scope.

## Recommended use of this doc

Use this file as evidence in product planning and client discovery:

1. Validate each gap against your target segment (SMB vs enterprise sites).
2. Prioritize gaps that are both high client value and guardrail-compatible.
3. Keep the evidence links current before roadmap or pricing decisions.
