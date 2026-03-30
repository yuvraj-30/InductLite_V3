# App Tour Error Log (2026-03-28)

Purpose: capture every real error or correctness issue we discover while manually touring the app route by route, so we can fix them in one focused pass afterward.

Scope of this log:

- visible UI errors
- console/runtime errors
- hydration errors
- broken interactions
- clearly wrong data presentation
- route-specific correctness issues discovered during the walkthrough

Out of scope for this log unless they surface during the walkthrough:

- broad release/readiness findings
- backend-only concerns with no visible app impact
- hypothetical issues not observed during the tour

## Status Summary

- Open findings: `0`
- Closed findings: `13`
- Last updated: `2026-03-28`

## Cross-Route Follow-Up

- Do a dedicated responsive audit of span-based badge/chip/status treatments across every major route, not just the pages where the problem was first noticed during the tour.
- Check all reused `span`-driven UI elements at:
  - full desktop
  - laptop / tablet widths around `768px` to `900px`
  - mobile widths
- Pay special attention to:
  - `StatusBadge`
  - KPI/card pills
  - queue/detail badges
  - shell/header labels
  - any uppercase compact pills that can wrap into tall multi-line elements
- Goal:
  - catch the same cramped / wrapping / visually awkward span issue everywhere it appears, not route-by-route after release.

---

## Finding 001 - Public sign-in footer causes invalid HTML nesting and hydration failure

- Status: `closed`
- Severity: `High`
- Route: `/s/plan-standard-site-a`
- Route family: `public sign-in flow`
- First observed: `2026-03-28`

### What we saw

The public sign-in route loads and appears usable, but the page throws real React hydration errors in the browser console.

The key console messages were:

- `In HTML, <div> cannot be a descendant of <p>. This will cause a hydration error.`
- `<p> cannot contain a nested <div>.`
- `Hydration failed because the server rendered HTML didn't match the client.`

### Why this is happening

The footer in the public sign-in shell renders a `<p>` wrapper and places `ThemeSwitcher` inside it.

`ThemeSwitcher` renders a root `<div>` when `showLabel={false}`.

That produces invalid HTML:

- parent: `<p>`
- child: `<div>`

React then detects the mismatch during hydration and regenerates that subtree on the client.

### Exact evidence

Relevant source:

- [public-shell.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\components\ui\public-shell.tsx)
- [theme-switcher.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\components\ui\theme-switcher.tsx)

Relevant code shape:

- `apps/web/src/components/ui/public-shell.tsx`
  - footer uses a `<p className="flex ...">`
  - that same `<p>` contains `<ThemeSwitcher showLabel={false} ... />`
- `apps/web/src/components/ui/theme-switcher.tsx`
  - when `showLabel={false}`, the component returns a root `<div>`

Observed runtime evidence during the tour:

- route: `http://localhost:3000/s/plan-standard-site-a`
- console error count on this page: `3`
- no network/API failure was required to trigger it

### User-facing impact

Even if the route looks mostly correct visually, this still matters because it can cause:

- hydration mismatch noise in development and QA
- avoidable client-side rerendering
- layout instability or brittle behavior around the footer subtree
- lower confidence in the route’s frontend correctness

### Likely fix

Replace the paragraph wrapper in the `PublicShell` footer with a non-paragraph container such as a `div`, or ensure the `ThemeSwitcher` is not mounted inside a paragraph-level element.

The cleanest fix is likely:

- keep inline text/link layout
- change the footer wrapper from `<p>` to `<div>` in `public-shell.tsx`

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/s/plan-standard-site-a`
2. Confirm browser console has no hydration/nesting errors.
3. Confirm footer layout still looks correct.
4. Recheck any other route using `PublicShell`.

---

## Finding 002 - Login fails with generic "unexpected error" because local Postgres was unavailable

- Status: `closed`
- Severity: `High`
- Route: `/login`
- Route family: `auth`
- First observed: `2026-03-28`

### What we saw

On the login page, clicking `Sign in` with the prefilled test credentials produced an `Unexpected error` failure instead of signing the session in and redirecting to admin.

The browser request itself completed, but the login did not succeed:

- route: `http://localhost:3000/login`
- request: `POST /login`
- response status: `200`
- visible outcome: generic error message shown to the user

### Why this is happening

The generic UI message came from the catch path in the auth server action, but the underlying failure was not the button, form, or query shape. Prisma could not reach the local Postgres instance at all when the login lookup ran.

The failing path is:

- `loginAction()` catches the exception and returns `An unexpected error occurred`
- `sessionLogin()` calls `findUnscopedUserByEmail(email, { include: { company: true } })`
- `findUnscopedUserByEmail()` calls `prisma.user.findFirst(...)`
- that Prisma call was throwing because the local database service was down / unreachable

So this was not a button/form wiring problem. It was a local runtime dependency failure.

### Exact evidence

Relevant source:

- [actions.ts](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\(auth)\actions.ts)
- [session.ts](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\lib\auth\session.ts)
- [scoped.ts](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\lib\db\scoped.ts)
- [tmp-local-server.log](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\tmp-local-server.log)

Relevant code shape:

- `apps/web/src/app/(auth)/actions.ts`
  - `loginAction()` catches thrown errors and returns:
    - `An unexpected error occurred`
- `apps/web/src/lib/auth/session.ts`
  - `sessionLogin()` calls:
    - `findUnscopedUserByEmail(email, { include: { company: true } })`
- `apps/web/src/lib/db/scoped.ts`
  - `findUnscopedUserByEmail()` executes:
    - `prisma.user.findFirst({ ... })`

Observed runtime evidence during the tour:

- server log shows:
  - `action: "auth.login"`
  - `error: "PrismaClientKnownRequestError ... prisma.user.findFirst()"`
- `POST /login 200 in 108ms`
- browser-side symptom is only the generic `Unexpected error` failure
- direct Prisma repro after investigation showed:
  - `code: 'ECONNREFUSED'` before Docker/Postgres was started

Resolution evidence:

- Docker Desktop launched successfully
- local DB container came up healthy:
  - `inductlite_v4-db-1   Up ... (healthy)`
- `npm run -w apps/web db:status`
  - `Database schema is up to date!`
- `npm run -w apps/web db:seed`
  - completed successfully and recreated the known plan test tenants / public site slugs

### User-facing impact

This blocked access to the admin side during the walkthrough and made the auth experience look broken and opaque:

- users cannot sign in with a valid local test account
- the UI hides the true problem behind a generic error
- admin routes cannot be inspected through the intended authenticated path

### Likely fix

Ensure the local Postgres dependency is running before touring or testing the app. In this case the concrete repair was:

- launch Docker Desktop
- bring the repo DB container up
- confirm migrations are current
- seed local data

The app-level UX could still be improved later by surfacing a slightly more actionable non-sensitive dev fallback than `An unexpected error occurred`, but that is secondary to having the database available.

### Recommended verification after fixing

1. Confirm local DB is healthy before app verification.
2. Revisit:
   - `http://localhost:3000/login`
3. Sign in with known local test credentials.
4. Confirm successful redirect to:
   - `/admin/dashboard`
5. Recheck a second login attempt and logout/login cycle.

---

## Finding 003 - Admin header company-name span truncates awkwardly on narrow widths

- Status: `closed`
- Severity: `Low`
- Route: `/admin/dashboard`
- Route family: `admin shell`
- First observed: `2026-03-28`

### What we saw

On the dashboard, the workspace/company name in the top admin header looks cramped and degrades visibly as the viewport narrows.

At tighter widths, the text does not produce a hard page overflow, but it truncates aggressively and reads as unfinished chrome.

Observed example:

- visible label: `Plan Test Standard...`
- route: `http://localhost:3000/admin/dashboard`

### Why this is happening

The company name is rendered in a `span` with a `truncate` treatment inside a tight horizontal header layout.

That keeps the shell from blowing out horizontally, but the current composition gives the company name too little room once the viewport compresses.

### Exact evidence

Relevant source:

- [layout.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\layout.tsx)

Relevant code shape:

- `apps/web/src/app/admin/layout.tsx:529`
  - company name is rendered as:
    - `<span className="truncate text-sm text-[color:var(--text-primary)]">`

Observed runtime evidence during the tour:

- at `320px` width, the header shows the workspace name clipped to:
  - `Plan Test Standard...`
- no full-page horizontal overflow was detected
- visual quality still drops because the header line looks squeezed rather than intentionally adapted

### User-facing impact

This is not a blocker, but it does make the mobile/narrow admin shell look less refined:

- the header feels cramped
- brand/workspace context is less readable
- the shell looks rougher during resize than the rest of the improved admin experience

### Likely fix

Give the workspace name a better responsive treatment than simple truncation alone.

Likely options:

- allow a cleaner stacked mobile header treatment
- shorten surrounding chrome at narrow widths so the name gets more room
- use a smaller or lower-priority company label pattern on tight viewports

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/dashboard`
2. Check header behavior at:
   - `320px`
   - `390px`
   - tablet width
3. Confirm the company name remains readable without making the shell feel crowded.
4. Confirm no horizontal overflow is introduced.

---

## Finding 004 - Dashboard KPI status badges wrap awkwardly at desktop mid-width and narrow layouts

- Status: `closed`
- Severity: `Low`
- Route: `/admin/dashboard`
- Route family: `admin dashboard KPIs`
- First observed: `2026-03-28`

### What we saw

The status pill / span elements in the top KPI cards do not scale cleanly.

Examples include labels such as:

- `LIVE REGISTER`
- `NO NEW ENTRIES`
- `ALL LIVE`

At full desktop and especially around `786px` width, those pills become cramped and visually awkward inside the KPI cards. They either wrap or squeeze hard enough that the cards stop looking deliberate.

### Why this is happening

Each KPI card uses a left eyebrow and a right `StatusBadge` inside a tight `justify-between` row.

The badge component is uppercase, padded, and sized as an inline pill. Some labels are simply too long for the available horizontal room in these cards at mid-range widths.

### Exact evidence

Relevant source:

- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\dashboard\page.tsx)
- [status-badge.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\components\ui\status-badge.tsx)

Relevant code shape:

- `apps/web/src/app/admin/dashboard/page.tsx`
  - `DashboardMetricCard()` renders:
    - eyebrow on the left
    - `<StatusBadge ...>{card.badgeLabel}</StatusBadge>` on the right
  - top card row uses:
    - `className="flex items-start justify-between gap-3"`
- `apps/web/src/components/ui/status-badge.tsx`
  - badge uses:
    - uppercase text
    - `px-2.5 py-1`
    - `text-[11px]`
    - rounded pill styling

Observed runtime evidence during the tour:

- at `1280px`, the `LIVE REGISTER` KPI pill already looks compressed in the top metric row
- at `786px`, KPI pills become clearly awkward in the first card row and start reading as squeezed rather than intentionally responsive
- the page does not fully break horizontally, but the visual quality drops in a noticeable way

### User-facing impact

This is a polish issue rather than a blocker, but it affects one of the most visible admin surfaces:

- KPI cards look less premium than the surrounding dashboard treatment
- status pills compete with card readability instead of reinforcing it
- the route feels less resolved at common laptop/tablet widths

### Likely fix

Give KPI badges a more responsive treatment than the default `StatusBadge` pill.

Likely options:

- shorten or sentence-case some KPI badge labels
- reduce pill padding / tracking for KPI-specific badge use
- let the KPI row stack more intentionally at constrained widths
- create a tighter metric-card badge variant instead of using the generic pill unchanged

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/dashboard`
2. Check the first KPI row at:
   - full desktop
   - `786px`
   - mobile width
3. Confirm badge labels stay readable without looking cramped or wrapping awkwardly.
4. Confirm the dashboard still feels calm and balanced.

---

## Finding 005 - Live-register badge spans become tall and awkward at desktop-mid and tablet widths

- Status: `closed`
- Severity: `Low`
- Route: `/admin/live-register`
- Route family: `admin live register`
- First observed: `2026-03-28`

### What we saw

The same badge/span problem from the dashboard appears on live-register, especially in summary cards, the attention queue, and expanded detail headers.

At around `768px`, several badges wrap into tall multi-line pills instead of staying calm and compact.

Examples observed:

- `Respond now`
- `3 on site`
- `6 issues`

### Why this is happening

The route is reusing the generic `StatusBadge` pill treatment in tight card/header layouts where the available width drops quickly.

Because the badge uses uppercase text, padding, and allows normal wrapping, labels become tall stacked pills rather than compact status markers.

### Exact evidence

Relevant source:

- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\live-register\page.tsx)
- [status-badge.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\components\ui\status-badge.tsx)

Relevant code shape:

- `apps/web/src/app/admin/live-register/page.tsx`
  - summary cards use `StatusBadge` in `LiveRegisterSummaryCard()`
  - attention queue rows use `StatusBadge` for:
    - `{group.headcount} on site`
    - `{attentionCount} issues`
  - expanded site panels use `StatusBadge` for:
    - `{group.headcount} on site`
    - `{attentionCount} issues`
    - `Stable now`
- `apps/web/src/components/ui/status-badge.tsx`
  - generic pill styling is still:
    - uppercase
    - padded
    - wrapping-enabled

Observed runtime evidence during the tour:

- at `768px`, Playwright measured:
  - `Respond now` height: `43.7px`
  - one `3 on site` badge height: `60.75px`
  - `6 issues` height: `43.7px`
- those tall pills make the route feel heavier and less premium than the surrounding layout

### User-facing impact

This is not a correctness failure, but it makes the route look less resolved at a common viewport width:

- summary cards feel more crowded
- the attention queue loses calmness
- expanded detail looks heavier than it needs to

### Likely fix

Give live-register a tighter badge treatment for summary/queue/detail contexts instead of using the default pill unchanged.

Likely options:

- create a compact live-register badge variant
- reduce padding/tracking for these contexts
- prevent wrapping for short labels or rewrite labels more compactly
- allow card/header layout to stack more intentionally when width gets tight

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/live-register`
2. Check badge behavior at:
   - full desktop
   - `768px`
   - mobile width
3. Confirm badges stay compact and readable without becoming tall stacked pills.
4. Confirm the route still feels lighter than its earlier versions.

---

## Finding 006 - Settings billing sidebar sticky behavior feels inconsistent across widths and section depth

- Status: `closed`
- Severity: `Low`
- Route: `/admin/settings`
- Route family: `admin settings layout`
- First observed: `2026-03-28`

### What we saw

The right-side `Billing and accounting` panel does not behave consistently as a supportive sticky sidebar.

Two separate behaviors showed up during the tour:

- around tablet width, the billing panel does not stick at all
- at full desktop, it sticks for part of the page, then starts moving once its parent section ends

That matches the experience you called out: it only feels attached to the page until the right-side section runs out.

### Why this is happening

The billing sidebar only becomes sticky at the `xl` breakpoint, and even then it is sticky only inside its parent layout container.

That means:

- below `xl`, it behaves like a normal flowing column
- above `xl`, it pins with `top: 24`, but stops pinning once the parent grid section reaches its bottom edge

### Exact evidence

Relevant source:

- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\settings\page.tsx)

Relevant code shape:

- `apps/web/src/app/admin/settings/page.tsx:527`
  - billing sidebar uses:
    - `<aside id="billing" className="space-y-6 xl:sticky xl:top-24">`

Observed runtime evidence during the tour:

- at `768px`, computed style on `#billing` was:
  - `position: static`
- at `1280px`, computed style on `#billing` was:
  - `position: sticky`
  - `top: 96px`
- deeper in the page, the sticky sidebar stops pinning once the parent section bottom is reached

### User-facing impact

This is a layout/polish issue rather than a blocker, but it makes the settings page feel less resolved:

- the sidebar does not consistently support long-form settings review
- on tablet-ish widths it offers no sticky help at all
- on desktop it can feel like it unexpectedly “gives up” once the surrounding section ends

### Likely fix

Decide on a more intentional responsive/sticky strategy for the billing sidebar.

Likely options:

- enable a stickier behavior earlier than `xl` if the layout supports it
- restructure the page/grid so the sticky column has a more predictable parent boundary
- explicitly design the sidebar to stop being sticky at a clearer handoff point rather than feeling accidental

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/settings`
2. Check billing sidebar behavior at:
   - `768px`
   - full desktop
   - near the bottom of the settings page
3. Confirm the sidebar feels intentionally placed rather than inconsistently attached.
4. Confirm no overlap or clipping is introduced.

---

## Finding 007 - Sign-In History still leaks encrypted contact values in visible rows

- Status: `closed`
- Severity: `High`
- Route: `/admin/history`
- Route family: `admin history`
- First observed: `2026-03-28`

### What we saw

The `Sign-In History` route is still rendering raw `enc:v1:` ciphertext in visible visitor contact fields for some signed-out records.

Examples observed on the page:

- `enc:v1:ui19PR_2mmJbLi462Z0h49CMnsU796oTQACSKsx8pOohmVS1UbfB1w`
- `enc:v1:Vcv1ZrlZsffw4BS3aZLM6FY8bnTlg_k6v3Cd6fa63K0WkU1uaDkbMQ`
- `enc:v1:IrcDMVQru1GjU5DsQ5DN1KJYEmpMSInaUO2Alsu0uoYVIGXvrdSGaQ`

### Why this is happening

The live-register route was fixed to use a safe display field for visitor phone values, but the history route is still rendering raw stored contact data for some rows.

So the safe-display handling is not yet applied consistently across all admin surfaces that show sign-in contact data.

### Exact evidence

Relevant runtime evidence during the tour:

- route: `http://localhost:3000/admin/history`
- visible rows for signed-out records show `enc:v1:` strings directly in the visitor column
- affected rows were visible in the table without any devtools inspection needed
- confirmed again during the PRO + rollout-flags pass under `Plan Test Pro Ltd`
- one reproduced example in the highest-access pass:
  - `enc:v1:oD0AMPVOnVNAB5phEYypdhIyckSGCKsyj95_cac_bBog1su_CWM9ZQ`
- during the execution pass:
  - `Status=Currently On Site` filter updated the URL correctly
  - search for `273019` narrowed the result set to one active record
  - `Sign Out` completed successfully and removed that record from the filtered on-site result set
  - the route behavior worked operationally, but the ciphertext rendering defect remained present for signed-out rows outside that filtered view

Relevant source:

- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\history\page.tsx)
- [signin.repository.ts](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\lib\repository\signin.repository.ts)

Relevant code shape:

- `apps/web/src/app/admin/history/page.tsx:373`
  - visitor contact line still renders:
    - `{record.visitor_phone || "Unavailable"}`
- `apps/web/src/lib/repository/signin.repository.ts:140`
  - repository already has `buildSafeVisitorPhoneDisplay(...)`
- `apps/web/src/lib/repository/signin.repository.ts:176`
  - repository already populates `visitor_phone_display`

This means the safe display field exists in the repository layer, but the history page is not using it yet.

### User-facing impact

This is a trust and data-presentation issue:

- encrypted contact blobs are visible to operators
- the page looks broken and unsafe
- it undermines confidence in the history/audit surface

### Likely fix

Apply the same safe/masked contact display approach used on live-register to the history route and any shared history table helpers.

The fix should live in the data-display layer used by history, not as a one-off string cleanup in the page markup.

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/history`
2. Confirm no visible `enc:v1:` strings appear anywhere on the page.
3. Confirm operators see a safe display value such as:
   - decrypted phone
   - masked fallback
   - `Unavailable`
4. Recheck related routes that show sign-in contact history, not just live-register.

---

## Finding 008 - Plan Configurator reports scheduling failure even when the change request is created

- Status: `closed`
- Severity: `Medium`
- Route: `/admin/plan-configurator`
- Route family: `administration / billing-config`
- First observed: `2026-03-28`

### What we saw

Submitting a plan change request from the `Self-Serve Plan Configurator` produced an explicit failure state in the UI:

- URL changed to:
  - `/admin/plan-configurator?status=error&message=Failed+to+schedule+plan+change+request`
- visible banner/message:
  - `Failed to schedule plan change request`

But the same submission also created a new scheduled record in the visible `Change Request History` list.

Observed created row:

- `Pro`
- `SCHEDULED`
- `Effective: 29/03/2026, 6:43:00 am`
- `Created: 28/03/2026, 7:43:22 pm`

### Why this is happening

The route appears to be completing the underlying write but still redirecting or rendering through an error path afterward.

That suggests the failure is likely happening:

- after persistence succeeds
- during follow-up processing, redirect handling, or response-state construction

So this currently behaves like a false-negative failure state rather than a true creation failure.

### Exact evidence

Relevant runtime evidence during the feature-execution pass:

- route: `http://localhost:3000/admin/plan-configurator`
- action exercised:
  - clicked `Schedule Plan Change` with the default `PRO` target plan and default future effective date
- resulting URL:
  - `/admin/plan-configurator?status=error&message=Failed+to+schedule+plan+change+request`
- same page render also showed a newly inserted scheduled request at the top of history

Relevant source to inspect next:

- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\plan-configurator\page.tsx)
- any related action/service used by the plan-change submission path

### User-facing impact

This is a trust and workflow correctness issue:

- operators are told the request failed
- the request may actually be created anyway
- users may resubmit and accidentally create duplicates
- the route undermines confidence in an admin/billing control surface

### Likely fix

Audit the plan-change submission flow so the success/error state matches the actual write result.

The fix likely needs to ensure:

- success redirects only happen after the write and follow-up logic succeed
- failures do not leave a created record behind without a matching success state
- duplicate submissions are not encouraged by a false error banner

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/plan-configurator`
2. Submit one plan change request.
3. Confirm:
   - the UI reports success
   - exactly one new request appears in history
   - the URL does not carry the `status=error` state
4. Re-test with a real validation error and confirm the record is not created on failure.

---

## Finding 009 - Sites route still throws a hydration mismatch and follow-on null DOM error

- Status: `closed`
- Severity: `Medium`
- Route: `/admin/sites`
- Route family: `operations / sites`
- First observed: `2026-03-28`

### What we saw

The `Sites` route rendered and its core actions worked, but the browser logged a real hydration failure followed by a null DOM access error on page load.

Observed console errors:

- `Hydration failed because the server rendered HTML didn't match the client.`
- `TypeError: Cannot read properties of null (reading 'parentNode')`

The page still became interactive, but React regenerated part of the tree on the client.

### Why this is happening

The console trace points at a server/client markup mismatch somewhere in the admin sites route tree. The mismatch diff shown by React highlights a discrepancy around the admin layout content area:

- client side shows `main.admin-shell-main`
- server output path includes a `Suspense` subtree in that same area

That mismatch then cascades into a follow-on `parentNode` null read while React/Next tries to reconcile the DOM.

At the moment this looks like a real SSR/client composition problem, not just a button-level interaction bug.

### Exact evidence

Relevant runtime evidence during the tour:

- route: `http://localhost:3000/admin/sites`
- page loaded and remained usable
- browser console produced two errors immediately on load
- reproduced again while exercising search + deactivate/reactivate actions on the route

Observed React/Next diff excerpt:

- `+ <main className="admin-shell-main">`
- `- <Suspense>`

Observed follow-on browser error:

- `TypeError: Cannot read properties of null (reading 'parentNode')`
- stack included inline route bootstrap code:
  - `http://localhost:3000/admin/sites:1:225538`

Relevant source to inspect first:

- [layout.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\layout.tsx)
- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\sites\page.tsx)

### User-facing impact

This is a real frontend correctness issue even though the route appears to work:

- React throws hydration errors on a core admin route
- part of the page is re-rendered client-side unnecessarily
- this can hide brittle rendering problems and makes the route feel less trustworthy in QA/dev

### Likely fix

Inspect the server/client tree around the admin layout + sites route boundary and remove the markup mismatch causing React to reconcile different structures.

Likely things to check first:

- whether the sites route introduces a client-only branch that changes the shell/content structure
- whether a conditional `Suspense` wrapper or route-only client component is rendering differently server vs client
- whether the admin shell or route wrapper changed without a stable shared structure between SSR and hydration

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/sites`
2. Confirm browser console shows no hydration or null `parentNode` errors.
3. Recheck:
   - site search
   - deactivate
   - reactivate
4. Confirm the route still preserves the improved table-first layout and action behavior.

---

## Finding 010 - Settings identity form reports success while restoring the old default role

- Status: `closed`
- Severity: `Medium`
- Route: `/admin/settings`
- Route family: `administration / settings / identity`
- First observed: `2026-03-28`

### What we saw

The identity settings form shows a success state after saving, but at least one changed field does not persist in the UI.

Specifically:

- changed `Default role` from `Viewer` to `Site manager`
- clicked `Save SSO Settings`
- saw success alert:
  - `SSO settings updated`
- after the page re-rendered, `Default role` was back to `Viewer`

The same thing reproduced again when changing `Default role` to `Admin`.

### Why this is happening

The settings save path appears to be surfacing a success message even though the changed default-role value is not surviving the round-trip.

That suggests one of these is happening:

- the submitted field is not actually being persisted
- the save action is ignoring or dropping `defaultRole`
- the page is reading stale/default data after save
- the form is binding the wrong field/value back into the select after a successful action state

At the moment this behaves like a false-success configuration save.

### Exact evidence

Relevant runtime evidence during the feature-execution pass:

- route: `http://localhost:3000/admin/settings`
- opened `Identity and access` -> `Provisioning`
- changed `Default role`
- clicked `Save SSO Settings`
- received visible success alert:
  - `SSO settings updated`
- observed `Default role` revert to `Viewer` after save on two different attempted values:
  - `Site manager`
  - `Admin`

By contrast, the compliance save path on the same route did persist correctly:

- changed sign-in retention from `365` -> `366`
- saved successfully
- saw summary update to `366d`
- reverted to `365` successfully

Relevant source to inspect first:

- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\settings\page.tsx)
- [sso-settings-panel.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\settings\sso-settings-panel.tsx)

### User-facing impact

This is a real admin trust issue:

- operators are told identity settings were updated
- the displayed value does not change
- admins can leave the page believing an access policy was updated when it was not

### Likely fix

Audit the `Save SSO Settings` submission path and the post-save data binding for `defaultRole`.

Things to check first:

- whether `defaultRole` is included in the submitted payload
- whether the server action persists it correctly
- whether the page reload reads the saved value or a fallback/default
- whether disclosure/form state is rehydrating stale props after success

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/settings`
2. Change `Default role` to a different value.
3. Save the SSO settings.
4. Confirm:
   - success message appears only when the value persists
   - the selected role remains on the newly chosen value after reload/re-render
5. Recheck another identity field to ensure this is not part of a broader false-success save issue.

---

## Finding 011 - Action Register reports failure while still moving the action to IN_PROGRESS

- Status: `closed`
- Severity: `Medium`
- Route: `/admin/actions`
- Route family: `safety / action-register`
- First observed: `2026-03-28`

### What we saw

Starting an open action from the `Action Register` produced an explicit failure message in the UI, but the action still changed state.

Observed result after clicking `Start` on the hazard follow-up action:

- URL changed to:
  - `/admin/actions?flashStatus=error&flashMessage=Failed+to+update+action`
- visible message:
  - `Failed to update action`
- same render also showed the action status changed from:
  - `OPEN` -> `IN_PROGRESS`
- summary cards updated at the same time:
  - `Open` dropped from `1` to `0`
  - `In progress` increased from `0` to `1`

### Why this is happening

This looks like another false-negative mutation path, similar in shape to the plan-configurator issue.

The underlying write appears to succeed, but the route still redirects or renders through an error state afterward.

That suggests the failure is likely happening:

- after the action status update is persisted
- during response-state construction, redirect handling, or follow-up logging

### Exact evidence

Relevant runtime evidence during the feature-execution pass:

- route: `http://localhost:3000/admin/actions`
- action exercised:
  - clicked `Start` on the action created from the hazard follow-up workflow
- resulting URL:
  - `/admin/actions?flashStatus=error&flashMessage=Failed+to+update+action`
- same page render showed:
  - status badge `IN_PROGRESS`
  - updated summary counts reflecting the new state

Relevant source to inspect first:

- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\actions\page.tsx)
- any related action/service handling status transitions in the action register

### User-facing impact

This is a trust issue for a core compliance workflow:

- operators are told the update failed
- the action has actually moved state
- users may retry unnecessarily or lose confidence in the register

### Likely fix

Audit the action-status transition flow so the UI success/error message matches the persisted result.

Things to check first:

- whether the status update succeeds before a later step throws
- whether redirect parameters are being set from a stale or inverted branch
- whether an audit/note side-effect can fail after the primary mutation completes

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/actions`
2. Start an open action.
3. Confirm:
   - the UI reports success
   - the action moves to `IN_PROGRESS`
   - summary counts update consistently
4. Re-test `Block` and `Close` to make sure the same false-error pattern does not exist on other transitions.

---

## Finding 012 - Inspections route reports `NEXT_REDIRECT` while schedule and run writes succeed

- Status: `closed`
- Severity: `Medium`
- Route: `/admin/inspections`
- Route family: `safety / inspections`
- First observed: `2026-03-28`

### What we saw

Both primary write paths on the inspections route completed their data changes, but the page still redirected with an error flash.

Observed on schedule creation:

- created schedule:
  - `Tour weekly SWMS inspection`
- route redirected to:
  - `/admin/inspections?flashStatus=error&flashMessage=NEXT_REDIRECT`
- at the same time:
  - the schedule appeared in the active schedules list
  - summary counts updated

Observed again on inspection run recording:

- recorded run for:
  - `Tour weekly SWMS inspection`
- route redirected to:
  - `/admin/inspections?flashStatus=error&flashMessage=NEXT_REDIRECT`
- at the same time:
  - the recent run appeared
  - summary counts updated to show:
    - `Runs last 30 days: 1`
    - `Failed runs: 1`

### Why this is happening

This is a false-negative mutation bug.

The underlying writes are succeeding, but the route is still treating the success redirect as an error.

The most likely cause is visible in the route actions:

- `statusRedirect(...)` calls `redirect(...)`
- that redirect is being called inside a `try` block
- the enclosing `catch` then catches the redirect throw and turns it into:
  - `flashStatus=error`
  - `flashMessage=NEXT_REDIRECT`

### Exact evidence

Relevant runtime evidence during the feature-execution pass:

- route:
  - `http://localhost:3000/admin/inspections`
- schedule creation result:
  - `/admin/inspections?flashStatus=error&flashMessage=NEXT_REDIRECT`
- run recording result:
  - `/admin/inspections?flashStatus=error&flashMessage=NEXT_REDIRECT`
- persisted side effects:
  - new schedule row present
  - new inspection run row present
  - summary counts updated

Relevant source to inspect first:

- [actions.ts](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\inspections\actions.ts)
- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\inspections\page.tsx)

Most suspicious code path:

- `apps/web/src/app/admin/inspections/actions.ts`
  - `statusRedirect()` uses `redirect(...)`
  - success path calls `statusRedirect("ok", ...)` inside `try`
  - enclosing `catch` turns thrown redirect into error flash handling

### User-facing impact

This undermines trust in a core compliance workflow:

- operators are told scheduling/recording failed
- the schedule/run has actually been created
- users can retry and create duplicates or lose confidence in inspection tracking

### Likely fix

Do not catch the redirect thrown by `statusRedirect("ok", ...)`.

Likely safe fixes:

- move the success redirect outside the `try/catch`
- or explicitly rethrow redirect errors instead of converting them to failure flash state

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/inspections`
2. Create a schedule.
3. Confirm:
   - success flash is shown
   - no `NEXT_REDIRECT` error appears
   - schedule appears once
4. Record an inspection run.
5. Confirm:
   - success flash is shown
   - run appears once
   - summary counts update correctly

---

## Finding 013 - Competency route reports `NEXT_REDIRECT` while requirement and certification writes succeed

- Status: `closed`
- Severity: `Medium`
- Route: `/admin/competency`
- Route family: `contractors / competency`
- First observed: `2026-03-28`

### What we saw

Both main write paths on the competency route persisted data, but the page surfaced an error flash instead of a success state.

Observed on requirement creation:

- created requirement:
  - `Electrical license`
- route redirected to:
  - `/admin/competency?flashStatus=error&flashMessage=NEXT_REDIRECT`
- at the same time:
  - the requirement appeared in the requirements table
  - summary count updated to:
    - `Requirements: 1`

Observed again on worker certification save:

- saved certification for:
  - `Terry Tour`
- route redirected to:
  - `/admin/competency?flashStatus=error&flashMessage=NEXT_REDIRECT`
- at the same time:
  - the certification appeared in the matrix
  - summary count updated to:
    - `Current: 1`

### Why this is happening

This is the same false-negative redirect pattern seen on the inspections route.

The success redirect is being called inside a `try` block, and the surrounding `catch` is converting that redirect throw into an error flash.

The route action structure shows the likely cause directly:

- `statusRedirect(...)` calls `redirect(...)`
- success paths call `statusRedirect("ok", ...)` inside `try`
- `catch` converts that thrown redirect into:
  - `flashStatus=error`
  - `flashMessage=NEXT_REDIRECT`

### Exact evidence

Relevant runtime evidence during the feature-execution pass:

- route:
  - `http://localhost:3000/admin/competency`
- requirement creation result:
  - `/admin/competency?flashStatus=error&flashMessage=NEXT_REDIRECT`
- certification save result:
  - `/admin/competency?flashStatus=error&flashMessage=NEXT_REDIRECT`
- persisted side effects:
  - new competency requirement row present
  - new worker certification row present
  - summary counts updated

Relevant source to inspect first:

- [actions.ts](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\competency\actions.ts)
- [page.tsx](c:\Users\uvcha\OneDrive\Desktop\inductlite_v4\apps\web\src\app\admin\competency\page.tsx)

Most suspicious code path:

- `apps/web/src/app/admin/competency/actions.ts`
  - `statusRedirect()` uses `redirect(...)`
  - success branches call `statusRedirect("ok", ...)` inside `try`
  - enclosing `catch` likely traps the redirect and emits the error flash

### User-facing impact

This is a real workflow-trust problem:

- operators are told requirement/certification creation failed
- the data is actually saved
- admins can retry and create duplicates or abandon a successful configuration change

### Likely fix

Handle redirect throws correctly in the competency actions.

Likely safe fixes:

- move success redirects outside the `try/catch`
- or explicitly rethrow redirect errors instead of mapping them to generic error flashes

### Recommended verification after fixing

1. Revisit:
   - `http://localhost:3000/admin/competency`
2. Create a requirement.
3. Confirm:
   - success flash is shown
   - no `NEXT_REDIRECT` error appears
   - the requirement appears once
4. Save a certification.
5. Confirm:
   - success flash is shown
   - no `NEXT_REDIRECT` error appears
   - the certification appears once

---

## Append format for later findings

Use this structure for each new issue we discover during the tour:

```md
## Finding 00N - Short title

- Status: `open`
- Severity: `High | Medium | Low`
- Route: `/example`
- Route family: `public | auth | admin | shared`
- First observed: `YYYY-MM-DD`

### What we saw

### Why this is happening

### Exact evidence

### User-facing impact

### Likely fix

### Recommended verification after fixing
```
