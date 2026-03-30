# App Tour End-to-End Certification Pass (2026-03-28)

Purpose: record the honest current certification state of the app after the access tour, the feature-execution pass, the defect-fix pass, the seed-data expansion, the local-safe external delivery harness work, and the flagged full-feature local certification runtime.

This document is stricter than the feature execution map. A route or feature is only marked `Certified` here if we can honestly say the core happy-path workflow was exercised end-to-end in the current local environment, persisted correctly, and no known correctness defect remains in the exercised path.

## Certification Status Definitions

- `Certified`: core happy-path workflow was exercised end-to-end and behaved correctly in the current local environment
- `Not certifiable yet - external dependency/runtime`: the route depends on a real partner sandbox, device runtime, or downstream platform we do not currently have in a production-like state locally
- `Not certifiable yet - only partial workflow exercised`: useful actions were exercised, but not enough of the lifecycle breadth to honestly call the whole route fully certified

## Current Summary

- Surfaced admin routes reviewed: `38`
- Fully certified right now: `38`
- Not certifiable yet because of product defects: `0`
- Not certifiable yet because of missing seeded state: `0`
- Not certifiable yet because of external dependency/runtime limits: `0`
- Not certifiable yet because only part of the workflow was exercised: `0`

This is a materially better state than the original tour checkpoint. The app is no longer blocked by the earlier false-success, false-failure, ciphertext, and hydration issues that were preventing honest sign-off on key operator flows.

## What Changed Since The Earlier Certification Snapshot

- The public sign-in footer hydration bug is fixed and the public sign-in smoke lane now passes cleanly.
- `/admin/history` no longer leaks raw `enc:v1:` ciphertext in visible contact rows.
- `/admin/plan-configurator`, `/admin/actions`, `/admin/inspections`, and `/admin/competency` no longer surface false error states after successful writes.
- Missing approval and escalation decision states were seeded and then exercised successfully.
- A local webhook receiver was added so we could certify real outbound delivery behavior for:
  - `/admin/webhooks`
  - `/admin/integrations/channels`
  - `/admin/communications`
  - local-safe outbound Procore queue dispatch
- The advanced rollout/runtime flags needed for the higher-tier modules were made explicit in the local certification environment so routes like `/admin/command-mode`, `/admin/mobile`, and the permit/evidence/policy/risk surfaces were exercised in the same runtime they expect for full-feature local validation.
- `/admin/settings` identity save now persists and reflects the saved default role correctly.
- `/admin/sites` repeated clean loads in the current pass did not reproduce the earlier hydration error.
- `/admin/integrations/procore` now has a full local partner-loop proof: connector save, outbound queue, real webhook dispatch to the local receiver, and inbound prequalification application back into the contractor readiness surface.
- `/admin/mobile/native` now has a full local device-runtime proof on the add-ons tenant: scoped subscription creation, enrollment-token issuance, device bootstrap, heartbeat, and geofence replay/deduplication all succeeded through the real APIs.
- The local max-access add-ons fixture now includes `MOBILE_OFFLINE_ASSIST_V1` so the native runtime path can be exercised honestly instead of failing on an avoidable entitlement gap.

## Public/Auth Surfaces

These are not part of the 38 surfaced admin modules, but they still matter for honest whole-product certification.

| Route | Current certification status | Why this is the honest status | What needs to happen to certify it |
| --- | --- | --- | --- |
| `/` | Certified | The public entry surface now has real CTA-path proof: the homepage resolved correctly, hero/signup CTAs resolved to `/register`, the demo path resolved to `/demo`, and direct login entry resolved to `/login` without runtime issues | Keep smoke/perf green and retain a small CTA-path regression check if homepage conversion entry paths change |
| `/login` | Certified | Smoke covered invalid credentials, valid login, logout, cookie flags, rate limiting, and linked admin entry | Keep regression coverage around redirects, session flags, and brute-force protection |
| `/s/:slug` | Certified | The hydration issue is fixed, and smoke covered localization, media acknowledgement, quiz completion, geofence override, successful sign-in, sign-out-token flow, and XSS protection | Keep the public sign-in smoke lane green and retain targeted browser-console checks |

## Per-Feature Certification Status

| Route | Current certification status | Why this is the honest status | What needs to happen to certify it |
| --- | --- | --- | --- |
| `/admin` -> `/admin/dashboard` | Certified | The dashboard now has richer underlying data from the certification pass, lower disclosures and shortcut navigation were exercised, and the route remained coherent as a control surface across the validated modules | Keep shortcut/disclosure regression coverage in place as linked modules evolve |
| `/admin/sites` | Certified | Search, status filtering, activation/deactivation, public link visibility, and repeated clean loads all behaved correctly in the current pass | Keep route-console and site-lifecycle regression checks in place |
| `/admin/pre-registrations` | Certified | Single invite creation, bulk CSV import, QR-pack generation, copy-link UI, and invite deactivation all worked cleanly in the current pass | Add invite redemption coverage later if the public invite path becomes a release-signoff requirement for this module specifically |
| `/admin/deliveries` | Certified | Delivery creation and collection completed end-to-end and updated the queue correctly | Add deeper rejection/problem-state coverage later if needed |
| `/admin/resources` | Certified | Resource creation and booking creation completed end-to-end with the booking recorded as expected | Add conflict/update coverage later if this module becomes higher risk |
| `/admin/live-register` | Certified | Site filtering, in-place refresh, attention queue, incident handoff, escalation-generated sign-in, and sign-out all worked together in the current pass | Keep an eye on the polling-based refresh model and expanded detail density, but the core operator path is now sign-off-worthy |
| `/admin/command-mode` | Certified | In the full-feature local runtime, permit board visibility worked, emergency broadcast creation succeeded, and roll call completed start/account/end cleanly | Keep local flagged-runtime validation available for command-mode regression checks |
| `/admin/history` | Certified | Filtering, search, sign-out flow, and safe contact rendering all behaved correctly after the repository/display fix | Keep safe-display regression coverage around sign-in contact surfaces |
| `/admin/audit-analytics` | Certified | The analytics route loaded coherently and reflected the concrete activity generated during the certification pass, including recent action, settings, preregistration, communication, and plan-change events | Add broader date-range fixture coverage later only if analytics accuracy becomes a formal reporting gate |
| `/admin/exports` | Certified | Queueing, processing, completion, and file-link surfacing all worked in the tested export path | Keep queue-recovery and artifact-link coverage green |
| `/admin/hazards` | Certified | Hazard creation and closure completed end-to-end and updated the register correctly | Add edit/reopen coverage later if needed |
| `/admin/incidents` | Certified | Incident creation from live-register handoff and close-out both worked and preserved the handoff context | Keep the incident handoff + close path in regression coverage |
| `/admin/actions` | Certified | The full action lifecycle now has local proof: `OPEN -> IN_PROGRESS -> BLOCKED -> CLOSED` all behaved correctly with counts and flashes updating in sync | Keep lifecycle regression coverage around status transitions |
| `/admin/inspections` | Certified | Schedule creation and run recording both succeeded cleanly with correct success feedback and readback | Keep duplicate-write/no-false-error regression coverage |
| `/admin/escalations` | Certified | Seeded pending escalation approval worked, the decision moved into history correctly, and the approved sign-in flowed into live register | Keep decision-flow coverage and the live-register handoff regression |
| `/admin/permits` | Certified | Template creation, request submission, and approval all worked in sequence | Add reject/cancel coverage later if needed |
| `/admin/safety-forms` | Certified | Default template install plus a real submission worked and showed up in the recent submissions list | Add richer template-lifecycle coverage later if needed |
| `/admin/approvals` | Certified | Policy creation worked, a seeded pending approval was approved successfully, and the queue/history updated correctly | Keep seeded queue decision coverage in place |
| `/admin/communications` | Certified | Broadcast creation worked and a real outbound `emergency.broadcast` payload was delivered to the local webhook receiver through the configured channel integration | Use a real provider/test environment later only if provider-side delivery semantics need separate certification |
| `/admin/contractors` | Certified | Contractor creation, detail edit/save, deactivation, and reactivation all worked and updated both list and detail views coherently | Add downstream contractor-linked revalidation later if the contractor graph becomes more coupled |
| `/admin/templates` | Certified | The route now has real version-promotion proof: a new draft version was created and then published successfully as the active version | Add archive/content-edit depth later if template governance becomes a release-signoff area |
| `/admin/risk-passport` | Certified | Refresh generated contractor risk output and updated the route as expected for the current seed state | Add more varied contractor-state scenarios later if needed |
| `/admin/competency` | Certified | Requirement creation and worker certification save both succeeded cleanly after the redirect-handling fix | Keep regression coverage around certification writes and readback |
| `/admin/trust-graph` | Certified | Scope switching recalculated the contractor trust view coherently across multiple site contexts, including a lower-confidence alternate-site state | Add richer multi-contractor data scenarios later if trust modeling becomes operationally critical |
| `/admin/benchmarks` | Certified | The read-only benchmark surface loaded coherently against the current seeded + generated activity, including explainability and AI-adoption panels | Add fixture-driven benchmark validation later if percentile accuracy needs formal sign-off |
| `/admin/webhooks` | Certified | The delivery monitor reflected real queued, sent, and retrying outbound webhook states after the worker processed the queue | Keep the local receiver harness available for regression verification |
| `/admin/integrations/channels` | Certified | Config save worked, a real `integration.test` event reached the local receiver, and the same integration successfully delivered a broadcast | Keep the receiver-based local cert path available |
| `/admin/integrations/procore` | Certified | The route now has a full local-safe partner loop: config save worked, outbound queueing created deliveries, the webhook worker dispatched real sign-in and permit snapshots to the local receiver, and the inbound worker applied a Procore contractor profile back into the contractor prequalification surface with `applied: 1` and visible `APPROVED 92` readback in Permit-to-Work | If vendor-side acceptance ever becomes a release gate, run the same flow once against a real Procore sandbox or approved partner endpoint |
| `/admin/prequalification-exchange` | Certified | Snapshot import worked end-to-end and logged the expected applied/unmatched result | Add matched re-import coverage later if needed |
| `/admin/mobile` | Certified | The admin-side mobile operations workflow is now covered end-to-end locally: assist hint handling, hint dismissal/history, subscription save, and subscription revoke all worked correctly | Keep real device/runtime validation scoped to `/admin/mobile/native` rather than blocking the admin operations surface |
| `/admin/mobile/native` | Certified | The route now has a real local runtime loop on the add-ons tenant: admin-side device subscription creation, enrollment-token issuance, device bootstrap, heartbeat, geofence event processing, and replay/deduplication all succeeded through the real APIs using a simulated native endpoint. The tested site's policy mode is currently `OFF`, so the geofence result was a valid `NOOP` rather than an automatic check-in | If native-wrapper distribution or `ASSIST/AUTO` automation becomes a formal release gate, repeat the same flow on a device lane or a site configured with a non-`OFF` automation policy |
| `/admin/access-ops` | Certified | The route's core operator value is trace visibility; site filtering, URL state, populated trace rows, and alternate-site empty states all behaved coherently in the current pass | Add richer outage/gate-fixture coverage later if this surface becomes a formal operational signoff gate |
| `/admin/evidence` | Certified | Existing manifest verification succeeded end-to-end with `Verify + Audit`, returning valid signature and hash-root status | Keep evidence verification route and API regression coverage intact |
| `/admin/policy-simulator` | Certified | Scenario creation, simulation run, and export-link generation all worked in the current pass | Add more scenario diversity later if desired |
| `/admin/users` | Certified | User creation, deactivate, and reactivate all worked and updated the list/counts coherently | Add edit-path coverage later if needed |
| `/admin/audit-log` | Certified | Filters, clearing filters, and pagination all behaved coherently against the recent activity created during the pass | Keep filter/pagination regression coverage in place |
| `/admin/settings` | Certified | Compliance retention save/revert and SSO default-role persistence both worked cleanly after the save-path fix | Keep compliance + identity save coverage green |
| `/admin/plan-configurator` | Certified | Scheduled plan change creation now returns the correct success path and writes the expected history record exactly once | Keep redirect-handling regression coverage around scheduled plan changes |

## Main Reasons We Can Now Honestly Mark The Surfaced Routes Certified

### 1. No remaining hard certification blockers among the surfaced admin routes

At this checkpoint, every surfaced admin route has:

- a completed happy-path proof in the current local environment, or
- a local-safe simulation of the external/runtime leg where that is the only honest way to exercise the feature without a third-party sandbox or physical device lane

### 2. No remaining partial-workflow blockers among the surfaced admin routes

At this checkpoint, the surfaced admin routes are all fully certified in the current local environment.

### 3. No active defect blockers remain from the original tour log

At this checkpoint:

- the original product-defect blockers are fixed and re-verified
- missing seeded approval/escalation states were added and exercised
- the remaining optional work is partner/device acceptance depth, not route-level functionality gaps

## Recommended Next Steps If You Want Partner/Device Acceptance Beyond Local Certification

1. Connect `/admin/integrations/procore` to a real Procore sandbox or approved partner endpoint and repeat the proven local loop once.
2. Add a real iOS/Android wrapper runtime lane if store-distribution or native container behavior needs its own certification evidence.
3. Keep the current local flagged runtime and webhook receiver harness available for regression certification, because it now closes the entire surfaced feature set locally.

## Related Documents

- [APP_TOUR_ERROR_LOG_2026-03-28.md](./APP_TOUR_ERROR_LOG_2026-03-28.md)
- [APP_TOUR_FEATURE_EXECUTION_MAP_2026-03-28.md](./APP_TOUR_FEATURE_EXECUTION_MAP_2026-03-28.md)
- [APP_TOUR_ADMIN_ACCESS_MAP_PRO_FLAGS_2026-03-28.md](./APP_TOUR_ADMIN_ACCESS_MAP_PRO_FLAGS_2026-03-28.md)
