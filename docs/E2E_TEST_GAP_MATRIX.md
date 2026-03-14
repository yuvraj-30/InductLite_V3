# Playwright E2E Gap Matrix

Generated: 2026-03-12T23:33:21.903Z

- Method: static route-to-path evidence from Playwright spec files (`apps/web/e2e/*.spec.ts`).
- Optional dynamic mode (`--dynamic-links`) crawls rendered `<a href>` links from a running app.
- Limitation: still undercounts links created only after deep client interactions.

- Total app routes/pages scanned: 119
- Playwright spec files scanned: 20
- Distinct referenced paths found: 120
- Static referenced paths: 120
- Dynamic referenced paths: 0
- JS-flow mode enabled: yes
- Anchor-crawl discovered paths: 0
- JS-flow discovered paths: 0
- Covered routes/pages: 117
- Gaps: 2
- UI coverage: 72/73
- API coverage: 45/46
- Dynamic mode enabled: yes
- Dynamic mode notes:
  - dynamic crawl disabled: cannot reach app/test runtime at http://localhost:3000 (Error: runtime probe failed (404): Not Found)

## Prioritized E2E Gaps

| Priority | Route | Surface | Risk | Suggested Playwright Coverage |
| --- | --- | --- | --- | --- |
| P0 | `/api/ux-events` | api | API contract / integration behavior | APIRequestContext contract test |
| P2 | `/signout` | ui | Public site UX / SEO | Public navigation/load test |

## Full Matrix

| Route | Source File | Surface | Status | Evidence Spec(s) |
| --- | --- | --- | --- | --- |
| `/~offline` | `apps/web/src/app/~offline/page.tsx` | ui | Covered | `apps/web/e2e/link-integrity.spec.ts` |
| `/admin` | `apps/web/src/app/admin/page.tsx` | ui | Covered | `apps/web/e2e/admin-auth.spec.ts`, `apps/web/e2e/export.spec.ts`, `apps/web/e2e/link-integrity.spec.ts`, `apps/web/e2e/visual-regression.spec.ts` |
| `/admin/access-ops` | `apps/web/src/app/admin/access-ops/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/approvals` | `apps/web/src/app/admin/approvals/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/audit-analytics` | `apps/web/src/app/admin/audit-analytics/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/audit-log` | `apps/web/src/app/admin/audit-log/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/link-integrity.spec.ts` |
| `/admin/benchmarks` | `apps/web/src/app/admin/benchmarks/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/command-mode` | `apps/web/src/app/admin/command-mode/page.tsx` | ui | Covered | `apps/web/e2e/command-mode.spec.ts` |
| `/admin/communications` | `apps/web/src/app/admin/communications/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/contractors` | `apps/web/src/app/admin/contractors/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-management.spec.ts` |
| `/admin/contractors/:id` | `apps/web/src/app/admin/contractors/[id]/page.tsx` | ui | Covered | `apps/web/e2e/admin-management.spec.ts` |
| `/admin/contractors/new` | `apps/web/src/app/admin/contractors/new/page.tsx` | ui | Covered | `apps/web/e2e/admin-management.spec.ts` |
| `/admin/dashboard` | `apps/web/src/app/admin/dashboard/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/link-integrity.spec.ts` |
| `/admin/deliveries` | `apps/web/src/app/admin/deliveries/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/escalations` | `apps/web/src/app/admin/escalations/page.tsx` | ui | Covered | `apps/web/e2e/escalation-approval.spec.ts` |
| `/admin/evidence` | `apps/web/src/app/admin/evidence/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/exports` | `apps/web/src/app/admin/exports/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/export.spec.ts`, `apps/web/e2e/link-integrity.spec.ts` |
| `/admin/hazards` | `apps/web/src/app/admin/hazards/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-hazards.spec.ts` |
| `/admin/history` | `apps/web/src/app/admin/history/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/link-integrity.spec.ts` |
| `/admin/incidents` | `apps/web/src/app/admin/incidents/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/integrations/channels` | `apps/web/src/app/admin/integrations/channels/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/integrations/procore` | `apps/web/src/app/admin/integrations/procore/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/live-register` | `apps/web/src/app/admin/live-register/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-auth.spec.ts`, `apps/web/e2e/link-integrity.spec.ts`, `apps/web/e2e/performance-budget.spec.ts`, `apps/web/e2e/visual-regression.spec.ts` |
| `/admin/mobile` | `apps/web/src/app/admin/mobile/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/mobile/native` | `apps/web/src/app/admin/mobile/native/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/permits` | `apps/web/src/app/admin/permits/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/permits/templates` | `apps/web/src/app/admin/permits/templates/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/plan-configurator` | `apps/web/src/app/admin/plan-configurator/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/policy-simulator` | `apps/web/src/app/admin/policy-simulator/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/pre-registrations` | `apps/web/src/app/admin/pre-registrations/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/prequalification-exchange` | `apps/web/src/app/admin/prequalification-exchange/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/resources` | `apps/web/src/app/admin/resources/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/risk-passport` | `apps/web/src/app/admin/risk-passport/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/safety-copilot` | `apps/web/src/app/admin/safety-copilot/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/safety-forms` | `apps/web/src/app/admin/safety-forms/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/settings` | `apps/web/src/app/admin/settings/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-settings.spec.ts` |
| `/admin/sites` | `apps/web/src/app/admin/sites/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-emergency-contacts.spec.ts`, `apps/web/e2e/admin-hazards.spec.ts`, `apps/web/e2e/link-integrity.spec.ts`, `apps/web/e2e/performance-budget.spec.ts`, `apps/web/e2e/visual-regression.spec.ts` |
| `/admin/sites/:id` | `apps/web/src/app/admin/sites/[id]/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-emergency-contacts.spec.ts`, `apps/web/e2e/admin-hazards.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/sites/:id/access` | `apps/web/src/app/admin/sites/[id]/access/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/sites/:id/emergency` | `apps/web/src/app/admin/sites/[id]/emergency/page.tsx` | ui | Covered | `apps/web/e2e/admin-emergency-contacts.spec.ts` |
| `/admin/sites/:id/lms` | `apps/web/src/app/admin/sites/[id]/lms/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/sites/:id/webhooks` | `apps/web/src/app/admin/sites/[id]/webhooks/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/sites/new` | `apps/web/src/app/admin/sites/new/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-emergency-contacts.spec.ts`, `apps/web/e2e/admin-hazards.spec.ts` |
| `/admin/templates` | `apps/web/src/app/admin/templates/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/link-integrity.spec.ts` |
| `/admin/templates/:id` | `apps/web/src/app/admin/templates/[id]/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/templates/archived` | `apps/web/src/app/admin/templates/archived/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/templates/new` | `apps/web/src/app/admin/templates/new/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/trust-graph` | `apps/web/src/app/admin/trust-graph/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/users` | `apps/web/src/app/admin/users/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-management.spec.ts` |
| `/admin/users/:id` | `apps/web/src/app/admin/users/[id]/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/users/new` | `apps/web/src/app/admin/users/new/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/admin/webhooks` | `apps/web/src/app/admin/webhooks/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/access-connectors/:provider/test` | `apps/web/src/app/api/access-connectors/[provider]/test/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/auth/directory-sync` | `apps/web/src/app/api/auth/directory-sync/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/auth/logout` | `apps/web/src/app/api/auth/logout/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/auth/sso/callback` | `apps/web/src/app/api/auth/sso/callback/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/auth/sso/start` | `apps/web/src/app/api/auth/sso/start/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/broadcasts/ack` | `apps/web/src/app/api/broadcasts/ack/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/client-errors` | `apps/web/src/app/api/client-errors/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/cron/digest` | `apps/web/src/app/api/cron/digest/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/cron/export-scheduler` | `apps/web/src/app/api/cron/export-scheduler/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/cron/maintenance` | `apps/web/src/app/api/cron/maintenance/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/csp-report` | `apps/web/src/app/api/csp-report/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/evidence/verify` | `apps/web/src/app/api/evidence/verify/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/exports/:id/download` | `apps/web/src/app/api/exports/[id]/download/route.ts` | api | Covered | `apps/web/e2e/export.spec.ts` |
| `/api/identity/ocr/verify` | `apps/web/src/app/api/identity/ocr/verify/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/integrations/channels/actions` | `apps/web/src/app/api/integrations/channels/actions/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/integrations/procore/workers` | `apps/web/src/app/api/integrations/procore/workers/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/live` | `apps/web/src/app/api/live/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/mobile/device-bootstrap` | `apps/web/src/app/api/mobile/device-bootstrap/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/mobile/enrollment-token` | `apps/web/src/app/api/mobile/enrollment-token/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/mobile/geofence-events` | `apps/web/src/app/api/mobile/geofence-events/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/mobile/geofence-events/replay` | `apps/web/src/app/api/mobile/geofence-events/replay/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/mobile/heartbeat` | `apps/web/src/app/api/mobile/heartbeat/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/policy-simulator/runs/:runId/export` | `apps/web/src/app/api/policy-simulator/runs/[runId]/export/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/push/subscriptions` | `apps/web/src/app/api/push/subscriptions/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/ready` | `apps/web/src/app/api/ready/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/rollcall/:eventId/evidence` | `apps/web/src/app/api/rollcall/[eventId]/evidence/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/rollcall/:eventId/export` | `apps/web/src/app/api/rollcall/[eventId]/export/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/sign-ins/:id/identity-evidence` | `apps/web/src/app/api/sign-ins/[id]/identity-evidence/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/storage/contractor-documents/:id/download` | `apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/storage/contractor-documents/commit` | `apps/web/src/app/api/storage/contractor-documents/commit/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/storage/contractor-documents/presign` | `apps/web/src/app/api/storage/contractor-documents/presign/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/storage/sign/:id` | `apps/web/src/app/api/storage/sign/[id]/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/test/clear-rate-limit` | `apps/web/src/app/api/test/clear-rate-limit/route.ts` | api | Covered | `apps/web/e2e/escalation-approval.spec.ts`, `apps/web/e2e/logic-flow.spec.ts`, `apps/web/e2e/public-signin.spec.ts`, `apps/web/e2e/visual-regression.spec.ts` |
| `/api/test/create-session` | `apps/web/src/app/api/test/create-session/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/test/create-user` | `apps/web/src/app/api/test/create-user/route.ts` | api | Covered | `apps/web/e2e/admin-management.spec.ts`, `apps/web/e2e/security-gate.spec.ts` |
| `/api/test/lookup` | `apps/web/src/app/api/test/lookup/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/test/manage-contractor` | `apps/web/src/app/api/test/manage-contractor/route.ts` | api | Covered | `apps/web/e2e/admin-management.spec.ts` |
| `/api/test/manage-user` | `apps/web/src/app/api/test/manage-user/route.ts` | api | Covered | `apps/web/e2e/admin-management.spec.ts` |
| `/api/test/process-next-export` | `apps/web/src/app/api/test/process-next-export/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/test/resolve-escalation` | `apps/web/src/app/api/test/resolve-escalation/route.ts` | api | Covered | `apps/web/e2e/escalation-approval.spec.ts` |
| `/api/test/runtime` | `apps/web/src/app/api/test/runtime/route.ts` | api | Covered | `apps/web/e2e/security-gate.spec.ts` |
| `/api/test/seed-public-site` | `apps/web/src/app/api/test/seed-public-site/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/test/set-user-lock` | `apps/web/src/app/api/test/set-user-lock/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/ux-events` | `apps/web/src/app/api/ux-events/route.ts` | api | Gap | - |
| `/api/v1/partner/sign-ins` | `apps/web/src/app/api/v1/partner/sign-ins/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/api/v1/partner/sites` | `apps/web/src/app/api/v1/partner/sites/route.ts` | api | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/change-password` | `apps/web/src/app/(auth)/change-password/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/compare` | `apps/web/src/app/compare/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/contractor` | `apps/web/src/app/(auth)/contractor/page.tsx` | ui | Covered | `apps/web/e2e/link-integrity.spec.ts` |
| `/contractor/portal` | `apps/web/src/app/contractor/portal/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/demo` | `apps/web/src/app/demo/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/favicon.ico` | `apps/web/src/app/favicon.ico/route.ts` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/health` | `apps/web/src/app/health/route.ts` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/login` | `apps/web/src/app/(auth)/login/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/admin-auth.spec.ts`, `apps/web/e2e/link-integrity.spec.ts`, `apps/web/e2e/performance-budget.spec.ts`, `apps/web/e2e/visual-regression.spec.ts` |
| `/logout` | `apps/web/src/app/(auth)/logout/route.ts` | ui | Covered | `apps/web/e2e/link-integrity.spec.ts` |
| `/pricing` | `apps/web/src/app/pricing/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/privacy` | `apps/web/src/app/privacy/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/register` | `apps/web/src/app/(auth)/register/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/robots.txt` | `apps/web/src/app/robots.txt/route.ts` | ui | Covered | `apps/web/e2e/seo.spec.ts` |
| `/s/:slug` | `apps/web/src/app/s/[slug]/page.tsx` | ui | Covered | `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/escalation-approval.spec.ts`, `apps/web/e2e/kiosk-mode.spec.ts`, `apps/web/e2e/link-integrity.spec.ts`, `apps/web/e2e/logic-flow.spec.ts`, `apps/web/e2e/performance-budget.spec.ts`, `apps/web/e2e/public-signin.spec.ts`, `apps/web/e2e/visual-regression.spec.ts` |
| `/s/:slug/kiosk` | `apps/web/src/app/s/[slug]/kiosk/page.tsx` | ui | Covered | `apps/web/e2e/kiosk-mode.spec.ts`, `apps/web/e2e/link-integrity.spec.ts`, `apps/web/e2e/visual-regression.spec.ts` |
| `/sign-out` | `apps/web/src/app/sign-out/page.tsx` | ui | Covered | `apps/web/e2e/escalation-approval.spec.ts`, `apps/web/e2e/link-integrity.spec.ts`, `apps/web/e2e/public-signin.spec.ts` |
| `/signout` | `apps/web/src/app/signout/page.tsx` | ui | Gap | - |
| `/sitemap.xml` | `apps/web/src/app/sitemap.xml/route.ts` | ui | Covered | `apps/web/e2e/seo.spec.ts` |
| `/terms` | `apps/web/src/app/terms/page.tsx` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |
| `/unauthorized` | `apps/web/src/app/unauthorized/page.tsx` | ui | Covered | `apps/web/e2e/link-integrity.spec.ts` |
| `/verify` | `apps/web/src/app/(auth)/verify/route.ts` | ui | Covered | `apps/web/e2e/gap-matrix-coverage.spec.ts` |

