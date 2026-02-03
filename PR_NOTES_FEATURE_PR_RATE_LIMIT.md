PR: feature/pr-rate-limit — Security hardening, tenant scoping, and rate-limit improvements

Summary of changes

- Added `scopedDb(companyId)` primitive and `publicDb` for explicit tenant-scoped and public DB access. 🔐
- Enforced repository import restrictions via ESLint to prevent raw `prisma` imports in `src/lib/repository/**` (allowlisted a few audited files that need raw transactions). ⚠️
- Converted repositories to use `scopedDb` or `publicDb` where appropriate (currently converted):
  - `user.repository` ✅
  - `contractor.repository` ✅
  - `site.repository` ✅
  - `signin.repository` ✅
  - `template.repository` ✅
  - `question.repository` ✅ (also made bulk ops transactional)
  - `public-signin.repository` ✅ (public reads via `publicDb`, transactional writes preserved)
  - `audit.repository` ✅ (now uses `scopedDb`)
- Rewrote rate-limit module to accept correlated `requestId` and safer client key derivation; added telemetry hooks and tests. 🛡️
- Added unit and integration tests to validate behavior (full suite passes locally: 279 tests passing, 1 skipped).

Security-focused notes / requests

- Please prioritize a security review focusing on:
  1. Proper tenant scoping across repositories (look for any lingering `prisma` imports in `src/lib/repository/**`).
  2. Atomic operations and TOCTOU mitigations (notably `updateMany` and `prisma.$transaction` usage). Verify `publishTemplate`, `createNewVersion`, `signOutWithToken`, and question bulk ops.
  3. Rate-limiter behavior: verify telemetry and tokenization logic. Check that clientKey derivation cannot be trivially spoofed.
  4. Ensure unit/integration tests cover concurrency and token replay scenarios (see `tests/integration/token-replay.test.ts`).

How to review locally

- Run the test suite: cd apps/web && npm run test
- Run integration token replay tests (requires Postgres + test DB): npm run test:integration in `apps/web` (CI runs these).

Request

- Requesting a **security-focused review** and at least one code owner with security expertise to review PR # (feature/pr-rate-limit) for tenant isolation and TOCTOU fixes.

Contact

- If you want me to split this PR into smaller, per-repository PRs for easier review, I can do that next.
