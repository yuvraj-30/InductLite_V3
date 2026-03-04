# NZ Competitor Pricing + Included Features Snapshot (as of 2026-02-28)

## Scope
- This is a web-researched snapshot of NZ or NZ-served apps similar to InductLite (visitor/contractor sign-in, inductions, compliance workflows).
- Prices and features change frequently; verify before procurement.
- Currency/tax treatment is kept exactly as published by each vendor page.

## Summary Table

| App | Public pricing model | Plan(s) and published price | Notable features included in plan(s) |
| --- | --- | --- | --- |
| SwipedOn | Tiered, per location/month, billed annually | Standard `USD 55`; Premium `USD 109`; Enterprise `USD 169`; add-ons listed (for example resource booking `USD 3`/resource/month) | Standard includes unlimited employees/visitors, 1 device or QR, badge printing, digital agreements, Slack/Teams, multi-location sync. Premium adds visitor approvals, location-verified sign-in/out, SMS notifications, delivery management. Enterprise adds custom visitor flows, data anonymization, directory integrations, dedicated account manager. |
| Site App Pro (NZ pricing page) | Tiered by employee band, with separate "with contractors" plan set | Without contractors/integrations: Essential `NZD 138` (monthly) / `NZD 124` (annual equiv), Team `NZD 276` / `NZD 248`, Professional `NZD 399` / `NZD 359`, Plus `NZD 480` / `NZD 432`, Premium `POA`. With contractors: Team `NZD 368` / `NZD 331` (50 contractors), Professional `NZD 475` / `NZD 428` (100), Plus `NZD 559` / `NZD 503` (150), Premium `POA` (300); marked "Includes Integrations". | Public pricing page differentiates by employee and contractor caps; contractor plans explicitly include integrations. Product pages also show Procore sync, offline field usage, forms/checklists and time on site export to Procore logs. |
| Ezy SignIn | Per location/month for Starter, custom for Premium | Starter `USD 149` per location/month (billed annually). Premium = custom pricing. | Starter lists multi-location support, kiosk and label printing, contactless sign-in, unlimited sign-ins, unlimited host notifications (email/SMS), mobile app, contractor onboarding, document uploads, induction customization with video/images, dashboard and reporting. Premium adds desk/space management and timesheets. |
| EVA Check-in | Tiered per site/month, explicit NZD and USD views | NZD view: Core `NZD 50`/site/month, Business `NZD 100`, Construction `NZD 125`, Enterprise `POA`. | Core includes unlimited check-ins/hosts/kiosks, unlimited visitor types, Microsoft D365 SSO, implementation support. Business adds inductions before/on arrival + AD Sync. Construction adds geofencing, on-site forms, safety inductions/custom questions. Enterprise lists reporting API and multi-site onboarding. |
| Sine (Honeywell) | Tiered Core plans + priced Workflows add-on; NZD displayed | Core has "Prices starting from NZD 89" (Small) plus Medium/Large/Enterprise tiers. Workflows add-on (requires Core) in NZD: Small `+NZD 79`, Medium `+NZD 129`, Large `+NZD 219`, Enterprise custom. | Core Small highlights kiosks, digital invitations/QR, host notifications, roll calls, geofence auto check-in/out. Medium adds pre-registration, asset register, Entra ID sync, SAML SSO. Large adds public API, real-time screening, access control add-on. Page also lists base items like badge printing, unlimited hosts, SMS notifications. |
| WorkSite Online Inductions (NZ) | Tiered monthly + setup fee | Bronze `NZD 50`/month + `NZD 300` setup (250 inductions/year), Silver `NZD 75` + setup (500/year), Gold `NZD 100` + setup (1000/year), Platinum custom. | Plans emphasize online contractor induction + record management, certificate design/preconfigured design and content storage limits; enterprise/custom integrations noted separately. |
| SiteWise (NZ) | Annual subscription by assessment level | Level 3 `NZD 225 + GST`/year, Level 2 `NZD 695 + GST`/year, Level 1 `POA`; additional assessment attempts `NZD 100 + GST`. | Primarily contractor pre-qualification and assessment visibility; Level 2/1 include subcontractor database visibility and shortlist/tender streamlining functions. |
| HazardCo (NZ) | Multiple plan tracks by segment, 12-month term | Builder/trade page snapshots show plans like Standard `NZD 61`/mo, Premium `NZD 85`/mo, Complete `NZD 149`/mo, and enterprise/custom variants; other pricing page snapshots show newer/alternate packaging by segment (for example Foundation/Professional/Premium/Complete with per-team or per-project constraints). | Included-in-all messaging emphasizes advisory support, incident support, templates, and training. Builder/trade pages explicitly mention scan-in, self-induction, and report submission through app. Exact pricing pack differs by segment and appears to have changed over time. |
| ThinkSafe (NZ) | Membership plus add-ons; partial public pricing visible | Pricing page title advertises "from $59/month"; page body clearly lists Enterprise Reporting Dashboard add-on at `NZD 1,990 setup + NZD 199/month + GST`. | Publicly listed enterprise features include executive dashboards, multi-location data, stakeholder reporting, trend analysis; page indicates broader membership/advice support included in fee. |

## Plan Features vs InductLite Status

Comparison basis:
1. Competitor plan features from this file's pricing snapshot.
2. InductLite implementation status from [NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md](NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md) and [NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md](NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md).

| Feature commonly included in competitor plans | Example apps/plans that include it | InductLite status | Gap meaning for roadmap |
| --- | --- | --- | --- |
| QR/kiosk check-in and visitor flow | SwipedOn Standard, EVA Core, Sine Small, Ezy Starter | Complete | Competitive parity present. |
| Digital agreements / induction question flows | SwipedOn Standard (digital agreements), EVA Business/Construction (inductions), WorkSite plans | Complete | Competitive parity present. |
| Badge/label printing | SwipedOn Standard, Ezy Starter, Sine base feature set | Complete for Standard baseline | Competitive parity present for front-desk and kiosk deployments. |
| SMS notifications | SwipedOn Premium, Sine listed base features, Ezy Starter host notifications | Complete as add-on (default policy-off + quota/entitlement gated) | Optional monetized add-on; keep disabled by default for cost control. |
| Geolocation/geofencing attendance controls | SwipedOn Premium (location-verified sign-in/out), EVA Construction (geofencing), Sine Small (geofence auto check-in/out) | Complete baseline + add-on depth (Standard audit-mode location verification; strict geofence deny/override as gated add-on) | Standard parity achieved with audit mode; strict controls remain premium add-on. |
| Contractor onboarding + document workflows | Site App Pro contractor plans, Ezy Starter contractor onboarding/docs, SwipedOn contractor features | Complete for baseline scope | Core doc handling plus expiry reminder automation delivered. |
| Roll-call / evacuation operations | Sine Small (roll calls), EVA construction safety workflows | Complete for Standard baseline | Event lifecycle + accounted/missing + exports delivered. |
| Integrations/API/SSO | Site App Pro contractor plans ("Includes Integrations"), EVA Business (AD sync), Sine Medium/Large (Entra/SAML/API) | Complete baseline | Webhook/LMS/hardware plus tenant-scoped OIDC/Entra SSO and directory-sync API/token rotation are delivered. |
| Access-control/gate integrations | Sine Large (access control add-on), Site Gateway-style offerings (market evidence) | Complete as add-on foundation | Adapter + outbound decision pipeline delivered for enterprise integration. |
| Media-rich induction content (video/PDF/doc before quiz) | Ezy Starter (induction customization with video/images), SiteMate/Induct-style products (market evidence) | Complete for baseline scope | Content-first flow with required acknowledgement and evidence capture delivered. |
| Quiz pass marks/retries scoring engine | HammerTech/Induct-style products (market evidence) | Complete for baseline scope | Pass-threshold, retries, cooldown, blocking, and analytics delivered. |
| LMS/eLearning sync | SiteConnect-style products (market evidence) | Complete for baseline scope | One-way completion sync with provider mappings delivered. |

Status roll-up from plan-feature comparison:
1. Complete: 12 feature groups.
2. Partial: 0 feature groups.
3. Not implemented: 0 feature groups in baseline scope.

## High-Level Takeaways
1. Transparent, self-serve pricing is common for SwipedOn, EVA, Sine, Ezy SignIn, Site App Pro, WorkSite.
2. Custom-quote pricing is common at enterprise tiers, especially where integrations, API, or access-control workflows are involved.
3. Geofencing and SMS are often packaged in higher tiers or add-ons (for example EVA Construction, SwipedOn/Sine higher plans).
4. Contractor-focused systems frequently price by workforce/project/induction volume rather than pure seat count.

## Important Notes
1. Published prices are usually GST-exclusive in NZ pages unless stated otherwise.
2. Several pages display multiple currencies; this snapshot records the values rendered by crawl output.
3. Some vendors operate segment-specific pricing pages, so two valid plan sets can coexist.

## Sources
- SwipedOn pricing: https://www.swipedon.com/pricing
- Site App Pro pricing (NZ): https://www.siteapppro.com/pricing
- Site App Pro Procore integration detail: https://www.siteapppro.com/us/procore
- Ezy SignIn pricing: https://ezysignin.com/pricing/
- EVA Check-in pricing: https://www.evacheckin.com/pricing
- Sine plans: https://www.sine.co/plans/
- WorkSite pricing: https://www.worksite.nz/pricing-2/
- SiteWise pricing: https://sitewise.co.nz/pricing/
- HazardCo pricing (main): https://www.hazardco.com/nz/hazardco-pricing/
- HazardCo builders page (plan examples): https://www.hazardco.com/nz/hazardco-for-builders/
- HazardCo tradies page (plan examples): https://www.hazardco.com/nz/hazardco-for-tradies/
- ThinkSafe pricing: https://www.thinksafe.co.nz/pricing/
