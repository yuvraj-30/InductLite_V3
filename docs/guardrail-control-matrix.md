# Guardrail Control Matrix

Version: `v2`
Updated: `2026-02-15`

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
| FILE-001 | UPLOAD_ALLOWED_MIME | application/pdf,image/jpeg,image/png | same/same/same | upload commit + server MIME validation | guardrails-upload-mime | Security |
| FILE-002 | UPLOAD_ALLOWED_EXTENSIONS | pdf,jpg,jpeg,png | same/same/same | upload presign + commit validation | guardrails-upload-mime | Security |
| FILE-003 | UPLOAD_REQUIRE_SERVER_MIME_SNIFF | true | true/true/true | upload commit validation | guardrails-upload-mime | Security |
| FILE-004 | UPLOAD_REQUIRE_MAGIC_BYTES | true | true/true/true | upload commit validation | guardrails-upload-mime | Security |
| EXPT-001 | MAX_EXPORT_ROWS | 50000 | 50000/50000/50000 | export enqueue + worker | guardrails-export-limits | Backend |
| EXPT-002 | MAX_EXPORT_BYTES_GLOBAL_PER_DAY | 2147483648 | 2GB/2GB/2GB | export enqueue | guardrails-export-limits | Backend |
| EXPT-003 | MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY | 536870912 | 512MB/512MB/512MB | export download route + egress quota check | guardrails-export-download-caps | Backend |
| EXPT-004 | MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY | 5368709120 | 5GB/5GB/5GB | export download route + global egress quota check | guardrails-export-download-caps | Backend |
| EXPT-005 | EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT | 20 | 20/20/20 | export scheduler policy check | guardrails-export-offpeak-auto | Backend |
| EXPT-006 | EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS | 60 | 60/60/60 | export scheduler policy check | guardrails-export-offpeak-auto | Backend |
| EXPT-007 | EXPORT_OFFPEAK_AUTO_ENABLE_DAYS | 7 | 7/7/7 | export scheduler policy check | guardrails-export-offpeak-auto | Backend |
| EXPT-008 | MAX_EXPORTS_PER_COMPANY_PER_DAY | 5 | 5/5/5 | export enqueue action | guardrails-export-limits | Backend |
| EXPT-009 | MAX_CONCURRENT_EXPORTS_PER_COMPANY | 1 | 1/1/1 | export enqueue action | guardrails-export-limits | Backend |
| ABUSE-001 | RL_PUBLIC_SLUG_PER_IP_PER_MIN | 30 | 30/30/30 | public actions rate-limit middleware | guardrails-public-rl | Security |
| ABUSE-002 | RL_ADMIN_PER_USER_PER_MIN | 60 | 60/60/60 | admin actions rate-limit middleware | guardrails-admin-rl | Security |
| MSG-001 | MAX_EMAILS_PER_COMPANY_PER_MONTH | 500 | 500/2000/10000 | centralized message wrapper | guardrails-messaging-caps | Backend |
| MSG-002 | MAX_EMAILS_GLOBAL_PER_DAY | 2000 | 2000/8000/40000 | centralized message wrapper | guardrails-messaging-caps | Backend |
| TENANT-001 | N/A | scopedDb only | N/A | repository and static analysis rules | guardrails-tenant-scope | Security |
| TENANT-002 | N/A | tenant model registry required | N/A | `docs/tenant-owned-models.md` CI check | guardrails-tenant-model-registry | Security |
| TENANT-003 | MAX_TENANT_STORAGE_GB | 5 | 5/plan-override/plan-override | quota admission checks | guardrails-tenant-quota-check | Platform |
| TENANT-004 | MAX_TENANT_EGRESS_GB_PER_MONTH | 20 | 20/plan-override/plan-override | quota admission checks | guardrails-tenant-quota-check | Platform |
| TENANT-005 | MAX_TENANT_JOB_MINUTES_PER_MONTH | 300 | 300/plan-override/plan-override | job admission checks | guardrails-tenant-quota-check | Platform |
| TENANT-006 | MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH | 250000 | 250k/plan-override/plan-override | compute admission checks | guardrails-tenant-quota-check | Platform |
| API-001 | N/A | deterministic guardrail denial payload enabled | N/A | `apps/web/src/lib/api/response.ts` | guardrails-denial-payload-check | Security |
