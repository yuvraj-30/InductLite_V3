# Release Strategy

## Environments

- Preview: per-PR builds for UI validation
- Staging: production-like, used for final smoke tests
- Production: customer traffic

## Release Gates

- Lint + typecheck
- Unit tests
- Integration tests (DB)
- E2E smoke suite
- Migration dry-run (deploy)

## Migration Discipline

- Prefer additive migrations
- Avoid data-destructive changes without a backfill plan
- Validate with staging before production
