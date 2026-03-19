# UI/UX Performance Weekly Report

- Generated: 2026-03-19T14:40:43.184Z
- Status: **FAIL**
- Checked routes: 5

| Route | LCP (ms) | LCP Budget | TBT Surrogate (ms) | TBT Budget | CLS | CLS Budget | INP (ms) | INP Budget | JS Transfer (bytes) | JS Budget | Utilization (LCP/TBT/CLS/INP/JS) | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `/login` | 232 | 2500 | 526 | 1500 | 0 | 0.15 | 48 | 350 | 2806592 | 400000 | 9% / 35% / 0% / 14% / 702% | FAIL |
| `/admin/sites` | 1164 | 2500 | 2081 | 3300 | 0 | 0.15 | 392 | 400 | 2914320 | 575000 | 47% / 63% / 0% / 98% / 507% | FAIL |
| `/admin/live-register` | 2192 | 2500 | 1166 | 3200 | 0 | 0.15 | 144 | 450 | 2912704 | 625000 | 88% / 36% / 0% / 32% / 466% | FAIL |
| `/admin/settings` | 364 | 2800 | 1960 | 3500 | 0 | 0.15 | 288 | 450 | 3093720 | 650000 | 13% / 56% / 0% / 64% / 476% | FAIL |
| `/s/perf-budget-site-fqtlvi` | 580 | 2500 | 1214 | 2200 | 0 | 0.1 | 96 | 350 | 3476143 | 700000 | 23% / 55% / 0% / 27% / 497% | FAIL |

## Notes
- Metrics are produced by `apps/web/e2e/performance-budget.spec.ts` on chromium stable lane.
- LCP uses the largest-contentful-paint browser entry (fallback: navigation DOMContentLoaded).
- TBT surrogate aggregates long-task blocking time above 50ms.
- CLS uses browser layout-shift entries without recent input.
- INP is approximated from browser event-duration entries to keep local chromium runs deterministic.
- JS transfer uses browser resource timings for script resources.

