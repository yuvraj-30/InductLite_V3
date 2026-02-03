# Repository Audit Report — Initial Scan

Date: 2026-01-29

## Overview

This is an initial automated audit of the repository to identify TypeScript errors, lint issues, unused imports/exports, and occurrences of `any` types. The audit also summarizes recent fixes I applied while working on the e2e/schema-per-worker CI work and proposes next steps for a thorough cleanup.

## Summary of findings so far

- Build & Type-check failures discovered and addressed during the session:
  - Fixed misplaced `"use client"` directive in `apps/web/src/app/admin/sites/new/create-site-form.tsx`.
  - Split client component `SubmitButton` into `SubmitButton.client.tsx` and updated usages.
  - Repaired a number of TypeScript errors in pages and actions (unused imports, incorrect function signatures, wrong imports vs default imports) and made targeted small fixes in:
    - `apps/web/src/app/admin/exports/page.tsx` (added logging, fixed form action typing)
    - `apps/web/src/app/admin/exports/actions.ts` (revalidatePath after creating export)
    - `apps/web/src/app/admin/templates/template-action-forms.tsx` and `template-buttons.tsx` (client/server action wiring)
    - `apps/web/src/lib/db/scoped-db.ts` (fixed type issues by selective casts and removed unused types)
    - Several other small fixes to get `npm run build` moving forward.

- Current TypeScript/lint status (partial):
  - `npm run build` still reports issues in places I am iterating on; I have resolved many of them in this session and `next build` now progresses further.
  - `npm run lint` currently fails on Windows in the `packages/shared` lint script due to missing `eslint` in PATH when invoked from turbo tasks (this is environment-related). I recommend running ESLint in CI (Ubuntu runner) or ensuring dev deps are installed correctly when running locally.

## Automated scan results (quick pass)

- Type errors collected by `get_errors` (quick):
  - `apps/web/e2e/export.spec.ts`: 'TEST_PASSWORD' is declared but never read.

- `any` occurrences (quick grep): sample locations
  - Tests (several places): using `cb: any` in mock implementations (acceptable in tests but could be typed better).
  - `apps/web/src/lib/db/scoped-db.ts`: several function `args: any` declarations; casting `prisma as any` used to appease TypeScript (technical debt — can be improved with Prisma types).
  - Some uses of `as any` across the codebase. Tests are the main place with `any` usage.

- Notable unused imports / variables found and fixed during the session:
  - Removed unused `execSync` import in `apps/web/e2e/test-fixtures.ts`.
  - Fixed unused `createExportAction` vs `createExportActionFromForm` usage in `apps/web/src/app/admin/exports/page.tsx`.
  - Fixed unused variables/imports flagged during build (e.g., `revalidatePath` and `createRequestLogger` handling).

- Exports:
  - I found and addressed several mismatches where the file intended a default import but exported a named export (and vice-versa). I will run a follow-up pass to enumerate all exports and search their usages to ensure no dead exports remain.

## Important notes and recommendations

1. Full repo audit is a multi-step process — here's the recommended approach:
   - Run `npm ci` and `npm run lint` and `npm run build` in a Linux CI environment to capture all issues in a stable environment (Windows can introduce PATH/spawn quirks).
   - Run long-form static analysis:
     - ESLint (fix unused imports/vars where appropriate or mark with \_ prefix for intentional unused args).
     - TypeScript strict-check (tweak tsconfig if some tests need more leniency).
     - Use tools to find unused exports (e.g., `ts-prune` or similar) and dead code (e.g., `madge`).
   - Replace `any` with more precise types, prioritizing non-test code (server / library code) first.
   - For dynamic `prisma[model]` patterns (like `scopedDb`), prefer a typed helper (generic wrapper) rather than `as any` if feasible. This prevents accidental mistakes while preserving DRY.

2. Cross-platform notes:
   - Some commands (npx, eslint) behave differently on Windows (shell vs npx.cmd). For local Windows developers, using WSL is recommended for parity with CI; the `apps/web/e2e/README.md` already has WSL notes.

## Deliverable

- I created this report at `docs/REPO_AUDIT_REPORT.md` with initial findings and recommendations.

## Next steps (proposed)

1. Confirm you'd like me to proceed with an automated deep pass:
   - Run ESLint (fix or annotate unused imports/vars).
   - Run `ts-prune` (or add it) to detect dead exports and list them.
   - Replace `any` in library code with concrete types (use Prisma types when appropriate) and add `// TODO` for test code improvements.
   - Produce a follow-up report with exact file-by-file fixes applied and any follow-up tasks.

2. Alternatively, I can start applying safe automated fixes now (remove clearly unused imports, rename unused variables with `_` to silence lint, and create focused PRs for larger typing work).

Would you like me to start the automated deep pass (ESLint fixes + dead-export detection + type improvements), or would you prefer a short review & approval step before I modify more files? Please confirm and I will proceed.

---

If you'd like, I can now run `npm run lint` in a Linux runner (CI) or install missing dev deps locally (fixing the Windows ESLint issue) to get comprehensive lint errors. Tell me which you'd prefer and I'll continue.
