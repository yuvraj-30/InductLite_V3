# Sentry status (Next.js 16)

Sentry is currently **not installed** because the official @sentry/nextjs package only lists support for Next.js 13.2–15, and this repo runs Next.js 16. Installing it causes dependency resolution conflicts.

## Current approach

- OpenTelemetry is enabled for server runtime tracing (see apps/web/src/lib/observability/otel.ts and apps/web/src/instrumentation.ts).
- Sentry config files remain in the repo, and next.config.js loads Sentry **only if** the package is installed.

## Re‑enable Sentry later

When @sentry/nextjs supports Next.js 16+:

1. Add @sentry/nextjs back to apps/web/package.json dependencies.
2. Run npm install.
3. Configure Sentry using the wizard:
   npx @sentry/wizard@latest -i nextjs
4. Set SENTRY_DSN and any required build plugin env vars.

## Why this choice

This avoids broken dependency resolution while keeping the repo ready to re‑enable Sentry once compatibility is official.
