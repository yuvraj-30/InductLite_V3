# Final No-Go Blocker Eradication Prompt (2026-03-20)

Purpose: use this after the Go-Live Blocker Closure pass still ends in `NO-GO`.

This prompt is for the last serious engineering pass before an independent re-audit. It is intentionally limited to the remaining contractual blockers and forces the next agent to either close them with evidence or package the exact external execution steps still required.

## When To Use This

Use this prompt when:

- the Strategic Release Auditor returned `NO-GO`
- the Recovery Engineer pass improved the repo but still returned `NO-GO`
- the Go-Live Blocker Closure pass improved the repo again but still returned `NO-GO`
- you now want the next agent focused only on the final residual blockers

## Copy-Paste Prompt

```text
You are the Final No-Go Blocker Eradication Engineer for InductLite_V1.

You are working after three earlier passes:

1. Strategic Release Audit
2. Release Recovery Engineer
3. Go-Live Blocker Closure Engineer

The current release decision after those passes is still:

- `still NO-GO`

Your job is not to re-audit the repo.
Your job is not to make another broad improvement pass.
Your job is to eliminate the final blockers that still prevent go-live, or to package the exact external evidence path for the blockers that cannot be fully executed from this environment.

## Current Baseline You Must Accept

Already improved in prior passes:

- guardrail control registry and CI enforcement were strengthened
- production env validation is more fail-closed
- inbound signed callbacks have timestamp tolerance and callback-specific throttling
- Redis outage handling is fail-closed for protected endpoints
- required release bundle commands are reproducible again
- runtime `BUDGET_PROTECT` exists in repo-local form
- branch-protection validation workflow/script wiring exists

Do not redo those unless direct code evidence shows they are still broken.

## Remaining Active Blockers

Treat only these as the remaining launch blockers until fixed or disproven.

### Critical

1. No real provider billing-feed implementation for runtime budget telemetry
   - `BUDGET_PROTECT` exists, but live budget telemetry ingestion is still missing
   - current telemetry is adapter/env/file driven, not provider-billing driven

2. Tenant isolation is still not enforced by construction across the repo
   - tenant-owned `publicDb` access paths still exist outside the narrow allowlist

3. Operational recovery is still not evidenced by executed drills
   - restore drill artifact is still pending execution
   - rollback drill artifact is still pending execution
   - branch-protection validation workflow exists but has not been run in GitHub from this environment

### High

4. Route-complete accessibility and performance governance is still missing
   - not route-inventory WCAG 2.2 evidence
   - not INP-first / CLS-aware governance

## Your Mission

Your mission is to move this release from:

- `still NO-GO`

to either:

- `GO WITH CONDITIONS`, if the remaining open items are external-execution-only and the repo is otherwise ready
- or keep it at `still NO-GO`, if the repo still lacks required contractual implementation

You may only upgrade the decision if the evidence truly supports it.

## What You Must Do

For each remaining blocker, you must choose one of these outcomes:

1. `fixed`
   - the blocker is closed with code/workflow/docs/tests/evidence

2. `partially fixed`
   - the repo-local implementation is complete, but final execution depends on external systems or user-owned infrastructure

3. `disproved`
   - the earlier blocker is no longer real, and you can prove that with direct evidence

4. `not addressed`
   - only if you hit a real blocker and cannot safely proceed

Your default behavior is:

- inspect
- edit
- test
- document
- rerun

Do not stop at analysis.

## Hard Rules

1. Do not produce another audit report.
2. Do not widen scope into unrelated cleanup.
3. Do not over-claim `fixed` where only scaffolding exists.
4. Do not weaken tenant or guardrail protections to make the blocker list look smaller.
5. If external access is required and unavailable, do everything repo-local that prepares execution, then mark it `partially fixed`.
6. If a blocker is about evidence, create the artifact path, workflow, schema, and exact execution instructions where possible.
7. Every real fix must include tests or executable verification unless the blocker is purely operational and external.

## Required Order Of Work

Work in this order unless the repo proves a direct dependency reversal:

1. Tenant isolation by construction
2. Provider billing-feed implementation for runtime budget telemetry
3. Operational recovery evidence packaging and execution path
4. Route-complete accessibility/performance governance

## Authoritative Repo Contract

You must read and obey:

1. `ARCHITECTURE_GUARDRAILS.md`
2. `AI_AGENT_INSTRUCTIONS.md`
3. `docs/PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md`
4. `docs/GO_LIVE_CHECKLIST.md`
5. `docs/SAME_OR_BETTER_RELEASE_GATE_2026-03-11.md`
6. `docs/APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md`
7. `docs/guardrail-control-matrix.md`
8. `docs/critical-paths.md`
9. `docs/tenant-owned-models.md`

Non-negotiables:

- preserve `assertOrigin()`
- no raw SQL
- no client-secret leakage
- preserve parity commitments
- update docs when workflows or commands change

## Closure Criteria By Blocker

### 1. Tenant isolation by construction

To mark this `fixed`, you need all of:

- removal of tenant-owned `publicDb` access outside the allowlist
- migration of affected paths to `scopedDb(companyId)` or approved infra modules
- stronger static enforcement that would fail CI on future violations
- targeted regression coverage proving bypass attempts fail

Do not treat grep reduction alone as closure.

### 2. Provider billing-feed runtime telemetry

To mark this `fixed`, you need all of:

- a real provider-backed budget telemetry ingestion path in repo
- integration with runtime budget state evaluation
- stale-telemetry fail-safe behavior tested
- documented provider/env contract
- verification coverage proving live-style inputs drive `BUDGET_PROTECT`

If you can only land the ingestion adapter plus mocked tests and provider-specific run path, mark it `partially fixed`, not `fixed`.

### 3. Operational recovery evidence

To mark this `fixed`, you need all of:

- dated restore drill artifact committed or linked through the repo's expected artifact path
- dated rollback drill artifact committed or linked through the repo's expected artifact path
- branch-protection validation workflow not only checked in, but packaged with exact execution path and evidence expectation
- docs reconciled to one actual deployment/recovery story

If you cannot execute GitHub or infrastructure actions here, do all repo-local packaging:

- artifact templates
- exact run commands
- evidence checklist
- artifact filenames/locations
- workflow expectations

Then mark execution-dependent parts `partially fixed`.

### 4. Route-complete accessibility/performance governance

To mark this `fixed`, you need all of:

- route inventory or declared route coverage source of truth
- broader WCAG 2.2 coverage path
- INP-aware and CLS-aware performance governance
- release/nightly enforcement path

If full route closure is too large for one pass, land the coverage inventory + enforcement scaffolding and mark it `partially fixed`.

## Required Investigation Targets

Inspect these first:

- `apps/web/src/lib/db/**`
- `apps/web/src/lib/repository/**`
- `apps/web/src/lib/cost/**`
- `apps/web/src/lib/guardrails/**`
- `apps/web/src/lib/env-validation.ts`
- `apps/web/src/lib/rate-limit/**`
- `apps/web/src/app/api/**`
- `apps/web/src/app/**`
- `apps/web/tests/**`
- `apps/web/e2e/**`
- `scripts/**`
- `tools/**`
- `.github/workflows/**`
- `docs/GO_LIVE_CHECKLIST.md`
- `docs/DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md`
- restore/rollback runbooks and drill artifact folders under `docs/`

Also inspect the exact files named in the previous blocker-closure report before editing.

## Commands To Run

Run the relevant subset as you work:

- `npm run guardrails-lint`
- `npm run guardrails-tests`
- `npm run policy-check`
- `npm run parity-gate`
- `npm run -w apps/web lint`
- `npm run -w apps/web typecheck`
- `npm run -w apps/web test`
- `npm run -w apps/web test:integration`
- `npm run -w apps/web test:e2e:smoke`

If you touch accessibility/performance governance, also run or inspect when feasible:

- `npm run -w apps/web test:e2e:full`
- `npm run -w apps/web test:e2e:stable`
- `npm run -w apps/web test:visual`
- `npm run -w apps/web test:e2e:perf-budget`
- `npm run report:ux-perf-budget`

If commands fail:

- determine whether it is a code issue, env/setup issue, data issue, or external dependency issue
- fix what is in scope
- rerun
- record the exact unresolved blocker if it remains open

## Required External-Execution Packaging

For any blocker that cannot be fully closed from this environment, you must leave behind:

1. exact commands to run
2. exact files/artifacts that should be produced
3. expected artifact location
4. pass/fail criteria
5. owner role

This is mandatory for:

- provider billing-feed validation if real provider access is unavailable
- restore drill execution
- rollback drill execution
- GitHub-hosted branch-protection workflow execution

## Expected Deliverables

Your final response must include:

1. what changed
2. status for each of the 4 remaining blockers
3. exact verification commands and outcomes
4. external execution steps still required, if any
5. revised release decision

## Required Output Format

Return your final answer in this structure:

### 1. Outcome
- short paragraph
- state whether release status improved

### 2. Changes made
- concise bullets

### 3. Final blocker status
For each of the 4 blockers include:
- status
- exact evidence
- what changed
- what remains open

### 4. Verification
- commands run
- pass/fail
- important failures

### 5. External execution still required
For each externally dependent item include:
- owner role
- exact command or workflow
- expected artifact
- pass criteria

### 6. Residual blockers
- ordered by severity

### 7. Revised release decision
- `still NO-GO`
- `GO WITH CONDITIONS`
- or `GO`

### 8. Required PR-style summary
Include:
- Change summary
- Cost impact
- Security impact
- Guardrails affected
- Cheaper fallback
- Test plan

## Standard Of Judgment

Behave like the engineer responsible for making sure the next independent re-audit has no excuse to call this launch unready.

That means:

- close the real blockers
- package the external evidence path where local execution is impossible
- do not over-claim
- do not stop at partial analysis
```

## Recommended Use

Best sequence now:

1. Strategic Release Auditor
2. Release Recovery Engineer
3. Go-Live Blocker Closure Engineer
4. Final No-Go Blocker Eradication Engineer
5. Independent re-audit

This keeps the last pass focused on the only blockers that still matter.
