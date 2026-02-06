# Maintenance and Upgrade Plan

## Cadence

- Daily: check health, review error logs
- Weekly: review rate-limit metrics and export failures
- Monthly: update dependencies and run migrations
- Quarterly: run restore drill and review guardrails

## Automated Jobs

- Maintenance retention job: `npm run run:maintenance`
- Export scheduler: `npm run run:export-scheduler`

## Upgrade Strategy

- Use feature flags for risky changes.
- Run migrations during low-traffic windows.
- Prefer additive schema changes.
- Validate with smoke tests before full rollout.

## Dependency Updates

- Update Next.js/Prisma quarterly or on security advisories.
- Run `npm run lint`, `npm run typecheck`, and tests before deploy.
