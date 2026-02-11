# AGENTS.md — Contributor Guide for AI Coding Agents

This file provides default instructions for any automated coding agent working in this repository.
Its scope is the entire repo tree.

## 1) First things first
- Read `ARCHITECTURE_GUARDRAILS.md` before proposing or implementing changes.
- Read `AI_AGENT_INSTRUCTIONS.md` for security, tenant isolation, and testing conventions.
- Prefer existing patterns in `apps/web/src/**` over inventing new abstractions.

## 2) Non-negotiable engineering rules
- Preserve tenant isolation (`company_id` scoping) for all tenant-owned data access.
- Keep CSRF defenses in place for mutating server actions (`assertOrigin()` baseline).
- Do not add raw SQL (`$queryRaw`, `$executeRaw`, or unsafe variants).
- Do not expose secret env vars to client code (only `NEXT_PUBLIC_*` is client-safe).
- Avoid logging secrets or sensitive PII.

## 3) Cost and reliability guardrails
- Stay within the budgets/caps in `ARCHITECTURE_GUARDRAILS.md`.
- Favor cheaper solutions first; if a change increases recurring cost, document why.
- Keep dependencies lean and avoid unnecessary infrastructure additions.

## 4) Documentation maintenance requirements
- When code paths, scripts, or workflows change, update impacted `.md` files in the same PR.
- Keep markdown links valid and relative to the file location (for example, links inside `docs/` should generally use `../` when pointing to repo-root files).
- Validate documentation references after edits (broken local links are treated as defects).
- If a document describes commands, ensure commands match `package.json` scripts and currently tracked files.

## 5) Expected workflow
1. Identify impacted areas and security/cost implications.
2. Implement minimal, scoped changes.
3. Add or update tests for changed behavior.
4. Update related documentation and verify links/paths.
5. Run checks locally (at minimum: lint, typecheck, relevant tests).
6. Summarize impact clearly in PR notes.

## 6) Pull request expectations
Include these sections in PR descriptions:
1. Change summary
2. Cost impact
3. Security impact
4. Guardrails affected
5. Cheaper fallback
6. Test plan (exact commands)

## 7) If unsure
For changes involving auth, sessions, tenant scope, exports, uploads, rate limits, or audit logs:
- re-check `ARCHITECTURE_GUARDRAILS.md`,
- follow an existing implementation pattern,
- and validate with targeted tests.
