# PRODUCT_CRITIQUE

Date: 2026-02-19  
Lens: Senior PM + UX Strategy (user value, not code quality)

Scope reviewed:
- `apps/web/src/app/(auth)`
- `apps/web/src/app/admin`
- `apps/web/src/app/s/[slug]`
- `apps/web/src/components`
- `apps/web/prisma/schema.prisma`

## 1. The "Friction" Scorecard (0-10)

- **Onboarding Speed:** **4/10**
  - Site creation itself is lightweight (only name is required), but first value is blocked by missing self-serve sign-up and a hidden template publishing dependency before public induction actually works.
- **Mobile Usability:** **4/10**
  - The field flow is multi-step, uses small controls in key places, requires signature + terms + required questions, and lacks in-flow offline recovery/autosave.
- **Visual Clarity:** **5/10**
  - UI is clean but not field-optimized: lots of `text-sm`/gray text, dense tables for operational views, and weak first-run guidance.

## 2. The "User Pain" List

- **Pain Point:** No clear self-serve buyer registration flow; auth is effectively login-only.
  - **Impact:** New foreman cannot get to value without external provisioning/support; high first-session abandonment.
  - **PM Recommendation:** Add a 3-step self-serve onboarding: company name, admin user, first site.

- **Pain Point:** Time-to-value is hidden behind template setup/publish after site creation.
  - **Impact:** Foreman creates a site, scans QR, then hits "no active template" style failure. Feels broken.
  - **PM Recommendation:** Auto-provision a default published induction template per new company/site and guide edits later.

- **Pain Point:** Dashboard is metrics-first, not activation-first for new accounts.
  - **Impact:** First login shows zero cards, but no setup checklist. Users must guess next steps.
  - **PM Recommendation:** Add a persistent "Get Started" checklist: Create Site -> Publish Template -> Test QR -> First Sign-In.

- **Pain Point:** Worker flow requires too much effort before value (details + induction + signature).
  - **Impact:** Hard to complete in under 2 minutes for impatient, on-site mobile users.
  - **PM Recommendation:** Add "Express Induction" mode: minimum required fields first, optional fields post sign-in.

- **Pain Point:** Required induction validation is late (errors can appear only at final sign-off).
  - **Impact:** Worker signs, then gets bounced back to fix missed answers. High frustration.
  - **PM Recommendation:** Validate required answers inline per question and gate "Continue" before signature.

- **Pain Point:** Thumb-target quality is inconsistent for gloves/dirty hands.
  - **Impact:** Small radios/checkboxes increase input errors and retry taps.
  - **PM Recommendation:** Enforce 44px minimum touch targets and larger tap zones for all public flow controls.

- **Pain Point:** No durable progress state in the mobile induction flow.
  - **Impact:** If network/browser resets, user re-enters everything. Field drop-off risk is high.
  - **PM Recommendation:** Autosave draft locally (name/phone/answers/signature state) with resume on reload.

- **Pain Point:** Offline handling is route-level, not task-level.
  - **Impact:** There is an offline page, but in-form submission loss has no resilient queue/retry UX.
  - **PM Recommendation:** Add offline submission queue with explicit states: "Saved locally", "Pending sync", "Synced".

- **Pain Point:** Live Register lacks immediate risk visibility depth.
  - **Impact:** Foreman can see who is on site, but not true urgency signals (e.g., overstay timer/status prominence).
  - **PM Recommendation:** Promote status and elapsed-time badges as primary signals; add stale-data timestamp + auto-refresh.

- **Pain Point:** Exports are not "auditor-instant."
  - **Impact:** Current flow is queue-first and CSV-first; no obvious one-click PDF compliance pack from admin UI.
  - **PM Recommendation:** Add preset "Audit Pack PDF" button (Last 24h, Last 7d, Date range) with progress + ready notification.

- **Pain Point:** Export UX feedback is weak when queueing fails/limits hit.
  - **Impact:** User may click and see no clear outcome; trust drops.
  - **PM Recommendation:** Show immediate inline toast/status for queued, blocked-by-limit, failed, and completed states.

## 3. The "Wow" Feature Opportunities

- **Foreman Command Mode (TV Dashboard)**
  - A single high-contrast screen with live on-site count, overdue presence alerts, and one-tap evacuation roll call.

- **90-Second Worker Fast Pass**
  - "Use last visit details" + large-button induction + auto-signature reuse consent for repeat contractors.

- **One-Tap Compliance Pack**
  - Generate an auditor-ready bundle (PDF summary + CSV detail + signed acknowledgments) from one button with preset date windows.
