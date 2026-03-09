# Manual Feature Validation Checklist (One-Pass)

Use this checklist against local production mode at `http://localhost:3000`.

## Automated Visual Runner (Playwright)

Run this to execute the checklist flow in a visible Chromium browser (headed mode):

```bash
node tools/checklist-visual-verify.mjs --slowmo=90
```

Optional flags:

- `--headless` (run without visible browser)
- `--slowmo=120` (change click/type pacing)
- `--keep-open` (keep browser open after run)

Evidence output:

- `apps/web/manual-evidence/checklist-visual-<timestamp>/results.json`
- `apps/web/manual-evidence/checklist-visual-<timestamp>/screenshots/*.png`

## 1) Preconditions

- [ ] Server is running in production mode on port 3000.
- [ ] `GET /api/ready` returns `{"ready":true,...}`.
- [ ] DB is migrated and seeded (`npm run -w apps/web db:migrate` and `npm run -w apps/web db:seed`).
- [ ] `FF_SELF_SERVE_CONFIG_V1=true` and other rollout flags are enabled for local manual testing.

## 2) Test Accounts

Password for all accounts: value of `ADMIN_PASSWORD` (default `Admin123!` if unset).

- [ ] `admin.standard@inductlite.test` (STANDARD)
- [ ] `admin.plus@inductlite.test` (PLUS)
- [ ] `admin.pro@inductlite.test` (PRO)
- [ ] `admin.addons@inductlite.test` (STANDARD + add-on feature overrides)

## 3) Public/Marketing Smoke

- [ ] Open `/` and confirm homepage loads without console errors.
- [ ] Click to `/pricing` and confirm Standard/Plus/Pro and add-ons are visible.
- [ ] Click to `/demo`, submit a demo request, confirm success message.
- [ ] Open `/compare` and confirm competitor comparison content renders.
- [ ] Open `/terms` and `/privacy`.

## 4) STANDARD Account Pass

Login as `admin.standard@inductlite.test`.

### 4.1 Core Admin Navigation

- [ ] `/admin/dashboard` loads KPIs/cards.
- [ ] `Sites` -> `/admin/sites` loads.
- [ ] `Sites` -> `Create` -> `/admin/sites/new` opens and can save.
- [ ] Open one site detail `/admin/sites/[id]`.
- [ ] Open site `Access` tab `/admin/sites/[id]/access`.
- [ ] Open `Templates` -> `/admin/templates` and `New Template`.
- [ ] Open `Live Register` -> `/admin/live-register`.
- [ ] Open `History` -> `/admin/history` and apply filters.
- [ ] Open `Exports` -> `/admin/exports` and queue one export.
- [ ] Open `Audit Log` -> `/admin/audit-log`.
- [ ] Open `Users` -> `/admin/users` and `New User`.
- [ ] Open `Contractors` -> `/admin/contractors` and contractor detail.
- [ ] Open `Pre-Registrations` -> `/admin/pre-registrations`.
- [ ] Open `Hazards` -> `/admin/hazards`.
- [ ] Open `Incidents` -> `/admin/incidents`.
- [ ] Open `Settings` -> `/admin/settings`.

### 4.2 Expected Entitlement Denials (STANDARD)

- [ ] `/admin/plan-configurator` shows entitlement-denied message.
- [ ] `/admin/policy-simulator` denied.
- [ ] `/admin/risk-passport` denied.
- [ ] `/admin/trust-graph` denied.
- [ ] `/admin/benchmarks` denied.
- [ ] `/admin/integrations/procore` denied.
- [ ] `/admin/access-ops` denied.

Logout.

## 5) PLUS Account Pass

Login as `admin.plus@inductlite.test`.

### 5.1 PLUS Features That Must Work

- [ ] `/admin/policy-simulator` loads and can run a simulation.
- [ ] `/admin/risk-passport` loads and can refresh profile/risk data.
- [ ] `/admin/communications` loads and can draft a broadcast.
- [ ] `/admin/evidence` loads and can verify a pack/check.
- [ ] `/admin/mobile` loads push/presence controls.
- [ ] `/admin/mobile/native` loads native runtime metadata page.
- [ ] `/admin/access-ops` loads gateway trace/access operations.

### 5.2 Expected Denials (PLUS vs PRO-only)

- [ ] `/admin/plan-configurator` denied.
- [ ] `/admin/benchmarks` denied.
- [ ] `/admin/audit-analytics` denied.
- [ ] `/admin/integrations/procore` denied.
- [ ] `/admin/prequalification-exchange` denied.

Logout.

## 6) PRO Account Pass

Login as `admin.pro@inductlite.test`.

### 6.1 PRO Features That Must Work

- [ ] `/admin/plan-configurator` loads current plan + invoice preview.
- [ ] In `/admin/plan-configurator`, create a scheduled plan change and confirm it appears in history.
- [ ] `/admin/audit-analytics` loads advanced analytics.
- [ ] `/admin/benchmarks` loads predictive benchmark page.
- [ ] `/admin/trust-graph` loads trust graph insights.
- [ ] `/admin/integrations/procore` loads connector config.
- [ ] `/admin/prequalification-exchange` loads exchange UI.

### 6.2 Site-Level PRO Checks

- [ ] Open `/admin/sites/[pro-site-id]/lms` and confirm LMS settings page loads.
- [ ] Open `/admin/sites/[pro-site-id]/webhooks` and save a test webhook config.
- [ ] Open `/admin/sites/[pro-site-id]/access` and confirm access settings can be changed.

Logout.

## 7) Add-ons Account Pass

Login as `admin.addons@inductlite.test`.

### 7.1 Add-on Enabled Site (A)

- [ ] Open Add-ons Site A detail (`/admin/sites/[id]` for `Add-ons Demo Site A`).
- [ ] Open `/admin/sites/[id]/access` and confirm these sections are active:
- [ ] Hardware access controls.
- [ ] Geofence enforcement controls.
- [ ] OCR/identity verification controls.
- [ ] Access connector provider controls.
- [ ] Open `/admin/access-ops` and confirm access trace/actions work.

### 7.2 Add-on Site Override (B)

- [ ] Open `Add-ons Demo Site B` -> `/admin/sites/[id]/access`.
- [ ] Confirm site-level overrides disable at least:
- [ ] `HARDWARE_ACCESS`
- [ ] `GEOFENCE_ENFORCEMENT`
- [ ] `ID_OCR_VERIFICATION_V1`
- [ ] Confirm disabled controls show denial/disabled state, not server error.

Logout.

## 8) Public Sign-in/Induction Flow (Browser)

Use one slug from each plan set:

- STANDARD: `/s/plan-standard-site-a`
- PLUS: `/s/plan-plus-site-a`
- PRO: `/s/plan-pro-site-a`
- ADD-ONS: `/s/plan-addons-site-a`

For each slug:

- [ ] Open public page and verify branding/content blocks load.
- [ ] Complete sign-in form with valid fields.
- [ ] Complete induction questions and submit.
- [ ] Confirm success screen.
- [ ] Use `/sign-out` flow for created sign-in if available.
- [ ] Confirm record appears in admin `Live Register` / `History`.

## 9) API/Operational Smoke

- [ ] `GET /api/ready` returns 200.
- [ ] `GET /health` returns healthy response.
- [ ] No uncaught errors in local server log.

## 10) Console and Error Review

- [ ] During all page checks, browser console has no blocking errors.
- [ ] `apps/web/.prod-3000.err.log` has no runtime crash stack after test pass.
- [ ] Any entitlement denial seen is expected for that plan and not a defect.

## 11) Pass Criteria

- [ ] All core pages render.
- [ ] Plan gates match expected Standard/Plus/Pro/add-on behavior.
- [ ] Public sign-in and induction work end-to-end.
- [ ] No blocking console/runtime errors.
