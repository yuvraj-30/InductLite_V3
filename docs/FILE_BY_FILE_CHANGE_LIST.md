# File-by-File Change List — Explicit Edits & Rationale

Date: 2026-01-29

## Purpose

This document lists explicit, reviewable changes I will make (if you approve) to resolve TypeScript/lint errors, remove unused imports/exports, reduce `any` usage in library code, and harden E2E cross-platform behavior. Each entry contains: file path, exact suggested edit (code-level where applicable), rationale, tests to add/verify, risk level, and PR size estimate.

## Instructions

- I will not apply any of these edits until you approve the plan and the grouping of PRs.
- After you approve, I will implement changes in small PRs as listed (one PR per grouping), run the build/lint/tests, and iterate until green.

## Summary of PRs (proposed grouping)

PR 1 — Build & lint blockers (small, high priority)

- Fix remaining TypeScript compile errors, unused imports, and small test helpers (files in apps/web/\*\* where build fails now).
- Add CI lint step fixes and `ts-prune` reporting.

PR 2 — E2E fixture robustness (medium)

- Replace brittle shell spawns in `e2e/test-fixtures.ts` with a programmatic schema creation path and add robust retries/logging.

PR 3 — Typing improvements (medium/large)

- Replace `any` usage in library code with precise types (start with `scoped-db.ts`), add ESLint rule to ban `any` in src (allow tests), and add TODOs for remaining test `any` occurrences.

PR 4 — API & UX action improvements (medium)

- Refactor client/server boundaries (e.g., template action buttons) to use form actions or server wrappers for clarity and security.

PR 5 — Dead exports cleanup (small)

- Run `ts-prune` and remove or justify dead exports, adding tests if needed.

## Detailed file entries

1. apps/web/e2e/test-fixtures.ts

- Problem: brittle use of `spawnSync('npx prisma db push')` inside Playwright worker processes leading to ENOENT/EINVAL on Windows. Uses shell invocation which is platform-sensitive.
- Exact change:
  - Replace the `spawnSync(commandString)` loop that runs `prisma db push` with a programmatic schema ensure step, e.g.:

```ts
// Replace spawnSync block with programmatic schema create
const { PrismaClient } = await import("@prisma/client");
const tmpClient = new PrismaClient({
  datasources: { db: { url: originalDb } },
});
try {
  await tmpClient.$connect();
  await tmpClient.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  // Optionally run `prisma db push` with shell **only** if schema missing and we're on CI/Linux
} finally {
  await tmpClient.$disconnect();
}
```

- Rationale: avoids calling external binary, is cross-platform, faster and more reliable.
- Tests: Run E2E locally via WSL and CI Ubuntu; assert that worker schemas are created and torn down correctly (spot check by listing tables in schema or attempting to seed test data).
- Risk: Medium — changing how schemas are created; mitigate by keeping a fallback `spawnSync` step behind an env flag and retain logs.
- PR size: Medium

2. apps/web/e2e/admin-auth.spec.ts (and other e2e tests)

- Problem: earlier syntax errors / unclosed literals and TypeScript parse errors were reported by the editor; some were fixed interactively.
- Exact change: Re-run TypeScript check and inspect remaining failing lines. Common edits:
  - Fix unmatched parentheses/commas
  - Replace `res.ok` property usage with `res.ok()` where `res` is Playwright response
  - Ensure template literals are closed
- Rationale: tests must be syntactically correct for automated runs.
- Tests: `npm run build` and `npx playwright test e2e --workers=1` locally (WSL) to ensure syntax and runtime.
- Risk: Low
- PR size: Small

3. apps/web/e2e/utils/seed.ts

- Problem: used `res.ok` (property) instead of `res.ok()` function, causing build TS error.
- Exact change: Already changed to call `res.ok()`; add unit tests verifying helper behavior and invalid responses.
- Rationale: correctness and defensive programming
- Risk: Low
- PR size: Small

4. apps/web/src/app/admin/sites/new/create-site-form.tsx

- Problem: `"use client"` directive placed incorrectly.
- Exact change: Move directive to the top of file (already implemented). Add comment and unit/visual test.
- Rationale: Next.js requires directive at top for client components.
- Tests: `npm run build`; optionally add Playwright snapshot for the form.
- Risk: Low
- PR size: Small

5. apps/web/src/app/admin/templates/\* (template-action-forms.tsx, template-buttons.tsx)

- Problem: Client/server boundary issues (hook in server component, or client directly calling server action). We added `SubmitButton.client.tsx` and corrected imports; template buttons still call server action directly.
- Exact change:
  - Preferred: Convert buttons that perform server-side operations into forms that call server actions (the new App Router form actions pattern). For example, for Publish:

```tsx
<form action={publishTemplateAction} className="inline">
  <input type="hidden" name="templateId" value={templateId} />
  <button type="submit">Publish</button>
</form>
```

- Alternatively, if we keep client click -> fetch pattern, use a thin server endpoint (server action wrapper) and call `fetch('/api/admin/templates/publish', { method: 'POST', body: JSON })` to avoid importing server action into client bundle.
- Rationale: avoids importing server-only code into client components and clarifies security boundaries.
- Tests: Unit tests for actions and an E2E test to click Publish/Archive and verify expected revalidatePath effect.
- Risk: Medium
- PR size: Medium

6. apps/web/src/app/admin/exports/actions.ts & page.tsx

- Problem: `createExportActionFromForm` originally returned ApiResponse (not suitable for being `form` handler). We changed to `await` and ignore response in form action.
- Exact change: Keep `await createExportAction(...)` and ensure `createExportAction` continues returning typed ApiResponse for API use. Add `revalidatePath('/admin/exports')` after job creation (already added).
- Rationale: proper server action signature and UI freshness.
- Tests: unit tests covering action logic; E2E test submitting the form and checking the exports list update.
- Risk: Low
- PR size: Small

7. apps/web/src/lib/db/scoped-db.ts

- Problem: dynamic indexing into `prisma[model]` triggered TypeScript union-callable signatures errors; built-in cast `(prisma as any)[model]` is used currently. Also removed unused `TenantModel` type — OK, but long-term `any` is undesirable.
- Exact change (two steps):
  - Immediate: annotate the file with a clear comment explaining the intentional cast and add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` on the specific line(s) where `any` is used, keeping behavior unchanged but making intent explicit.
  - Medium-term: implement typed wrapper using Prisma model-specific types, e.g. implement a `createScopedDb(companyId)` that returns an object with typed method signatures for each model (using Prisma types like `Prisma.UserFindManyArgs`). Example pattern:

```ts
import type { Prisma } from "@prisma/client";
function typedFindMany<M extends keyof PrismaClient>(model: M, args?: any) {
  /* typed wrapper */
}
```

- Add unit tests that ensure findMany calls include `company_id` in where.
- Rationale: reduces `any` surface and improves maintainability.
- Tests: unit tests mocking Prisma to ensure `where` is augmented.
- Risk: Medium (typing work can be verbose) — implement in separate PR.
- PR size: Medium -> Large (for complete typed conversion)

8. apps/web/src/lib/export/runner.ts

- Problem: `generateContractorCsvForCompany` imported but unused (this could be due to incomplete feature work).
- Exact change: remove the unused import, or if intended, implement the INDUTION_CSV case to call that function. For now: remove import and leave TODO comment to implement other export types.
- Rationale: keep build clean and remove dead imports.
- Tests: Add unit tests to process sign-in export result and error path.
- Risk: Low
- PR size: Small

9. packages/shared & eslint dev-run issues

- Problem: running `npm run lint` via turbo on Windows failed due to eslint not found; CI uses Ubuntu and runs fine.
- Exact change: add a small helper script in root package.json to run lint using `npx` or prefer `pnpm` invocation; document recommended dev flow for Windows developers (use WSL). Optionally add a GitHub Actions job to run `npm run lint` and report results.
- Rationale: reproducible linting regardless of shell.
- Tests: test running `npm run lint` in CI; add README note.
- Risk: Low
- PR size: Small

10. Add `ts-prune` + CI checks to detect dead exports

- Exact change: add `devDependency` ts-prune and add `npm run check:dead-exports` that runs ts-prune and fails CI if non-empty. Upload ts-prune output as artifact for review as needed.
- Rationale: catch dead exported symbols early.
- Tests: CI job to run ts-prune; fix any results then re-run.
- Risk: Low
- PR size: Small

11. Enforce `no-explicit-any` for src (allow tests)

- Exact change: update `.eslintrc` to enable `@typescript-eslint/no-explicit-any` with `"allowInFiles": ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts"]` or via overrides to allow `any` in test files only.
- Rationale: Gradually improve type coverage while not blocking tests.
- PR size: Small

12. Dead export removal & exported symbol uniqueness

- Action: Run `ts-prune` to enumerate unused exports. For each exported symbol:
  - If used elsewhere: do nothing.
  - If unused: remove or move to internal module and mark unexported; add tests if it was intended to be public API.
- Also ensure exported symbol names are unique in their public surface.
- PR size: Small → Medium based on results.

## Testing & Validation

- After PR1 (build fixes) passes, run `npm run build` and `npm run lint` in CI Linux runner.
- After PR2 (e2e fixture changes) run `npx playwright test e2e --workers=2` in CI and validate no cross-worker interference.
- After PRs for typing, re-run `npm run build` and `npm run test` and fix any regressions.

## Acceptance criteria (repeat)

- `npm run build` passes with 0 TypeScript errors.
- `npm run lint` passes (or only warnings remain flagged separately).
- `npx ts-prune` reports no confusing dead exports (or each is justified in a change/PR).
- `npx playwright test e2e --workers=2` passes in CI.

## Estimated timeline

- PR1: 1–2 days
- PR2: 2–4 days (schema creation change + thorough e2e validation)
- PR3: 3–5 days (typing work; can be split into smaller PRs)
- PR4/5: 1–3 days

## If you want me to proceed

Reply with:

- `approve` to begin implementing PR1 (Build & lint blockers), or
- `revise` with specific priorities changed (e.g., start with E2E fixture first), or
- `discuss` if you'd like any item split differently or additional justification.

---

If approved, I will create PR1 with the highest-priority, low-risk fixes and provide the PR link and CI run outputs for your review.
