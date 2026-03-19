# Provider Billing Artifact Folder

Expected release artifact:

- `provider-billing-manifest.json`

Template:

- `provider-billing-manifest.template.json`

Validation command:

```bash
npm run provider-billing-check -- --file docs/artifacts/provider-billing/provider-billing-manifest.json --required render,neon,cloudflare_r2,upstash,resend
```

Pass criteria:

- command exits `0`
- output includes `provider-billing-check: PASS`
- every required provider is present
