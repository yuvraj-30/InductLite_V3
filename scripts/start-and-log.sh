#!/usr/bin/env bash
set -euo pipefail

echo "START-SHIM: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Print minimal, non-secret runtime diagnostics (do NOT print DATABASE_URL value)
echo "START-SHIM: NODE_ENV=${NODE_ENV:-<unset>}"
if [ -n "${DATABASE_URL:-}" ]; then
  echo "START-SHIM: DATABASE_URL present (length=${#DATABASE_URL})"
else
  echo "START-SHIM: DATABASE_URL not present"
fi
echo "START-SHIM: ALLOW_TEST_RUNNER=${ALLOW_TEST_RUNNER:-<unset>}"
echo "START-SHIM: exec npm run start"

# Replace current shell with the actual server process so envs are preserved
exec npm run start
