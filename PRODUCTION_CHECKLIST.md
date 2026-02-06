# Production Deployment Checklist

## Pre-Deployment

### 1. Environment Variables

- [ ] **DATABASE_URL**: PostgreSQL connection string with SSL (`?sslmode=require`)
- [ ] **SESSION_SECRET**: Cryptographically secure random string (≥32 chars)
  ```bash
  openssl rand -base64 32
  ```
- [ ] **NEXT_PUBLIC_APP_URL**: Production URL with HTTPS
- [ ] **STORAGE_MODE**: Set to `s3` (not `local`)
- [ ] **S3_BUCKET**, **S3_REGION**, **S3_ACCESS_KEY_ID**, **S3_SECRET_ACCESS_KEY**: Configured
- [ ] **TRUST_PROXY**: Set to `1` if behind a reverse proxy

### 2. Security

- [ ] CSP headers enabled (middleware.ts)
- [ ] Session cookies set with `secure: true` (automatic in production)
- [ ] HTTPS enforced on all routes
- [ ] Admin password changed from default
- [ ] No development secrets in production env

### 3. Database

- [ ] Prisma migrations applied: `npm run db:migrate`
- [ ] Database backups configured
- [ ] Connection pooling configured (if using serverless)
- [ ] Database user has minimal required permissions

### 4. Rate Limiting

- [ ] Upstash Redis configured for production (multi-instance safe)
- [ ] Rate limit thresholds reviewed for expected traffic

### 5. Storage & Exports

- [ ] Signed URL upload/download enabled for storage
- [ ] Export job idempotency and retry/backoff verified

### 6. Monitoring

- [ ] Health endpoint accessible: `/health`
- [ ] Structured logging to stdout (JSON format)
- [ ] Error tracking configured (optional: Sentry, etc.)
- [ ] Log drain configured on platform
- [ ] Alerts configured for elevated 5xx rates and export failures

---

## Deployment

### Docker Deployment

```bash
# Build production image
docker build -t inductlite:latest -f apps/web/Dockerfile .

# Run with environment variables
docker run -d \
  --name inductlite \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="..." \
  -e STORAGE_MODE=s3 \
  -e S3_BUCKET="..." \
  inductlite:latest
```

### Docker Compose

```bash
# Production deployment
docker compose up -d

# Run migrations first
docker compose run --rm migrate
```

### Platform-as-a-Service (Vercel, Railway, Render)

1. Connect repository
2. Set environment variables in platform dashboard
3. Set build command: `npm run build`
4. Set start command: `npm run start`
5. Configure health check endpoint: `/health`

---

## Post-Deployment

### 1. Verify Health

```bash
curl https://yourdomain.com/health
```

Expected response:

```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok", "latency_ms": 5 }
  }
}
```

### 2. Verify Security Headers

```bash
curl -I https://yourdomain.com
```

Check for:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy`

### 3. Test Critical Flows

- [ ] Admin login works
- [ ] Site creation works
- [ ] QR code generation works
- [ ] Public sign-in flow works
- [ ] File uploads work (if S3 configured)
- [ ] Exports work (if enabled)

### 4. Configure DNS & SSL

- [ ] DNS pointing to production server
- [ ] SSL certificate valid and auto-renewing
- [ ] HSTS enabled

---

## Maintenance

### Regular Tasks

- **Daily**: Check health endpoint, review error logs
- **Weekly**: Review rate limit metrics, check storage usage
- **Monthly**: Apply security updates, rotate secrets if needed
- **Quarterly**: Review and test backup restoration
- **Quarterly**: Execute restore drill runbook

### Scaling Considerations

| Traffic Level         | Recommended Setup                               |
| --------------------- | ----------------------------------------------- |
| MVP (<2k sign-ins/mo) | Single instance, local storage OK               |
| Early (<20k/mo)       | Single instance, S3 storage, Upstash Redis      |
| Growth (<150k/mo)     | Multiple instances, S3, Redis, DB read replicas |

---

## Rollback Procedure

1. Identify the last working version
2. Deploy previous Docker image or git commit
3. If database migration failed:
   - Restore from backup, OR
   - Apply reverse migration if available
4. Verify health endpoint
5. Notify affected users if needed

---

## Security Contacts

Update `/.well-known/security.txt` with your security contact email.

---

## Budget Guardrails (per ARCHITECTURE_GUARDRAILS.md)

| Phase  | Monthly Infra Budget (NZD) |
| ------ | -------------------------- |
| MVP    | ≤ $150                     |
| Early  | ≤ $500                     |
| Growth | ≤ $2,000                   |

Monitor:

- Database storage and connections
- S3 storage and egress
- Redis operations (if using Upstash)
- Export job runtime
