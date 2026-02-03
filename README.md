# InductLite - Multi-tenant SaaS for NZ Construction Inductions

Production-ready multi-tenant SaaS for NZ small construction/maintenance companies.

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Database**: PostgreSQL + Prisma ORM
- **Background Jobs**: pg-boss (Postgres-based queue)
- **Rate Limiting**: Upstash Redis Rate Limit
- **Storage**: S3 (production) / Local filesystem (development)
- **PDF Generation**: Puppeteer
- **Containerization**: Docker + Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
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

# Seed database
npm run db:seed

# Start development server
npm run dev
```

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
```

## Production Deployment

See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for full deployment guide.

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
├── apps/
│   └── web/              # Next.js application
│       ├── src/
│       │   ├── app/      # App Router pages/routes
│       │   ├── lib/      # Shared utilities
│       │   └── components/
│       └── prisma/       # Schema, migrations, seed
├── packages/             # Shared packages
└── docker-compose.yml
```

## License

Proprietary - All rights reserved.
