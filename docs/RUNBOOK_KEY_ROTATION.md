# Runbook — Key Rotation

## Rotate Session Secret

1. Generate new SESSION_SECRET.
2. Update secret in platform.
3. Redeploy (forces re-login).

## Rotate R2/S3 Keys

1. Create new access key pair.
2. Update R2/S3 env vars.
3. Redeploy and verify upload/download.

## Rotate Upstash

1. Regenerate Redis token.
2. Update UPSTASH env vars.
3. Redeploy.

## Rotate Sentry DSN

1. Generate new DSN in Sentry.
2. Update SENTRY_DSN.
3. Redeploy.

## Rotate Database Credentials

1. Create new DB user or reset password.
2. Update DATABASE_URL.
3. Redeploy and verify.
