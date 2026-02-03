param(
  [string]$clientKey = 'ua:e2e'
)

if (-not $env:UPSTASH_REDIS_REST_URL -or -not $env:UPSTASH_REDIS_REST_TOKEN) {
  Write-Error "UPSTASH env vars not set. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
  exit 1
}

Write-Host "Running Upstash E2E test..."

npx vitest run src/lib/rate-limit/__tests__/upstash.e2e.test.ts

Write-Host "Cleaning up keys for clientKey: $clientKey"
node ./scripts/clear-upstash-keys.js $clientKey

Write-Host "Done."