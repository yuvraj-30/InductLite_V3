# Manual Click Audit

Date: 2026-03-16

Environment:
- Local dev server at `http://127.0.0.1:3000`
- Authenticated tenant: `manual-audit`
- Authenticated admin user: `manual.audit.admin@inductlite.test`

Scope:
- Broad manual click sweep across the admin UI, shared chrome, and public sign-in flow.
- Route-load verification across the current admin navigation surface and linked feature pages.
- Page-level interaction checks for key CRUD and operational actions, not just recently changed surfaces.

Out of scope / tool-limited:
- Browser-native print dialogs and clipboard contents were not fully assertable via Playwright, although related buttons were reached where possible.
- `Sign Out` was intentionally not exercised to avoid discarding the authenticated audit session.
- The pass covered the currently reachable app state for the seeded tenant; it does not prove every destructive branch in every empty/non-empty data permutation.

## Coverage Summary

Verified working routes:
- `/admin`
- `/admin/dashboard`
- `/admin/sites`
- `/admin/sites/new`
- `/admin/sites/[id]`
- `/admin/sites/[id]/access`
- `/admin/sites/[id]/lms`
- `/admin/sites/[id]/webhooks`
- `/admin/sites/[id]/emergency`
- `/admin/pre-registrations`
- `/admin/deliveries`
- `/admin/resources`
- `/admin/live-register`
- `/admin/command-mode`
- `/admin/history`
- `/admin/audit-analytics`
- `/admin/exports`
- `/admin/hazards`
- `/admin/incidents`
- `/admin/escalations`
- `/admin/permits`
- `/admin/safety-forms`
- `/admin/approvals`
- `/admin/communications`
- `/admin/contractors`
- `/admin/templates`
- `/admin/risk-passport`
- `/admin/trust-graph`
- `/admin/benchmarks`
- `/admin/prequalification-exchange`
- `/admin/mobile`
- `/admin/access-ops`
- `/admin/evidence`
- `/admin/policy-simulator`
- `/admin/users`
- `/admin/users/new`
- `/admin/users/[id]`
- `/admin/audit-log`
- `/admin/settings`
- `/admin/plan-configurator`
- `/change-password`
- `/s/MFDLpmSdgXpZhjaLaxXmzA`

Broken routes discovered during click sweep:
- `/admin/integrations/channels`
- `/admin/integrations/procore`
- `/admin/mobile/native`
- `/admin/contractors/new`
- `/admin/templates/new`

## Page-Level Actions Exercised

Shared chrome:
- Theme mode buttons: `Auto`, `Light`, `Dark`
- Header `Password` route
- Command palette open/close
- Sidebar section toggles for collapsed groups

Sites and public sign-in:
- Created a site
- Opened site detail page
- Opened and closed QR/poster modal
- Loaded public sign-in page and advanced into induction flow

Users:
- Created a user
- Filtered users
- Reset filters
- Opened edit routes
- Opened deactivate confirmation and cancelled

Pre-registrations:
- Created single invite
- Created CSV invite batch
- Used invite copy action
- Opened deactivate confirmation and cancelled

Deliveries:
- Logged a delivery
- Added a delivery note
- Marked delivery collected

Resources:
- Created a resource
- Created a booking
- Cancelled a booking

Exports:
- Queued sign-in CSV
- Confirmed other export actions render disabled when prerequisites are missing

Settings:
- Saved SSO settings
- Rotated directory sync key
- Rotated partner API key
- Saved compliance settings earlier in the same audit session

Live Register:
- Toggled auto-refresh pause/resume state
- Used site filter

Command Mode:
- Attempted emergency broadcast send
- Observed command mode refresh controls and open-live-register navigation

## Data Created During Audit

- Company/tenant: `manual-audit`
- Site: `Manual Audit Site`
- Site id: `cmmssgi1w0007v0u8zvx4k360`
- Public slug used for sign-in verification: `MFDLpmSdgXpZhjaLaxXmzA`
- Extra user: `manual.audit.user+1@inductlite.test`
- Single invite: `Manual Invite Visitor`
- CSV invite row: `CSV Visitor`
- Delivery reference: `DLV-AUDIT-001`
- Resource: `Manual Audit Room`
- Booking: `Manual Audit Meeting`

## Findings

### High

1. Sidebar group toggles can crash the entire admin app.
   - Reproduced by clicking collapsed admin nav sections like `Safety & Compliance`.
   - Result: global error screen with `Cannot read properties of null (reading 'open')`.
   - User impact: a single sidebar click can take the current page into the global error boundary.

2. Multiple linked admin routes are hard 404s.
   - Broken during direct route loads or direct clicks:
   - `/admin/integrations/channels`
   - `/admin/integrations/procore`
   - `/admin/mobile/native`
   - `/admin/contractors/new`
   - `/admin/templates/new`
   - User impact: visible feature entry points lead to dead ends.

### Medium

1. `Send Broadcast` in Command Mode gives no visible success, empty-recipient, or failure feedback.
   - Reproduced on `/admin/command-mode` with a populated message.
   - Observed behavior: the message field cleared after click, but no success banner, recipient count, or empty-state explanation appeared.
   - User impact: the operator cannot tell whether the action succeeded, failed, or was ignored because no one was on site.

2. Copy actions do not show clear visible confirmation in the audited session.
   - Observed on pre-registration invite copy actions.
   - User impact: low, but users may not know whether the link actually copied.

### Low

1. Browser autofill/autocomplete warnings are present on settings and password pages.
   - `/admin/settings`: missing autocomplete guidance on some inputs.
   - `/change-password`: password-form autocomplete warning in the browser console.
   - User impact: mostly polish and browser UX quality.

2. Command palette backdrop dismissal is less reliable than keyboard dismissal in automation.
   - Escape close worked reliably.
   - Earlier backdrop-click attempts were intercepted by dialog content.
   - User impact: probably low, but worth hardening if outside-click close is intended behavior.

## Expected or Non-Bug States Observed

- `/admin/plan-configurator` is present but intentionally disabled by rollout flag.
- Permit board area in Command Mode is intentionally disabled by rollout flag.
- `Sync Billing Preview` is disabled when no accounting endpoint is configured.
- Most export pack buttons were disabled in the current empty-data state; only sign-in CSV was enabled and queued.

## Recommended Follow-Up Order

1. Fix the `AdminNav` section-toggle crash first.
2. Repair or remove the broken linked routes:
   - integrations channels
   - integrations procore
   - mobile native
   - contractors new
   - templates new
3. Add explicit success/empty-state feedback for Command Mode broadcast sends.
4. Add autocomplete attributes and tighten minor interaction feedback on copy actions and modal dismissal.
