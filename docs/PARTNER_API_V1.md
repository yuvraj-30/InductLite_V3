# Partner API v1

## Overview

Versioned external API endpoints for tenant-approved partner integrations.

- Base path: `/api/v1/partner`
- Auth: `Authorization: Bearer <partner_api_key>`
- Company scope: `?company=<company-slug>` query parameter is required.
- Key lifecycle: configure and rotate from `/admin/settings` under SSO and Directory Sync.
- Security hardening note: partner API keys created before March 13, 2026 must be rotated once after deploy because legacy weak hashes are no longer accepted.

## Endpoints

### `GET /api/v1/partner/sites`

Scope: `sites.read`

Returns tenant sites with active status metadata.

### `GET /api/v1/partner/sign-ins`

Scope: `signins.read`

Query params:

- `company` (required)
- `siteId` (optional, CUID)
- `status` (optional: `on_site | signed_out | all`)
- `dateFrom` (optional ISO datetime)
- `dateTo` (optional ISO datetime)
- `page` (optional, default `1`)
- `pageSize` (optional, default `50`, max `100`)

Returns paginated sign-in history records.

## Security and controls

- Company-scoped API key verification.
- Per-key scope enforcement.
- Partner API enable/disable control in tenant settings.
- Monthly quota enforcement per tenant key configuration.
- Rate limiting on partner key fingerprint.
- Audit log event for every successful partner API request: `partner.api.request`.

## Example

```bash
curl -sS \
  -H "Authorization: Bearer partner_xxx" \
  "https://your-domain.example/api/v1/partner/sites?company=buildright-nz"
```
