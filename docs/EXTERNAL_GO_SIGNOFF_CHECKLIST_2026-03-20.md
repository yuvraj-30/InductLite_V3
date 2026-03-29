# External GO Sign-Off Checklist (2026-03-20)

Purpose: this is the operator-facing checklist for moving InductLite from `GO WITH CONDITIONS` to `GO`.

Use this only after repo-local blockers are already closed and the final remaining work is external execution evidence.

## Owners

- Platform / FinOps: live provider billing manifest
- Platform / SRE: restore drill
- Release Manager + Platform: rollback drill
- Release Engineer: branch-protection validation

## Required inputs

Before starting, confirm all of the following:

- target release SHA is known
- target environment and production URLs are known
- access to production billing exports or provider billing APIs is available
- GitHub permissions are available for branch-protection validation
- the current release candidate already passed the repo-local gates

Record these values before you begin:

- Release SHA: `________________`
- Release tag: `________________`
- Production app URL: `________________`
- Restored test target URL: `________________`
- Operator name: `________________`
- Date and time started: `________________`

## Step 1. Refresh live provider billing manifest

Owner: Platform / FinOps

Goal: replace the repo-local handoff manifest with a current live provider-origin billing capture for the release window.

Required providers:

- `render`
- `neon`
- `cloudflare_r2`
- `upstash`
- `resend`

Artifact path:

- `docs/artifacts/provider-billing/provider-billing-manifest.json`

Instructions:

1. Pull the current provider-origin billing export or API payload for each required provider.
2. Update `docs/artifacts/provider-billing/provider-billing-manifest.json` with current live data.
3. Confirm each entry has:
   - `provider`
   - `sourceType`
   - `capturedAt`
   - `amountNzd`
4. Run:

```bash
npm run provider-billing-check -- --file docs/artifacts/provider-billing/provider-billing-manifest.json --required render,neon,cloudflare_r2,upstash,resend
```

Pass criteria:

- command exits `0`
- output contains `provider-billing-check: PASS`
- all required providers are present
- `capturedAt` freshness satisfies `BUDGET_TELEMETRY_STALE_AFTER_HOURS`
- manifest no longer describes itself as a repo-local handoff artifact

Evidence to attach:

- updated manifest JSON
- raw validator output
- source reference or billing export timestamp

Status:

- [x] complete
- Evidence location: `docs/artifacts/provider-billing/provider-billing-manifest.json` validated with `npm run provider-billing-check -- --file docs/artifacts/provider-billing/provider-billing-manifest.json --required render,neon,cloudflare_r2,upstash,resend`

## Step 2. Execute restore drill

Owner: Platform / SRE

Goal: prove the team can restore the production-like dataset and successfully run the required smoke verification.

Artifact path:

- `docs/drills/restore/2026-03-19-pending-production-drill.md`

Instructions:

1. Restore the target database or production-like snapshot to the selected restore environment.
2. Confirm connectivity:

```bash
npm run -w apps/web db:status
```

3. Run smoke verification against the restored target:

```bash
npm run -w apps/web test:e2e:smoke
```

4. Replace the placeholder content in the restore artifact with:
   - operator
   - date/time
   - release SHA
   - restore target details
   - actual RPO
   - actual RTO
   - command results
   - issues found
   - final pass/fail decision

Pass criteria:

- restored database is reachable
- smoke suite passes against the restored target
- actual RPO and actual RTO are recorded
- operator and release SHA are recorded
- artifact is no longer placeholder or pending-only text

Evidence to attach:

- completed restore artifact
- smoke command output
- any supporting restore logs or screenshots

Status:

- [x] complete
- Evidence location: `docs/drills/restore/2026-03-19-pending-production-drill.md`

## Step 3. Execute rollback drill

Owner: Release Manager + Platform

Goal: prove the team can redeploy the prior release and recover safely.

Artifact path:

- `docs/drills/rollback/2026-03-19-pending-production-drill.md`

Instructions:

1. Redeploy the previous release candidate or prior tagged release.
2. Run verification commands after rollback:

```bash
npm run parity-gate
npm run guardrails-lint
npm run guardrails-tests
npm run policy-check
npm run -w apps/web test:e2e:smoke
```

3. Verify cron routes or scheduled workflows relevant to exports, retention, email queue, and webhook maintenance.
4. Replace the placeholder content in the rollback artifact with:
   - operator
   - date/time
   - before SHA
   - after SHA
   - rollback target details
   - command results
   - cron verification result
   - issues found
   - final pass/fail decision

Pass criteria:

- previous release is redeployed successfully
- smoke suite passes after rollback
- cron behavior is verified after rollback
- before/after SHAs are recorded
- artifact is no longer placeholder or pending-only text

Evidence to attach:

- completed rollback artifact
- command output for the verification bundle
- deployment record or release log reference

Status:

- [x] complete
- Evidence location: `docs/drills/rollback/2026-03-19-pending-production-drill.md`

## Step 4. Execute branch-protection validation

Owner: Release Engineer

Goal: prove required GitHub branch protections are active for the protected branches.

Workflow:

- `.github/workflows/branch-protection-validation.yml`

Manual command fallback:

```bash
npm run branch-protection-check
```

Required env for manual execution:

- `GITHUB_REPOSITORY`
- `BRANCH_PROTECTION_TOKEN` or `GITHUB_TOKEN`
- `BRANCH_PROTECTION_BRANCHES`

Instructions:

1. Prefer running the GitHub Actions workflow.
2. If manual execution is required, export the required env vars and run the manual command.
3. Capture the workflow URL or the manual JSON output artifact.
4. Confirm the result proves:
   - `main` and `develop` are protected
   - required status checks are present
   - stale reviews are dismissed
   - force-push is disabled
   - branch deletion is disabled

Pass criteria:

- workflow or manual validation succeeds
- output contains `status: "ok"` or equivalent success result
- evidence clearly covers all required branches and protections

Evidence to attach:

- GitHub workflow run URL or manual JSON output
- any follow-up remediation ticket if a protection had to be corrected

Status:

- [x] complete
- Evidence location: `https://github.com/yuvraj-30/InductLite_V3/actions/runs/23535500881`

## Final sign-off packet

All four items below must be attached before requesting final `GO`:

- [x] live provider-origin billing manifest and validator output
- [x] completed restore drill artifact
- [x] completed rollback drill artifact
- [x] branch-protection validation evidence

Release sign-off summary:

- Provider billing: `PASS`
- Restore drill: `PASS`
- Rollback drill: `PASS`
- Branch protection: `PASS`

Final recommendation:

- [x] remain `GO WITH CONDITIONS`
- [ ] upgrade to `GO`

Approvals:

- Platform / FinOps: `________________`
- Platform / SRE: `________________`
- Release Manager: `________________`
- Release Engineer: `________________`
- Final approver: `________________`

## Source runbooks

- [PROVIDER_BILLING_TELEMETRY_RUNBOOK.md](./PROVIDER_BILLING_TELEMETRY_RUNBOOK.md)
- [OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md](./OPERATIONAL_RECOVERY_EVIDENCE_RUNBOOK.md)
- [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)
- [FINAL_GO_SIGNOFF_PROMPT_2026-03-20.md](./FINAL_GO_SIGNOFF_PROMPT_2026-03-20.md)
