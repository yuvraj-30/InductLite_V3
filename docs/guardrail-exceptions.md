# Guardrail Exceptions

Version: `v1`
Updated: `2026-02-15`

Use this file to record approved time-limited guardrail exceptions.

## Rules

- Exceptions are mandatory for any MUST-level control deviation.
- Maximum lifetime is 30 days.
- Renewal is allowed once. Further extension requires CTO approval and published risk acceptance.
- Missing required fields or expired records must fail CI.

## Fields

- `exception_id`
- `control_id`
- `scope_hash` (`control_id + file_path + owner`)
- `reason`
- `owner`
- `approvers`
- `created_at_utc`
- `expires_at_utc`
- `renewal_count`
- `rollback_plan`

## Active Exceptions

| exception_id | control_id | scope_hash | reason | owner | approvers | created_at_utc | expires_at_utc | renewal_count | rollback_plan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NONE | N/A | N/A | No active exceptions | N/A | N/A | N/A | N/A | 0 | N/A |
