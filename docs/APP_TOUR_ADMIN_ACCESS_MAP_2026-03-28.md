# Admin Access Map (Current Admin Tour - 2026-03-28)

Purpose: capture what the current signed-in admin can actually see on every surfaced admin route, including full-access pages, clean empty states, rollout-gated experiences, and plan-gated experiences.

Current admin used for this pass:

- Company: `Plan Test Standard Ltd`
- User: `STANDARD Plan Admin`
- Email: `admin.standard@inductlite.test`
- Role: `ADMIN`
- Plan context: `STANDARD`

How to read this document:

- `Full access`: the route loaded normally for this admin
- `Full access (empty state)`: the route loaded normally, but seeded data is empty
- `Full access (partial feature disabled)`: the route is available, but one module inside it is clearly disabled
- `Rollout-gated`: the route loads a clean feature-disabled message with a rollout control id
- `Plan-gated`: the route loads a clean entitlement message with a plan control id

Related defect log:

- [APP_TOUR_ERROR_LOG_2026-03-28.md](./APP_TOUR_ERROR_LOG_2026-03-28.md)

## Summary

- Full access routes: `22`
- Full access with partial feature-disabled module: `1`
- Rollout-gated routes: `11`
- Plan-gated routes: `2`
- Highest-priority defect discovered during this pass:
  - `/admin/history` still leaks raw `enc:v1:` contact ciphertext in visible rows

## Operations

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/dashboard` | Full access | Operator dashboard with summary KPIs, act-now section, core health, and lower disclosure sections | Responsive span/badge polish issue logged separately |
| `/admin/sites` | Full access | Dense table-first site workspace with filters, counts, sticky header, and row actions | Looks operator-grade on desktop |
| `/admin/pre-registrations` | Full access (empty state) | Single invite form, bulk CSV upload, and recent invites empty state for the selected site | No access warning shown |
| `/admin/deliveries` | Full access (empty state) | Delivery logging form, filters, and empty queue/history state | No gate visible |
| `/admin/resources` | Full access (empty state) | Resource creation, booking form, and empty resources/bookings/inspections sections | No gate visible |
| `/admin/live-register` | Full access | Control-room summary, attention queue, scoped filter, and expanded site detail | Responsive badge issue logged separately |
| `/admin/command-mode` | Full access (partial feature disabled) | Live command surface plus alert that permit board is unavailable | `CONTROL_ID: FLAG-ROLLOUT-001` applies to permit workflows inside the route |
| `/admin/history` | Full access | Paginated sign-in history table with filters and audit-style summary cards | High-severity ciphertext leak logged in the error log |
| `/admin/audit-analytics` | Plan-gated | Analytics page with plan upsell/entitlement messaging | `CONTROL_ID: PLAN-ENTITLEMENT-001` |
| `/admin/exports` | Full access (empty state) | Export action cards and empty exports list | No permission block |

## Safety & Compliance

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/hazards` | Full access (empty state) | Hazard logging form and empty hazard register | No gate visible |
| `/admin/incidents` | Full access (empty state) | Incident logging form and empty recent reports | No gate visible |
| `/admin/actions` | Full access (empty state) | Action stats, create-action form, filters, and empty state | No gate visible |
| `/admin/inspections` | Full access (empty state) | Schedule creation, inspection run recording, and empty schedules/runs sections | No gate visible |
| `/admin/escalations` | Full access (empty state) | Pending escalations and recent decisions sections, both empty in seeded data | No gate visible |
| `/admin/permits` | Rollout-gated | Permit-to-work page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/safety-forms` | Full access (empty state) | Install defaults, create template, record submission, plus empty templates/submissions sections | No gate visible |
| `/admin/approvals` | Rollout-gated | Approvals and identity page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/communications` | Rollout-gated | Communications hub page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |

## Contractors & Content

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/contractors` | Full access (empty state) | Contractor filters, metrics, add flow entry point, and empty contractor list | No gate visible |
| `/admin/templates` | Full access | Template table with seeded induction template plus version/archive actions | Existing seeded content visible |
| `/admin/risk-passport` | Rollout-gated | Risk passport page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/competency` | Full access (empty state) | Requirement creation, worker certification entry, and empty requirements/certifications sections | No gate visible |
| `/admin/trust-graph` | Rollout-gated | Trust graph page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/benchmarks` | Rollout-gated | Predictive benchmarks page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |

## Integrations & Advanced

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/webhooks` | Full access (empty state) | Webhook delivery summary, filters, and empty delivery table | No gate visible |
| `/admin/integrations/channels` | Rollout-gated | Teams/Slack integrations page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/integrations/procore` | Rollout-gated | Procore connector page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/prequalification-exchange` | Rollout-gated | Prequalification exchange page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/mobile` | Rollout-gated | Mobile Operations page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/mobile/native` | Full access | Native runtime metadata and runtime requirements reference content | Reads like an operator/reference page |
| `/admin/access-ops` | Plan-gated | Gate and access operations page with entitlement message | `CONTROL_ID: PLAN-ENTITLEMENT-001` |
| `/admin/evidence` | Rollout-gated | Evidence packs page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |
| `/admin/policy-simulator` | Rollout-gated | Policy simulator page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |

## Administration

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/users` | Full access | User table, filters, add-user entry point, and current admin row | One user in seeded company |
| `/admin/audit-log` | Full access | Audit table, filters, and pagination with real seeded records | No gate visible |
| `/admin/settings` | Full access | Summary-first settings surface with compliance, identity, and billing sections | Sticky billing sidebar issue logged separately |
| `/admin/plan-configurator` | Rollout-gated | Plan configurator page with clean disabled message | `CONTROL_ID: FLAG-ROLLOUT-001` |

## Cross-Route Notes

- The app is generally returning clear, intentional access states for gated features. Most advanced routes do not look broken; they show explicit disabled or entitlement messaging with control ids.
- The main functional/correctness issue found during this pass is not a gate issue. It is the history route rendering raw encrypted contact values.
- Several admin routes still need a shared responsive audit for span/badge/chip elements around tablet widths. That follow-up is tracked in the error log, not here.

## Suggested Full-Access Follow-Up

For the next pass, repeat this same route sweep with the broadest seeded admin account available so we can compare:

- which rollout-gated routes become available
- which plan-gated routes become available
- whether any currently hidden advanced modules have their own defects once enabled

Likely candidate accounts to try next:

- `admin.pro@inductlite.test`
- `admin.addons@inductlite.test`
