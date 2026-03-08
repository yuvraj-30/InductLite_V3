# CI/CD Plan

## CI Gates

- Lint
- Typecheck
- Unit tests
- Integration tests
- E2E smoke tests
- Competitor parity gate (`npm run parity-gate`) using [COMPETITOR_PARITY_CONTROL_MATRIX.md](COMPETITOR_PARITY_CONTROL_MATRIX.md)

## CD

- Deploy staging on main branch
- Promote to production after manual approval
