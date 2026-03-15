# CI/CD Plan

## CI Gates

- Lint
- Typecheck
- Unit tests
- Integration tests
- E2E smoke tests
- Nightly full validation runs the broader desktop-browser suite from [`.github/workflows/nightly.yml`](../.github/workflows/nightly.yml) against the standalone localhost build and forces `SESSION_COOKIE_SECURE=0` there so Safari/WebKit does not drop auth cookies over plain HTTP.
- Competitor parity gate (`npm run parity-gate`) using [COMPETITOR_PARITY_CONTROL_MATRIX.md](COMPETITOR_PARITY_CONTROL_MATRIX.md)

## CD

- Deploy staging on main branch
- Promote to production after manual approval
