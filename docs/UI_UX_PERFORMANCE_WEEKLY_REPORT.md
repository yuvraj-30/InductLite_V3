# UI/UX Performance Weekly Report

- Generated: 2026-03-20T08:37:27.975Z
- Status: **PASS**
- Checked routes: 5

| Route | LCP (ms) | LCP Budget | TBT Surrogate (ms) | TBT Budget | CLS | CLS Budget | INP (ms) | INP Budget | JS Transfer (bytes) | JS Budget | Utilization (LCP/TBT/CLS/INP/JS) | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `/login` | 84 | 2500 | 29 | 1500 | 0 | 0.15 | 56 | 350 | 125748 | 400000 | 3% / 2% / 0% / 16% / 31% | PASS |
| `/admin/sites` | 368 | 2500 | 906 | 3300 | 0 | 0.15 | 248 | 400 | 129696 | 575000 | 15% / 27% / 0% / 62% / 23% | PASS |
| `/admin/live-register` | 104 | 2500 | 92 | 3200 | 0 | 0.15 | 16 | 450 | 129937 | 625000 | 4% / 3% / 0% / 4% / 21% | PASS |
| `/admin/settings` | 88 | 2800 | 198 | 3500 | 0.025 | 0.15 | 40 | 450 | 141069 | 650000 | 3% / 6% / 17% / 9% / 22% | PASS |
| `/s/perf-budget-site-755e7d` | 52 | 2500 | 0 | 2200 | 0 | 0.1 | 24 | 350 | 196451 | 700000 | 2% / 0% / 0% / 7% / 28% | PASS |

## Notes
- Metrics are produced by `apps/web/e2e/performance-budget.spec.ts` on chromium stable lane.
- LCP uses the largest-contentful-paint browser entry (fallback: navigation DOMContentLoaded).
- TBT surrogate aggregates long-task blocking time above 50ms.
- CLS uses browser layout-shift entries without recent input.
- INP is approximated from browser event-duration entries to keep local chromium runs deterministic.
- JS transfer uses browser resource timings for script resources.

