# Admin Access Map (Add-ons Admin Tour - 2026-03-28)

Purpose: capture what the broadest currently-seeded add-ons admin can see on the surfaced admin routes without changing the app's rollout state.

Current admin used for this pass:

- Company: `Plan Test Add-ons Ltd`
- User: `STANDARD Plan Admin`
- Email: `admin.addons@inductlite.test`
- Role: `ADMIN`
- Plan context: `STANDARD + company add-on overrides`

How to read this document:

- `Full access`: the route loaded normally for this admin
- `Full access (empty state)`: the route loaded normally, but seeded data is empty
- `Full access (partial feature disabled)`: the route is available, but one module inside it is still disabled
- `Rollout-gated`: the route loads a clean feature-disabled message with a rollout control id

Related documents:

- [APP_TOUR_ERROR_LOG_2026-03-28.md](./APP_TOUR_ERROR_LOG_2026-03-28.md)
- [APP_TOUR_ADMIN_ACCESS_MAP_2026-03-28.md](./APP_TOUR_ADMIN_ACCESS_MAP_2026-03-28.md)

## Summary

- Full access routes: `24`
- Full access with partial feature-disabled module: `1`
- Rollout-gated routes: `11`
- Plan-gated routes: `0`
- Newly unlocked versus the STANDARD admin pass:
  - `/admin/audit-analytics`
  - `/admin/access-ops`

## Key Differences vs the STANDARD Admin Pass

- `Advanced Audit Analytics` is fully available for the add-ons admin.
- `Gate & Access Operations` is fully available for the add-ons admin.
- The rest of the previously blocked advanced pages are still blocked, but they are blocked by global rollout flags rather than by this tenant's plan entitlements.
- `Command Mode` still has the same partial disabled state for the permit board module.

## Operations

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin` -> `/admin/dashboard` | Full access | Same operator dashboard structure as the current-admin pass, now under `Plan Test Add-ons Ltd` | Alias resolves to dashboard |
| `/admin/sites` | Full access | Dense site table for `Add-ons Demo Site A/B` | Core route unchanged structurally |
| `/admin/pre-registrations` | Full access (empty state) | Invite creation and bulk upload with add-ons company site options | No gate visible |
| `/admin/deliveries` | Full access (empty state) | Delivery logging and empty queue/history state | No gate visible |
| `/admin/resources` | Full access (empty state) | Resource and booking surfaces | No gate visible |
| `/admin/live-register` | Full access | Control-room summary and live queue for add-ons tenant data | Core route unchanged structurally |
| `/admin/command-mode` | Full access (partial feature disabled) | Command surface plus disabled permit board alert | `CONTROL_ID: FLAG-ROLLOUT-001` still applies to permit board module |
| `/admin/history` | Full access | Same history route available for this tenant | Recheck contact rendering during dedicated fix pass; no new add-ons-specific break observed during this sweep |
| `/admin/audit-analytics` | Full access | Real analytics dashboard with totals, daily trend, top IPs, and top actions | Unlocked for add-ons admin |
| `/admin/exports` | Full access | Export action cards and export queue | No gate visible |

## Safety & Compliance

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/hazards` | Full access (empty state) | Hazard logging form and empty register | No gate visible |
| `/admin/incidents` | Full access (empty state) | Incident logging form and empty recent reports | No gate visible |
| `/admin/actions` | Full access (empty state) | Action stats, form, filters, empty register | No gate visible |
| `/admin/inspections` | Full access (empty state) | Inspection scheduling and run recording | No gate visible |
| `/admin/escalations` | Full access (empty state) | Pending escalations and recent decisions sections | No gate visible |
| `/admin/permits` | Rollout-gated | Permit-to-work page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/safety-forms` | Full access (empty state) | Safety template creation and submission recording | No gate visible |
| `/admin/approvals` | Rollout-gated | Approvals and identity page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/communications` | Rollout-gated | Communications hub page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |

## Contractors & Content

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/contractors` | Full access (empty state) | Contractor filters, stats, and add flow entry point | No gate visible |
| `/admin/templates` | Full access | Template management table with seeded induction template | No gate visible |
| `/admin/risk-passport` | Rollout-gated | Risk passport page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/competency` | Full access (empty state) | Competency requirement and certification management | No gate visible |
| `/admin/trust-graph` | Rollout-gated | Trust graph page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/benchmarks` | Rollout-gated | Predictive benchmarks page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |

## Integrations & Advanced

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/webhooks` | Full access (empty state) | Webhook delivery summary, filters, and empty results table | No gate visible |
| `/admin/integrations/channels` | Rollout-gated | Teams/Slack integrations page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/integrations/procore` | Rollout-gated | Procore connector page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/prequalification-exchange` | Rollout-gated | Prequalification exchange page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/mobile` | Rollout-gated | Mobile Operations page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/mobile/native` | Full access | Native runtime metadata and device/runtime requirements | Available under add-ons tenant as well |
| `/admin/access-ops` | Full access | Access decision trace, outage tracking, and site-scoped operations view | Unlocked for add-ons admin |
| `/admin/evidence` | Rollout-gated | Evidence packs page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/policy-simulator` | Rollout-gated | Policy simulator page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |

## Administration

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/users` | Full access | User table, filters, and add-user entry point | One seeded company admin visible |
| `/admin/audit-log` | Full access | Audit log table with filters and pagination | Real records visible |
| `/admin/settings` | Full access | Summary-first settings surface for add-ons tenant | Same route shape as current-admin pass |
| `/admin/plan-configurator` | Rollout-gated | Plan configurator page with disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` even though this tenant has the entitlement override |

## Interpretation

The add-ons admin is the broadest tenant-level access state we verified without changing environment flags. It proves the difference between:

- tenant entitlement / add-on enablement
- global rollout enablement

That distinction matters because some advanced routes are already tenant-enabled here, but they are still not reachable as working product surfaces until the matching global rollout flags are turned on.

## Recommended Next Pass for True Maximal Access

If we want to inspect the routes that are still blocked here, the next pass should use:

- admin: `admin.pro@inductlite.test`
- with local rollout flags enabled for:
  - `FF_PERMITS_V1`
  - `FF_ID_HARDENING_V1`
  - `FF_EMERGENCY_COMMS_V1`
  - `FF_TEAMS_SLACK_V1`
  - `FF_PWA_PUSH_V1`
  - `FF_EVIDENCE_TAMPER_V1`
  - `FF_POLICY_SIMULATOR_V1`
  - `FF_RISK_PASSPORT_V1`
  - `FF_SELF_SERVE_CONFIG_V1`

That would be the cleanest true "everything on" admin tour, because the remaining blocks are no longer mainly about plan access.
