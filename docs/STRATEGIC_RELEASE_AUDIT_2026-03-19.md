# Strategic Release Audit

Date: 2026-03-19
Auditor: Strategic Release Auditor
Target: InductLite go-live readiness
Decision: `NO-GO`

## 1. Executive decision

`NO-GO`

The repo has real depth, and some important foundations are present: parity gating, entitlements, broad `assertOrigin()` coverage, encryption for sensitive fields, and a structured CI pipeline. But it is not meeting its own 2026 industrial-grade release contract: budget-protect and monthly cost controls are largely docs-only, tenant isolation is not uniformly enforced "by construction," and operational release evidence (restore/rollback/branch-protection) is missing or contradictory.

## 2. Industrial-grade scorecard

| Area | Score | Justification |
| --- | --- | --- |
| Security and tenant isolation | 2/5 | CSRF and encrypted-data patterns exist, but tenant-owned data is still widely accessed through `publicDb` outside the narrow allowlist. |
| Guardrails and FinOps enforcement | 1/5 | Some export/upload/message caps exist, but environment budget ceilings, billing-driven `BUDGET_PROTECT`, and compute/runtime enforcement are not credibly wired into runtime. |
| Operational resilience and rollback readiness | 2/5 | Health endpoints, cron automation, and runbooks exist, but there is no dated restore/rollback drill evidence and the deployment docs conflict on topology. |
| Tier completeness and parity integrity | 3/5 | Parity gate and entitlements are real, but broader cross-tier runtime evidence is partial rather than release-grade. |
| UX quality and industrial coherence | 3/5 | The public homepage and admin shell are intentional and product-like, but route-complete deterministic-state evidence is still weak. |
| Accessibility and performance governance | 2/5 | Top-route axe and perf tests exist, but this is not route-level WCAG 2.2 proof and not INP-first governance. |
| Release evidence and CI enforcement | 2/5 | CI sequencing is decent, but the "guardrail" scripts are shallow and the broader release bundle was not reproducible in this audit workspace. |
| Documentation and policy integrity | 2/5 | The repo is well-documented, but key policy artifacts are incomplete and some go-live/runbook documents contradict each other. |

## 3. Release blockers

- `Critical` Budget-protect and monthly cost ceilings are not actually implemented. Why it matters: the release contract says budget safety is a design invariant and a release failure if violated. Evidence: [guardrails.ts](../apps/web/src/lib/guardrails.ts) silently defaults `ENV_BUDGET_TIER` to `MVP` and numeric caps to fallback values; [env-validation.ts](../apps/web/src/lib/env-validation.ts) marks budget guardrail env vars optional; `rg -n "BUDGET_PROTECT|MAX_MONTHLY_EGRESS_GB|MAX_MONTHLY_STORAGE_GB|MAX_MONTHLY_JOB_MINUTES|MAX_MONTHLY_SERVER_ACTION_INVOCATIONS" apps/web/src scripts tools` found no runtime enforcement beyond docs; [compute-counters.ts](../apps/web/src/lib/cost/compute-counters.ts) exists, but `rg -n "recordComputeInvocation\\(|recordComputeRuntimeMinutes\\(" -g"*.ts" -g"*.tsx" .` showed it is only referenced by its own test. Violates: `ARCHITECTURE_GUARDRAILS.md` sections 1, 4, 7. Likely production failure mode: runaway spend, no 80%/100% circuit breaker, stale billing never triggering fail-safe, and quotas that exist only on paper. Minimal credible fix: implement a real budget service with billing-source ingestion, stale-data fail-safe, runtime `BUDGET_PROTECT`, wired compute counters on every entrypoint, and fail-closed env validation.

- `Critical` The required guardrail control registry is incomplete, which the repo defines as release-blocking. Why it matters: if the control matrix is incomplete, CI can go green while mandatory controls are unmapped and unowned. Evidence: [guardrail-control-matrix.md](./guardrail-control-matrix.md) lists 39 controls, but `rg -n "FEATURE_PUBLIC_SIGNIN_ENABLED|FEATURE_UPLOADS_ENABLED|SMS_ENABLED|RL_ADMIN_PER_IP_PER_MIN|RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN|MAX_CONCURRENT_EXPORTS_GLOBAL" docs/guardrail-control-matrix.md` returned no hits, while the same search against [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md) returned required MUST controls. The CI scripts also under-check this: [guardrails-lint.mjs](../scripts/guardrails-lint.mjs) validates only a small hard-coded subset, and [policy-check.mjs](../scripts/policy-check.mjs) requires only 8 matrix IDs. Violates: `ARCHITECTURE_GUARDRAILS.md` sections 4 and 7. Likely production failure mode: undocumented kill switches, abuse controls, and messaging controls drift without CI catching it. Minimal credible fix: complete the matrix for every MUST-level control, assign `CONTROL_ID`/owner/test mapping for each, and update CI to verify full coverage rather than a hand-picked subset.

- `Critical` Tenant isolation is not consistently enforced "by construction." Why it matters: the repo contract explicitly requires tenant-owned data access through `scopedDb(companyId)` or approved infra modules, not raw unscoped clients with manual filters. Evidence: [public-db.ts](../apps/web/src/lib/db/public-db.ts) says `publicDb` is only for a small allowlist, but [question.repository.ts](../apps/web/src/lib/repository/question.repository.ts) uses `publicDb.inductionQuestion.findFirst/findMany`, [public-signin.repository.ts](../apps/web/src/lib/repository/public-signin.repository.ts) uses `publicDb.signInRecord.findFirst`, [email/worker.ts](../apps/web/src/lib/email/worker.ts) uses `publicDb.contractorDocument/contractor/auditLog`, and [retention.ts](../apps/web/src/lib/maintenance/retention.ts) uses `publicDb.exportJob/contractorDocument/signInRecord/auditLog` across tenant-owned models. The lint rule is not a hard enforcement layer: [eslint-plugin-security/index.js](../apps/web/eslint-plugin-security/index.js) describes `require-company-id` as a heuristic `suggestion`. Violates: `ARCHITECTURE_GUARDRAILS.md` section 3.1 and `AI_AGENT_INSTRUCTIONS.md`. Likely production failure mode: future manual-filter mistakes create cross-tenant read/write regressions that CI is structurally weak at preventing. Minimal credible fix: ban `publicDb` on tenant-owned models outside an explicit allowlist, move affected repos/workers to `scopedDb` or approved infra modules, and add integration tests that prove bypass attempts fail.

- `Critical` Operational recovery and release-governance evidence is not launch-grade. Why it matters: the go-live plan requires rollback/restore confidence, and architecture requires weekly branch-protection validation. Evidence: [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) still has unchecked items for secrets rotation, PITR, Upstash, worker deployment, and observability; [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) expects a Render worker service, while [DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md](./DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md) documents a single web service with cron routes; [RUNBOOK_RESTORE_DRILL.md](./RUNBOOK_RESTORE_DRILL.md) is only a template, and `rg -n "restore drill result|rollback drill|incident response|Sev1|Sev2|branch-protection|required rules|weekly.*branch" docs .github/workflows apps/web/src` found planning references but no executed drill artifact or branch-protection validation workflow. Violates: `ARCHITECTURE_GUARDRAILS.md` governance/resilience requirements and [PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md](./PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md). Likely production failure mode: restore or rollback during an incident is unproven, and required GitHub protections can drift without detection. Minimal credible fix: execute and archive restore/rollback drills, add the missing scheduled branch-protection validation workflow, reconcile deployment docs to one real topology, and close checklist items with evidence links.

## 4. High-risk gaps that may not be immediate blockers

- `High` Production rate limiting fails open to in-memory behavior if Upstash is absent. Evidence: [env-validation.ts](../apps/web/src/lib/env-validation.ts) only warns when Upstash is missing, and [rate-limit/index.ts](../apps/web/src/lib/rate-limit/index.ts) falls back to in-memory limiters. Violates: go-live checklist infra readiness and production-safe abuse control expectations. Failure mode: cluster-unsafe throttling or inconsistent abuse control under multi-instance or failover scenarios. Minimal fix: require Upstash in production or document and enforce a single-instance exception with explicit risk acceptance.

- `High` Inbound channel/webhook callbacks do not enforce timestamp tolerance or endpoint-specific rate limiting. Evidence: [channel actions route](../apps/web/src/app/api/integrations/channels/actions/route.ts) verifies HMAC and idempotency, but there is no timestamp window check and no route-level rate limit. Violates: `ARCHITECTURE_GUARDRAILS.md` webhook authenticity/replay requirements. Failure mode: replayable signed requests and higher blast radius for abuse. Minimal fix: require signed timestamp headers, enforce tolerance, add per-endpoint rate limits, and test replay rejection.

- `High` Accessibility/performance governance is still top-route and legacy-metric oriented, not route-complete and INP-first. Evidence: [a11y.spec.ts](../apps/web/e2e/a11y.spec.ts) covers 19 admin routes plus 3 public routes, not the full route inventory; [performance-budget.spec.ts](../apps/web/e2e/performance-budget.spec.ts) measures only `/login`, `/admin/sites`, `/admin/live-register`, and `/s/:slug`, and it checks LCP/TBT-surrogate/JS bytes, not INP/CLS; [apps/web/package.json](../apps/web/package.json) excludes `Accessibility Checks` from `test:e2e:full`. Violates: [APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md](./APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md). Failure mode: enterprise-grade UX claims outpace actual evidence, especially on less-traveled routes. Minimal fix: make route-inventory a11y and INP/CLS budgets release-blocking in CI/nightly.

- `High` The broader release command bundle was not reproducible in this audit workspace. Evidence: `npm run -w apps/web test` failed with 8 timeouts, including `src/lib/maintenance/scheduler.test.ts`, `src/app/admin/resources/page.test.ts`, `src/app/admin/templates/page.test.ts`, `src/app/admin/permits/templates/page.test.ts`, `src/app/api/test/process-next-export/route.test.ts`, `src/app/s/[slug]/kiosk/page.test.ts`, and two contractor-document route smoke tests; `npm run -w apps/web test:integration` timed out after 10 minutes with no conclusive result; `npm run -w apps/web test:e2e:smoke` timed out after 15 minutes with no conclusive result. Violates: the repo's own must-pass command lists in go-live and trend-plan docs. Failure mode: weak incident-time reproducibility and fragile confidence when the team most needs reliable gates. Minimal fix: stabilize or platform-scope these lanes, then publish passing CI/nightly artifacts tied to the release candidate.

## 5. False confidence and evidence gaps

- Executable checks that did pass in this audit were narrow: `npm run guardrails-lint`, `npm run guardrails-tests`, `npm run policy-check`, `npm run parity-gate`, `npm run -w apps/web lint`, and `npm run -w apps/web typecheck`.
- [guardrails-tests.mjs](../scripts/guardrails-tests.mjs) is mostly a string-pattern check over 5 files plus 2 tiny tests; it does not prove runtime guardrail behavior.
- [policy-check.mjs](../scripts/policy-check.mjs) checks artifact presence and a few strings/IDs, not policy completeness or runtime wiring.
- [guardrails-lint.mjs](../scripts/guardrails-lint.mjs) validates only a curated subset of matrix rows, which is why an incomplete control matrix can still pass.
- `parity-gate` is useful, but it mainly verifies matrix structure, refs, and statuses; it does not prove end-to-end cross-tier behavior.
- The docs themselves imply readiness more strongly than the evidence supports: [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) is still mostly unchecked, [RUNBOOK_RESTORE_DRILL.md](./RUNBOOK_RESTORE_DRILL.md) has no recorded drill result, and the trend docs still admit WCAG/INP coverage is incomplete.

## 6. Tier and flow coverage table

| Item | Status | Assessment |
| --- | --- | --- |
| Standard | partially verified | Required parity rows exist and parity-gate passes, but full release-grade runtime evidence was not reproduced here. |
| Plus | partially verified | Server-side entitlements and feature surfaces exist, but audit coverage was more structural than end-to-end. |
| Pro | partially verified | Pro connectors/analytics are present in code and docs, but enterprise-grade operational evidence is still weak. |
| Add-ons | partially verified | SMS/hardware/geofence foundations exist, but I did not verify add-on setup/failure/rollback end-to-end. |
| login/auth | partially verified | Auth code, unit tests, and smoke coverage exist, but smoke was not completed in this workspace. |
| public sign-in/sign-out | partially verified | Core code and parity references are strong, but the release smoke lane did not complete in this audit. |
| induction completion | partially verified | The public induction flow is heavily implemented, but I do not have a completed audit-run artifact proving end-to-end success. |
| exports | partially verified | Export quotas and routes exist, but budget-protect/egress governance and end-to-end runtime evidence are incomplete. |
| uploads | partially verified | MIME/magic-byte controls exist in code and tests, but I did not complete a prod-like upload flow verification. |
| reminders/notifications | partially verified | Worker logic and unit tests exist, but delivery/retry success was not proven with release artifacts. |
| admin high-frequency tasks | partially verified | Admin surfaces are broad and deliberate, but many tests are smoke-imports rather than task-level reliability proof. |
| rollback/recovery path | documented only | Runbooks exist, but I found no dated restore drill, rollback drill, or incident-readiness artifact. |

## 7. Top 10 actions before go-live

1. Platform lead: implement real billing-fed budget enforcement and `BUDGET_PROTECT`. Why now: this is the cleanest way to remove the largest contractual blocker. Expected evidence: passing runtime tests, stale-billing fail-safe tests, and CI artifacts showing enforced 80%/100% behavior.
2. Security lead + backend lead: eliminate `publicDb` usage on tenant-owned models outside the explicit allowlist. Why now: this is the core tenant-isolation integrity issue. Expected evidence: repo-wide grep clean-up, strengthened lint rule, and integration tests that catch bypasses.
3. Release engineer: rebuild `docs/guardrail-control-matrix.md` from the authoritative guardrails and fail CI on any missing MUST control. Why now: the policy artifact is currently invalid by the repo's own rules. Expected evidence: complete matrix diff plus stricter `guardrails-lint`/`policy-check` output.
4. QA lead: stabilize and rerun the release command bundle on the release candidate. Why now: the repo's required commands are not currently good evidence from this workspace. Expected evidence: archived results for unit, integration, smoke, stable, visual, perf-budget, and parity/guardrail lanes.
5. Ops owner: execute a PITR restore drill and rollback drill against a production-like snapshot. Why now: recoverability is currently only documented, not proven. Expected evidence: dated drill report with RPO/RTO actuals, timing, issues, and sign-off.
6. DevOps owner: add the missing scheduled branch-protection validation workflow. Why now: governance drift should be detected automatically before launch. Expected evidence: new workflow in `.github/workflows/` plus at least one successful scheduled/manual run artifact.
7. Platform/SRE: remove or formally constrain the in-memory production rate-limit fallback. Why now: abuse control should not silently degrade in production. Expected evidence: prod env validation fails without Upstash, or an explicit single-instance exception record with compensating controls.
8. Integrations engineer: add timestamp tolerance and route-specific rate limiting to inbound signed callbacks. Why now: current HMAC-only verification is replay-weaker than the contract requires. Expected evidence: route tests for expired/tampered/replayed requests and rate-limit tests.
9. Accessibility owner: expand WCAG evidence from top-route sampling to route inventory coverage. Why now: the 2026 industrial-grade claim depends on route-level evidence, not a sample. Expected evidence: route inventory mapping plus passing a11y artifacts in CI/nightly.
10. Frontend performance owner: add INP and CLS governance and make the perf report release-blocking. Why now: current budgets are too narrow and use pre-INP governance. Expected evidence: CI/nightly reports covering INP/LCP/CLS across the agreed route set with enforced thresholds.

## 8. What would change the decision

- `NO-GO -> GO WITH CONDITIONS`: I would need four things: real budget-protect/cost-cap runtime enforcement, by-construction tenant-scope remediation with stronger CI enforcement, a complete control matrix plus branch-protection validation workflow, and dated restore/rollback drill evidence with a reproducible passing release bundle.
- `GO WITH CONDITIONS -> GO`: I would then need successful broader release evidence on the exact release candidate, closed go-live checklist items with linked artifacts, and staged rollout KPI evidence that matches the thresholds in [PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md](./PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md).
