# UI/UX Heuristic Audit (Top 20 Routes)

- Date: 2026-03-10
- Ticket: `UX26-S0-002`
- Scope baseline: `apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z`
- Scope follow-up: `apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z`

## Method

Routes were ranked using:

1. User/task criticality (login, occupancy, compliance workflows).
2. Friction severity (`Critical`, `High`, `Medium`, `Low`).
3. Delivery effort (`S`, `M`, `L`) to inform sprint sequencing.

## Top-20 Route Findings

| Rank | Route | Primary friction | Severity | Effort | Before | After |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/login` | Password and SSO paths compete on first view; high decision friction. | Critical | S | [007](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/007-login-admin_standard_inductlite_test.png) | [007](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/007-login-admin_standard_inductlite_test.png) |
| 2 | `/admin/live-register` | Mobile scan density and filter discoverability are weak for urgent actions. | Critical | M | [013](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/013-standard-_admin_live-register.png) | [013](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/013-standard-_admin_live-register.png) |
| 3 | `/admin/sites` | Status/action hierarchy is not scannable enough on small screens. | High | M | [009](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/009-standard-_admin_sites.png) | [009](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/009-standard-_admin_sites.png) |
| 4 | `/admin/dashboard` | Above-the-fold hierarchy lacks consistent task-first structure. | High | M | [008](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/008-standard-_admin_dashboard.png) | [008](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/008-standard-_admin_dashboard.png) |
| 5 | `/admin/sites/new` | Form sequence is long and lacks progressive disclosure by task intent. | High | M | [010](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/010-standard-_admin_sites_new.png) | [010](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/010-standard-_admin_sites_new.png) |
| 6 | `/admin/templates` | Table/cards compete with controls, raising cognitive load for common actions. | High | M | [011](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/011-standard-_admin_templates.png) | [011](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/011-standard-_admin_templates.png) |
| 7 | `/admin/templates/new` | Creation flow lacks clear step grouping and validation pacing. | High | M | [012](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/012-standard-_admin_templates_new.png) | [012](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/012-standard-_admin_templates_new.png) |
| 8 | `/admin/history` | Filter/sort controls are not prominent enough for quick incident lookup. | High | S | [014](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/014-standard-_admin_history.png) | [014](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/014-standard-_admin_history.png) |
| 9 | `/admin/exports` | Queue state and next actions are not unified into deterministic state blocks. | High | S | [015](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/015-standard-_admin_exports.png) | [015](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/015-standard-_admin_exports.png) |
| 10 | `/admin/audit-log` | Dense metadata and controls make filtering/compliance checks slower than target. | Medium | M | [016](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/016-standard-_admin_audit-log.png) | [016](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/016-standard-_admin_audit-log.png) |
| 11 | `/admin/users` | High-volume user list lacks clear priority grouping for frequent tasks. | Medium | M | [017](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/017-standard-_admin_users.png) | [017](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/017-standard-_admin_users.png) |
| 12 | `/admin/users/new` | Validation and field grouping can better support fast admin onboarding. | Medium | S | [018](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/018-standard-_admin_users_new.png) | [018](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/018-standard-_admin_users_new.png) |
| 13 | `/admin/contractors` | Identity/status/action density creates scan burden on busy rosters. | Medium | M | [019](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/019-standard-_admin_contractors.png) | [019](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/019-standard-_admin_contractors.png) |
| 14 | `/admin/pre-registrations` | Invite management needs clearer state and expiry hierarchy. | Medium | S | [020](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/020-standard-_admin_pre-registrations.png) | [020](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/020-standard-_admin_pre-registrations.png) |
| 15 | `/admin/hazards` | Drafting and triage actions are not strongly separated by urgency. | Medium | M | [021](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/021-standard-_admin_hazards.png) | [021](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/021-standard-_admin_hazards.png) |
| 16 | `/admin/incidents` | Dense record cards reduce first-pass comprehension of critical incidents. | Medium | M | [022](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/022-standard-_admin_incidents.png) | [022](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/022-standard-_admin_incidents.png) |
| 17 | `/admin/settings` | Sections are broad; navigation and save scope can be clearer. | Medium | M | [023](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/023-standard-_admin_settings.png) | [023](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/023-standard-_admin_settings.png) |
| 18 | `/admin/plan-configurator` | Denial state messaging does not clearly map entitlement next steps. | Medium | S | [024](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/024-standard-denied-_admin_plan-configurator.png) | [024](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/024-standard-denied-_admin_plan-configurator.png) |
| 19 | `/admin/policy-simulator` | Denial and unlock pathways need stronger contextual guidance. | Medium | S | [025](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/025-standard-denied-_admin_policy-simulator.png) | [025](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/025-standard-denied-_admin_policy-simulator.png) |
| 20 | `/admin/risk-passport` | Gated state is technically correct but low on conversion guidance. | Medium | S | [026](../apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/026-standard-denied-_admin_risk-passport.png) | [026](../apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/026-standard-denied-_admin_risk-passport.png) |

## Ranked Friction Backlog (Impact x Effort)

1. Login intent split (`UX26-S2-001`) to remove early auth decision overload.
2. Mobile-first live register shell (`UX26-S3-003`) for high-speed occupancy actions.
3. Sites page mobile card workflow (`UX26-S3-002`) for faster state + action scanning.
4. Shared loading/empty/error primitives (`UX26-S2-002`) across async admin pages.
5. Page hierarchy standardization (`UX26-S1-003`) on dashboard, sites, and live register.

## Verification

1. `npm run -w apps/web test:visual`
2. Manual evidence comparison:
`apps/web/manual-evidence/checklist-visual-2026-03-08T13-30-47-065Z/screenshots/` vs `apps/web/manual-evidence/checklist-visual-2026-03-08T14-12-10-161Z/screenshots/`
