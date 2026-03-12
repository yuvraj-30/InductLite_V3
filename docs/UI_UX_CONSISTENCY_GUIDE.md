# UI/UX Consistency Guide

This repo now uses a 2026 tokenized visual system across admin, auth, contractor, and public flows.

## Core Principles

- Build on shared tokens and primitives before writing one-off utility strings.
- Prioritize intent-first actions: keyboard-first navigation via command palette where applicable.
- Preserve accessibility and operational clarity under both adaptive modes.
- Keep interaction behavior stable while evolving visual depth and hierarchy.

## Design System Source

- Token source of truth: `apps/web/src/design/modern-theme.json`.
- Runtime token application: `apps/web/src/app/globals.css`.
- Adaptive mode runtime (`warm-light` and `high-contrast-dark`): `apps/web/src/components/ui/theme-runtime.tsx`.

## Shared Patterns

- Buttons: `btn-primary`, `btn-secondary`, `btn-danger`.
- Inputs: `input` with `label` (minimum 44px touch target).
- Surfaces: `surface-panel`, `surface-panel-strong`, `card`, `bento-card`.
- Layout grids: `bento-grid` for modular dashboard-style grouping.
- Alerts: `Alert` component in `apps/web/src/components/ui/alert.tsx`.
- Public shell: `PublicShell` in `apps/web/src/components/ui/public-shell.tsx`.
- Admin navigation active state: `NavLink` in `apps/web/src/app/admin/nav-link.tsx`.

## Intent-Based UX

- Admin shell includes `Cmd/Ctrl + K` command palette:
  - Component: `apps/web/src/app/admin/admin-command-palette.tsx`
  - Integration: `apps/web/src/app/admin/layout.tsx`
- Commands should be role-aware and include:
  - clear title,
  - short action description,
  - route target,
  - optional context keywords.

## AI Trust Pattern

- In-context copilot guidance remains draft-only by default.
- Every accepted/rejected/edited AI recommendation requires explicit human action.
- AI decisions are written to communication events and audit logs without free-text payload content.
- Confidence band and source signals must be visible where AI suggestions are rendered.

## Typography & Motion

- Body font uses variable `Manrope`; display uses variable `Space Grotesk`.
- Kinetic typography should use `kinetic-title` and `kinetic-hover` on interactive headings.
- Respect reduced motion (`prefers-reduced-motion`) by avoiding non-essential animation.

## Accessibility Requirements

- Maintain WCAG 2.2 contrast in both adaptive modes.
- Keep visible focus indicators for links, buttons, and form controls.
- Keep `aria-current="page"` on active nav links.
- Use `role="alert"` for actionable error/success notices.
- Command palette must keep keyboard navigation (`Cmd/Ctrl+K`, arrows, Enter, Escape).

## Testing Expectations

- Run at minimum:
  - `npm run -w apps/web lint`
  - `npm run -w apps/web typecheck`
- For UI-heavy changes, also run relevant Playwright specs for touched flows when environment supports E2E fixture server mode.
- For accessibility/performance gates, run:
  - `npm run -w apps/web test:e2e -- e2e/a11y.spec.ts`
  - `npm run -w apps/web test:e2e:perf-budget`
  - `npm run report:ux-perf-budget`
