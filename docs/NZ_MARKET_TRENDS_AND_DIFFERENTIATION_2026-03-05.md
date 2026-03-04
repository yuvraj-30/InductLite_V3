# NZ Market Trends and Differentiation Opportunities (as of 2026-03-05)

## Scope
- Market focus: New Zealand-relevant visitor management, induction, and construction safety software.
- Goal:
1. Identify current trends with clear demand signals that are not fully implemented in this repo.
2. Identify differentiation features with low visible coverage in competitor public material.

## Part A: NZ market trends with demand signals that are not fully implemented

| Trend in market | Evidence from market sources | Demand signal | Current repo status | Gap verdict |
| --- | --- | --- | --- | --- |
| Digital Permit-to-Work / Control-of-Work (hot work, confined space, excavation, hold points, staged approvals) | ThinkSafe lists construction permit forms as ready-to-use. 1Breadcrumb permit docs and release notes show active permit workflows and lifecycle reporting. EcoOnline positions ePermits as Control-of-Work with active enforcement and competency checks. | 1Breadcrumb explicitly says permits were launched in response to customer feedback. | Not implemented as a dedicated permit workflow module (`permit-to-work/control-of-work` keyword scan returned no matches in `apps/web/src` and `apps/web/prisma`). | Not implemented |
| Identity-hardening at check-in (ID scanning, watchlists, random checks, stricter approvals) | Capterra lists ID scanning and watch list among commonly valued visitor management features. Sine markets Face Check, ID scanning, and watchlists. SwipedOn released randomized checks for approvals. | Capterra user-priority data + SwipedOn security update cadence indicate active buyer demand. | Not implemented as dedicated product features (`id scan/watchlist/random check/visitor approval` keyword scan returned no matches). | Not implemented |
| Native mobile-first sign-in with geofence auto check-in/out and push | Sine supports auto check-in and enforced auto check-out via geofence. SwipedOn markets geofence sign-in/sign-out verification and Pocket notifications. Site App Pro pricing page pushes App Store/Play Store mobile apps. | Capterra reports mobile access issues as a frequent limitation, which reinforces demand for strong mobile UX. | Geofence verification exists in web flow, but there is no native iOS/Android app stack and no explicit auto check-out + push workflow (`react-native/capacitor` keyword scan returned no matches). | Partially implemented |
| Emergency communication maturity (mass emergency messaging + app-delivered evacuation comms) | SwipedOn future page says stronger evacuation capability is one of their most requested improvements. Sine markets emergency messaging and digital roll call. | Direct "most requested improvements" language from SwipedOn + emergency messaging as standard on Sine. | Roll-call lifecycle is implemented; broad emergency broadcast/read-receipt style messaging is not clearly implemented as a standalone capability. | Partially implemented |
| Collaboration-channel notifications and approvals (Teams/Slack + approval loop) | SwipedOn markets Slack and Teams integrations; Teams supports approvals and host notifications. SwipedOn changelog called Teams integration one of the most requested features. | Direct "most requested" signal from vendor release notes. | Not implemented as packaged channel integrations (`slack/teams/push` keyword scan returned no matches). | Not implemented |

## Part B: Differentiation features with low visible competitor coverage

Note: this section is an inference from publicly marketed competitor capabilities. It identifies areas with low explicit coverage in reviewed NZ competitor pages, not absolute global absence.

| Potential differentiation feature | Why this can be an advantage | Competitor coverage signal | Current repo status |
| --- | --- | --- | --- |
| Tamper-evident compliance evidence packs (signed/hash-verified PDF/ZIP, chain-of-custody verify endpoint) | Strong trust feature for audits, principal contractors, and legal disputes. Moves from "export" to "verifiable evidence." | Competitors heavily market exports, but public pages reviewed do not prominently describe tamper-evident verification flows. | Not implemented end-to-end (exports exist, verification chain does not). |
| Safety policy simulator ("what-if" mode before enforcing geofence/quiz/escalation policy) | Lets clients tune policy without production disruption; lowers fear of false denials and operational friction. | Competitor pages emphasize workflows, not pre-deployment simulation tooling. | Not implemented. |
| Cross-site contractor risk passport (dynamic risk score from incidents, quiz outcomes, expiries, permit behavior) | Creates a defensible "single risk view" per contractor across sites, improving pre-approval and supervision decisions. | Competitors market records and compliance checks, but not a unified dynamic risk score with policy hooks as a headline capability. | Not implemented as a unified scoring feature. |
| Self-serve plan configurator with mandatory/removable features and instant per-site quote | Commercial advantage: lets price-sensitive clients reduce cost transparently without sales friction. | Competitors commonly show fixed plans/add-ons; fine-grained self-service modular pricing is not clearly promoted in reviewed pages. | Partially implemented internally (entitlements + billing preview exist), not packaged as customer self-serve product flow. |
| Unified communication hub (email + SMS + Slack/Teams + emergency channels + acknowledgement tracking) | Converts notification sprawl into one auditable communications center tied to incidents and evacuations. | Competitors show individual channels, but less visible as one unified auditable communication control plane. | Partially implemented (email/SMS foundations exist; channel hub and acknowledgement model are not complete). |

## Practical next build order (high impact, low-to-medium complexity first)
1. Teams/Slack packaged connector with approval actions and host-notification routing.
2. Emergency broadcast messaging module with acknowledgement and evacuation event linkage.
3. Permit-to-Work module (template library, staged approval, hold points, closeout evidence).
4. ID scanning/watchlist/random checks security module.
5. Native mobile app strategy (or strong PWA + push as interim).

## Sources
- Capterra visitor management category and feature/user-priority sections:
  - https://www.capterra.com/visitor-management-software/
- SwipedOn:
  - https://www.swipedon.com/blog/whats-new-swipedon
  - https://www.swipedon.com/the-future
  - https://www.swipedon.com/integrations/microsoftteams
  - https://www.swipedon.com/support/integration-for-slack
  - https://www.swipedon.com/migration/support/notification-types
- Sine:
  - https://www.sine.co/visitor-management-system/
  - https://sine.support/en/articles/3581582-auto-check-in-with-the-sine-pro-mobile-app
  - https://sine.support/en/articles/2121822-pass-settings
  - https://www.sine.co/features/emergency-management-features/
  - https://www.sine.co/visitor-management-system-na/
- 1Breadcrumb:
  - https://support.1breadcrumb.com/november-2025-release-notes
  - https://support.1breadcrumb.com/signonsite/permit-to-work-overview
  - https://1breadcrumb.com/en-us/new-feature-permits-to-work/
- ThinkSafe:
  - https://www.thinksafe.co.nz/construction-safety-software/
- Site App Pro:
  - https://www.siteapppro.com/pricing
- EcoOnline:
  - https://www.ecoonline.com/en-us/news/ecoonline-expands-global-availability-of-epermits/
  - https://www.ecoonline.com/en-nz/ehs-software/control-of-work/
- MBIE construction trends context:
  - https://www.mbie.govt.nz/building-and-energy/building/building-system-insights-programme/sector-trends-reporting/building-and-construction-sector-trends-annual-report/2023/emerging-trends-in-building-design-technologies-and-materials

