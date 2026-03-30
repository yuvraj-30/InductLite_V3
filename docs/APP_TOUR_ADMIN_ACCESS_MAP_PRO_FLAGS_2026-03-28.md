# Admin Access Map (PRO Admin + Rollout Flags Tour - 2026-03-28)

Purpose: capture what the broadest seeded admin can actually see when both tenant entitlements and the currently relevant local rollout flags are enabled.

Current admin used for this pass:

- Company: `Plan Test Pro Ltd`
- User: `PRO Plan Admin`
- Email: `admin.pro@inductlite.test`
- Role: `ADMIN`
- Plan context: `PRO`

Local rollout state used for this pass:

- `FF_PERMITS_V1=true`
- `FF_ID_HARDENING_V1=true`
- `FF_EMERGENCY_COMMS_V1=true`
- `FF_TEAMS_SLACK_V1=true`
- `FF_PWA_PUSH_V1=true`
- `FF_EVIDENCE_TAMPER_V1=true`
- `FF_POLICY_SIMULATOR_V1=true`
- `FF_RISK_PASSPORT_V1=true`
- `FF_SELF_SERVE_CONFIG_V1=true`
- `FEATURE_NATIVE_MOBILE_RUNTIME=true`
- `FEATURE_ACCESS_CONNECTORS=true`
- `FEATURE_IDENTITY_OCR=true`

How to read this document:

- `Full access`: the route loaded normally for this admin
- `Full access (empty state)`: the route loaded normally, but the seeded tenant has little or no operating data in that module
- `Full access (seeded content)`: the route loaded normally and showed real seeded records, metrics, or interactive surfaces

Related documents:

- [APP_TOUR_ERROR_LOG_2026-03-28.md](./APP_TOUR_ERROR_LOG_2026-03-28.md)
- [APP_TOUR_ADMIN_ACCESS_MAP_2026-03-28.md](./APP_TOUR_ADMIN_ACCESS_MAP_2026-03-28.md)
- [APP_TOUR_ADMIN_ACCESS_MAP_ADDONS_2026-03-28.md](./APP_TOUR_ADMIN_ACCESS_MAP_ADDONS_2026-03-28.md)

## Summary

- Full access routes: `38`
- Rollout-gated routes: `0`
- Plan-gated routes: `0`
- Newly unlocked versus the earlier passes:
  - `/admin/permits`
  - `/admin/approvals`
  - `/admin/communications`
  - `/admin/risk-passport`
  - `/admin/trust-graph`
  - `/admin/benchmarks`
  - `/admin/integrations/channels`
  - `/admin/integrations/procore`
  - `/admin/prequalification-exchange`
  - `/admin/mobile`
  - `/admin/evidence`
  - `/admin/policy-simulator`
  - `/admin/plan-configurator`
- Important correctness caveat that still persists in this highest-access state:
  - `/admin/history` still renders raw `enc:v1:` ciphertext in visible visitor contact rows for some signed-out records

## Interpretation

This pass confirms that the remaining advanced routes were not missing because of tenant entitlement alone. They were primarily hidden behind rollout state in the earlier tours. With the relevant flags on and a PRO tenant active, every surfaced admin route opened as a real route rather than a gate screen.

That also means future defects found in these modules should be treated as product issues in live surfaces, not just hypothetical feature-flag work.

## Operations

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin` -> `/admin/dashboard` | Full access (seeded content) | Operator dashboard with summary KPIs, act-now queue, core health, operational signals, and lower disclosure sections | Alias resolves to dashboard |
| `/admin/sites` | Full access (seeded content) | Dense table-first site workspace with `Pro Demo Site A/B`, filters, counts, sticky header, and row actions | Strong desktop operator feel |
| `/admin/pre-registrations` | Full access (empty state) | Single invite creation, bulk CSV upload, and recent invites empty state | No gate visible |
| `/admin/deliveries` | Full access (empty state) | Delivery logging form, filters, and delivery queue surface | No access warning shown |
| `/admin/resources` | Full access | Resource creation, booking creation, active resources section, and compliance controls surface | Seeded data is light but module is fully open |
| `/admin/live-register` | Full access (seeded content) | Control-room summary, site scope combobox, attention queue, expanded site detail, and in-place refresh controls | No ciphertext seen here during this pass |
| `/admin/command-mode` | Full access (seeded content) | Command surface with live `Permit Board`, `Emergency Broadcast Composer`, `Overstay Alerts`, and `Evacuation Roll Call` sections | Previously partial-gated permit board is now visible |
| `/admin/history` | Full access (seeded content) | Filterable sign-in history table with summary cards and sign-out actions | High-severity ciphertext leak still present on some rows |
| `/admin/audit-analytics` | Full access (seeded content) | `Advanced Audit Analytics` dashboard with daily trend, top IPs, and top actions | Fully unlocked |
| `/admin/exports` | Full access (empty state) | Quick export actions, queue recovery tools, and empty exports state | No gate visible |

## Safety & Compliance

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/hazards` | Full access (empty state) | Hazard register with add-hazard form and empty register state | No gate visible |
| `/admin/incidents` | Full access (empty state) | Incident and near-miss register, incident logging form, and empty recent reports state | No gate visible |
| `/admin/actions` | Full access (empty state) | Action register, create-action form, filters, and empty action state | No gate visible |
| `/admin/inspections` | Full access (empty state) | Inspection schedule creation, inspection run recording, and empty schedules/runs sections | No gate visible |
| `/admin/escalations` | Full access (empty state) | Pending escalations and recent decisions sections | Module opens cleanly |
| `/admin/permits` | Full access | `Permit-to-Work` workspace with template creation, permit request entry, lifecycle section, and contractor prequalification hooks | Previously rollout-gated |
| `/admin/safety-forms` | Full access (empty state) | Default form pack install, custom template creation, submission recording, and templates/submissions sections | No gate visible |
| `/admin/approvals` | Full access | `Approval Queue & Identity Hardening` with visitor approval policy, pending queue, watchlist, identity verification records, and active policies | Previously rollout-gated |
| `/admin/communications` | Full access | `Unified Communications Hub` with emergency broadcast composer, broadcast timeline, and communication events | Previously rollout-gated |

## Contractors & Content

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/contractors` | Full access (empty state) | Contractor filters, list shell, and empty contractor state | No gate visible |
| `/admin/templates` | Full access (seeded content) | Induction template management table with real seeded template content | No gate visible |
| `/admin/risk-passport` | Full access | `Contractor Risk Passport` with score refresh, site risk trend, and current risk score surfaces | Previously rollout-gated |
| `/admin/competency` | Full access (empty state) | Requirement creation, worker certification entry, and competency matrix sections | No gate visible |
| `/admin/trust-graph` | Full access | `Contractor Trust Graph` route with scope and trust node surfaces | Previously rollout-gated |
| `/admin/benchmarks` | Full access | `Predictive Benchmarks` with explainability and AI adoption surfaces | Previously rollout-gated |

## Integrations & Advanced

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/webhooks` | Full access (empty state) | Webhook delivery summary, filters, and delivery table shell | No gate visible |
| `/admin/integrations/channels` | Full access | `Teams/Slack Integrations` with integration form, configured integrations, and delivery diagnostics | Previously rollout-gated |
| `/admin/integrations/procore` | Full access | `Procore Connector` with connector configuration, outbound sync queue, and sync activity | Previously rollout-gated |
| `/admin/prequalification-exchange` | Full access | Prequalification exchange with import snapshot workflow and recent imports section | Previously rollout-gated |
| `/admin/mobile` | Full access | `Mobile & Presence Operations` with auto check-out assist, open hints, admin test subscription registration, secure enrollment, and device subscriptions | Previously rollout-gated |
| `/admin/mobile/native` | Full access | Native runtime metadata, distribution metadata, and device runtime requirements | Already open in earlier passes too |
| `/admin/access-ops` | Full access | `Gate & Access Operations` with access decision trace and hardware outage events | Available with full access state |
| `/admin/evidence` | Full access (empty state) | Tamper-evident evidence packs, external verification API section, manifests, and empty evidence state | Previously rollout-gated |
| `/admin/policy-simulator` | Full access (empty state) | Safety policy simulator with scenario creation, scenario list, and recent runs sections | Previously rollout-gated |

## Administration

| Route | Access | What this admin sees | Notes |
| --- | --- | --- | --- |
| `/admin/users` | Full access (seeded content) | User table, filters, and add-user entry point with the seeded PRO company admin visible | No gate visible |
| `/admin/audit-log` | Full access (seeded content) | Audit log table, filters, and pagination with real seeded records | No gate visible |
| `/admin/settings` | Full access (seeded content) | Summary-first settings route with compliance, identity, and billing/accounting sections | Billing sticky behavior issue remains separately logged |
| `/admin/plan-configurator` | Full access | `Self-Serve Plan Configurator` with plan snapshot, tier matrix, schedule change request, and history sections | Previously rollout-gated |

## Key Differences vs the Earlier Tours

- The STANDARD admin pass proved the baseline operator routes and showed which advanced areas were blocked by plan or rollout.
- The add-ons admin pass proved that some advanced capabilities were tenant-enabled but still hidden by rollout state.
- This PRO + flags pass proves the entire surfaced admin tree can load as working product UI when both entitlement and rollout state are satisfied.

## Recommended Next Follow-Up

The next valuable pass is no longer another access tour. It is a focused bug-fix pass against the issues now confirmed in live routes, especially:

- `/admin/history` ciphertext rendering
- cross-route span/badge/chip responsive audit
- settings billing sticky behavior

Those are now the higher-leverage items than more entitlement verification.
