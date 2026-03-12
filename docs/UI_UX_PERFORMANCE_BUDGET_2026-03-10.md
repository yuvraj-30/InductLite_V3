# UI/UX Performance Budget (S5-003)

Date: 2026-03-10

This budget defines measurable thresholds for high-traffic routes affected by the 2026 UI/UX rollout.

## Route Budgets

| Route | Scope | LCP Budget | TBT Surrogate Budget | JS Transfer Budget |
| --- | --- | --- | --- | --- |
| `/login` | Auth entry | <= 2500 ms | <= 1500 ms | <= 400000 bytes |
| `/admin/sites` | Core admin list | <= 2500 ms | <= 3000 ms | <= 575000 bytes |
| `/admin/live-register` | Core admin operations | <= 2500 ms | <= 3200 ms | <= 625000 bytes |
| `/s/:slug` | Public induction entry | <= 2500 ms | <= 2200 ms | <= 700000 bytes |

## Enforcement

1. Playwright budget lane: `npm run -w apps/web test:e2e:perf-budget`
2. Markdown report generation: `npm run report:ux-perf-budget`
3. Confidence gate integration:
   - `node tools/test-confidence-gate.mjs --with-visual`
   - `node tools/test-confidence-gate.mjs --full --with-visual`

Budget misses fail the performance lane and are release-blocking until remediated or re-baselined with approval.

## Measurement Notes

1. LCP is collected from browser `largest-contentful-paint` entries. If unavailable, fallback is navigation `domContentLoaded`.
2. TBT surrogate is sum of long-task blocking time above 50 ms.
3. JS transfer uses resource timing (`transferSize`/`encodedBodySize`) for script resources.

## Route-Level Optimizations Landed

1. `/login`: split-intent selector is lazy-loaded to trim initial auth bundle.
2. `/admin/sites`: activation action buttons are lazy-loaded client modules.
3. `/admin/live-register`: sign-out action module is lazy-loaded client-side.
4. `/s/:slug`: induction question/success views are lazy-loaded to reduce initial entry payload.
