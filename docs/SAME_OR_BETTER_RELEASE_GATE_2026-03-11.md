# Same-or-Better Release Gate (2026-03-11)

## Purpose

Define a strict pass/fail gate so UI/UX modernization can only ship when output is equal or better than the baseline across all tiers:

1. Standard
2. Plus
3. Pro
4. Add-ons

PR CI now enforces the fast branch gate in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) under job `e2e` (`E2E smoke (chromium)`), and it emits the branch-protection compatibility jobs `release-confidence` (`Release Confidence (E2E + Visual + Perf)`) and `branch-protection-full` (`Full (lint • typecheck • unit • integration • e2e • visual)`) from executable CI lanes instead of relying on stale required-check names.

## Pass/Fail Gates

1. Gate G1: Tier + parity control integrity
- `npm run parity-gate` must pass.
- Required parity rows must remain `implemented`.
- Matrix must contain implemented coverage for all plan targets: `Standard`, `Plus`, `Pro`, `Add-on`.

2. Gate G2: Branch smoke confidence
- `npm run -w apps/web test:e2e:smoke` must pass in Chromium.
- CI must run with `E2E_RETRIES=0`.

3. Gate G3: Broader release evidence
- `npm run test:gap-matrix` and `npm run test:e2e:gap-matrix -- --dynamic-links --js-flows --base-url http://localhost:3000` remain required for local/manual release confidence.
- PR CI keeps `E2E smoke (chromium)` as the branch e2e gate, and the `release-confidence` job adds `npm run -w apps/web test:e2e:stable:chromium`, `npm run -w apps/web test:e2e:stable:webkit`, `npm run -w apps/web test:e2e:stable:mobile-chrome`, `npm run -w apps/web test:e2e:stable:mobile-safari`, `npm run -w apps/web test:visual` when Linux baselines exist, `npm run -w apps/web test:e2e:perf-budget`, and `npm run report:ux-perf-budget` so required branch-protection contexts reflect real browser/device coverage instead of advisory-only recommendations.
- Scheduled GitHub validation in [`.github/workflows/nightly.yml`](../.github/workflows/nightly.yml) still runs the standalone localhost build for the broader nightly sweep, including desktop full-suite coverage plus the mobile Safari/mobile Chrome stable lanes and perf-budget evidence that remain deeper than the branch lane.

## CI Enforcement Contract

1. Job dependency chain
- `guardrails-lint`, `policy-check`, `guardrails-tests`, `parity-gate`, `quality`, and `integration` must pass before `e2e` runs.
- `release-confidence` depends on `quality`, `integration`, and `e2e`.
- `branch-protection-full` depends on `quality`, `integration`, `e2e`, and `release-confidence`.

2. Branch smoke block
- If any command in `e2e` fails, CI fails and merge is blocked.

3. Evidence artifacts
- CI uploads Playwright reports/logs for the smoke lane, release-confidence browser/device lanes, and perf/visual evidence as build artifacts.

## Local Reproduction (Exact Sequence)

Run from repository root after DB is up and migrated:

```bash
npm run parity-gate
npm run -w apps/web test:e2e:smoke
```

`npm run -w apps/web test:e2e:smoke` now defaults to the same production-style standalone server lifecycle used by CI and nightly validation. Only force `E2E_SERVER_MODE=dev` when investigating local dev-only behavior.

## Notes

1. This gate is quality-only and does not alter tenant data access patterns, CSRF controls, or budget guardrails.
2. PR CI emits the protected-branch compatibility contexts from smoke plus browser/device/visual/perf evidence, while the broader full-suite nightly runs remain available for deeper investigation without making every push pay the full cross-browser cost.
3. Any future addition to parity/tier commitments must update:
- [`COMPETITOR_PARITY_CONTROL_MATRIX.md`](./COMPETITOR_PARITY_CONTROL_MATRIX.md)
- [`APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md`](./APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md)
