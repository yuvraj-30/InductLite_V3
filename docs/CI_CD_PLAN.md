# CI/CD Plan

## CI Gates

- Lint
- Typecheck
- Unit tests
- Integration tests
- Lean E2E merge gate in branch CI:
  - Desktop non-visual Playwright coverage
  - Mobile stable matrix
  - Playwright retries disabled
- Competitor parity gate (`npm run parity-gate`) using [COMPETITOR_PARITY_CONTROL_MATRIX.md](COMPETITOR_PARITY_CONTROL_MATRIX.md)

## Nightly / Manual Full Validation

- Route coverage evidence generation
- Desktop non-visual Playwright coverage
- Mobile stable matrix
- Visual regression snapshots
- Performance budget suite and report

## CD

- Deploy staging on main branch
- Promote to production after manual approval
