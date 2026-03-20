# Provider Billing Artifact Folder

Expected release artifact:

- `provider-billing-manifest.json`

Repo-local handoff note:

- Keep `provider-billing-manifest.json` schema-valid in the repo so `npm run provider-billing-check` stays reproducible.
- Replace its contents with the current live provider-origin export/API capture before launch approval.

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
