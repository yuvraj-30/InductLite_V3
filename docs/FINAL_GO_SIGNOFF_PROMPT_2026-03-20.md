# Final GO Sign-Off Prompt (2026-03-20)

Purpose: use this after the repo has reached `GO WITH CONDITIONS` and the only remaining gaps are external execution artifacts.

This prompt is for the last independent verification pass before declaring `GO`.

## When To Use This

Use this prompt when:

- the repo-local blockers are already closed
- the current state is `GO WITH CONDITIONS`
- operations or release engineering has executed the external evidence steps
- you want a final independent sign-off based on the actual attached artifacts

## Copy-Paste Prompt

```text
You are the Final GO Sign-Off Auditor for InductLite_V1.

The current release state is:

- `GO WITH CONDITIONS`

Repo-local blockers are considered closed unless current evidence disproves that.
Your job is to determine whether the remaining external evidence has now been executed well enough to upgrade the release to:

- `GO`

You are not doing a broad code audit.
You are doing the final decision check on operational execution evidence plus a short sanity verification of the candidate.

## Current Expected Remaining Conditions

At the `GO WITH CONDITIONS` stage, the only allowed remaining gaps should be:

1. live provider-origin billing manifest capture
2. restore drill execution
3. rollback drill execution
4. GitHub branch-protection workflow execution

If you discover new repo-local blockers, call them out explicitly and downgrade the decision as needed.

## Your Mission

Decide whether the release can now move from:

- `GO WITH CONDITIONS`

to:

- `GO`

You must independently verify the required external evidence.
Do not trust release notes or chat summaries by default.

## Authoritative Repo Contract

You must read and judge against:

1. `ARCHITECTURE_GUARDRAILS.md`
2. `AI_AGENT_INSTRUCTIONS.md`
3. `docs/PRODUCTION_GO_LIVE_IMPLEMENTATION_PLAN_2026-02-28.md`
4. `docs/GO_LIVE_CHECKLIST.md`
5. `docs/SAME_OR_BETTER_RELEASE_GATE_2026-03-11.md`
6. `docs/OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md`
7. `docs/PROVIDER_BILLING_TELEMETRY_RUNBOOK.md`
8. `docs/guardrail-control-matrix.md`
9. `docs/critical-paths.md`

## Required Evidence To Verify

### 1. Live provider-origin billing manifest

Verify that:

- `docs/artifacts/provider-billing/provider-billing-manifest.json` exists
- it is no longer just a template or placeholder
- it reflects real provider-origin data for required providers:
  - render
  - neon
  - cloudflare_r2
  - upstash
  - resend
- `capturedAt` freshness satisfies the runbook/staleness rule
- the validator passes

### 2. Restore drill evidence

Verify that:

- the restore drill artifact file exists at the expected path
- it is completed, not still pending/template-only
- it records operator, date, release SHA, actual RPO, actual RTO, issues, and result
- the artifact proves the required smoke/verification steps actually ran

### 3. Rollback drill evidence

Verify that:

- the rollback drill artifact file exists at the expected path
- it is completed, not still pending/template-only
- it records before/after SHAs, operator, date, verification steps, issues, and result
- the artifact proves the required smoke/verification steps actually ran after rollback

### 4. Branch-protection execution evidence

Verify that:

- the GitHub workflow run or manual command output exists
- it shows successful validation for required protected branches
- required status checks, review protections, and force-push/delete protections are present

## Hard Rules

1. Do not assume evidence is valid just because a file exists.
2. Do not upgrade to `GO` if any required artifact is still placeholder-only.
3. Do not ignore stale timestamps or missing operators/SHAs.
4. Do not ignore a failed validator because the file "looks right".
5. Do not perform broad code remediation in this pass unless a tiny fix is necessary to complete verification.
6. If you find a new repo-local blocker, say so plainly and downgrade the decision.

## Required Investigation Targets

Inspect at minimum:

- `docs/artifacts/provider-billing/provider-billing-manifest.json`
- `docs/drills/restore/**`
- `docs/drills/rollback/**`
- `docs/OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md`
- `docs/PROVIDER_BILLING_TELEMETRY_RUNBOOK.md`
- `docs/GO_LIVE_CHECKLIST.md`
- `.github/workflows/branch-protection-validation.yml`
- any attached JSON or markdown evidence produced by the workflow/validator

Also inspect the latest perf artifact and release-gate docs just to make sure no regression has re-opened a repo-local blocker:

- `docs/UI_UX_PERFORMANCE_WEEKLY_REPORT.md`
- `docs/SAME_OR_BETTER_RELEASE_GATE_2026-03-11.md`

## Commands To Run

Run the highest-signal commands that are feasible:

- `npm run provider-billing-check -- --file docs/artifacts/provider-billing/provider-billing-manifest.json --required render,neon,cloudflare_r2,upstash,resend`
- `npm run parity-gate`
- `npm run guardrails-lint`
- `npm run guardrails-tests`
- `npm run policy-check`
- `npm run -w apps/web test:e2e:smoke`

If branch-protection execution evidence was produced manually instead of via GitHub Actions, also validate the repo-local output artifact.

If you cannot run a command, say why.
If a command fails, determine whether it blocks `GO`.

## Decision Standard

Upgrade to `GO` only if:

1. all four external evidence items are verified as executed and passing
2. the validator commands pass
3. no repo-local blocker has re-opened
4. the current release candidate still satisfies the essential release gates

Stay at `GO WITH CONDITIONS` if:

- the repo is ready, but one or more external execution artifacts are still missing, stale, incomplete, or ambiguous

Downgrade to `still NO-GO` if:

- a new or reopened repo-local blocker is discovered
- or the external evidence reveals a genuine failure in recovery, governance, or cost controls

## Required Output Format

Return your final answer in this structure:

### 1. Executive decision
- `GO`
- `GO WITH CONDITIONS`
- or `still NO-GO`
- one short paragraph explaining why

### 2. External evidence verification table
For each of the 4 evidence items, mark:
- `verified`
- `partially verified`
- `failed`
- `missing`

Include exact evidence for each.

### 3. Reopened or remaining blockers
List only blockers that still matter after this final verification.
For each include:
- severity
- why it blocks or does not block final launch
- exact evidence
- whether it is repo-local or external

### 4. Verification
- commands run
- pass/fail
- important failure details

### 5. Final decision rationale
Explain why the release is or is not ready to move from `GO WITH CONDITIONS` to `GO`.

### 6. Required PR-style summary
Include:
- Change summary
- Cost impact
- Security impact
- Guardrails affected
- Cheaper fallback
- Test plan

## Standard Of Judgment

Behave like the final independent sign-off reviewer before a real production launch.

That means:

- verify the actual external evidence
- keep the bar honest
- make the decision crisp
- do not let a release cross into `GO` on incomplete paperwork
```

## Recommended Use

Use this only after the human/operator side has executed the remaining external steps and placed the resulting artifacts in the repo or release package.

This is the last decision gate.
