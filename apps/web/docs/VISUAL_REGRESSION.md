# Visual Regression Tests (Playwright + VisualRegressionTracker)

This project includes Playwright-based visual regression tests that use Playwright's
built-in snapshot assertions by default. There's optional integration with a
self-hosted VisualRegressionTracker (VRT) server if you prefer a dashboard-based
workflow (similar to Applitools, but free/self-hosted).

## How it works

- By default the tests use Playwright `expect(page).toHaveScreenshot(...)` assertions.
- If you enable VRT (see below), screenshots are uploaded to the tracker instead of
  failing locally; use the tracker web UI to review and approve baselines.

## Running locally (Playwright snapshots)

1. Start the dev server:
   - PowerShell: `$env:ALLOW_TEST_RUNNER='1'; $env:TRUST_PROXY='1'; $env:SESSION_SECRET='your-32-char-secret'; npm run dev`
2. Run Visual tests:
   - `npm run test:visual` (this runs `e2e/visual-regression.spec.ts`)
3. To create/update baselines:
   - `npx playwright test e2e/visual-regression.spec.ts --update-snapshots`

## Enabling VisualRegressionTracker (self-hosted dashboard)

1. Install and run VisualRegressionTracker (see: https://github.com/Visual-Regression-Tracker/Visual-Regression-Tracker)
   - You can run it in Docker or locally as the project documents.

### Quick Docker (recommended for local testing)

If you want a fast local VRT instance, use the project's Docker Compose quickstart:

1. Clone the VRT repo and start the services:
   - `git clone https://github.com/Visual-Regression-Tracker/Visual-Regression-Tracker.git`
   - `cd Visual-Regression-Tracker`
   - Copy the example env and adjust DB passwords if needed: `cp .env.example .env`
   - Bring the stack up: `docker-compose up -d`

2. Default UI port is configurable via the `.env` `PORT` variable (commonly `8080`). Visit `http://localhost:8080` (or your configured port) to access the tracker UI.

3. Create a project / API key in the tracker UI and then set these env vars in your local environment (do not commit them):
   - `VRT_ENABLED=1`
   - `VRT_API_URL=http://localhost:8080`
   - `VRT_API_KEY=<your-generated-api-key>`

4. Run the visual tests in this repo (they will upload screenshots to VRT when enabled):
   - `cd apps/web`
   - `npm run test:visual`

### Included quick-start compose (local)

A minimal `docker-compose.vrt.yml` is included at the repo root to start a VRT instance quickly (Postgres + API + UI):

> Tip: A ready-made `.env.vrt.example` lives at the repo root with recommended defaults (ports, DB settings and VRT versions). Copy it to `.env.vrt` and edit secrets before use, for example:
>
> - Unix/macOS: `cp .env.vrt.example .env.vrt`
> - Windows (PowerShell): `Copy-Item .env.vrt.example .env.vrt`
>
> Then start the compose using the env-file: `docker compose --env-file .env.vrt -f docker-compose.vrt.yml up -d`.

1. Start VRT locally:
   - `docker compose -f docker-compose.vrt.yml up -d`
   - or from this package: `cd apps/web && npm run vrt:up` (starts the minimal VRT stack in the repo root)

> Note: In this repo the quick-start compose exposes the VRT API on host port **3005** (container port 3000) to avoid collisions with local dev servers that use port 3000. Change `api.ports` if you want a different mapping.

> Tip: The GitHub Actions workflow supports an optional `start_vrt` workflow_dispatch input. If you run the `.github/workflows/visual-regression.yml` workflow manually and set `start_vrt=true`, the workflow will attempt to start the included `docker-compose.vrt.yml` on the runner before running tests. Note: that action only starts the service — you still need valid `VRT_API_KEY`/`VRT_API_URL` repository secrets for uploads to occur.

2. Visit `http://localhost:8080`, create a project and an API key.

3. Set the env vars locally (do NOT commit):
   - `VRT_ENABLED=1`
   - `VRT_API_URL=http://localhost:8080`
   - `VRT_API_KEY=<your-generated-api-key>`

4. Stop and remove data when finished:
   - `docker compose -f docker-compose.vrt.yml down --volumes`

5. Set these environment variables for tests:
   - `VRT_ENABLED=1`
   - `VRT_API_URL=https://your-vrt-host:port`
   - `VRT_API_KEY=<your-tracker-api-key>`

### Creating baselines (Playwright snapshots)

- The first time you run visual tests they will fail and write the actual screenshots to the snapshot folder. To create/update baselines run:
  - `npx playwright test e2e/visual-regression.spec.ts --project=chromium --update-snapshots`
- Subsequent runs will compare against those saved baseline images and fail on diffs.

When `VRT_ENABLED=1`, tests will upload screenshots to the tracker API endpoint
`/api/runs/upload`. The test will skip the Playwright snapshot assertion and
will instead instruct you to review the images in the tracker UI.

## CI integration notes

- Add the tracker URL and API key as repository secrets in your CI provider.
- Update the CI job to set `VRT_ENABLED=1` in the environment for the visual test step.
- Visual tests will run in CI and upload results to the tracker for team review.

## Why use Playwright snapshots first?

- No external service or cost required
- Cross-browser support is native
- Faster to adopt and maintain

If you want, I can:

- Add a small CI step example that runs the visual tests and uploads to VRT (if enabled), or
- Wire up VisualRegressionTracker's official client instead of the lightweight upload helper.

Which would you like me to do next?
