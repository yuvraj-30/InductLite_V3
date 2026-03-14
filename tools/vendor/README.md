# Vendored Dependency Notes

This directory contains local copies of third-party packages that are pinned here to resolve security issues that were not yet fixable through the upstream published dependency graph.

Current vendored packages:

- `extract-zip`
- `prisma`
- `@prisma/dev`

Why these are vendored:

- Upstream Prisma `7.4.2` pulled `@prisma/dev` transitives that triggered GitHub/npm security alerts.
- Upstream `extract-zip@2.0.1` still depends on `yauzl@^2.10.0`, which leaves the Puppeteer browser-download chain on a vulnerable `yauzl` release.
- npm `overrides` did not reliably replace Prisma's exact-pinned toolchain dependencies in this workspace.
- The local copies keep the Prisma CLI/browser-download interfaces unchanged while forcing patched versions of:
  - `yauzl`
  - `@hono/node-server`
  - `hono`
  - `@mrleebo/prisma-ast`
  - `chevrotain`

Update workflow:

1. Refresh `tools/vendor/prisma` from the desired upstream Prisma CLI package.
2. Refresh `tools/vendor/prisma-dev` from the desired upstream `@prisma/dev` package.
3. Re-apply the patched dependency entries in each vendored `package.json`.
4. Run:
   - `npm install`
   - `npm audit`
   - `npm run -w apps/web prisma:validate`
   - `npm run -w apps/web db:generate`

The application still uses the standard Prisma client package from npm. Only the CLI/dev helper path is vendored here.
