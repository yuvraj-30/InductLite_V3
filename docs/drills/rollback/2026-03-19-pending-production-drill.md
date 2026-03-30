# Rollback Drill Evidence - Executed

Status: `pass`
Prepared: `2026-03-19`
Executed: `2026-03-26 20:18:00 +13:00` to `2026-03-26 20:33:30 +13:00`
Environment: `live Render production service`
Owner role: `Release Manager + Platform`
Runbook: `docs/OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md`

## Execution Record

- Operator: `Yuvraj Singh`
- Rollback trigger: `Operational recovery drill / go-live evidence closure`
- Release SHA before rollback: `1eec817da5446b2eb125c40d8d42073bd8e2145e`
- Release SHA after rollback: `a8c27fddb09fbec11693d948af1a8b8bb688d003`
- Rollback target details:
  - Render service: `inductlite-app`
  - Production URL: `https://inductlite-app.onrender.com`
  - Previous live deploy id: `dep-d6vl83p4tr6s73dml79g`
  - Selected rollback source deploy id: `dep-d6v91k6uk2gs738kqri0`
  - New rollback deploy id: `dep-d72dtlc50q8c738o3fb0`
- Flag changes applied: `None; drill used Render deploy rollback rather than flag rollback`

## Runtime Verification

1. Live health verification after rollback:

```text
GET /health
Result: PASS
Response summary:
- status: ok
- build.commit: a8c27fddb09fbec11693d948af1a8b8bb688d003
- build.source: render
- database.status: ok
- database.latency_ms: 96
```

2. Live readiness verification after rollback:

```text
GET /api/ready
Result: PASS
Response summary:
- ready: true
```

3. Live liveness verification after rollback:

```text
GET /api/live
Result: PASS
Response summary:
- alive: true
- uptime_seconds: 60
```

## Smoke and Guardrail Verification

1. Parity gate:

```text
npm run parity-gate
Result: PASS
```

2. Guardrails lint:

```text
npm run guardrails-lint
Result: PASS
```

3. Guardrails tests:

```text
npm run guardrails-tests
Result: PASS
```

4. Policy check:

```text
npm run policy-check
Result: PASS
```

5. Smoke verification:

```text
npm run -w apps/web test:e2e:smoke
Result: PASS
Summary: 39 passed
```

## Cron Route Verification

```text
Workflow: Render Keep-Alive and Cron
Workflow run URL: https://github.com/yuvraj-30/InductLite_V3/actions/runs/23582777887
Workflow job URL: https://github.com/yuvraj-30/InductLite_V3/actions/runs/23582777887/job/68668967175
Result: PASS
Verified:
- health endpoint succeeded after rollback
- export scheduler step succeeded after rollback
```

## Post-Drill Cleanup

```text
Action: redeployed the pre-drill live release after evidence capture
Restored live release SHA: 1eec817da5446b2eb125c40d8d42073bd8e2145e
Restored live deploy id: dep-d72ecpc50q8c738ocvb0
Verification:
- GET /health -> PASS (build.commit = 1eec817da5446b2eb125c40d8d42073bd8e2145e)
- GET /api/live -> PASS
```

## Issues Found

- Render rollback disabled auto-deploy during the drill and required an explicit post-drill redeploy back to the intended current release.
- Render logs on the rollback deploy emitted Upstash free-tier limit warnings:
  - `ERR max requests limit exceeded. Limit: 500000`
  - runtime fell back to in-memory readiness limiting for that dependency path
- The smoke and guardrail verification bundle was run from the current workspace after the live rollback completed; the live service itself was separately validated through `/health`, `/api/ready`, `/api/live`, and the GitHub cron workflow.

## Remediation Owner

- Platform / Release: address Upstash plan/usage limits before final launch approval.

## Final Decision

- Pass criteria met:
  - previous release was redeployed successfully
  - smoke and required guardrail commands passed after rollback
  - cron verification was recorded after rollback
  - release SHA before and after rollback were recorded

- Final result: `PASS`

## Sign-off

- Operator sign-off: `Yuvraj Singh`
- Date: `2026-03-26`
