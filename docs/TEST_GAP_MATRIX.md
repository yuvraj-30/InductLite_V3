# Test Gap Matrix

Generated: 2026-03-08T07:47:27.271Z

- Total source files: 374
- Covered by direct tests: 97
- Gaps: 277

## Prioritized Missing-Tests Backlog

| Priority | Source File | Risk | Suggested Test Type |
| --- | --- | --- | --- |
| P0 | `apps/web/src/app/(auth)/contractor/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/access-ops/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/approvals/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/communications/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/contractors/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/deliveries/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/evidence/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/hazards/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/history/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/incidents/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/integrations/channels/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/integrations/procore/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/live-register/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/mobile/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/permits/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/plan-configurator/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/policy-simulator/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/sites/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/admin/users/actions.ts` | Mutating server action | Server action unit test (redirect/error paths) |
| P0 | `apps/web/src/app/api/auth/logout/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/broadcasts/ack/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/cron/digest/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/cron/export-scheduler/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/cron/maintenance/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/csp-report/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/integrations/channels/actions/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/integrations/procore/workers/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/live/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/push/subscriptions/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/rollcall/[eventId]/evidence/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/rollcall/[eventId]/export/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/sign-ins/[id]/identity-evidence/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/storage/contractor-documents/commit/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/storage/contractor-documents/presign/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/storage/sign/[id]/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/clear-rate-limit/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/create-session/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/create-user/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/lookup/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/manage-contractor/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/manage-user/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/process-next-export/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/resolve-escalation/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/runtime/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/seed-public-site/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/app/api/test/set-user-lock/route.ts` | Public/API contract | Route handler unit/integration test |
| P0 | `apps/web/src/lib/auth/contractor-session.ts` | Auth/security flow | Unit test |
| P0 | `apps/web/src/lib/auth/index.ts` | Auth/security flow | Unit test |
| P0 | `apps/web/src/lib/auth/session-config.ts` | Auth/security flow | Unit test |
| P0 | `apps/web/src/lib/auth/session.ts` | Auth/security flow | Unit test |
| P0 | `apps/web/src/lib/db/index.ts` | Data layer infrastructure | Unit test |
| P0 | `apps/web/src/lib/db/prisma.ts` | Data layer infrastructure | Unit test |
| P0 | `apps/web/src/lib/db/public-db.ts` | Data layer infrastructure | Unit test |
| P0 | `apps/web/src/lib/db/scoped.ts` | Data layer infrastructure | Unit test |
| P0 | `apps/web/src/lib/guardrails.ts` | Application logic | Unit test |
| P0 | `apps/web/src/lib/repository/audit.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/demo-booking.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/email.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/emergency.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/evidence.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/export.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/hardware-trace.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/hazard.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/identity-ocr.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/incident.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/index.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/induction-quiz-attempt.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/magic-link.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/mobile-ops.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/permit.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/plan-change.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/plan-entitlement.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/policy-simulator.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/pre-registration.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/risk-passport.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/signin-escalation.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/site-manager.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/sitemap.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P0 | `apps/web/src/lib/repository/visitor-approval.repository.ts` | Tenant-scoped data access | Repository unit/integration test |
| P1 | `apps/web/src/app/(auth)/change-password/change-password-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/change-password/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/contractor/magic-link-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/contractor/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/layout.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/login/login-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/login/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/register/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/register/register-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/(auth)/verify/route.ts` | Application logic | Unit test |
| P1 | `apps/web/src/app/~offline/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/access-ops/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/admin-command-palette.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/approvals/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/audit-analytics/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/audit-log/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/benchmarks/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/command-mode/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/command-mode/roll-call.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/communications/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/components/OnboardingChecklist.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/contractors/[id]/edit-contractor-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/contractors/[id]/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/contractors/contractor-action-buttons.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/contractors/new/create-contractor-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/contractors/new/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/contractors/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/dashboard/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/deliveries/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/escalations/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/evidence/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/exports/ExportQueuePanel.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/exports/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/hazards/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/history/history-filters.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/history/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/history/pagination.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/incidents/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/integrations/channels/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/integrations/procore/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/layout.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/live-register/auto-refresh.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/live-register/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/live-register/sign-out-button.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/live-register/SiteFilterSelect.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/mobile/native/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/mobile/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/nav-link.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/permits/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/permits/templates/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/plan-configurator/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/policy-simulator/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/pre-registrations/bulk-invite-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/pre-registrations/create-invite-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/pre-registrations/deactivate-invite-button.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/pre-registrations/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/prequalification-exchange/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/resources/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/risk-passport/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/safety-copilot/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/safety-forms/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/settings/billing-sync-panel.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/settings/compliance-settings-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/settings/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/settings/sso-settings-panel.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/sites/[id]/access/page.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/sites/[id]/access/site-access-settings-form.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/sites/[id]/CopyLinkButton.tsx` | Application logic | Unit test |
| P1 | `apps/web/src/app/admin/sites/[id]/edit-site-form.tsx` | Application logic | Unit test |

## Full Matrix

| Source File | Status | Priority | Direct Test(s) |
| --- | --- | --- | --- |
| `apps/mobile/src/config/runtime.ts` | Gap | P2 | - |
| `apps/mobile/src/services/deviceRuntime.ts` | Gap | P2 | - |
| `apps/mobile/src/services/enrollmentToken.ts` | Gap | P2 | - |
| `apps/mobile/src/services/eventQueue.ts` | Gap | P2 | - |
| `apps/mobile/src/services/geofenceRuntime.ts` | Gap | P2 | - |
| `apps/mobile/src/services/mobileApi.ts` | Gap | P2 | - |
| `apps/mobile/src/storage/mobileSettings.ts` | Gap | P2 | - |
| `apps/mobile/src/tasks/geofenceTask.ts` | Gap | P2 | - |
| `apps/mobile/src/utils/id.ts` | Gap | P2 | - |
| `apps/web/src/app/(auth)/actions.ts` | Covered | P0 | `apps/web/src/app/(auth)/actions.test.ts` |
| `apps/web/src/app/(auth)/change-password/change-password-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/change-password/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/contractor/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/(auth)/contractor/magic-link-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/contractor/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/layout.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/login/login-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/login/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/logout/route.ts` | Covered | P1 | `apps/web/src/app/(auth)/logout/route.test.ts` |
| `apps/web/src/app/(auth)/register/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/register/register-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/(auth)/verify/route.ts` | Gap | P1 | - |
| `apps/web/src/app/admin/access-ops/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/access-ops/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/admin-command-palette.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/approvals/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/approvals/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/audit-analytics/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/audit-log/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/benchmarks/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/command-mode/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/command-mode/roll-call.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/communications/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/communications/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/components/OnboardingChecklist.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/contractors/[id]/edit-contractor-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/contractors/[id]/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/contractors/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/contractors/contractor-action-buttons.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/contractors/new/create-contractor-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/contractors/new/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/contractors/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/dashboard/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/deliveries/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/deliveries/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/escalations/actions.ts` | Covered | P0 | `apps/web/src/app/admin/escalations/actions.test.ts` |
| `apps/web/src/app/admin/escalations/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/evidence/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/evidence/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/exports/ExportQueuePanel.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/exports/actions.ts` | Covered | P0 | `apps/web/src/app/admin/exports/actions.test.ts` |
| `apps/web/src/app/admin/exports/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/hazards/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/hazards/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/history/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/history/history-filters.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/history/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/history/pagination.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/incidents/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/incidents/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/integrations/channels/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/integrations/channels/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/integrations/procore/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/integrations/procore/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/layout.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/live-register/SiteFilterSelect.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/live-register/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/live-register/auto-refresh.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/live-register/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/live-register/sign-out-button.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/mobile/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/mobile/native/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/mobile/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/nav-link.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/permits/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/permits/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/permits/templates/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/plan-configurator/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/plan-configurator/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/policy-simulator/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/policy-simulator/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/pre-registrations/actions.ts` | Covered | P0 | `apps/web/src/app/admin/pre-registrations/actions.test.ts` |
| `apps/web/src/app/admin/pre-registrations/bulk-invite-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/pre-registrations/create-invite-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/pre-registrations/deactivate-invite-button.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/pre-registrations/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/prequalification-exchange/actions.ts` | Covered | P0 | `apps/web/src/app/admin/prequalification-exchange/actions.test.ts` |
| `apps/web/src/app/admin/prequalification-exchange/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/resources/actions.ts` | Covered | P0 | `apps/web/src/app/admin/resources/actions.test.ts` |
| `apps/web/src/app/admin/resources/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/risk-passport/actions.ts` | Covered | P0 | `apps/web/src/app/admin/risk-passport/actions.test.ts` |
| `apps/web/src/app/admin/risk-passport/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/safety-copilot/actions.ts` | Covered | P0 | `apps/web/src/app/admin/safety-copilot/actions.test.ts` |
| `apps/web/src/app/admin/safety-copilot/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/safety-forms/actions.ts` | Covered | P0 | `apps/web/src/app/admin/safety-forms/actions.test.ts` |
| `apps/web/src/app/admin/safety-forms/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/settings/actions.ts` | Covered | P0 | `apps/web/src/app/admin/settings/actions.test.ts` |
| `apps/web/src/app/admin/settings/billing-sync-panel.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/settings/compliance-settings-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/settings/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/settings/sso-settings-panel.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/CopyLinkButton.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/QRCodeButton.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/access/actions.ts` | Covered | P0 | `apps/web/src/app/admin/sites/[id]/access/actions.test.ts` |
| `apps/web/src/app/admin/sites/[id]/access/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/access/site-access-settings-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/edit-site-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/emergency/actions.ts` | Covered | P0 | `apps/web/src/app/admin/sites/[id]/emergency/actions.test.ts` |
| `apps/web/src/app/admin/sites/[id]/emergency/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/lms/actions.ts` | Covered | P0 | `apps/web/src/app/admin/sites/[id]/lms/actions.test.ts` |
| `apps/web/src/app/admin/sites/[id]/lms/lms-settings-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/lms/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/webhooks/actions.ts` | Covered | P0 | `apps/web/src/app/admin/sites/[id]/webhooks/actions.test.ts` |
| `apps/web/src/app/admin/sites/[id]/webhooks/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/[id]/webhooks/webhook-settings-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/sites/new/create-site-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/new/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/sites/site-buttons.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/ConfirmActionButton.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/SubmitButton.client.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/[id]/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/[id]/question-builder.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/[id]/template-header.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/actions.ts` | Covered | P0 | `apps/web/src/app/admin/templates/actions.test.ts` |
| `apps/web/src/app/admin/templates/archived/delete-button.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/archived/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/archived/unarchive-button.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/new/new-template-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/new/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/template-action-forms.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/templates/template-buttons.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/trust-graph/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/users/[id]/edit-user-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/users/[id]/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/users/actions.ts` | Gap | P0 | - |
| `apps/web/src/app/admin/users/new/create-user-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/users/new/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/users/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/users/user-action-buttons.tsx` | Gap | P1 | - |
| `apps/web/src/app/admin/webhooks/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/api/access-connectors/[provider]/test/route.ts` | Covered | P0 | `apps/web/src/app/api/access-connectors/[provider]/test/route.test.ts` |
| `apps/web/src/app/api/auth/directory-sync/route.ts` | Covered | P0 | `apps/web/src/app/api/auth/directory-sync/route.test.ts` |
| `apps/web/src/app/api/auth/logout/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/auth/sso/callback/route.ts` | Covered | P0 | `apps/web/src/app/api/auth/sso/callback/route.test.ts` |
| `apps/web/src/app/api/auth/sso/start/route.ts` | Covered | P0 | `apps/web/src/app/api/auth/sso/start/route.test.ts` |
| `apps/web/src/app/api/broadcasts/ack/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/client-errors/route.ts` | Covered | P0 | `apps/web/src/app/api/client-errors/route.test.ts` |
| `apps/web/src/app/api/cron/digest/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/cron/export-scheduler/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/cron/maintenance/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/csp-report/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/evidence/verify/route.ts` | Covered | P0 | `apps/web/src/app/api/evidence/verify/route.test.ts` |
| `apps/web/src/app/api/exports/[id]/download/route.ts` | Covered | P0 | `apps/web/src/app/api/exports/[id]/download/route.test.ts` |
| `apps/web/src/app/api/identity/ocr/verify/route.ts` | Covered | P0 | `apps/web/src/app/api/identity/ocr/verify/route.test.ts` |
| `apps/web/src/app/api/integrations/channels/actions/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/integrations/procore/workers/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/live/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/mobile/device-bootstrap/route.ts` | Covered | P0 | `apps/web/src/app/api/mobile/device-bootstrap/route.test.ts` |
| `apps/web/src/app/api/mobile/enrollment-token/route.ts` | Covered | P0 | `apps/web/src/app/api/mobile/enrollment-token/route.test.ts` |
| `apps/web/src/app/api/mobile/geofence-events/replay/route.ts` | Covered | P0 | `apps/web/src/app/api/mobile/geofence-events/replay/route.test.ts` |
| `apps/web/src/app/api/mobile/geofence-events/route.ts` | Covered | P0 | `apps/web/src/app/api/mobile/geofence-events/route.test.ts` |
| `apps/web/src/app/api/mobile/heartbeat/route.ts` | Covered | P0 | `apps/web/src/app/api/mobile/heartbeat/route.test.ts` |
| `apps/web/src/app/api/policy-simulator/runs/[runId]/export/route.ts` | Covered | P0 | `apps/web/src/app/api/policy-simulator/runs/[runId]/export/route.test.ts` |
| `apps/web/src/app/api/push/subscriptions/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/ready/route.ts` | Covered | P0 | `apps/web/src/app/api/ready/route.test.ts` |
| `apps/web/src/app/api/rollcall/[eventId]/evidence/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/rollcall/[eventId]/export/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/sign-ins/[id]/identity-evidence/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/storage/contractor-documents/[id]/download/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/storage/contractor-documents/commit/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/storage/contractor-documents/presign/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/storage/sign/[id]/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/_guard.ts` | Covered | P0 | `apps/web/src/app/api/test/__tests__/_guard.test.ts` |
| `apps/web/src/app/api/test/clear-rate-limit/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/create-session/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/create-user/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/lookup/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/manage-contractor/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/manage-user/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/process-next-export/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/resolve-escalation/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/runtime/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/seed-public-site/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/test/set-user-lock/route.ts` | Gap | P0 | - |
| `apps/web/src/app/api/v1/partner/sign-ins/route.ts` | Covered | P0 | `apps/web/src/app/api/v1/partner/sign-ins/route.test.ts` |
| `apps/web/src/app/api/v1/partner/sites/route.ts` | Covered | P0 | `apps/web/src/app/api/v1/partner/sites/route.test.ts` |
| `apps/web/src/app/compare/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/contractor/portal/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/demo/actions.ts` | Covered | P0 | `apps/web/src/app/demo/actions.test.ts` |
| `apps/web/src/app/demo/demo-booking-form.tsx` | Gap | P1 | - |
| `apps/web/src/app/demo/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/error.tsx` | Gap | P1 | - |
| `apps/web/src/app/favicon.ico/route.ts` | Gap | P1 | - |
| `apps/web/src/app/global-error.tsx` | Gap | P1 | - |
| `apps/web/src/app/health/route.ts` | Gap | P1 | - |
| `apps/web/src/app/layout.tsx` | Gap | P1 | - |
| `apps/web/src/app/not-found.tsx` | Gap | P1 | - |
| `apps/web/src/app/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/pricing/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/privacy/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/robots.txt/route.ts` | Gap | P1 | - |
| `apps/web/src/app/s/[slug]/actions.ts` | Covered | P0 | `apps/web/src/app/s/[slug]/actions.test.ts` |
| `apps/web/src/app/s/[slug]/components/InductionQuestions.tsx` | Gap | P1 | - |
| `apps/web/src/app/s/[slug]/components/SignInFlow.tsx` | Gap | P1 | - |
| `apps/web/src/app/s/[slug]/components/SuccessScreen.tsx` | Gap | P1 | - |
| `apps/web/src/app/s/[slug]/kiosk/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/s/[slug]/not-found.tsx` | Gap | P1 | - |
| `apps/web/src/app/s/[slug]/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/sign-out/components/SignOutForm.tsx` | Gap | P1 | - |
| `apps/web/src/app/sign-out/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/sitemap.xml/route.ts` | Gap | P1 | - |
| `apps/web/src/app/terms/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/unauthorized/page.tsx` | Gap | P1 | - |
| `apps/web/src/app/~offline/page.tsx` | Gap | P1 | - |
| `apps/web/src/components/ui/alert.tsx` | Gap | P2 | - |
| `apps/web/src/components/ui/public-shell.tsx` | Gap | P2 | - |
| `apps/web/src/components/ui/theme-preference.ts` | Gap | P2 | - |
| `apps/web/src/components/ui/theme-runtime.tsx` | Gap | P2 | - |
| `apps/web/src/components/ui/theme-switcher.tsx` | Gap | P2 | - |
| `apps/web/src/instrumentation.ts` | Gap | P2 | - |
| `apps/web/src/lib/access-connectors/core.ts` | Covered | P1 | `apps/web/src/lib/access-connectors/__tests__/core.unit.test.ts` |
| `apps/web/src/lib/access-connectors/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/base.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/brivo.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/gallagher.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/generic.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/genetec.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/hid-origo.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-connectors/providers/lenels2.ts` | Gap | P1 | - |
| `apps/web/src/lib/access-control/config.ts` | Covered | P1 | `apps/web/src/lib/access-control/__tests__/config.unit.test.ts` |
| `apps/web/src/lib/api/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/api/response.ts` | Gap | P1 | - |
| `apps/web/src/lib/auth/contractor-session.ts` | Gap | P0 | - |
| `apps/web/src/lib/auth/csrf.ts` | Covered | P0 | `apps/web/src/lib/auth/__tests__/csrf.test.ts` |
| `apps/web/src/lib/auth/guards.ts` | Covered | P0 | `apps/web/src/lib/auth/__tests__/guards.test.ts` |
| `apps/web/src/lib/auth/index.ts` | Gap | P0 | - |
| `apps/web/src/lib/auth/magic-link.ts` | Covered | P0 | `apps/web/src/lib/auth/__tests__/magic-link.test.ts` |
| `apps/web/src/lib/auth/mfa.ts` | Covered | P0 | `apps/web/src/lib/auth/__tests__/mfa.integration.test.ts` |
| `apps/web/src/lib/auth/password.ts` | Covered | P0 | `apps/web/src/lib/auth/__tests__/password.test.ts` |
| `apps/web/src/lib/auth/session-config.ts` | Gap | P0 | - |
| `apps/web/src/lib/auth/session.ts` | Gap | P0 | - |
| `apps/web/src/lib/auth/sign-out-token.ts` | Covered | P0 | `apps/web/src/lib/auth/__tests__/sign-out-token.test.ts` |
| `apps/web/src/lib/client-error-reporting.ts` | Gap | P1 | - |
| `apps/web/src/lib/cost/compute-counters.ts` | Covered | P1 | `apps/web/src/lib/cost/__tests__/compute-counters.test.ts` |
| `apps/web/src/lib/cron.ts` | Covered | P1 | `apps/web/src/lib/cron.test.ts` |
| `apps/web/src/lib/db/index.ts` | Gap | P0 | - |
| `apps/web/src/lib/db/prisma.ts` | Gap | P0 | - |
| `apps/web/src/lib/db/public-db.ts` | Gap | P0 | - |
| `apps/web/src/lib/db/readiness.ts` | Covered | P0 | `apps/web/src/lib/db/readiness.test.ts` |
| `apps/web/src/lib/db/scoped-db.ts` | Covered | P0 | `apps/web/src/lib/db/__tests__/scoped-db.unit.test.ts` |
| `apps/web/src/lib/db/scoped.ts` | Gap | P0 | - |
| `apps/web/src/lib/differentiation/benchmark.ts` | Gap | P1 | - |
| `apps/web/src/lib/differentiation/safety-copilot.ts` | Gap | P1 | - |
| `apps/web/src/lib/differentiation/trust-graph.ts` | Gap | P1 | - |
| `apps/web/src/lib/email/resend.ts` | Gap | P1 | - |
| `apps/web/src/lib/email/worker.ts` | Covered | P1 | `apps/web/src/lib/email/__tests__/worker.unit.test.ts` |
| `apps/web/src/lib/env-validation.ts` | Covered | P1 | `apps/web/src/lib/__tests__/env-validation.test.ts` |
| `apps/web/src/lib/export/formatters.ts` | Covered | P1 | `apps/web/src/lib/export/__tests__/formatters.unit.test.ts` |
| `apps/web/src/lib/export/runner.ts` | Gap | P1 | - |
| `apps/web/src/lib/export/scheduler.ts` | Gap | P1 | - |
| `apps/web/src/lib/export/worker.ts` | Covered | P1 | `apps/web/src/lib/export/__tests__/worker.unit.test.ts` |
| `apps/web/src/lib/feature-flags.ts` | Gap | P1 | - |
| `apps/web/src/lib/guardrails.ts` | Gap | P0 | - |
| `apps/web/src/lib/hardware/adapter.ts` | Covered | P1 | `apps/web/src/lib/hardware/__tests__/adapter.unit.test.ts` |
| `apps/web/src/lib/health.ts` | Covered | P1 | `apps/web/src/lib/health.test.ts` |
| `apps/web/src/lib/identity-ocr/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/identity-ocr/providers/base.ts` | Gap | P1 | - |
| `apps/web/src/lib/identity-ocr/providers/index.ts` | Covered | P1 | `apps/web/src/lib/identity-ocr/providers/__tests__/index.unit.test.ts` |
| `apps/web/src/lib/identity-ocr/providers/mock.ts` | Gap | P1 | - |
| `apps/web/src/lib/identity-ocr/providers/textract.ts` | Covered | P1 | `apps/web/src/lib/identity-ocr/providers/__tests__/textract.unit.test.ts` |
| `apps/web/src/lib/identity-ocr/service.ts` | Gap | P1 | - |
| `apps/web/src/lib/identity/config.ts` | Gap | P1 | - |
| `apps/web/src/lib/identity/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/identity/oidc.ts` | Gap | P1 | - |
| `apps/web/src/lib/identity/user-sync.ts` | Gap | P1 | - |
| `apps/web/src/lib/integrations/procore/config.ts` | Covered | P1 | `apps/web/src/lib/integrations/procore/__tests__/config.unit.test.ts` |
| `apps/web/src/lib/integrations/procore/sync.ts` | Gap | P1 | - |
| `apps/web/src/lib/legal/consent-versioning.ts` | Gap | P1 | - |
| `apps/web/src/lib/lms/config.ts` | Covered | P1 | `apps/web/src/lib/lms/__tests__/config.unit.test.ts` |
| `apps/web/src/lib/lms/payload.ts` | Covered | P1 | `apps/web/src/lib/lms/__tests__/payload.unit.test.ts` |
| `apps/web/src/lib/logger/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/logger/pino.ts` | Gap | P1 | - |
| `apps/web/src/lib/logic/evaluator.ts` | Covered | P1 | `apps/web/src/lib/logic/__tests__/evaluator.test.ts` |
| `apps/web/src/lib/maintenance/retention.ts` | Covered | P1 | `apps/web/src/lib/maintenance/retention.test.ts` |
| `apps/web/src/lib/maintenance/scheduler.ts` | Gap | P1 | - |
| `apps/web/src/lib/mobile/device-runtime.ts` | Gap | P1 | - |
| `apps/web/src/lib/mobile/enrollment-token.ts` | Covered | P1 | `apps/web/src/lib/mobile/__tests__/enrollment-token.unit.test.ts` |
| `apps/web/src/lib/observability/otel.ts` | Gap | P1 | - |
| `apps/web/src/lib/offline/signin-queue.ts` | Covered | P1 | `apps/web/src/lib/offline/signin-queue.test.ts` |
| `apps/web/src/lib/offline/signin-sync.ts` | Gap | P1 | - |
| `apps/web/src/lib/operations/market-ops.ts` | Gap | P1 | - |
| `apps/web/src/lib/partner-api/auth.ts` | Covered | P1 | `apps/web/src/lib/partner-api/auth.test.ts` |
| `apps/web/src/lib/plans/entitlements.ts` | Covered | P1 | `apps/web/src/lib/plans/__tests__/entitlements.unit.test.ts` |
| `apps/web/src/lib/plans/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/plans/invoice-preview.ts` | Covered | P1 | `apps/web/src/lib/plans/__tests__/invoice-preview.unit.test.ts` |
| `apps/web/src/lib/plans/invoice-sync.ts` | Covered | P1 | `apps/web/src/lib/plans/__tests__/invoice-sync.unit.test.ts` |
| `apps/web/src/lib/plans/pricing.ts` | Covered | P1 | `apps/web/src/lib/plans/__tests__/pricing.unit.test.ts` |
| `apps/web/src/lib/quiz/scoring.ts` | Covered | P1 | `apps/web/src/lib/quiz/__tests__/scoring.unit.test.ts` |
| `apps/web/src/lib/rate-limit/client.ts` | Gap | P1 | - |
| `apps/web/src/lib/rate-limit/clientKey.ts` | Covered | P1 | `apps/web/src/lib/rate-limit/__tests__/clientKey.test.ts` |
| `apps/web/src/lib/rate-limit/index.ts` | Covered | P1 | `apps/web/src/lib/rate-limit/__tests__/index.test.ts` |
| `apps/web/src/lib/rate-limit/telemetry.ts` | Covered | P1 | `apps/web/src/lib/rate-limit/__tests__/telemetry.test.ts` |
| `apps/web/src/lib/repository/access-connector.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/access-connector.repository.unit.test.ts` |
| `apps/web/src/lib/repository/audit-analytics.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/audit-analytics.repository.unit.test.ts` |
| `apps/web/src/lib/repository/audit.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/auth.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/auth.repository.unit.test.ts` |
| `apps/web/src/lib/repository/base.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/base.test.ts` |
| `apps/web/src/lib/repository/communication.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/communication.repository.unit.test.ts` |
| `apps/web/src/lib/repository/company.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/company.repository.unit.test.ts` |
| `apps/web/src/lib/repository/contractor.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/contractor.repository.unit.test.ts` |
| `apps/web/src/lib/repository/dashboard.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/dashboard.repository.unit.test.ts` |
| `apps/web/src/lib/repository/delivery.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/delivery.repository.unit.test.ts` |
| `apps/web/src/lib/repository/demo-booking.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/email.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/emergency.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/evidence.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/export.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/hardware-trace.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/hazard.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/identity-ocr.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/incident.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/index.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/induction-quiz-attempt.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/magic-link.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/mobile-ops.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/permit.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/plan-change.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/plan-entitlement.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/policy-simulator.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/pre-registration.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/public-signin.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/public-signin.repository.unit.test.ts` |
| `apps/web/src/lib/repository/question.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/question.repository.unit.test.ts` |
| `apps/web/src/lib/repository/resource-booking.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/resource-booking.repository.unit.test.ts` |
| `apps/web/src/lib/repository/risk-passport.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/safety-form.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/safety-form.repository.unit.test.ts` |
| `apps/web/src/lib/repository/signin-escalation.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/signin.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/signin.repository.unit.test.ts` |
| `apps/web/src/lib/repository/site-manager.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/site.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/site.repository.unit.test.ts` |
| `apps/web/src/lib/repository/sitemap.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/template.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/template.repository.unit.test.ts` |
| `apps/web/src/lib/repository/user.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/user.repository.unit.test.ts` |
| `apps/web/src/lib/repository/visitor-approval.repository.ts` | Gap | P0 | - |
| `apps/web/src/lib/repository/webhook-delivery.repository.ts` | Covered | P0 | `apps/web/src/lib/repository/__tests__/webhook-delivery.repository.unit.test.ts` |
| `apps/web/src/lib/safety-forms/defaults.ts` | Covered | P1 | `apps/web/src/lib/safety-forms/__tests__/defaults.unit.test.ts` |
| `apps/web/src/lib/security/data-protection.ts` | Gap | P1 | - |
| `apps/web/src/lib/sms/wrapper.ts` | Covered | P1 | `apps/web/src/lib/sms/__tests__/wrapper.unit.test.ts` |
| `apps/web/src/lib/storage/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/storage/keys.ts` | Gap | P1 | - |
| `apps/web/src/lib/storage/local.ts` | Gap | P1 | - |
| `apps/web/src/lib/storage/s3.ts` | Gap | P1 | - |
| `apps/web/src/lib/storage/validation.ts` | Gap | P1 | - |
| `apps/web/src/lib/template/language-config.ts` | Covered | P1 | `apps/web/src/lib/template/__tests__/language-config.unit.test.ts` |
| `apps/web/src/lib/template/media-config.ts` | Covered | P1 | `apps/web/src/lib/template/__tests__/media-config.unit.test.ts` |
| `apps/web/src/lib/tenant/context.ts` | Gap | P1 | - |
| `apps/web/src/lib/tenant/index.ts` | Gap | P1 | - |
| `apps/web/src/lib/test/setup.ts` | Gap | P1 | - |
| `apps/web/src/lib/testing/mockPrisma.ts` | Gap | P1 | - |
| `apps/web/src/lib/time/day-range.ts` | Covered | P1 | `apps/web/src/lib/time/__tests__/day-range.test.ts` |
| `apps/web/src/lib/url/public-url.ts` | Gap | P1 | - |
| `apps/web/src/lib/validation/schemas.ts` | Gap | P1 | - |
| `apps/web/src/lib/webhook/config.ts` | Covered | P1 | `apps/web/src/lib/webhook/__tests__/config.unit.test.ts` |
| `apps/web/src/lib/webhook/worker.ts` | Covered | P1 | `apps/web/src/lib/webhook/__tests__/worker.unit.test.ts` |
| `apps/web/src/proxy.ts` | Gap | P2 | - |
| `packages/shared/src/index.ts` | Gap | P2 | - |
| `packages/shared/src/schemas.ts` | Gap | P2 | - |
| `packages/shared/src/types.ts` | Gap | P2 | - |
| `packages/shared/src/utils.ts` | Gap | P2 | - |

