# Upstash E2E test (rate-limit)

Purpose

- Run the Upstash-backed E2E test which validates real Redis-backed rate limiting.

Safety

- Use a dedicated Upstash instance for E2E (recommended name: `inductlite-e2e-ratelimit`).
- Do NOT run against production Upstash.

Environment

- Set these env vars before running:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

Scripts

- `node ./scripts/clear-upstash-keys.js [clientKey]` - Deletes keys from Upstash by pattern. If `clientKey` provided (e.g. `ua:e2e`), only removes keys matching that key; otherwise removes a conservative set of inductlite ratelimit keys.
- `./scripts/run-upstash-e2e.sh` (bash) - Runs the single Vitest E2E test and then cleans up keys for `ua:e2e`.
- `./scripts/run-upstash-e2e.ps1` (PowerShell) - Cross-platform runner for Windows PowerShell.
- `npm run test:upstash-e2e` - convenience npm script (runs `node ./scripts/run-upstash-e2e.js`).

Usage

1. Export the env vars for your Upstash E2E instance.
2. Run:
   - Bash: `./scripts/run-upstash-e2e.sh`
   - PowerShell: `./scripts/run-upstash-e2e.ps1`
   - Or: `npm run test:upstash-e2e`

Cleanup

- The scripts run `clear-upstash-keys.js` after tests to remove keys created during the run. Review the patterns in that script before running in shared instances.

Notes

- The E2E test uses a clientKey `ua:e2e` by default when cleaning up. Adjust the script arguments if you run with a different clientKey.
- Keep tokens secret and rotate regularly.
