# SYSTEM_MAP

Structural audit of the InductLite monorepo as of 2026-03-13.

## Executive Summary

This repository is not a microservice mesh. It is a Turbo monorepo centered on one primary deployable service, [`apps/web`](apps/web), plus one native client, [`apps/mobile`](apps/mobile), and a small set of shared/tooling packages under [`packages/`](packages).

The real backend "source of truth" sits in the web app:

- Database schema: [`apps/web/prisma/schema.prisma`](apps/web/prisma/schema.prisma)
- Database migration history: [`apps/web/prisma/migrations`](apps/web/prisma/migrations)
- Tenant-safe data access boundary: [`apps/web/src/lib/db/scoped-db.ts`](apps/web/src/lib/db/scoped-db.ts)
- Domain/service boundary: [`apps/web/src/lib/repository/index.ts`](apps/web/src/lib/repository/index.ts)

API contracts are still somewhat fragmented. There is no single OpenAPI, GraphQL, protobuf, or generated contract layer in the repo today. After the contract cleanup, they are split across:

- cross-app mobile contracts in [`packages/shared/src/contracts/mobile.ts`](packages/shared/src/contracts/mobile.ts)
- [`apps/web/src/lib/validation/schemas.ts`](apps/web/src/lib/validation/schemas.ts)
- [`apps/web/src/lib/api/response.ts`](apps/web/src/lib/api/response.ts)
- Route-local Zod schemas under [`apps/web/src/app/api`](apps/web/src/app/api)

The main remaining drift risk is that partner API and some web-only request schemas are still owned inside `apps/web`, while only cross-app mobile contracts have been centralized.

## Core Workspace Inventory

| Path | Role | Deployable | Notes |
| --- | --- | --- | --- |
| [`apps/web`](apps/web) | Primary product surface and backend | Yes | Next.js 16 app, server actions, route handlers, Prisma, background job entrypoints, policy enforcement |
| [`apps/mobile`](apps/mobile) | Native mobile client | Yes | Expo app that calls `apps/web` mobile endpoints |
| [`packages/shared`](packages/shared) | Shared TypeScript utilities and cross-app contracts | No | Holds phone utilities plus shared mobile/web payload contracts |
| [`packages/tsconfig`](packages/tsconfig) | Shared TypeScript config package | No | Build/tooling only |
| [`apps/web/eslint-plugin-security`](apps/web/eslint-plugin-security) | Local ESLint security/guardrail plugin | No | CI/tooling only |
| [`tools/vendor/prisma`](tools/vendor/prisma) | Vendored Prisma CLI package | No | Tooling/vendor only |
| [`tools/vendor/prisma-dev`](tools/vendor/prisma-dev) | Vendored Prisma dev tooling | No | Tooling/vendor only |

## Top-Level Directory Map

| Path | Purpose |
| --- | --- |
| [`apps/`](apps) | Deployable applications |
| [`packages/`](packages) | Shared workspace packages |
| [`docs/`](docs) | Guardrails, runbooks, cost/security policy, audit artifacts |
| [`scripts/`](scripts) | Repo-level policy/guardrail checks |
| [`tests/`](tests) | Root-level non-app test assets; currently load testing lives here |
| [`e2e/`](e2e) | Root-level local VRT output only; real web E2E tests live in `apps/web/e2e` |
| [`competitors/`](competitors) | Market research/reference material |
| [`tools/`](tools) | Vendored or analysis tooling |
| `node_modules/`, `.turbo/`, `.next/`, `coverage/`, `tmp/`, `.tmp_*` | Generated or local-state directories; not part of the core system design |

## Runtime Shape

```text
Browser / Public users
  -> apps/web/src/app/*
  -> server actions + route handlers
  -> apps/web/src/lib/repository/*
  -> apps/web/src/lib/db/scoped-db.ts / public-db.ts
  -> Prisma client
  -> PostgreSQL

Admin users
  -> apps/web/src/app/admin/*
  -> same repository/db boundary
  -> exports, audit, plans, incidents, permits, safety forms, integrations

Partner/API consumers
  -> apps/web/src/app/api/v1/partner/*
  -> apps/web/src/lib/partner-api/auth.ts
  -> repositories
  -> PostgreSQL

Native mobile app
  -> apps/mobile/src/*
  -> /api/mobile/enrollment-token
  -> /api/mobile/heartbeat
  -> /api/mobile/geofence-events
  -> repositories + audit/runtime event tables

Background/async work
  -> apps/web/scripts/run-export-scheduler.ts
  -> apps/web/scripts/run-maintenance.ts
  -> apps/web/src/lib/export/*
  -> apps/web/src/lib/email/*
  -> apps/web/src/lib/webhook/*
  -> PostgreSQL + pg-boss + storage/email providers
```

## `apps/web`: Logical Subsystems

[`apps/web`](apps/web) is a modular monolith with several logical subsystems:

| Path | Responsibility |
| --- | --- |
| [`apps/web/src/app`](apps/web/src/app) | App Router pages, layouts, server actions, route handlers |
| [`apps/web/src/app/admin`](apps/web/src/app/admin) | Admin product surface |
| [`apps/web/src/app/s`](apps/web/src/app/s) | Public sign-in and sign-out entry flow |
| [`apps/web/src/app/api`](apps/web/src/app/api) | HTTP endpoints for mobile, partner API, storage, cron, test helpers |
| [`apps/web/src/lib/repository`](apps/web/src/lib/repository) | Domain/data access layer; broadest single map of business modules |
| [`apps/web/src/lib/db`](apps/web/src/lib/db) | Prisma client creation plus scoped/public DB helpers |
| [`apps/web/src/lib/auth`](apps/web/src/lib/auth) | Sessions, CSRF, guards, MFA, password flows |
| [`apps/web/src/lib/rate-limit`](apps/web/src/lib/rate-limit) | Abuse controls and telemetry |
| [`apps/web/src/lib/export`](apps/web/src/lib/export) | Export scheduling, formatting, workers |
| [`apps/web/src/lib/mobile`](apps/web/src/lib/mobile) | Mobile runtime token encoding/verification helpers |
| [`apps/web/prisma`](apps/web/prisma) | Canonical schema, migration history, seed |
| [`apps/web/e2e`](apps/web/e2e) | Playwright scenarios |
| [`apps/web/tests/integration`](apps/web/tests/integration) | Real-DB integration suite |
| [`apps/web/scripts`](apps/web/scripts) | Operational scripts and worker entrypoints |

## `apps/mobile`: Runtime Role

[`apps/mobile`](apps/mobile) is a thin Expo wrapper around backend APIs already hosted by `apps/web`.

Key folders:

| Path | Responsibility |
| --- | --- |
| [`apps/mobile/src/services`](apps/mobile/src/services) | Mobile API calls, enrollment token parsing, event queueing |
| [`apps/mobile/src/tasks`](apps/mobile/src/tasks) | Background geofence task integration |
| [`apps/mobile/src/storage`](apps/mobile/src/storage) | Local device settings |
| [`apps/mobile/src/config`](apps/mobile/src/config) | Runtime/environment config |
| [`apps/mobile/credentials`](apps/mobile/credentials) | Placeholder credential stubs; not runtime code |

Important implication: the mobile app is a client of the web app, not a separate backend.

## Database Source of Truth

### Authoritative

1. [`apps/web/prisma/schema.prisma`](apps/web/prisma/schema.prisma)
   This is the canonical database model definition and enum registry.
2. [`apps/web/prisma/migrations`](apps/web/prisma/migrations)
   This is the applied schema history.
3. [`apps/web/prisma.config.ts`](apps/web/prisma.config.ts)
   This defines which schema/migration paths Prisma uses at runtime.

### Derived from the Prisma schema

- `@prisma/client` types and delegates used across `apps/web`
- [`docs/tenant-owned-models.md`](docs/tenant-owned-models.md), which explicitly says it is generated from `apps/web/prisma/schema.prisma`

### Enforcement layer, not schema authority

- [`apps/web/src/lib/db/scoped-db.ts`](apps/web/src/lib/db/scoped-db.ts)
  This is the runtime enforcement point for tenant-owned model access.
- [`apps/web/src/lib/db/scoped.ts`](apps/web/src/lib/db/scoped.ts)
  Additional scoped helpers.

Practical conclusion: if schema truth and generated types disagree, the Prisma schema wins.

## API Type Source of Truth

There is no single canonical API contract package today.

### Closest current authorities by concern

| Concern | Closest source of truth | Notes |
| --- | --- | --- |
| Shared mobile/web payloads | [`packages/shared/src/contracts/mobile.ts`](packages/shared/src/contracts/mobile.ts) | Canonical cross-app contract file after refactor |
| Web-only public sign-in/history validation | [`apps/web/src/lib/validation/schemas.ts`](apps/web/src/lib/validation/schemas.ts) | More complete than `packages/shared` for real sign-in flows |
| Server action / app-level response envelope | [`apps/web/src/lib/api/response.ts`](apps/web/src/lib/api/response.ts) | Actual web runtime response shape |
| Mobile endpoint request shapes | [`packages/shared/src/contracts/mobile.ts`](packages/shared/src/contracts/mobile.ts) | Used by both `apps/mobile` and mobile web routes |
| Partner API responses | Inline in [`apps/web/src/app/api/v1/partner`](apps/web/src/app/api/v1/partner) | No shared contract package found |

### Audit conclusion

The repo still uses federated API contracts, not one universal contract authority. The improvement is that mobile/web shared payloads now have one home.

The remaining split is intentional:

- cross-app mobile contracts live in [`packages/shared`](packages/shared)
- web-only runtime, session, and response rules stay in [`apps/web`](apps/web)

## Duplicate Code and Drift Hotspots

### 1. Validation schema split-brain

Web-only validation is now correctly owned by:

- [`apps/web/src/lib/validation/schemas.ts`](apps/web/src/lib/validation/schemas.ts)

Cross-app mobile contracts are now owned by:

- [`packages/shared/src/contracts/mobile.ts`](packages/shared/src/contracts/mobile.ts)

Why this matters:

- Public sign-in and export validation are no longer duplicated in `packages/shared`.
- The remaining contract split is by ownership boundary, not accidental copying.

### 2. Session type duplication

The session user shape now belongs only to:

- [`apps/web/src/lib/auth/session-config.ts`](apps/web/src/lib/auth/session-config.ts)

That is the correct owner because the web app owns the runtime cookie/session contract.

### 3. API response type duplication

The API response envelope now belongs only to:

- [`apps/web/src/lib/api/response.ts`](apps/web/src/lib/api/response.ts)

That is the correct owner because the backend defines those responses.

### 4. Repeated bearer-token parsing helpers

Equivalent `parseBearerToken` helpers appear in multiple places:

- [`apps/web/src/lib/mobile/enrollment-token.ts`](apps/web/src/lib/mobile/enrollment-token.ts)
- [`apps/web/src/lib/partner-api/auth.ts`](apps/web/src/lib/partner-api/auth.ts)
- [`apps/web/src/app/api/auth/directory-sync/route.ts`](apps/web/src/app/api/auth/directory-sync/route.ts)

This is small duplication, but it is still protocol parsing drift.

### 5. Mobile enrollment token protocol is now shared

The shared payload definition now lives in:

- [`packages/shared/src/contracts/mobile.ts`](packages/shared/src/contracts/mobile.ts)

It is consumed by:

- [`apps/web/src/lib/mobile/enrollment-token.ts`](apps/web/src/lib/mobile/enrollment-token.ts)
- [`apps/mobile/src/services/enrollmentToken.ts`](apps/mobile/src/services/enrollmentToken.ts)

The web app still owns signing and verification, but the payload shape itself is no longer manually duplicated.

## Dependency Skew Between Folders

Package-manifest comparison across the workspace shows only two direct version skews:

| Dependency | Versions | Where |
| --- | --- | --- |
| `typescript` | `^5.3.3` and `~5.9.2` | Root/web/shared use `^5.3.3`; mobile uses `~5.9.2` |
| `@types/react` | `19.2.14` and `~19.2.2` | Web uses `19.2.14`; mobile uses `~19.2.2` |

Interpretation:

- This is not a runtime conflict for the deployed product.
- It is a workspace maintenance risk, especially if `packages/shared` is expected to compile cleanly against both web and mobile.

Notable non-conflicts:

- `react` is aligned at `19.2.4` in web and mobile.
- `zod` is aligned between web and shared.
- Prisma is isolated to `apps/web`; no competing ORM/schema authority was found elsewhere.

## How the Parts Fit Together

### Primary production path

1. Users hit [`apps/web/src/app`](apps/web/src/app) routes.
2. Server actions and route handlers call repository functions from [`apps/web/src/lib/repository`](apps/web/src/lib/repository).
3. Repositories use scoped or public DB helpers from [`apps/web/src/lib/db`](apps/web/src/lib/db).
4. Prisma maps those calls onto the Postgres schema defined in [`apps/web/prisma/schema.prisma`](apps/web/prisma/schema.prisma).
5. Background work, exports, emails, and webhook delivery are orchestrated from web-side scripts and lib modules, not separate services.

### Mobile path

1. [`apps/mobile`](apps/mobile) stores enrollment settings and geofence events on-device.
2. It sends heartbeat/geofence requests to `apps/web` mobile endpoints.
3. The web app validates mobile enrollment tokens, writes runtime/audit events, and performs sign-in/out side effects through the same repository layer.

### Shared-code path

1. [`packages/shared`](packages/shared) provides a small shared utility surface.
2. It now owns phone helpers plus the shared mobile/web payload schemas and types.

## Structural Recommendations

If you want a cleaner long-term system map, the highest-value moves are:

1. Keep following the ownership split now in place.
   Cross-app mobile contracts in [`packages/shared`](packages/shared); web-only runtime rules in [`apps/web`](apps/web).
2. Keep session and API response types owned by the web runtime unless they are truly shared.
3. Generate or centrally define mobile/partner API contracts instead of manually mirroring them in route files and client files.
4. Consolidate duplicated auth-header parsing into one helper.

## Bottom Line

The repo is structurally understandable once viewed as:

- one modular monolith backend/frontend in [`apps/web`](apps/web),
- one thin native client in [`apps/mobile`](apps/mobile),
- one shared contract/util package in [`packages/shared`](packages/shared),
- and a set of guardrail/tooling folders around them.

The main architectural ambiguity is not service ownership. It is contract ownership.
