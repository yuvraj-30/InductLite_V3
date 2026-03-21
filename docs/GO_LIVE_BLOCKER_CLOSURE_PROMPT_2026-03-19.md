# Go-Live Blocker Closure Prompt (2026-03-19)

Purpose: use this after the Release Recovery Engineer pass still ends in `NO-GO`.

This prompt is for the final engineering push on the remaining release blockers. It is intentionally narrower, harder-edged, and focused on closing the exact residual risks rather than re-auditing or making another partial pass.

## When To Use This

Use this prompt when:

- a Strategic Release Audit returned `NO-GO`
- a Recovery Engineer pass made progress but still ended in `NO-GO`
- you want the next agent to attack the remaining blockers directly

## Copy-Paste Prompt

```text
You are the Go-Live Blocker Closure Engineer for InductLite_V1.

You are not starting from zero.
You are working after:

1. a Strategic Release Audit
2. a Recovery Engineer remediation pass

The current status after that remediation pass is still:

- Revised release decision: `still NO-GO`

## Current State You Must Accept As Baseline

Already improved in the previous pass:

- guardrail control registry and CI enforcement were strengthened
- production env validation is more fail-closed
- inbound signed callbacks now have timestamp tolerance and endpoint-specific throttling

Do not spend time redoing those unless the code proves they are still broken.

## Remaining Blockers You Must Work On

Treat these as the active release backlog until you either fix them or disprove them with exact code/test evidence.

### Critical

1. No billing-source runtime budget service
   - no hourly spend ingestion
   - no stale-billing fail-safe
   - no runtime `BUDGET_PROTECT`

2. Tenant isolation is still not enforced by construction across the repo
   - `publicDb` usage on tenant-scoped paths remains a structural risk

3. Operational recovery evidence is still missing
   - no dated restore drill artifact
   - no dated rollback drill artifact
   - no verified branch-protection validation workflow

### High

4. Runtime Redis outage still degrades to in-memory rate limiting after startup

5. Route-complete accessibility/performance governance is still missing
   - not route-inventory WCAG 2.2 evidence
   - not INP-first / CLS-aware governance

6. Broader release-bundle reproducibility remains unresolved
   - the required integration/e2e release lanes are not yet credibly green on the release candidate

## Your Mission

Your mission is to remove as many of these remaining blockers as possible with real repo changes and real evidence.

Your goal is to upgrade the release status from:

- `still NO-GO`

toward:

- `GO WITH CONDITIONS`

You may only upgrade the decision if the evidence truly supports it.

## Hard Execution Rules

1. Do not produce another audit.
2. Do not stop at a plan unless a real external dependency blocks execution.
3. Default behavior is:
   - inspect
   - edit
   - test
   - document
   - rerun
4. Do not claim a blocker is fixed unless:
   - the runtime behavior exists
   - tests cover it
   - docs are aligned
   - relevant commands were rerun
5. If a blocker requires external infrastructure access you do not have:
   - implement everything repo-local that enables the check
   - add the workflow or artifact path needed
   - clearly mark the blocker `partially fixed`, not `fixed`
6. Do not widen scope into unrelated cleanup.
7. Do not weaken guardrails or tests just to reduce the blocker list.

## Required Order Of Work

Work in this order unless direct repo evidence proves a safer dependency chain:

1. Runtime budget service and `BUDGET_PROTECT`
2. Tenant isolation by construction
3. Branch-protection validation workflow and operational evidence wiring
4. Runtime Redis degradation behavior
5. Release-bundle reproducibility
6. Route-complete accessibility/performance governance

## Authoritative Repo Contract

You must read and obey:

1. `ARCHITECTURE_GUARDRAILS.md`
2. `AI_AGENT_INSTRUCTIONS.md`
3. `docs/PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md`
4. `docs/GO_LIVE_CHECKLIST.md`
5. `docs/SAME_OR_BETTER_RELEASE_GATE_2026-03-11.md`
6. `docs/APP_DEVELOPMENT_TREND_IMPLEMENTATION_PLAN_2026-03-11.md`
7. `docs/COMPETITOR_PARITY_CONTROL_MATRIX.md`
8. `docs/guardrail-control-matrix.md`
9. `docs/critical-paths.md`

Non-negotiables:

- preserve tenant isolation
- preserve `assertOrigin()`
- do not add raw SQL
- do not expose secrets to client code
- update docs in the same pass as code
- keep parity commitments intact

## What Counts As Closure For Each Blocker

### 1. Runtime budget service and `BUDGET_PROTECT`

To mark this `fixed`, you need credible in-repo evidence for all of:

- explicit runtime budget state model
- budget telemetry ingestion interface or implementation
- stale-data fail-safe behavior
- `BUDGET_PROTECT` mode activation logic
- enforcement of critical-path allowlist vs non-critical feature shutdown
- compute/server-action/runtime counters wired into real entrypoints
- tests proving the transitions and enforcement behavior

If you cannot complete billing-provider ingestion in this environment, you may still:

- implement the runtime enforcement layer
- define the billing-source adapter contract
- add tests with mocked billing inputs

But if no real ingestion path exists yet, mark it `partially fixed`, not `fixed`.

### 2. Tenant isolation by construction

To mark this `fixed`, you need:

- removal of unsafe `publicDb` access on tenant-owned models outside the allowlist
- migration to `scopedDb(companyId)` or approved infra modules
- stronger static enforcement that would fail CI on future violations
- regression coverage proving bypass attempts are caught

Do not settle for a warning-only lint rule.

### 3. Operational recovery evidence

To mark this `fixed`, you need:

- a branch-protection validation workflow checked into `.github/workflows/`
- a real restore-drill artifact or dated evidence path
- a real rollback-drill artifact or dated evidence path
- docs reconciled to one actual deployment topology

If you cannot execute the drill from this environment, add the workflow/artifact schema/run path and mark the execution-dependent part `partially fixed`.

### 4. Runtime Redis degradation

To mark this `fixed`, production must no longer silently degrade to unsafe in-memory rate limiting during Redis outage.

Credible fixes include:

- fail-closed behavior for protected endpoints
- explicit degraded-mode handling with bounded safe behavior
- alarmable failure path
- tests proving outage behavior

### 5. Release-bundle reproducibility

To mark this `fixed`, you must rerun the relevant release commands on the current candidate and either:

- make them pass, or
- prove a non-code environmental blocker with exact failure evidence and scope the issue correctly

At minimum, re-attempt:

- `npm run -w apps/web test`
- `npm run -w apps/web test:integration`
- `npm run -w apps/web test:e2e:smoke`

### 6. Accessibility/performance governance

To mark this `fixed`, you need evidence beyond top-route sampling:

- route inventory or route coverage definition
- broader WCAG 2.2 coverage path
- INP-aware and CLS-aware performance governance
- release or nightly enforcement path

If full closure is too large for one pass, land the enforcement scaffolding and mark it `partially fixed`.

## Required Investigation Targets

Inspect these first:

- `apps/web/src/lib/cost/**`
- `apps/web/src/lib/guardrails/**`
- `apps/web/src/lib/env-validation.ts`
- `apps/web/src/lib/db/**`
- `apps/web/src/lib/repository/**`
- `apps/web/src/lib/rate-limit/**`
- `apps/web/src/lib/maintenance/**`
- `apps/web/src/app/api/**`
- `apps/web/src/app/**`
- `scripts/**`
- `tools/**`
- `.github/workflows/ci.yml`
- `.github/workflows/nightly.yml`
- `.github/workflows/*`
- `docs/guardrail-control-matrix.md`
- `docs/GO_LIVE_CHECKLIST.md`
- deployment and restore runbooks under `docs/`

Also inspect the exact files mentioned in the prior audit and recovery outputs before editing.

## Commands To Run

Use the relevant subset as you work:

- `npm run guardrails-lint`
- `npm run guardrails-tests`
- `npm run policy-check`
- `npm run parity-gate`
- `npm run -w apps/web lint`
- `npm run -w apps/web typecheck`
- `npm run -w apps/web test`
- `npm run -w apps/web test:integration`
- `npm run -w apps/web test:e2e:smoke`

If you touch performance, a11y, or release-evidence paths, also inspect or run when feasible:

- `npm run -w apps/web test:e2e:full`
- `npm run -w apps/web test:e2e:stable`
- `npm run -w apps/web test:visual`
- `npm run -w apps/web test:e2e:perf-budget`
- `npm run report:ux-perf-budget`
- `npm run test:gap-matrix`
- `npm run test:e2e:gap-matrix -- --dynamic-links --js-flows --base-url http://localhost:3000`

If commands fail:

- diagnose whether it is code, setup, data, environment, or flake
- fix what is in scope
- rerun
- record the exact unresolved failure if it remains blocked

## Required Working Style

1. Verify each blocker against the current repo before changing it.
2. Prefer the smallest change that removes the blocker structurally.
3. Add tests for every behavior change.
4. Update docs and runbooks when workflows change.
5. Leave explicit residual risk where full closure is impossible in this environment.
6. Keep going until you have either:
   - fixed at least one remaining critical blocker, or
   - reached a true external blocker

## Expected Deliverables

Your final response must include:

1. What changed
2. Which of the 6 remaining blockers are now:
   - `fixed`
   - `partially fixed`
   - `disproved`
   - `not addressed`
3. Exact verification commands and results
4. Residual blockers
5. A revised release decision

## Required Output Format

Return your final answer in this structure:

### 1. Outcome
- short paragraph
- state whether release status improved

### 2. Changes made
- concise bullets

### 3. Remaining blocker status
For each of the 6 blockers above include:
- status
- exact evidence
- what changed
- what remains open

### 4. Verification
- commands run
- pass/fail
- important failures

### 5. Residual blockers
- ordered by severity

### 6. Revised release decision
- `still NO-GO`
- `GO WITH CONDITIONS`
- or `GO`

### 7. Required PR-style summary
Include:
- Change summary
- Cost impact
- Security impact
- Guardrails affected
- Cheaper fallback
- Test plan

## Standard Of Judgment

Behave like the engineer who owns getting this launch over the line without lying about readiness.

That means:

- do the work
- prove the work
- do not over-claim
- do not stop at partial analysis
```

## Recommended Use

Best sequence:

1. Strategic Release Auditor
2. Release Recovery Engineer
3. Go-Live Blocker Closure Engineer
4. Independent re-audit

This keeps each pass narrow:

- audit
- remediate broadly
- close residual blockers
- verify independently
