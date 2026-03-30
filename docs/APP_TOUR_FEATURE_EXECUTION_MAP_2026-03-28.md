# App Tour Feature Execution Map (2026-03-28)

Purpose: document which unlocked routes were actually exercised beyond simple page-load/access verification during the local tour.

How to read this document:

- `Not tested yet`: route was only checked for access/output, not workflow execution
- `Smoke-tested`: one or more primary actions were exercised with safe/local inputs
- `Partially tested`: some major actions were exercised, but not the full module lifecycle
- `Blocked`: feature execution could not proceed because of a real product issue

Related documents:

- [APP_TOUR_ERROR_LOG_2026-03-28.md](./APP_TOUR_ERROR_LOG_2026-03-28.md)
- [APP_TOUR_ADMIN_ACCESS_MAP_2026-03-28.md](./APP_TOUR_ADMIN_ACCESS_MAP_2026-03-28.md)
- [APP_TOUR_ADMIN_ACCESS_MAP_ADDONS_2026-03-28.md](./APP_TOUR_ADMIN_ACCESS_MAP_ADDONS_2026-03-28.md)
- [APP_TOUR_ADMIN_ACCESS_MAP_PRO_FLAGS_2026-03-28.md](./APP_TOUR_ADMIN_ACCESS_MAP_PRO_FLAGS_2026-03-28.md)

## Current Status

- Feature-execution pass started: `2026-03-28`
- Active account baseline: `admin.pro@inductlite.test`
- Max-access completion account: `admin.addons@inductlite.test`
- Local rollout flags: enabled for the advanced/admin modules verified in the PRO pass
- Surfaced admin routes now covered here: `38 / 38`
- Current known execution defects from this pass: `0`

## Results

| Route | Status | Actions exercised | Outcome | Notes |
| --- | --- | --- | --- | --- |
| `/admin` -> `/admin/dashboard` | Smoke-tested | Expanded lower disclosure sections; followed management shortcuts into linked admin modules; verified curated top-half cards still resolve into live routes after the broader certification pass | Worked | Dashboard disclosures open cleanly, shortcut navigation resolves correctly, and the route stays coherent after the deeper module coverage created richer underlying data |
| `/admin/permits` | Partially tested | Created permit template; submitted permit request; approved request | Core lifecycle controls are working for the tested happy path | Template creation updated the template list, request submission updated the lifecycle queue, and approval transitioned the request from `REQUESTED` to `APPROVED` |
| `/admin/approvals` | Partially tested | Created visitor approval policy; approved seeded pending request with decision note | Worked | Policy save worked, the pending queue decision flow completed cleanly, and the request moved into the resolved list as `APPROVED` |
| `/admin/communications` | Partially tested | Created emergency broadcast; delivered broadcast to local webhook receiver via channel integration | Worked | Success banner displayed, timeline updated, and the local receiver captured the real `emergency.broadcast` payload with the expected headers/body |
| `/admin/access-ops` | Smoke-tested | Applied site filter to a populated site trace; switched to an alternate site and verified the empty-state trace/outage views | Worked | URL state, populated trace rows, and alternate-site empty states all behaved coherently |
| `/admin/history` | Partially tested | Filtered by `Currently On Site`; searched by visitor name fragment; signed out an active record | Worked | Filters updated the URL correctly, search narrowed the table, sign-out completed successfully, and signed-out rows now render the safe contact display instead of raw ciphertext |
| `/admin/live-register` | Partially tested | Paused auto-refresh; triggered manual refresh; switched site scope; opened incident handoff from expanded detail | Worked | Refresh stayed in-place, scope changes updated the URL cleanly, empty-state behavior on a quiet site was correct, and the incident handoff prefilled site + sign-in context correctly |
| `/admin/incidents` | Partially tested | Created incident from live-register handoff; closed created incident | Worked | Prefilled site and sign-in linkage carried over from live-register, the new report appeared immediately in `Recent Reports`, and the close action transitioned the report to `CLOSED` |
| `/admin/users` | Partially tested | Created site-manager user; deactivated user; reactivated user | Worked | Counts updated correctly, the new user appeared immediately in the table, and deactivate/reactivate both completed without leaving the list in a stale state |
| `/admin/sites` | Partially tested | Filtered by site name; deactivated site; reactivated site | Worked | Search updated the URL and narrowed the table correctly, deactivation hid the public sign-in link, reactivation restored the site, and repeated clean loads in the current pass showed no hydration error reproduction |
| `/admin/settings` | Partially tested | Updated compliance retention and reverted it; changed SSO default role and verified persistence | Worked | Compliance settings persisted correctly, the SSO default role now stays on the saved value immediately after submit, and reload/readback matched the saved role |
| `/admin/pre-registrations` | Partially tested | Created single invite; bulk-imported two invites from CSV; verified QR-pack generation/copy-link UI; deactivated created invite | Worked | Single invite creation, bulk CSV import, QR-pack output, and deactivation all behaved correctly in the current pass |
| `/admin/exports` | Partially tested | Queued Sign-In CSV export; ran queue recovery | Worked | Queueing created a `QUEUED` export row, `Run Queue Now` processed it successfully, and the row transitioned to `SUCCEEDED` with a downloadable file link |
| `/admin/command-mode` | Partially tested | Verified permit board visibility in flagged runtime; created emergency broadcast; started evacuation roll call; marked attendee accounted; ended roll call | Worked | Command mode now has local proof across permit-board visibility, broadcast creation, and full roll-call progression |
| `/admin/deliveries` | Partially tested | Logged delivery; marked delivery collected | Worked | Delivery creation showed a success flash and inserted the row into the queue immediately; marking it `COLLECTED` updated the row state cleanly |
| `/admin/resources` | Partially tested | Created resource; created booking against that resource | Worked | Resource creation populated both the active resources table and the booking resource selector; booking creation produced an immediate `CONFIRMED` upcoming booking |
| `/admin/audit-analytics` | Smoke-tested | Opened analytics route; verified totals, trend table, and top-actions data against recent execution activity generated during certification | View validated | Read-only analytics route reflects current audit volume coherently, including recent settings, actions, preregistration, communications, and plan-change events |
| `/admin/audit-log` | Smoke-tested | Applied action + entity filters; cleared filters; paginated from page 1 to page 2 | Worked | Query-string state, filtered results, and pagination all behaved coherently and reflected the recent activity we created in the tour |
| `/admin/hazards` | Partially tested | Created hazard with follow-up action; closed hazard | Worked | The hazard appeared immediately in the register, and the close action transitioned it from `OPEN` to `CLOSED` cleanly |
| `/admin/actions` | Partially tested | Started an open action; blocked it; closed it | Worked | The full local lifecycle now behaves correctly: counts update in sync and each transition returns the correct success feedback |
| `/admin/inspections` | Partially tested | Created inspection schedule; recorded inspection run | Worked | Both the schedule and the run appeared once, updated summary counts, and now return success flashes rather than false `NEXT_REDIRECT` errors |
| `/admin/escalations` | Partially tested | Approved seeded pending escalation with note; verified it moved into recent decisions; verified resulting sign-in reached live register | Worked | The decision flow now has seeded coverage, queue counts update correctly, and the approved escalation produced a real live-register attendee that could be signed out later in the pass |
| `/admin/plan-configurator` | Partially tested | Submitted scheduled plan change request and verified resulting history entry | Worked | Scheduling now returns the correct success flash and produces the expected scheduled change record without a false failure state |
| `/admin/evidence` | Partially tested | Verified existing evidence manifest; ran `Verify + Audit` on a generated manifest | Worked | The route now has real verification-path evidence: manifest verification returns `passed`, signature `valid`, and hash-root `valid` for the generated evidence pack |
| `/admin/policy-simulator` | Partially tested | Created simulation scenario; ran simulation | Worked | Scenario creation succeeded, run completed, and export link was generated |
| `/admin/integrations/channels` | Partially tested | Saved Slack integration; ran integration test against local receiver; reused the channel for a live emergency broadcast | Worked | Config save worked, the receiver captured a real `integration.test` event, and the same integration delivered an `emergency.broadcast` payload successfully |
| `/admin/integrations/procore` | Partially tested | Saved connector configuration; queued outbound sync; processed webhook queue to local receiver; posted inbound prequalification payload to the real worker route | Worked locally | Queue action created real delivery rows, the webhook worker dispatched both `procore.signins.snapshot` and `procore.permits.snapshot`, the local receiver captured the expected payloads, and the inbound worker applied an `APPROVED` prequalification to `Tour Electrical Ltd` with visible readback on `/admin/permits` |
| `/admin/webhooks` | Partially tested | Verified delivery monitor before and after processing outbound queue | Worked | Shared webhook monitor now shows the full local lifecycle: queued Procore deliveries moved to `SENT`, and earlier intentionally invalid targets remain visible as `RETRYING` with honest error detail |
| `/admin/prequalification-exchange` | Smoke-tested | Imported Totika-style snapshot JSON | Worked | Import history logged `APPLIED` with a summary showing `received: 1` and `unmatched: 1`, which is the expected result for a contractor that does not yet map locally |
| `/admin/mobile` | Partially tested | Ran auto check-out assist; accepted one generated hint; dismissed another hint; saved admin test subscription; revoked the saved subscription | Worked | Hint queue handling and admin-side subscription save/revoke both behaved correctly, leaving `/admin/mobile/native` as the remaining true runtime-dependent piece |
| `/admin/mobile/native` | Partially tested | On the add-ons max-access tenant, saved a native device subscription; issued enrollment token; completed bootstrap; sent heartbeat; processed geofence event; replayed duplicate/exit batch | Worked locally | The real runtime APIs all accepted the simulated native device loop. The tested site's current policy mode is `OFF`, so geofence handling correctly returned `NOOP` plus replay dedupe rather than auto check-in |
| `/admin/safety-forms` | Partially tested | Installed default templates; recorded SWMS submission | Worked | Default pack installed 5 templates, and the new submission appeared immediately in the recent submissions list |
| `/admin/contractors` | Partially tested | Created contractor; edited contractor notes; deactivated contractor; reactivated contractor | Worked | List counts and detail-page state stayed in sync through edit, deactivate, and reactivate |
| `/admin/templates` | Partially tested | Created a new draft version; published the draft as the active version | Worked | Template version promotion now has direct proof in addition to the earlier draft-version manipulation |
| `/admin/risk-passport` | Smoke-tested | Ran `Refresh All` for contractor risk scores | Worked | Refresh created a contractor score row and updated the risk view for the newly created contractor |
| `/admin/competency` | Partially tested | Created requirement; saved worker certification | Worked | Both the requirement and certification appeared once, updated summary counts, and now return success flashes instead of false `NEXT_REDIRECT` errors |
| `/admin/trust-graph` | Smoke-tested | Changed the route scope from all sites to `Pro Demo Site B` | Worked | URL state updated correctly and the trust score/confidence/reason mix recalculated for the alternate site view |
| `/admin/benchmarks` | Smoke-tested | Verified predictive benchmark metrics and explainability surfaces after recent tour activity | View validated | Read-only analytics route loaded coherently and reflected seeded plus newly created activity data |

## Notes

- This document is intentionally separate from the access maps. A route can be `Full access` in the access map and still be `Not tested yet` here until its core workflow is actually exercised.
- Any real execution failures discovered during this pass should also be added to the error log.
- Highest-priority execution defects from this pass:
  - None currently open from the execution flows exercised in this pass.
