# UI/UX Performance Weekly Report

- Generated: 2026-03-26T08:12:58.492Z
- Status: **PASS**
- Checked routes: 5

| Route | LCP (ms) | LCP Budget | TBT Surrogate (ms) | TBT Budget | CLS | CLS Budget | INP (ms) | INP Budget | JS Transfer (bytes) | JS Budget | Utilization (LCP/TBT/CLS/INP/JS) | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `/login` | 52 | 2500 | 0 | 1500 | 0 | 0.15 | 40 | 350 | 125714 | 400000 | 2% / 0% / 0% / 11% / 31% | PASS |
| `/admin/sites` | 56 | 2500 | 0 | 3300 | 0 | 0.15 | 16 | 400 | 129782 | 575000 | 2% / 0% / 0% / 4% / 23% | PASS |
| `/admin/live-register` | 76 | 2500 | 98 | 3200 | 0 | 0.15 | 32 | 450 | 129919 | 625000 | 3% / 3% / 0% / 7% / 21% | PASS |
| `/admin/settings` | 124 | 2800 | 324 | 3500 | 0.025 | 0.15 | 80 | 450 | 141307 | 650000 | 4% / 9% / 17% / 18% / 22% | PASS |
| `/s/perf-budget-site-92s16v` | 80 | 2500 | 19 | 2200 | 0 | 0.1 | 16 | 350 | 201065 | 700000 | 3% / 1% / 0% / 5% / 29% | PASS |

## Notes
- Metrics are produced by `apps/web/e2e/performance-budget.spec.ts` on chromium stable lane.
- LCP uses the largest-contentful-paint browser entry (fallback: navigation DOMContentLoaded).
- TBT surrogate aggregates long-task blocking time above 50ms.
- CLS uses browser layout-shift entries without recent input.
- INP is approximated from browser event-duration entries to keep local chromium runs deterministic.
- JS transfer uses browser resource timings for script resources.

