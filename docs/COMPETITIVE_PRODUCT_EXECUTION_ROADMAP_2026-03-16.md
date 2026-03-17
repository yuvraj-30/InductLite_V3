# COMPETITIVE_PRODUCT_EXECUTION_ROADMAP_2026-03-16

Date: 2026-03-16

Related research:

- [COMPETITOR_MASTER_AUDIT_2026.md](./COMPETITOR_MASTER_AUDIT_2026.md)
- [COMPETITOR_HYBRID_MARKETING_SPEC_2026-03-15.md](./COMPETITOR_HYBRID_MARKETING_SPEC_2026-03-15.md)
- [EHS_FOCUSED_EXPANSION_IMPLEMENTATION_ROADMAP_2026-03-17.md](./EHS_FOCUSED_EXPANSION_IMPLEMENTATION_ROADMAP_2026-03-17.md)

## Goal

Make InductLite better than the current market set by winning the core operational job more cleanly than any competitor:

1. identify the worker
2. clear the worker for site
3. keep the live site state visible
4. prove what happened later

This roadmap is deliberately product-first, not marketing-first. Most competitors either:

- market better than they execute, or
- have operational breadth but weak UX clarity.

InductLite should beat both.

## Product Position To Build Toward

InductLite should feel:

- faster than 1Breadcrumb
- clearer than HammerTech
- more coherent than SignOnSite
- less cluttered than SiteConnect and SiteDocs
- more construction-native than Sine, EVA Check-in, and SwipedOn
- more modern than ThinkSafe and Worksite

## Execution Principles

- One core object: `site clearance state`
- One worker story: `scan -> identify -> review -> clear -> visible onsite`
- One admin story: `see who is active, blocked, expiring, or awaiting action`
- Product UI should show real state, not just decorative cards
- Public flow must feel fast on a phone before it feels feature-rich

## Phases

| Phase | Outcome | Why it matters | Primary files | Status |
| --- | --- | --- | --- | --- |
| 1 | Clearance-first public sign-in UX | This is the most important user ritual in the product | [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx), [SuccessScreen.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SuccessScreen.tsx), [page.tsx](../apps/web/src/app/s/%5Bslug%5D/page.tsx), [kiosk/page.tsx](../apps/web/src/app/s/%5Bslug%5D/kiosk/page.tsx), [public-shell.tsx](../apps/web/src/components/ui/public-shell.tsx) | Phase 1 delivered |
| 2 | Live site control room dashboard | Competitors talk about site visibility; few make it feel truly live | [dashboard/page.tsx](../apps/web/src/app/admin/dashboard/page.tsx), [dashboard.repository.ts](../apps/web/src/lib/repository/dashboard.repository.ts), [status-badge.tsx](../apps/web/src/components/ui/status-badge.tsx) | Delivered |
| 3 | Permit and exception decisioning | This is where HammerTech and Sine still feel stronger | [approvals/page.tsx](../apps/web/src/app/admin/approvals/page.tsx), [permits/page.tsx](../apps/web/src/app/admin/permits/page.tsx), [risk-passport/page.tsx](../apps/web/src/app/admin/risk-passport/page.tsx), [communications/page.tsx](../apps/web/src/app/admin/communications/page.tsx), approval actions and repositories | Delivered |
| 4 | Repeat worker fast-pass | Most products optimize the first visit, not the fifth | [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx), [SuccessScreen.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SuccessScreen.tsx), [sign-out/page.tsx](../apps/web/src/app/sign-out/page.tsx), [SignOutForm.tsx](../apps/web/src/app/sign-out/components/SignOutForm.tsx) | Delivered |
| 5 | Audit proof and reporting surfaces | Buyers want proof, not just better screens | [history/page.tsx](../apps/web/src/app/admin/history/page.tsx), [exports](../apps/web/src/app/admin/exports), [dashboard/page.tsx](../apps/web/src/app/admin/dashboard/page.tsx) | Delivered |
| 6 | Product-wide visual normalization | The system is good, adoption is uneven | [globals.css](../apps/web/src/app/globals.css), shared UI primitives in [components/ui](../apps/web/src/components/ui), key admin pages | Delivered |

## Phase 1: Clearance-First Public Sign-In UX

### Competitive problem being solved

- 1Breadcrumb has the best hero and induction clarity.
- EVA Check-in and SwipedOn feel easier for first-time completion.
- Most competitors still bury the actual clearance path in generic forms.

### InductLite move

Make the public sign-in flow feel like a visible clearance journey, not a generic multi-step form.

### What to change

1. Make the top of the flow explain exactly where the worker is in the path.
2. Surface repeat-visitor acceleration earlier.
3. Turn the final step into a visible clearance check.
4. Turn the success state into an operational "cleared for site" state.

### Primary files

- [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx)
- [SuccessScreen.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SuccessScreen.tsx)
- [page.tsx](../apps/web/src/app/s/%5Bslug%5D/page.tsx)
- [kiosk/page.tsx](../apps/web/src/app/s/%5Bslug%5D/kiosk/page.tsx)
- [public-shell.tsx](../apps/web/src/components/ui/public-shell.tsx)

### Success criteria

- A worker can understand the three-step path immediately on page load.
- A returning worker sees a fast-pass path before filling the form manually.
- The success state reads as `cleared`, not just `submitted`.
- The sign-out instruction is obvious and easy to keep.

### Implementation status in this pass

- Added stronger step framing and clearance-path messaging in [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx)
- Added repeat-visitor fast-pass framing and clearer express mode copy in [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx)
- Added a final clearance summary before signature in [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx)
- Changed success state language from generic success to active clearance in [SuccessScreen.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SuccessScreen.tsx)
- Tightened sign-in and kiosk subtitles in [page.tsx](../apps/web/src/app/s/%5Bslug%5D/page.tsx) and [kiosk/page.tsx](../apps/web/src/app/s/%5Bslug%5D/kiosk/page.tsx)

## Phase 2: Live Site Control Room Dashboard

### Competitive problem being solved

HammerTech, 1Breadcrumb, and SignOnSite all promise visibility. Few make the default dashboard feel like a real-time command surface.

### InductLite move

Make the dashboard the obvious place to answer:

- who is onsite now
- who is blocked
- what is waiting for approval
- what is expiring soon
- what has changed in the last few hours

### What to change

1. Reframe the first fold around `live site state`, not only generic KPIs.
2. Add a visible blocked / review-needed lane.
3. Surface permit and compliance exceptions as action items, not only counts.
4. Make emergency readiness and document expiry feel operational, not archival.

### Primary files

- [dashboard/page.tsx](../apps/web/src/app/admin/dashboard/page.tsx)
- [dashboard.repository.ts](../apps/web/src/lib/repository/dashboard.repository.ts)
- [data-table.tsx](../apps/web/src/components/ui/data-table.tsx)
- [status-badge.tsx](../apps/web/src/components/ui/status-badge.tsx)

### Success criteria

- A site manager can tell within 10 seconds who is active, blocked, missing, or at risk.
- The dashboard answers action questions, not just reporting questions.
- The page feels more like a control room than a reporting page.

## Phase 3: Permit And Exception Decisioning

### Competitive problem being solved

HammerTech and Sine still look more serious in permits and approvals. InductLite needs stronger decision-state UX, not just more fields.

### InductLite move

Make high-risk approvals feel fast, mobile-friendly, and unmistakably traceable.

### What to change

1. Create a visible permit lifecycle: requested, reviewing, active, expired, closed.
2. Add explicit blocked reasons and next actions.
3. Make supervisor approval one-tap where policy allows.
4. Improve exception escalation states and audit visibility.

### Primary files

- [approvals/page.tsx](../apps/web/src/app/admin/approvals/page.tsx)
- [risk-passport/page.tsx](../apps/web/src/app/admin/risk-passport/page.tsx)
- [communications/page.tsx](../apps/web/src/app/admin/communications/page.tsx)
- related approval server actions and repositories under [lib](../apps/web/src/lib)

### Success criteria

- A supervisor can understand why a person is blocked without opening multiple records.
- A permit request can be approved or rejected quickly on a phone or tablet.
- Approval history is readable without exporting data.

## Phase 4: Repeat Worker Fast-Pass

### Competitive problem being solved

Most competitors are still optimized for first-run onboarding, not repeated site visits.

### InductLite move

Turn repeat visits into a measurable product moat.

### What to change

1. Improve last-visit reuse for details and signatures.
2. Recognize prior induction completion and only ask for deltas when policy allows.
3. Add clearer saved-state messaging and device-safety rules.
4. Make sign-out and next sign-in feel part of the same lifecycle.

### Primary files

- [SignInFlow.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SignInFlow.tsx)
- [SuccessScreen.tsx](../apps/web/src/app/s/%5Bslug%5D/components/SuccessScreen.tsx)
- public sign-in and sign-out actions under [app/s/[slug]/actions.ts](../apps/web/src/app/s/%5Bslug%5D/actions.ts) and [sign-out/page.tsx](../apps/web/src/app/sign-out/page.tsx)

### Success criteria

- A returning visitor can complete a valid repeat sign-in materially faster than a new visitor.
- Saved-state behavior stays safe on kiosk and shared devices.
- The product visibly rewards repeat compliance.

## Phase 5: Audit Proof And Reporting

### Competitive problem being solved

Competitors sell compliance proof constantly, but their reporting surfaces often feel passive or generic.

### InductLite move

Make it easier to prove:

- who was onsite
- who completed which induction
- which version was accepted
- who approved a permit or override
- what changed and when

### What to change

1. Improve history filtering around clearance state, not just raw event logs.
2. Build clearer audit summaries into dashboards and exports.
3. Surface proof-ready metadata directly in UI before export.

### Primary files

- [history/page.tsx](../apps/web/src/app/admin/history/page.tsx)
- [history-filters.tsx](../apps/web/src/app/admin/history/history-filters.tsx)
- [exports](../apps/web/src/app/admin/exports)
- supporting repositories under [lib/repository](../apps/web/src/lib/repository)

### Success criteria

- A compliance user can answer common audit questions without leaving the product.
- Export becomes the final mile, not the first step.

## Phase 6: Visual Normalization Across Product UI

### Competitive problem being solved

InductLite's underlying design direction is stronger than many competitors, but the application of it is still uneven across admin and public flows.

### InductLite move

Finish the system so the product looks intentionally unified.

### What to change

1. Keep admin surfaces industrial and flat/elevated by default.
2. Reserve blur or glass for overlays and special emphasis only.
3. Normalize badges, tables, controls, alerts, and modals fully.
4. Make public and admin flows feel like one product family.

### Primary files

- [globals.css](../apps/web/src/app/globals.css)
- shared primitives in [components/ui](../apps/web/src/components/ui)
- key admin pages and public shells called out in [UI_UX_VISUAL_CONSISTENCY_AUDIT_2026-03-15.md](./UI_UX_VISUAL_CONSISTENCY_AUDIT_2026-03-15.md)

### Success criteria

- There is one obvious design language across admin, public sign-in, and overlays.
- No page looks like a legacy one-off.

## Recommended Delivery Order

1. Finish Phase 1 and validate public sign-in speed and clarity.
2. Move directly into Phase 2 dashboard reframe.
3. Build Phase 3 permit and exception states.
4. Then deepen repeat-worker advantages in Phase 4.
5. Finish with proof surfaces and complete normalization.

## What Not To Do

- Do not chase every competitor feature page one-for-one.
- Do not broaden into generic EHS suite sprawl.
- Do not add decorative visual complexity to look "premium".
- Do not let admin reporting become more prominent than live site operations.

## Strategic Bet

If InductLite becomes the fastest, clearest, and most traceable site-clearance product in the set, it does not need to out-market every competitor on breadth.

It only needs to make the core ritual feel obviously better:

`scan -> clear -> visible -> provable`
