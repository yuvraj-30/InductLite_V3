/**
 * Archived Templates Page
 *
 * Lists all archived induction templates for the company.
 */

import Link from "next/link";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { listTemplates } from "@/lib/repository";
import type { TemplateWithCounts } from "@/lib/repository";
import { PageEmptyState, PageWarningState } from "@/components/ui/page-state";
import { DeleteButton } from "./delete-button";
import { UnarchiveButton } from "./unarchive-button";

export const metadata = {
  title: "Archived Templates | InductLite",
};

export default async function ArchivedTemplatesPage() {
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Archived Induction Templates
          </h1>
          <p className="mt-1 text-sm text-secondary">
            View all archived induction questionnaires for your company.
          </p>
        </div>
        <PageWarningState title="Unable to load archived templates." description={guard.error} />
      </div>
    );
  }

  const context = await requireAuthenticatedContextReadOnly();
  const canManage = await checkPermissionReadOnly("template:manage");
  const canManageTemplates = canManage.success;

  const result = await listTemplates(
    context.companyId,
    { isArchived: true },
    { pageSize: 100 },
  );

  const templates = result.items;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Archived Induction Templates
          </h1>
          <p className="mt-1 text-sm text-secondary">
            View all archived induction questionnaires for your company.
          </p>
        </div>
        <Link href="/admin/templates" className="btn-secondary w-full sm:w-auto">
          Back to Templates
        </Link>
      </div>

      {templates.length === 0 ? (
        <PageEmptyState
          title="No archived templates"
          description="There are no archived induction templates for your company."
          actionHref="/admin/templates"
          actionLabel="Back to Templates"
        />
      ) : (
        <div className="surface-panel overflow-hidden">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
                  Questions
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
                  Responses
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {templates.map((template: TemplateWithCounts) => (
                <tr key={template.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div>
                      <Link
                        href={`/admin/templates/${template.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {template.name}
                      </Link>
                      {template.description ? (
                        <p className="max-w-xs truncate text-sm text-muted">{template.description}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                    {template.site ? (
                      <span className="text-accent">{template.site.name}</span>
                    ) : (
                      <span className="text-muted">Company-wide</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[color:var(--text-primary)]">
                    v{template.version}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-[color:var(--bg-surface-strong)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--text-primary)]">
                      Archived
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                    {template._count.questions}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                    {template._count.responses}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/templates/${template.id}`}
                        className="text-secondary hover:text-[color:var(--text-primary)]"
                      >
                        View
                      </Link>
                      {canManageTemplates ? (
                        <>
                          <UnarchiveButton templateId={template.id} />
                          <DeleteButton templateId={template.id} />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
