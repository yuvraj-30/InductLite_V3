# Threat Model — InductLite

## Scope

- Multi-tenant web app (Next.js + Prisma + Postgres)
- Public sign-in/sign-out
- Admin dashboard
- Exports and file storage (R2/S3)

## Assets

- PII: visitor names, phones, emails
- Company data: sites, templates, contractors
- Audit logs and export files
- Auth secrets: SESSION_SECRET, storage keys

## Trust Boundaries

- Public web (unauthenticated)
- Authenticated admin session
- Background worker
- External services: Postgres, R2, Upstash, Sentry

## Entry Points

- Public routes: /s/[slug], sign-out token flow
- Admin actions
- Storage presign endpoints
- Export download endpoint

## Threats & Mitigations (STRIDE)

### Spoofing

- Token misuse in sign-out flow
  - Mitigation: signed token + hash comparison + atomic update
- Session hijack
  - Mitigation: httpOnly cookies, secure flags, CSRF origin checks

### Tampering

- Cross-tenant access (IDOR)
  - Mitigation: scopedDb(companyId) for tenant models, audit tests
- Export job parameters manipulation
  - Mitigation: server-side validation + guardrails in worker

### Repudiation

- Missing audit trails
  - Mitigation: audit log writes on sensitive actions

### Information Disclosure

- Public access to exports
  - Mitigation: signed URLs with short expiry + permission checks
- Misconfigured storage
  - Mitigation: private buckets, server-side download routes

### Denial of Service

- Abuse of public sign-in
  - Mitigation: rate limits, max payload size
- Export flood
  - Mitigation: per-company quotas, concurrency limits

### Elevation of Privilege

- Role bypass
  - Mitigation: RBAC guards in server actions

## Residual Risks

- Shared IP rate limits in proxied environments
- Misconfiguration of secrets/keys

## Security Controls Mapping

- Tenant isolation: scopedDb + eslint guardrails
- CSRF: origin checks
- CSP: nonce-based middleware
- Storage: signed URLs
- Jobs: lock/claim with retry/backoff

## Assumptions

- TLS enforced at the edge
- Secrets stored in the platform secret manager
