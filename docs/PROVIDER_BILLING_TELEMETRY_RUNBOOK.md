# Provider Billing Telemetry Runbook

This runbook defines the production evidence path for `BUDGET_PROTECT` telemetry.

## Owner

- Primary: Platform / FinOps
- Review: Release Manager

## Artifact location

- Manifest: `docs/artifacts/provider-billing/provider-billing-manifest.json`
- Validator output: attach command output to the release record / change ticket

## Manifest source contract

The manifest must be built from provider-originated billing exports or billing API payloads, not manual estimates.

Required providers for the current production stack:

- `render`
- `neon`
- `cloudflare_r2`
- `upstash`
- `resend`

Optional providers when enabled in production:

- `twilio`

Each manifest entry must contain:

- `provider`
- `sourceType`
  - `provider_api` or `invoice_export`
- `capturedAt`
- `amountNzd`

Use [provider-billing-manifest.template.json](./artifacts/provider-billing/provider-billing-manifest.template.json) as the schema template.

## Validation command

```bash
npm run provider-billing-check -- --file docs/artifacts/provider-billing/provider-billing-manifest.json --required render,neon,cloudflare_r2,upstash,resend
```

## Pass criteria

- Command exits `0`
- Output includes `provider-billing-check: PASS`
- Output lists every required provider
- `capturedAt` is not older than `BUDGET_TELEMETRY_STALE_AFTER_HOURS`
- The validated manifest is available at the artifact location above

## Render / production env contract

Configure one of:

- `BUDGET_TELEMETRY_PROVIDER_BILLING_FILE`
- `BUDGET_TELEMETRY_PROVIDER_BILLING_URL`
- `BUDGET_TELEMETRY_PROVIDER_BILLING_JSON`

Also configure:

- `BUDGET_TELEMETRY_REQUIRED_PROVIDERS`
- `BUDGET_TELEMETRY_STALE_AFTER_HOURS`
- `BUDGET_TELEMETRY_PROVIDER_BILLING_TOKEN` when the remote manifest URL requires bearer auth

## Release evidence

Attach these to the release candidate:

1. The manifest JSON used for validation
2. The exact validator command
3. The validator output
4. The timestamp when the manifest was published to production
