# Operational Recovery Evidence Runbook

This runbook defines the exact evidence required to close go-live recovery blockers.

## Owner roles

- Restore drill: Platform / SRE
- Rollback drill: Release Manager + Platform
- Branch protection validation: Release Engineer

## Branch protection validation

Workflow:

- `.github/workflows/branch-protection-validation.yml`

Manual command:

```bash
npm run branch-protection-check
```

Required env for manual execution:

- `GITHUB_REPOSITORY`
- `BRANCH_PROTECTION_TOKEN` or `GITHUB_TOKEN`
- `BRANCH_PROTECTION_BRANCHES`

Expected evidence:

- Successful scheduled or manual workflow run in GitHub Actions
- Output JSON showing `status: "ok"`

Pass criteria:

- `main` and `develop` are protected
- all required status checks are present
- stale reviews are dismissed
- force-push and delete remain disabled

## Restore drill

Artifact path:

- `docs/drills/restore/2026-03-19-pending-production-drill.md`

Execution commands:

```bash
npm run -w apps/web db:status
npm run -w apps/web test:e2e:smoke
```

Pass criteria:

- restored database is reachable
- smoke suite passes against the restored target
- actual RPO and actual RTO are recorded
- release SHA and operator are recorded

## Rollback drill

Artifact path:

- `docs/drills/rollback/2026-03-19-pending-production-drill.md`

Execution commands:

```bash
npm run parity-gate
npm run guardrails-lint
npm run guardrails-tests
npm run policy-check
npm run -w apps/web test:e2e:smoke
```

Pass criteria:

- previous release is redeployed successfully
- smoke suite passes after rollback
- cron routes are verified after rollback
- release SHA before/after rollback is recorded

## Release evidence checklist

Attach all of the following to the release candidate:

1. Executed restore drill artifact
2. Executed rollback drill artifact
3. Successful branch-protection validation workflow run URL
4. Any remediation tickets raised during the drills
