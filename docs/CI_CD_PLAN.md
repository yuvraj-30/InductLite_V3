# CI/CD Plan

## CI Gates

- Lint
- Typecheck
- Unit tests
- Integration tests
- Lean E2E merge gate in branch CI:
  - Desktop chromium smoke lane
  - Mobile-chrome smoke lane
  - Playwright retries disabled
- Competitor parity gate (`npm run parity-gate`) using [COMPETITOR_PARITY_CONTROL_MATRIX.md](COMPETITOR_PARITY_CONTROL_MATRIX.md)

## Nightly / Manual Full Validation

- Route coverage evidence generation
- Desktop chromium smoke lane
- Mobile-chrome smoke lane
- Visual regression snapshots
- Performance budget suite and report

## CD

- Deploy staging on main branch
- Promote to production after manual approval
