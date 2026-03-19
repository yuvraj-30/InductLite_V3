# Guardrail Control Matrix

Version: `v4`
Updated: `2026-03-19`

This file is the machine-checkable registry for MUST-level controls.

## Columns

- `control_id`: Stable identifier.
- `env_var`: Policy env var name or `N/A`.
- `default`: Required default value.
- `max_by_tier`: MVP/Early/Growth cap summary.
- `enforcement_path`: Code path that enforces the rule.
- `test_id`: Automated test ID or suite name.
- `owner`: Role accountable for control maintenance.

## Controls

| control_id | env_var | default | max_by_tier | enforcement_path | test_id | owner |
| --- | --- | --- | --- | --- | --- | --- |
| COST-001 | MAX_MONTHLY_EGRESS_GB | 100 (MVP) | 100/500/2500 | startup env validation + budget service | guardrails-cost-caps | Platform |
| COST-002 | MAX_MONTHLY_STORAGE_GB | 50 (MVP) | 50/250/1000 | startup env validation + budget service | guardrails-cost-caps | Platform |
| COST-003 | MAX_MONTHLY_JOB_MINUTES | 1000 (MVP) | 1000/5000/25000 | startup env validation + job limiter | guardrails-cost-caps | Platform |
| COST-004 | MAX_MONTHLY_SERVER_ACTION_INVOCATIONS | 1000000 (MVP) | 1M/5M/20M | startup env validation + action limiter | guardrails-cost-caps | Platform |
| COST-005 | MAX_MONTHLY_COMPUTE_INVOCATIONS | 1200000 (MVP) | 1.2M/6M/24M | compute counter limiter | guardrails-counter-check | Platform |
| COST-006 | MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES | 2500 (MVP) | 2500/12000/48000 | compute runtime limiter | guardrails-counter-check | Platform |
| COST-007 | ENV_BUDGET_TIER | MVP | MVP/EARLY/GROWTH | startup env validation + budget service | guardrails-policy-check | Platform |
| COST-008 | N/A | fail-safe `BUDGET_PROTECT` at stale telemetry or >=100% projected budget | N/A | `apps/web/src/lib/cost/budget-service.ts` + export/SMS entrypoints | budget-service-state | Platform |
| COST-009 | N/A | disable non-critical paths at >=80% projected budget | N/A | `apps/web/src/lib/cost/budget-service.ts` + export/SMS entrypoints | budget-service-state | Platform |
| FILE-005 | MAX_UPLOAD_MB | 5 | 5/5/5 | upload presign + commit validation | guardrails-upload-size | Security |
| FILE-001 | UPLOAD_ALLOWED_MIME | application/pdf,image/jpeg,image/png | same/same/same | upload commit + server MIME validation | guardrails-upload-mime | Security |
| FILE-002 | UPLOAD_ALLOWED_EXTENSIONS | pdf,jpg,jpeg,png | same/same/same | upload presign + commit validation | guardrails-upload-mime | Security |
| FILE-003 | UPLOAD_REQUIRE_SERVER_MIME_SNIFF | true | true/true/true | upload commit validation | guardrails-upload-mime | Security |
| FILE-004 | UPLOAD_REQUIRE_MAGIC_BYTES | true | true/true/true | upload commit validation | guardrails-upload-mime | Security |
| FILE-006 | FILES_RETENTION_DAYS | 90 | 90/90/90 | maintenance retention job | guardrails-retention-jobs | Security |
| FILE-007 | EXPORTS_RETENTION_DAYS | 30 | 30/30/30 | maintenance retention job | guardrails-retention-jobs | Security |
| LOG-001 | AUDIT_RETENTION_DAYS | 90 | 90/90/90 | maintenance retention job | guardrails-retention-jobs | Compliance |
| LOG-002 | LOG_RETENTION_DAYS | 14 | 14/14/14 | stdout retention policy + deployment config | guardrails-policy-check | Compliance |
| EXPT-001 | MAX_EXPORT_ROWS | 50000 | 50000/50000/50000 | export enqueue + worker | guardrails-export-limits | Backend |
| EXPT-002 | MAX_EXPORT_BYTES_GLOBAL_PER_DAY | 2147483648 | 2GB/2GB/2GB | export enqueue | guardrails-export-limits | Backend |
| EXPT-003 | MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY | 536870912 | 512MB/512MB/512MB | export download route + egress quota check | guardrails-export-download-caps | Backend |
| EXPT-004 | MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY | 5368709120 | 5GB/5GB/5GB | export download route + global egress quota check | guardrails-export-download-caps | Backend |
| EXPT-005 | EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT | 20 | 20/20/20 | export scheduler policy check | guardrails-export-offpeak-auto | Backend |
| EXPT-006 | EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS | 60 | 60/60/60 | export scheduler policy check | guardrails-export-offpeak-auto | Backend |
| EXPT-007 | EXPORT_OFFPEAK_AUTO_ENABLE_DAYS | 7 | 7/7/7 | export scheduler policy check | guardrails-export-offpeak-auto | Backend |
| EXPT-008 | MAX_EXPORTS_PER_COMPANY_PER_DAY | 5 | 5/5/5 | export enqueue action | guardrails-export-limits | Backend |
| EXPT-009 | MAX_CONCURRENT_EXPORTS_PER_COMPANY | 1 | 1/1/1 | export enqueue action | guardrails-export-limits | Backend |
| EXPT-010 | MAX_EXPORT_BYTES | 104857600 | 100MB/100MB/100MB | export worker + archive builder | guardrails-export-limits | Backend |
| EXPT-011 | MAX_EXPORT_RUNTIME_SECONDS | 120 | 120/120/120 | export runner + stale-job recovery | guardrails-export-runtime | Backend |
| EXPT-012 | MAX_CONCURRENT_EXPORTS_GLOBAL | 1 | 1/1/1 | export enqueue action + runner | guardrails-export-limits | Backend |
| EXPT-013 | EXPORT_OFFPEAK_ONLY | false | false/false/false | export enqueue action + runner | guardrails-export-offpeak-auto | Backend |
| EXPT-014 | MAX_EXPORT_QUEUE_AGE_MINUTES | 60 | 60/60/60 | export queue age guard + release checklist | guardrails-export-queue-age | Backend |
| ABUSE-001 | RL_PUBLIC_SLUG_PER_IP_PER_MIN | 30 | 30/30/30 | public actions rate limiter | guardrails-public-rl | Security |
| ABUSE-002 | RL_SIGNIN_PER_IP_PER_MIN | 30 | 30/30/30 | public sign-in action rate limiter | guardrails-public-rl | Security |
| ABUSE-003 | RL_SIGNIN_PER_SITE_PER_MIN | 200 | 200/200/200 | public sign-in action rate limiter | guardrails-public-rl | Security |
| ABUSE-004 | RL_SIGNOUT_PER_IP_PER_MIN | 30 | 30/30/30 | public sign-out action rate limiter | guardrails-public-rl | Security |
| ABUSE-005 | RL_ADMIN_PER_USER_PER_MIN | 60 | 60/60/60 | admin actions rate limiter | guardrails-admin-rl | Security |
| ABUSE-006 | RL_ADMIN_PER_IP_PER_MIN | 120 | 120/120/120 | admin + inbound callback rate limiter | guardrails-admin-rl | Security |
| ABUSE-007 | RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN | 60 | 60/60/60 | admin + inbound callback rate limiter | guardrails-admin-rl | Security |
| COMP-001 | N/A | settings updates require `settings:manage` permission + `assertOrigin()` | N/A | `apps/web/src/app/admin/settings/actions.ts` | e2e-admin-settings-save | Security |
| COMP-002 | N/A | legal hold reason required when `compliance_legal_hold=true` | N/A | `apps/web/src/app/admin/settings/actions.ts` + `apps/web/src/lib/repository/company.repository.ts` | e2e-admin-settings-legal-hold-validation | Compliance |
| COMP-003 | N/A | compliance settings changes must emit immutable audit event (`settings.update`) | N/A | `apps/web/src/app/admin/settings/actions.ts` + `apps/web/src/lib/repository/audit.repository.ts` | unit-admin-settings-actions | Security |
| MSG-001 | MAX_EMAILS_PER_COMPANY_PER_MONTH | 500 | 500/2000/10000 | centralized message wrapper | guardrails-messaging-caps | Backend |
| MSG-002 | MAX_EMAILS_GLOBAL_PER_DAY | 2000 | 2000/8000/40000 | centralized message wrapper | guardrails-messaging-caps | Backend |
| MSG-006 | SMS_ENABLED | false | false/false/false | centralized message wrapper + entitlement gate | guardrails-messaging-caps | Backend |
| MSG-007 | MAX_MESSAGES_PER_COMPANY_PER_MONTH | 0 | 0/100/100 | centralized message wrapper + entitlement gate | guardrails-messaging-caps | Backend |
| MSG-003 | MAX_BROADCASTS_PER_COMPANY_PER_DAY | 3 | 3/10/50 | emergency broadcast admission checks | guardrails-broadcast-caps | Backend |
| MSG-004 | MAX_BROADCAST_RECIPIENTS_PER_EVENT | 500 | 500/2000/10000 | emergency broadcast orchestration | guardrails-broadcast-caps | Backend |
| MSG-005 | MAX_PUSH_NOTIFICATIONS_PER_COMPANY_PER_MONTH | 2000 | 2000/10000/50000 | push notification wrapper | guardrails-push-caps | Backend |
| SIM-001 | MAX_POLICY_SIM_RUNS_PER_COMPANY_PER_DAY | 10 | 10/50/200 | policy simulator runner admission checks | guardrails-policy-sim-caps | Platform |
| RISK-001 | MAX_RISK_SCORE_RECALC_JOBS_PER_DAY | 24 | 24/96/500 | risk scoring job scheduler | guardrails-risk-score-caps | Platform |
| FLAG-001 | FEATURE_EXPORTS_ENABLED | true | true/true/true | feature-flags runtime + export entrypoints | guardrails-feature-flags | Platform |
| FLAG-002 | FEATURE_UPLOADS_ENABLED | true | true/true/true | feature-flags runtime + upload entrypoints | guardrails-feature-flags | Platform |
| FLAG-003 | FEATURE_PUBLIC_SIGNIN_ENABLED | true | true/true/true | feature-flags runtime + public sign-in entrypoints | guardrails-feature-flags | Platform |
| FLAG-004 | FEATURE_VISUAL_REGRESSION_ENABLED | false | false/false/false | feature-flags runtime + CI visual lane | guardrails-feature-flags | Platform |
| TENANT-001 | N/A | scopedDb only | N/A | repository and static analysis rules | guardrails-tenant-scope | Security |
| TENANT-002 | N/A | tenant model registry required | N/A | `docs/tenant-owned-models.md` CI check | guardrails-tenant-model-registry | Security |
| TENANT-003 | MAX_TENANT_STORAGE_GB | 5 | 5/plan-override/plan-override | quota admission checks | guardrails-tenant-quota-check | Platform |
| TENANT-004 | MAX_TENANT_EGRESS_GB_PER_MONTH | 20 | 20/plan-override/plan-override | quota admission checks | guardrails-tenant-quota-check | Platform |
| TENANT-005 | MAX_TENANT_JOB_MINUTES_PER_MONTH | 300 | 300/plan-override/plan-override | job admission checks | guardrails-tenant-quota-check | Platform |
| TENANT-006 | MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH | 250000 | 250k/plan-override/plan-override | compute admission checks | guardrails-tenant-quota-check | Platform |
| API-001 | N/A | deterministic guardrail denial payload enabled | N/A | `apps/web/src/lib/api/response.ts` | guardrails-denial-payload-check | Security |
| INT-001 | CHANNEL_INTEGRATION_SIGNING_SECRET | unset | min 16 chars/same/same | `apps/web/src/app/api/integrations/channels/actions/route.ts` | route-channels-signature | Security |
| INT-002 | CHANNEL_INTEGRATION_TIMESTAMP_TOLERANCE_SECONDS | 300 | 300/300/300 | `apps/web/src/app/api/integrations/channels/actions/route.ts` | route-channels-signature | Security |
