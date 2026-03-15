# UI/UX Visual Consistency Audit

Date: 2026-03-15

Scope: `apps/web/src`

## Executive Summary

The active frontend does not currently behave like one fully unified design system.

- The intended system is defined in `apps/web/src/app/globals.css`: soft flat surfaces, rounded panels, trust/floating shadows, consistent control sizing, and optional glass.
- Marketing routes are the main consumers of the newer component primitives: `Card`, `buttonVariants`, and `Badge`.
- Admin and public product flows mostly use the token set indirectly through utility classes, but many blocks are still rebuilt ad hoc per page.
- Result: the app reads as a mix of three related styles:
  - tokenized marketing surfaces with occasional glass,
  - flat admin CRUD surfaces,
  - tinted task-oriented public flow panels.

## Evidence Snapshot

Counts below exclude `*.test.tsx`.

| Signal | Count | Interpretation |
| --- | ---: | --- |
| Files using `surface-panel`, `surface-panel-strong`, or `bento-card` | 79 | Core surface tokens are widely adopted |
| Files using glass or blur styles (`glass-card`, `backdrop-blur`, `glass-bg`) | 8 | Glass exists, but only in isolated areas |
| Files with manual rounded border blocks (`rounded-xl border`, `rounded-lg border`, `rounded-md border`) | 77 | Most blocks are still hand-composed |
| Files with tables | 37 | Table standardization matters |
| Files with overlay/dialog patterns | 2 | Modal behavior is very under-standardized |
| App routes using shared `Card` | 3 | Shared card primitive is mostly marketing-only |
| App routes using `buttonVariants` | 3 | Shared button primitive is mostly marketing-only |
| App routes using shared `Badge` | 6 | Badge adoption is partial |
| Files using shared empty/warning/loading states or `Alert` | 41 | State messaging is more standardized than layout chrome |

## Baseline Style DNA

The repo already defines a clear visual baseline in `apps/web/src/app/globals.css`.

- Layout pattern:
  - stacked sections,
  - bento grid for dashboards,
  - table-toolbar grid for filters,
  - minimum 44px controls.
- Surface style:
  - solid `surface-panel`,
  - elevated `surface-panel-strong`,
  - optional `glass-card`.
- Spacing and border logic:
  - 4/8px spacing cadence,
  - large card radius,
  - softer control radius,
  - trust/floating/glass shadow tiers.

The inconsistency problem is not lack of design tokens. It is uneven adoption of the design primitives.

## Major Findings

### 1. Glass vs flat is not a product-wide decision

- Marketing uses glass intentionally in `apps/web/src/app/pricing/page.tsx` and `apps/web/src/app/compare/page.tsx`.
- Admin uses blur/glass only in isolated places such as `apps/web/src/app/admin/admin-command-palette.tsx` and `apps/web/src/app/admin/components/OnboardingChecklist.tsx`.
- Most admin CRUD pages stay flat.

Impact: the product feels split between a premium marketing surface and a more utility-first operational UI.

### 2. Forms are the strongest source of visual drift

- Tokenized controls exist as `.input`, `.label`, `.btn-primary`, and `.btn-secondary`.
- Many pages still use older field styling with `rounded-md`, `shadow-sm`, and custom focus rings.
- Example drift:
  - tokenized: `apps/web/src/app/admin/history/history-filters.tsx`
  - legacy/manual: `apps/web/src/app/admin/sites/new/create-site-form.tsx`
  - mixed semantic action buttons: `apps/web/src/app/admin/exports/ExportQueuePanel.tsx`

Impact: forms look like they come from different eras of the codebase.

### 3. Tables are repeated, similar, and not standardized

- The repo has 37 table-bearing files.
- Many use the same broad structure:
  - `overflow-x-auto`
  - `table`
  - divide-y borders
  - semantic chips inside cells
- But wrappers, density, border tokens, and header treatments vary.
- `apps/web/src/app/admin/command-mode/page.tsx` is a notable outlier because it uses `--surface-border` instead of the normal border token family.

Impact: the app has table consistency at the idea level, but not at the component level.

### 4. Badge and chip styling is fragmented

- Shared `Badge` exists in `apps/web/src/components/ui/badge.tsx`.
- Shared admin status logic exists in `apps/web/src/app/admin/components/status-chip.ts`.
- Many pages still inline custom pill styles.

Impact: label density, capitalization, neutral states, and semantic tones are close, but not identical.

### 5. Modal and overlay design is not systematized

- `apps/web/src/app/admin/admin-command-palette.tsx` uses a blurred overlay and elevated rounded panel.
- `apps/web/src/app/admin/sites/[id]/QRCodeButton.tsx` uses a plain black overlay and a simpler modal card.

Impact: overlays do not feel like one coherent block family.

## Block Matrix

| Block | Representative files | Layout DNA | Surface DNA | Spacing / border DNA | Consistency |
| --- | --- | --- | --- | --- | --- |
| Base primitives | `apps/web/src/app/globals.css`, `apps/web/src/components/ui/card.tsx`, `apps/web/src/components/ui/button.tsx` | Tokenized panels, grid helpers, control classes | Soft solid by default, optional glass | `rounded-panel`, `rounded-control`, trust/float/glass shadows | Strong intent, weak app-level adoption |
| Marketing cards / pricing tiers | `apps/web/src/app/page.tsx`, `apps/web/src/app/pricing/page.tsx`, `apps/web/src/app/compare/page.tsx` | Grid, bento, slot-based composition | Mix of solid and glass | `rounded-panel` or `rounded-xl`, `p-4` to `p-6`, shared buttons | High internally |
| Admin shell / page heroes | `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/history/page.tsx` | Sidebar + main shell, stacked hero sections | Flat elevated surfaces | `surface-panel-strong`, `rounded-2xl`, `p-5` and `p-6` | Fairly consistent |
| Metric / stat cards | `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/components/OnboardingChecklist.tsx`, `apps/web/src/app/admin/command-mode/page.tsx` | Bento grid, 3-up stats, stacked CTA cards | Flat cards with semantic tints, occasional blur | `bento-card`, `surface-panel`, tinted icon pills | Medium |
| Tables | `apps/web/src/app/admin/history/page.tsx`, `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/command-mode/page.tsx` | `overflow-x-auto` wrapper + plain HTML tables | Flat surfaces with semantic chips in rows | Mixed wrapper borders, mixed cell padding | Medium-low |
| Table toolbars / filters | `apps/web/src/app/admin/history/history-filters.tsx` | Grid toolbar | Flat panel | Shared `.table-toolbar`, `.input`, `.label`, `.btn-primary` | Good, but underused |
| Forms / field groups | `apps/web/src/app/admin/sites/new/create-site-form.tsx`, `apps/web/src/app/admin/exports/ExportQueuePanel.tsx`, `apps/web/src/app/s/[slug]/components/SignInFlow.tsx` | Stacked forms with occasional grids | Flat surfaces with semantic banners | Split between tokenized controls and older `rounded-md` controls | Low |
| Lists / row cards | `apps/web/src/app/admin/sites/page.tsx`, `apps/web/src/app/admin/dashboard/page.tsx` | Divide-y lists, mobile row cards | Flat surfaces, hover fills | Outer shared surfaces, inner custom cards | Medium |
| Status chips / badges | `apps/web/src/app/admin/components/status-chip.ts`, `apps/web/src/components/ui/badge.tsx`, `apps/web/src/app/admin/history/page.tsx` | Inline pills | Neutral glass-ish pills plus semantic tints | Similar but not identical padding, uppercase, and color logic | Low |
| Alerts / empty / loading states | `apps/web/src/components/ui/page-state.tsx`, `apps/web/src/components/ui/alert.tsx` | Centered empty states and inline banners | Semantic tinted boxes over base surfaces | Shared empty/loading surfaces, manual warning/error boxes | Medium |
| Navigation / command surfaces | `apps/web/src/app/admin/admin-nav.tsx`, `apps/web/src/app/admin/admin-command-palette.tsx` | Sidebar accordion, quick-switch, overlay palette | Nav is flat, palette is blurred/elevated | Nav uses `rounded-xl`; palette uses `rounded-2xl` + blur | Medium-low |
| Modals / overlays | `apps/web/src/app/admin/admin-command-palette.tsx`, `apps/web/src/app/admin/sites/[id]/QRCodeButton.tsx` | Centered overlay dialogs | Palette is glassy; QR modal is plain | Different overlay, radius, and button treatments | Low |
| Public sign-in flow | `apps/web/src/components/ui/public-shell.tsx`, `apps/web/src/app/s/[slug]/components/SignInFlow.tsx` | Vertical multi-step task flow | Mostly flat with semantic tinting | Heavy `rounded-xl` and `rounded-lg`, full-width actions | Medium |

## Normalization Matrix

| Priority | Block family | Canonical target | What to normalize | First migration targets |
| --- | --- | --- | --- | --- |
| P0 | Forms and controls | Reuse `.input`, `.label`, `.btn-*` or promote `apps/web/src/components/ui/button.tsx` into admin | Remove mixed legacy `rounded-md border shadow-sm` fields and custom CTA buttons | `apps/web/src/app/admin/sites/new/create-site-form.tsx`, `apps/web/src/app/admin/exports/ExportQueuePanel.tsx`, `apps/web/src/app/(auth)/login/login-form.tsx` |
| P0 | Badges / status chips | Merge around one badge API using `apps/web/src/components/ui/badge.tsx` and `apps/web/src/app/admin/components/status-chip.ts` | Unify padding, neutral treatment, semantic tones, uppercase behavior | `apps/web/src/app/admin/history/page.tsx`, `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/components/OnboardingChecklist.tsx` |
| P0 | Modals / overlays | Create one shared modal primitive | Standardize overlay color, blur rule, panel radius, close affordance, and modal actions | `apps/web/src/app/admin/admin-command-palette.tsx`, `apps/web/src/app/admin/sites/[id]/QRCodeButton.tsx` |
| P1 | Data tables | Create a shared `DataTable` shell | Standardize wrapper panel, header row, row hover, density, empty rows, and overflow behavior | `apps/web/src/app/admin/history/page.tsx`, `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/command-mode/page.tsx` |
| P1 | Surface panels / section cards | Use `surface-panel`, `surface-panel-strong`, and `apps/web/src/components/ui/card.tsx` intentionally | Reduce duplicate `rounded-xl border bg-*` cards and decide when glass is valid | `apps/web/src/app/page.tsx`, `apps/web/src/app/admin/settings/page.tsx`, `apps/web/src/app/admin/plan-configurator/page.tsx` |
| P1 | Stat / KPI cards | Create a shared `StatCard` family | Unify title, value, caption, icon block, semantic tint, and CTA treatment | `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/command-mode/page.tsx`, `apps/web/src/app/admin/components/OnboardingChecklist.tsx` |
| P1 | Alerts / banners / empty states | Keep `apps/web/src/components/ui/page-state.tsx` and `apps/web/src/components/ui/alert.tsx`; remove custom banners | Standardize semantic colors, radius, density, and message hierarchy | `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/sites/page.tsx`, `apps/web/src/app/(auth)/login/login-form.tsx` |
| P2 | Navigation chrome | Create a small nav-surface primitive | Align sidebar cards, quick-switch, route summary, user pill, and small utility buttons | `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/admin-nav.tsx` |
| P2 | Public flow cards | Preserve a distinct public-flow mode but share the same primitives | Keep task-focused tinting while normalizing radii and action buttons | `apps/web/src/components/ui/public-shell.tsx`, `apps/web/src/app/s/[slug]/components/SignInFlow.tsx` |
| P2 | Glass usage policy | Allow glass only for marketing hero/CTA and high-focus overlays | Stop accidental blur spread across CRUD pages | `apps/web/src/app/pricing/page.tsx`, `apps/web/src/app/compare/page.tsx`, `apps/web/src/app/admin/admin-command-palette.tsx`, `apps/web/src/app/admin/components/OnboardingChecklist.tsx` |

## Recommended Visual Rules

### Admin product

- Default to flat or elevated surfaces.
- Avoid casual blur on CRUD cards, tables, and forms.
- Keep semantic tinting as accent, not as a replacement for structure.

### Marketing and sales pages

- Glass is allowed for hero wrappers, pricing emphasis, and premium CTAs.
- Shared `Card`, `Badge`, and `buttonVariants` should remain the canonical component API.

### Public sign-in flows

- Keep the task-first layout and semantic color blocks.
- Avoid introducing multiple modal or field styles inside the same flow.
- Use the same button and input primitives as admin unless a task-specific exception is intentional.

## Migration Plan

### Phase 1: Control normalization

Goal: eliminate the most visible field and button drift.

Tasks:

1. Standardize admin and auth forms on `.input`, `.label`, and shared button variants.
2. Replace page-local green, indigo, and legacy `rounded-md` action buttons with approved semantic button variants.
3. Introduce any missing button variants centrally instead of inline.

Primary targets:

- `apps/web/src/app/admin/sites/new/create-site-form.tsx`
- `apps/web/src/app/admin/exports/ExportQueuePanel.tsx`
- `apps/web/src/app/(auth)/login/login-form.tsx`
- `apps/web/src/app/(auth)/login/login-intent-selector.tsx`

### Phase 2: Status and feedback normalization

Goal: unify chips, banners, empty states, and warnings.

Tasks:

1. Fold `statusChipClass` into the shared badge API or wrap both behind one semantic component.
2. Replace page-local warning and error banners with `Alert` or `PageWarningState`.
3. Keep one neutral pill style and one semantic mapping.

Primary targets:

- `apps/web/src/app/admin/history/page.tsx`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/sites/page.tsx`
- `apps/web/src/app/admin/components/OnboardingChecklist.tsx`

### Phase 3: Table shell extraction

Goal: stop re-implementing table wrappers in every admin page.

Tasks:

1. Create a shared table container with standard overflow, border, header, row hover, and empty-state behavior.
2. Normalize cell padding and heading density.
3. Remove token outliers such as `--surface-border`.

Primary targets:

- `apps/web/src/app/admin/history/page.tsx`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/command-mode/page.tsx`
- `apps/web/src/app/admin/exports/page.tsx`

### Phase 4: Overlay and card unification

Goal: make overlays and reusable cards feel like the same product.

Tasks:

1. Create one shared modal component for overlay behavior and panel chrome.
2. Create shared `StatCard` and `InfoCard` patterns.
3. Restrict glass usage to documented exceptions.

Primary targets:

- `apps/web/src/app/admin/admin-command-palette.tsx`
- `apps/web/src/app/admin/sites/[id]/QRCodeButton.tsx`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/command-mode/page.tsx`

## Definition of Done

The normalization effort is successful when all of the following are true:

- New admin and auth forms do not introduce custom field styling outside shared primitives.
- New tables use one shared shell.
- New badges and chips do not hand-roll semantic pill classes.
- Overlays use one shared modal implementation.
- Glass usage is documented and limited to intentional marketing or overlay contexts.
- Page-level visual variety comes from content priority and semantic state, not from ad hoc block styling.
