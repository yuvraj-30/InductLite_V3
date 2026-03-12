# Same-or-Better Release Gate (2026-03-11)

## Purpose

Define a strict pass/fail gate so UI/UX modernization can only ship when output is equal or better than the baseline across all tiers:

1. Standard
2. Plus
3. Pro
4. Add-ons

This gate is enforced by CI in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) under job `e2e` (`Release Confidence (E2E + Visual + Perf)`).

## Pass/Fail Gates

1. Gate G1: Tier + parity control integrity
- `npm run parity-gate` must pass.
- Required parity rows must remain `implemented`.
- Matrix must contain implemented coverage for all plan targets: `Standard`, `Plus`, `Pro`, `Add-on`.

2. Gate G2: Coverage evidence generation
- `npm run test:gap-matrix` must run successfully.
- `npm run test:e2e:gap-matrix -- --dynamic-links --js-flows --base-url http://localhost:3000` must run successfully.

3. Gate G3: Functional journey confidence
- `npm run -w apps/web test:e2e:full` must pass.
- `npm run -w apps/web test:e2e:stable` must pass.

4. Gate G4: Visual non-regression confidence
- Linux visual baselines must exist in `apps/web/e2e/visual-regression.spec.ts-snapshots/*-linux.png`.
- `npm run -w apps/web test:visual` must pass.

5. Gate G5: Performance budget confidence
- `npm run -w apps/web test:e2e:perf-budget` must pass.
- `npm run report:ux-perf-budget` must pass and produce `docs/UI_UX_PERFORMANCE_WEEKLY_REPORT.md`.

## CI Enforcement Contract

1. Job dependency chain
- `guardrails-lint`, `policy-check`, `guardrails-tests`, `parity-gate`, `quality`, and `integration` must pass before `e2e` runs.

2. Release confidence block
- If any command in `e2e` fails, CI fails and merge is blocked.

3. Evidence artifacts
- CI uploads Playwright reports/logs, test gap matrices, and the performance weekly report as build artifacts.

## Local Reproduction (Exact Sequence)

Run from repository root after DB is up and migrated:

```bash
npm run parity-gate
npm run test:gap-matrix
npm run test:e2e:gap-matrix -- --dynamic-links --js-flows --base-url http://localhost:3000
npm run -w apps/web test:e2e:full
npm run -w apps/web test:e2e:stable
npm run -w apps/web test:visual
npm run -w apps/web test:e2e:perf-budget
npm run report:ux-perf-budget
```

## Notes

1. This gate is quality-only and does not alter tenant data access patterns, CSRF controls, or budget guardrails.
2. Any future addition to parity/tier commitments must update:
- [`COMPETITOR_PARITY_CONTROL_MATRIX.md`](./COMPETITOR_PARITY_CONTROL_MATRIX.md)
- [`APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md`](./APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md)
