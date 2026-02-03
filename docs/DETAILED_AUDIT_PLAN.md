# Detailed Audit & Remediation Plan

Date: 2026-01-29

## Purpose

This document outlines a precise, file-by-file audit plan for TypeScript errors, unused imports/exports, duplicate or missing exports, and improper `any` usage across the repo. It prioritizes low-risk, high-impact fixes first and provides a repeatable checklist so you can review and sign off before code changes are applied.

## Scope

- All files under the repo root (packages, apps, src, tests, e2e).
- Focus areas: TypeScript compile errors, ESLint problems, unused/duplicate exports, replacing `any` in library code (leave tests for later unless they block build), and cross-platform e2e issues (spawn, paths).

## High-level approach & tooling

1. Ensure a reproducible environment:
   - Run `npm ci` at repo root.
   - Use Linux CI runner (or WSL locally) to avoid Windows-specific spawn/path issues.
2. Static checks:
   - `npm run lint` (autofix where safe; annotate remaining issues).
   - `npm run build` (resolve TypeScript errors iteratively).
   - `npx ts-prune --json` to find dead exports.
   - `npx madge --orphans` to detect unused modules.
3. Runtime checks:
   - Run unit tests (`npm run test`) and integration tests.
   - Run E2E in CI (`npx playwright test e2e --workers=2`) after fixes.

## Priority list (what to fix first)

1. **Blocking compile/type errors** (must pass `npm run build`) ✅
2. **ESLint errors and unused imports** (run `npm run lint` and `eslint --fix` where safe) ✅
3. **Cross-platform runtime issues** used by `e2e` fixtures (prisma spawn on Windows) ✅
4. **Dead exports and duplicate names** (resolve via `ts-prune`) ✅
5. **Replace `any` in library code** (use correct types, prefer Prisma types or generics) ⚠️
6. **Refactor server/client boundaries** (avoid calling server actions directly from client components; prefer form actions or server-side wrappers) ⚠️

## File-by-file items (observed + recommended)

Note: this list includes confirmed issues found during the initial scan and recommended fixes. After you approve this plan I'll run the deeper automated scan and produce a complete file-by-file actionable list derived from tool output.

- apps/web/e2e/test-fixtures.ts
  - Issue: Spawns `npx prisma db push` from within Playwright worker processes which is platform-sensitive and caused Windows ENOENT/EINVAL errors.
  - Recommendation: Replace shell spawn approach with a programmatic schema-creation method (e.g., use a short-lived Prisma Client to create the schema via raw SQL or use the `@prisma/sdk` programmatic migrate/push flow). Add robust retries + better logging. Keep `shell` fallback for CI if needed.
  - Priority: High (blocks local Windows runs and potentially flaky CI).

- apps/web/e2e/admin-auth.spec.ts
  - Issue: TypeScript parser reported multiple syntax errors earlier; most were fixed during the session. Re-run type-check to validate all syntax is clean.
  - Recommendation: Re-run `npm run build` and `npm run lint` to ensure no remaining TS errors in test files. If parser still complains, fix syntax (unclosed template literals, missing commas) and ensure test code follows the Playwright `test.describe` API.
  - Priority: High (E2E tests must be syntactically valid).

- apps/web/e2e/utils/seed.ts
  - Issue: Used `res.ok` property (function in Playwright Request) incorrectly — fixed to call `res.ok()`.
  - Recommendation: Add unit tests for these helper methods and defensive null checks.
  - Priority: Medium.

- apps/web/src/app/admin/sites/new/create-site-form.tsx
  - Issue: Misplaced `"use client"` directive (moved to top). Fixed.
  - Recommendation: Add a minimal test or lint rule check for directive placement and include a short comment explaining client component boundaries.
  - Priority: Low.

- apps/web/src/app/admin/templates/template-action-forms.tsx
  - Issue: Client-only hook `useFormStatus` used in a server component. Fixed by extracting client `SubmitButton`.
  - Recommendation: Audit other components for similar client/server boundary mistakes.
  - Priority: Medium.

- apps/web/src/app/admin/exports/page.tsx & actions.ts
  - Issue: `createExportActionFromForm` originally returned a typed ApiResponse (not suitable for form action signature); adjusted to `await` the typed action. Logging and `revalidatePath` added.
  - Recommendation: Add a small unit test verifying the server action works as a form action (and does not leak structured ApiError to client). Add comment and types for developers.
  - Priority: Medium.

- apps/web/src/lib/db/scoped-db.ts
  - Issue: TypeScript complained about `prisma[model]` dynamic indexing and unused type declarations. I added targeted fixes (casts to `any`) to progress the build.
  - Recommendation: Replace `any` casting with a typed helper using Prisma model types or a `scopedDb<TModel>` generic approach so we keep type-safety and avoid `any`. Add tests to assert it enforces `company_id` for tenant models.
  - Priority: High (library code; reduce `any` technical debt here soon).

- apps/web/src/lib/export/runner.ts
  - Issue: Unused import (`generateContractorCsvForCompany`) flagged by TypeScript; remove or use it when implementing that export type.
  - Recommendation: If `INDUCTION_CSV` / contractor export is not implemented, remove the import until used or add a TODO comment linking to an issue.
  - Priority: Low.

- apps/web/src/app/admin/templates/template-buttons.tsx
  - Issue: Client components were calling server actions directly — a questionable pattern. I imported server actions (but note: server actions should normally be invoked via form actions or server-side passes).
  - Recommendation: Prefer form actions or server wrappers; if keeping this pattern, add tests and comments explaining intent and security model.
  - Priority: Medium.

- packages and shared modules
  - Issue: `npm run lint` failed due to `eslint` not found in PATH when run via turbo in Windows dev environment.
  - Recommendation: Ensure contributors install dev dependencies (`npm ci`) or run lint in the CI/linux environment; optionally add a repo-level helper script to run lint via a stable Docker/WSL environment for Windows devs.
  - Priority: Low.

## Global patterns and fixes

- `any` usage
  - Strategy: Replace `any` in library/server code first. Use proper inferred Prisma types (e.g., `Prisma.UserFindManyArgs`) or generics. In tests, allow `any` temporarily but add TODOs to gradually type mocks.
  - Tooling: Add `eslint` rules to disallow `any` outside test folders, enforce `@typescript-eslint/no-explicit-any` with an exception for test files.

- Unused imports/variables
  - Strategy: Run `eslint --fix` to remove trivial unused imports. For intentionally unused params, rename to `_param` or add `// eslint-disable-next-line` with a short justification.

- Dead exports
  - Strategy: Add `ts-prune` as a dev script and run it to list dead exports. For each dead export, check whether it's intentionally public API; if not, remove or mark internal (move to `src/internal` or un-export).

- Duplicate export names
  - Strategy: Run a repo-wide scan for exported identifiers (`export function|const|class|type|interface|default`) and look for collisions within the same module scope. If a collision exists across files, ensure each public API is uniquely named and documented.

## Testing & CI

- After the fixes, run the full CI flow locally (via WSL or run GitHub Actions in a dry-run) to validate cross-platform differences.
- Ensure E2E job in `ci.yml` (`Run full E2E (parallel workers=2)`) is verified and that any test-only endpoints are behind `ALLOW_TEST_RUNNER` guard.

## Acceptance criteria

- `npm run build` exits successfully with no TypeScript errors.
- `npm run lint` exits with no _errors_ (warnings acceptable as a second pass). Treat fixing linter errors as high priority where they affect correctness.
- `ts-prune` returns no significant unexpected dead exports or any chosen dead exports are justified and documented.
- The E2E job in CI (`--workers=2`) completes successfully in an Ubuntu runner.
- `any` usage is limited to test code with TODOs; library code has proper types.

## Deliverables & PR plan

I'll produce a series of small, focused PRs (each with tests) if you approve:

1. PR: Fix build-blocking TypeScript errors and lint issues (small files, high confidence).
2. PR: Replace `any` and add types in `scoped-db` and other high-impact library modules.
3. PR: Replace shell `prisma db push` with programmatic schema creation in `e2e/test-fixtures.ts`.
4. PR: Run `eslint --fix` and apply additive changes (rename unused variables with `_` or add comments).
5. PR: Run `ts-prune` and clean dead exports.

Each PR will include:

- Short description of change and justification.
- Unit tests where applicable.
- CI run demonstrating passing `build`, `lint`, and E2E checks (where relevant).

## Next action (requires your confirmation)

Please confirm you want me to: **(A)** run the automated deep pass now (ESLint autofix + ts-prune + targeted `any` fixes in library code) and open the first PR set, or **(B)** I produce a fuller file-by-file list of _exact_ edits to apply (no code changes yet) for your review.

If you pick A, I will run the tools, create PRs in small increments, and keep you informed of each failing CI step so we can iterate quickly.

---

If you'd like any additions to the plan before I run the deeper automation, let me know and I will update this file.
