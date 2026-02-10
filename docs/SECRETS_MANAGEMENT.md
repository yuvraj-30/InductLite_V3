# Secrets Management

## Storage

- Use platform secret manager (Render/Neon/Upstash/R2).
- Never commit secrets to git.

## Required Secrets

- DATABASE_URL
- SESSION_SECRET
- SIGN_OUT_TOKEN_SECRET
- R2/S3 credentials
- UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
- SENTRY_DSN (optional)

## Rotation

- Rotate quarterly or after incidents.
- Follow [docs/RUNBOOK_KEY_ROTATION.md](RUNBOOK_KEY_ROTATION.md).
