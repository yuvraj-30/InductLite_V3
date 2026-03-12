# Runbook - Deployment Rollback

## Purpose

This runbook defines progressive rollout and rollback behavior for UI/UX 2026 flags while preserving tenant isolation, entitlement controls, and budget-protect behavior.

## Rollout Stages

1. Stage 0 - Internal pilot tenants only (5-10 tenants).
2. Stage 1 - 25% production tenants.
3. Stage 2 - 50% production tenants.
4. Stage 3 - 100% production tenants.

Advance to the next stage only when all acceptance checks pass for at least 24 hours.

## Flag Rollout Order

1. `UIX_S1_VISUAL`
2. `UIX_S2_FLOW`
3. `UIX_S3_MOBILE`
4. `UIX_S4_AI`
5. `UIX_S5_A11Y`

## Rollback Triggers

1. New severe/critical accessibility violations on touched routes.
2. Sign-in conversion drop >= 10% for 24h compared with baseline.
3. Median admin task duration regression >= 20% for top tasks.
4. Performance budget lane failures on key routes.
5. Entitlement-denial mismatch across Standard/Plus/Pro/add-on cohorts.
6. Budget-protect behavior deviation from guardrails.

## Rollback Procedure (Render)

1. Disable impacted `UIX_*` flag(s) in environment config.
2. Redeploy web service with flag-off config.
3. If worker behavior is impacted, redeploy worker service to last known good deploy.
4. Verify critical paths (`/login`, `/s/:slug`, `/admin/live-register`) before reopening rollout.

## Per-Flag Validation and Rollback Checks

1. `UIX_S1_VISUAL`
   - Validate tokenized surfaces and contrast in both themes.
   - Roll back by setting `UIX_S1_VISUAL=false`.
2. `UIX_S2_FLOW`
   - Validate login intent split and shared async states.
   - Roll back by setting `UIX_S2_FLOW=false`.
3. `UIX_S3_MOBILE`
   - Validate mobile nav + card workflows on sites/live-register.
   - Roll back by setting `UIX_S3_MOBILE=false`.
4. `UIX_S4_AI`
   - Validate in-context copilot, explicit approval logging, and entitlement denials.
   - Roll back by setting `UIX_S4_AI=false` and `FF_POLICY_SIMULATOR_V1=false` when required.
5. `UIX_S5_A11Y`
   - Validate top-route axe lane + performance budget lane.
   - Roll back by setting `UIX_S5_A11Y=false`.

## Guardrail Verification After Any Rollback

1. `npm run parity-gate`
2. `npm run guardrails-lint && npm run guardrails-tests && npm run policy-check`
3. `npm run -w apps/web test:e2e:smoke`
4. `npm run -w apps/web test:e2e:perf-budget`

## Database Migrations

1. Prefer forward-only migrations.
2. If a migration caused failure, restore from backup or apply a corrective migration.

## Runtime Verification

1. Check `/health` and `/api/ready`.
2. Verify public sign-in and admin login.
3. Confirm exports queue and worker stability.
4. Confirm entitlement-denied routes still return deterministic control IDs.
