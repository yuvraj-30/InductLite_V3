# Build stage
FROM node:24-bookworm-slim AS builder

# Metadata
LABEL org.opencontainers.image.title="InductLite"
LABEL org.opencontainers.image.description="Multi-tenant SaaS for NZ construction site inductions"
LABEL org.opencontainers.image.vendor="InductLite"

# Install dependencies for native modules (argon2) and SSL runtime for Prisma (Debian)
RUN apt-get update && apt-get install -y --no-install-recommends -o Acquire::Retries=3 --fix-missing \
    build-essential python3 openssl ca-certificates curl chromium \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY apps/web/package.json ./apps/web/
# Copy workspace shared package source so workspace scripts can run during npm ci
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared ./packages/shared
RUN npm ci

# Build shared workspace package so Next/Turbopack can consume it
# Use workspace build command so we avoid running nested installs and make CI deterministic
RUN npm run build --workspace=@inductlite/shared && \
    # Ensure built files are available under node_modules so Turbopack can resolve the package
    mkdir -p node_modules/@inductlite && rm -rf node_modules/@inductlite/shared || true && \
    cp -R packages/shared/dist node_modules/@inductlite/shared && \
    cp packages/shared/package.json node_modules/@inductlite/shared/package.json && \
    # Install production dependencies for the packaged shared module so Turbopack can resolve them
    cd node_modules/@inductlite/shared && npm install --production --no-audit --no-fund --progress=false --ignore-scripts

# Copy source
COPY . .

# Generate Prisma client
RUN npm run db:generate --workspace=@inductlite/web && \
    # Ensure Prisma runtime artifacts are available at predictable root locations
    if [ -d apps/web/node_modules/@prisma ]; then mkdir -p node_modules && cp -R apps/web/node_modules/@prisma node_modules/@prisma || true; fi && \
    if [ -d apps/web/node_modules/prisma ]; then mkdir -p node_modules && cp -R apps/web/node_modules/prisma node_modules/prisma || true; fi && \
    if [ -d apps/web/node_modules/.prisma ]; then mkdir -p apps/web/node_modules && cp -R apps/web/node_modules/.prisma apps/web/node_modules/.prisma || true; fi

# Build application
RUN npm run build --workspace=@inductlite/web

# Production stage
FROM node:24-bookworm-slim AS runner

# Install dependencies for native modules and Puppeteer (Debian)
RUN apt-get update && apt-get install -y --no-install-recommends -o Acquire::Retries=3 --fix-missing \
    chromium ca-certificates openssl curl fonts-liberation libnss3 libfreetype6 libharfbuzz0b \
  && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy Prisma files for migrations
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/node_modules/.prisma ./apps/web/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create storage directory
RUN mkdir -p /app/.storage && chown -R nextjs:nodejs /app/.storage

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check - use lightweight readiness probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:3000/api/ready > /dev/null || exit 1

CMD ["node", "apps/web/server.js"]
