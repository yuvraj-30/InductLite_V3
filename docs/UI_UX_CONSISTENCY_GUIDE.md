# UI/UX Consistency Guide

This project uses a shared visual language across admin, auth, contractor, and public flows.

## Core Principles

- Keep interaction patterns predictable across all pages.
- Use shared utility classes/components before writing one-off styles.
- Keep page sections visually familiar: heading, context text, actions, content.
- Use role-appropriate visual identity without changing interaction behavior.

## Shared Patterns

- Buttons: use `btn-primary`, `btn-secondary`, `btn-danger`.
- Inputs: use `input` and labels with `label`.
- Cards: use `card` or `rounded-lg border bg-white` table shells.
- Alerts: use `Alert` component from `apps/web/src/components/ui/alert.tsx`.
- Public pages: use `PublicShell` from `apps/web/src/components/ui/public-shell.tsx`.
- Admin nav: use `NavLink` from `apps/web/src/app/admin/nav-link.tsx` for active-state consistency.

## Layout Consistency

- Headings:
  - Page title: `text-2xl font-bold text-gray-900`
  - Supporting text: `text-gray-600`
- Content containers:
  - Cards/tables should share border/radius/shadow rhythm.
- Empty states:
  - Use centered card with clear title and one follow-up action.

## Accessibility Requirements

- Active navigation links must expose `aria-current="page"`.
- Alerts should expose `role="alert"` for actionable feedback.
- Focus states should remain visible and consistent.

## Testing Expectations

- Visual snapshots should cover representative pages in each section:
  - auth (`/login`)
  - admin (`/admin/dashboard`, `/admin/users`, `/admin/exports`)
  - public (`/s/[slug]`, `/sign-out`)
  - contractor (`/contractor/portal`)
- UI changes should include visual baseline updates and reviewer sign-off.
