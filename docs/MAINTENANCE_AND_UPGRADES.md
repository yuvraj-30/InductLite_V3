# Maintenance and Upgrade Plan

## Cadence

- Daily: check health, review error logs
- Weekly: review rate-limit metrics and export failures
- Monthly: update dependencies and run migrations
- Quarterly: run restore drill and review guardrails

## Automated Jobs

- Maintenance retention job: `npm run run:maintenance`
- Maintenance flow also processes the email queue (host notifications + pre-registration reminder batches + contractor document expiry reminders).
- Maintenance flow also processes the outbound webhook queue (signed delivery, retry/backoff, dead-letter transitions).
- Export scheduler: `npm run run:export-scheduler`

## Feature State Maintenance Notes

- Quiz scoring retry/cooldown state is persisted per visitor/site/template in `InductionQuizAttempt` and updated inline during public sign-in submissions (no separate cron required).
- Template quiz policy changes (`quiz_scoring_enabled`, threshold, attempts, cooldown, required-for-entry) should be rolled out with draft-template edits first, then publish/version promotion.

## Upgrade Strategy

- Use feature flags for risky changes.
- Run migrations during low-traffic windows.
- Prefer additive schema changes.
- Validate with smoke tests before full rollout.

## Dependency Updates

- Update Next.js/Prisma quarterly or on security advisories.
- Run `npm run lint`, `npm run typecheck`, and tests before deploy.
