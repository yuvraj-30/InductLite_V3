# InductLite - Multi-tenant SaaS for NZ Construction Inductions

Production-ready multi-tenant SaaS for NZ small construction/maintenance companies.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database**: PostgreSQL + Prisma ORM
- **Background Jobs**: pg-boss (Postgres-based queue)
- **Rate Limiting**: Upstash Redis Rate Limit
- **Storage**: S3 (production) / Local filesystem (development)
- **PDF Generation**: Puppeteer
- **Containerization**: Docker + Docker Compose

## Quick Start

### Prerequisites

- Node.js 24+ (LTS recommended; Node 20 is minimum compatibility)
- Docker & Docker Compose
- npm 10+

### Development Setup

```bash
# Install dependencies
npm install

# Start database
docker compose up db -d

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Check migration status
npm run db:status

# Seed database
npm run db:seed

# Start development server
npm run dev
```

### Seeded Plan Test Tenants

After `npm run db:seed`, these additional admin users are available (password = `ADMIN_PASSWORD`):

| Plan | Admin Email | Company Slug | Public Site Slugs |
| --- | --- | --- | --- |
| STANDARD | `admin.standard@inductlite.test` | `plan-test-standard` | `plan-standard-site-a`, `plan-standard-site-b` |
| PLUS | `admin.plus@inductlite.test` | `plan-test-plus` | `plan-plus-site-a`, `plan-plus-site-b` |
| PRO | `admin.pro@inductlite.test` | `plan-test-pro` | `plan-pro-site-a`, `plan-pro-site-b` |
| STANDARD + add-on overrides | `admin.addons@inductlite.test` | `plan-test-addons` | `plan-addons-site-a`, `plan-addons-site-b` |

To enable the Plan Configurator UI:

1. Set `FF_SELF_SERVE_CONFIG_V1=true` in your root `.env` (or deployment env vars).
2. Restart the web server.
3. Log in as `admin.pro@inductlite.test` (or `admin.addons@inductlite.test`), then open `/admin/plan-configurator`.

### Native Mobile App (iOS + Android)

```bash
# Type-check native app
npm run mobile:typecheck

# Start Expo runtime
npm run mobile:start

# Launch iOS simulator
npm run mobile:ios

# Launch Android emulator
npm run mobile:android
```

See [apps/mobile/README.md](apps/mobile/README.md) for placeholder and credential setup.

### Quality Gates

```bash
# Competitor parity release gate (required rows must stay implemented)
npm run parity-gate

# Full confidence gate for local/manual release validation
npm run test:confidence

# Broader local/manual confidence gate with all Playwright projects
npm run test:confidence:full

# Include visual regression lane in local/manual confidence gate
npm run test:confidence -- --with-visual

# Mirror the GitHub Actions PR smoke lane locally on Windows/shared-server mode
npm run test:e2e:ci-local
```

Detailed test-coverage explanation (plain language): [docs/FULL_TEST_COVERAGE_AND_PURPOSE_2026-03-09.md](docs/FULL_TEST_COVERAGE_AND_PURPOSE_2026-03-09.md)
Manual browser validation checklist: [docs/MANUAL_FEATURE_VALIDATION_CHECKLIST_2026-03-09.md](docs/MANUAL_FEATURE_VALIDATION_CHECKLIST_2026-03-09.md)
Release confidence contract (PR smoke lane + broader manual confidence): [docs/SAME_OR_BETTER_RELEASE_GATE_2026-03-11.md](docs/SAME_OR_BETTER_RELEASE_GATE_2026-03-11.md)
Scheduled broad browser validation: [.github/workflows/nightly.yml](.github/workflows/nightly.yml)

### Docker Compose (Full Stack)

```bash
# Build and start all services
docker compose up --build

# Verify health
curl http://localhost:3000/health
```

## Environment Variables

Create `.env` file (see `.env.example`):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inductlite?schema=public
SESSION_SECRET=your-32-char-minimum-secret-here
ADMIN_PASSWORD=changeme-in-production
DEMO_BOOKING_NOTIFY_TO=sales@inductlite.nz,support@inductlite.nz
```

Public marketing routes:

- `/` homepage
- `/pricing` plan and add-on overview
- `/demo` demo-booking form (DB persisted + email notifications)
- `/compare` competitor comparison snapshot page

## Production Deployment

See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for full deployment guide.
Go-live steps: [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md).
DB migration + rollback operations: [docs/MIGRATION_RUNBOOK.md](docs/MIGRATION_RUNBOOK.md).

- Market and competitor strategy: [docs/NZ_MARKET_COMPETITOR_ANALYSIS.md](docs/NZ_MARKET_COMPETITOR_ANALYSIS.md).
- Competitor parity control matrix: [docs/COMPETITOR_PARITY_CONTROL_MATRIX.md](docs/COMPETITOR_PARITY_CONTROL_MATRIX.md).

**Render free tier:** keep the single web service awake and trigger cron routes via GitHub Actions. See [.github/workflows/render-keep-alive.yml](.github/workflows/render-keep-alive.yml) and [docs/DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md](docs/DEPLOYMENT_RENDER_NEON_R2_UPSTASH.md) for `CRON_SECRET` and `RENDER_APP_URL` setup.

### Quick Production Start

```bash
# Set required environment variables
export SESSION_SECRET=$(openssl rand -base64 32)
export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
export STORAGE_MODE=s3
export S3_BUCKET=your-bucket
# ... set other S3 vars

# Deploy with Docker
docker compose up -d

# Verify health
curl http://localhost:3000/health
curl http://localhost:3000/api/ready
```

### Health Endpoints

| Endpoint     | Purpose                | Use Case              |
| ------------ | ---------------------- | --------------------- |
| `/health`    | Detailed health status | Monitoring dashboards |
| `/api/ready` | Readiness probe        | K8s readinessProbe    |
| `/api/live`  | Liveness probe         | K8s livenessProbe     |

## Project Structure

```
inductlite/
|-- apps/
|   |-- mobile/              # Expo native app (iOS + Android)
|   `-- web/                 # Next.js application
|       |-- src/
|       |   |-- app/         # App Router pages/routes
|       |   |-- lib/         # Shared utilities
|       |   `-- components/
|       `-- prisma/          # Schema, migrations, seed
|-- packages/                # Shared packages and cross-app contracts
`-- docker-compose.yml
```
## License

Proprietary - All rights reserved.

