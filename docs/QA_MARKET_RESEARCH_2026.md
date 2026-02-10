# QA Market Research (Feb 10, 2026)

## Scope
This memo summarizes current QA/DevOps standards relevant to SaaS engineering as of **February 10, 2026**.

## Testing Trends (2026): Over-testing vs Under-testing

### External benchmark signals
- DORA 2024 (Google Cloud) emphasizes outcomes over raw test volume: software delivery performance is tied to reliability, platform engineering quality, and stable priorities, not just more checks.
- State of JavaScript 2024 testing trends show a clear shift toward faster feedback tooling and better developer ergonomics (notably Vitest momentum), while E2E remains critical but expensive.

### Assessment of this codebase
- This repo currently runs: lint, typecheck, unit, integration, coverage, smoke E2E, full E2E, full-all browser matrix, and visual regression.
- Compared to 2026 practice, this is **not under-tested**; if anything, it is **slightly over-gated for every merge**.
- Practical read: quality bar is strong, but cost/risk profile suggests splitting into:
  - Required merge gate: lint + typecheck + unit + integration + smoke E2E.
  - Scheduled/nightly or release gate: full matrix + visual + extended suites.

## Tooling Outlook (Jest/Playwright in 2026)

### Are Jest/Playwright being replaced?
- **Playwright**: still a leading E2E choice in modern JS stacks; no clear replacement with equal cross-browser maturity + CI ergonomics.
- **Jest**: still widely used, but **Vitest** adoption and sentiment are rising quickly in frontend/fullstack TS ecosystems.

### Current market direction (signal, not absolute market share)
- npm weekly downloads (last-week endpoints, checked Feb 10, 2026):
  - `jest`: 38,503,567
  - `vitest`: 30,429,069
  - `@playwright/test`: 18,371,223
  - `cypress`: 6,612,659
- Interpretation:
  - Jest remains very large in absolute usage.
  - Vitest is no longer niche and is now mainstream in modern TS projects.
  - Playwright has clear momentum relative to Cypress in ecosystem activity.
- For the specific query "Playwright vs Cypress market share in construction software": public, sector-specific market-share data is limited. The safest defensible proxy is ecosystem-level adoption plus internal telemetry from your own pipeline.

## NZ Compliance (Digital Safety / Privacy) Updates

### What changed recently
- The **Biometric Processing Privacy Code 2025** was issued under the Privacy Act 2020.
- Effective dates:
  - In force for new biometric processing from **November 3, 2025**.
  - Transition deadline for existing biometric processing: **August 3, 2026**.

### What remains active and important
- Privacy Act 2020 notifiable breach duties remain central:
  - Agencies must notify the Commissioner and affected individuals/public notice for notifiable privacy breaches as soon as practicable.

### Compliance impact for SaaS teams
- If your product uses facial recognition, fingerprinting, or other biometric identification workflows, 2026 implementation plans should include:
  - explicit purpose limitation,
  - proportionality checks,
  - stronger notice/consent UX,
  - retention/deletion controls,
  - auditable governance ahead of the August 3, 2026 transition cutoff.

## Recommended Actions for This Repo
1. Keep Playwright as primary E2E framework; focus on run stability and environment determinism.
2. Preserve broad suite coverage, but rebalance merge gates vs nightly/release gates to reduce pipeline drag.
3. Continue Jest where stable; evaluate incremental Vitest expansion in packages where startup speed and DX are bottlenecks.
4. Add a NZ compliance checklist in release governance if biometric or identity features are introduced.

## Sources
- DORA 2024 report: https://dora.dev/report/2024
- SLSA specification (site shows current v1.2 context): https://slsa.dev/spec/v1.0/
- NIST SSDF v1.1: https://csrc.nist.gov/pubs/sp/800/218/final
- NIST SSDF v1.2 draft announcement (Dec 17, 2025): https://www.nist.gov/news-events/news/2025/12/secure-software-development-framework-ssdf-version-12-available-public
- State of JavaScript 2024 (about): https://2024.stateofjs.com/en-US/about/
- State of JavaScript 2024 (testing): https://2024.stateofjs.com/en-US/libraries/testing/
- npm downloads API:
  - https://api.npmjs.org/downloads/point/last-week/%40playwright%2Ftest
  - https://api.npmjs.org/downloads/point/last-week/cypress
  - https://api.npmjs.org/downloads/point/last-week/jest
  - https://api.npmjs.org/downloads/point/last-week/vitest
- NZ Gazette notice (Biometric Processing Privacy Code 2025): https://gazette.govt.nz/notice/id/2025-sl4213
- NZ Privacy Commissioner biometrics focus page: https://www.privacy.org.nz/focus-areas/biometrics/
- NZ Privacy Commissioner code page: https://www.privacy.org.nz/privacy-principles/codes-of-practice/biometric-processing-privacy-code/
- NZ Privacy Act (notifiable breach duties):
  - Section 114: https://legislation.govt.nz/act/public/2020/0031/latest/LMS23503.html
  - Section 115: https://legislation.govt.nz/act/public/2020/0031/latest/LMS23504.html
