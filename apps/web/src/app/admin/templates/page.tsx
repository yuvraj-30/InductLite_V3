/**
 * Templates List Page
 *
 * Displays all induction templates with versioning info and management actions.
 */

import Link from "next/link";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { listTemplates } from "@/lib/repository";
import { getOnboardingProgress } from "@/lib/repository/dashboard.repository";
import {
  PublishTemplateForm,
  ArchiveTemplateForm,
  DeleteTemplateForm,
  CreateVersionForm,
} from "./template-action-forms";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import { PageEmptyState, PageWarningState } from "@/components/ui/page-state";

export const metadata = {
  title: "Induction Templates | InductLite",
};

function StatusBadge({
  isPublished,
  isArchived,
  isDefault,
}: {
  isPublished: boolean;
  isArchived: boolean;
  isDefault: boolean;
}) {
  if (isArchived) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]">
        Archived
      </span>
    );
  }
  if (isPublished) {
    return (
      <div className="flex gap-1">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Published
        </span>
        {isDefault && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[color:var(--bg-surface-strong)] text-accent">
            Default
          </span>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
      Draft
    </span>
  );
}

export default async function TemplatesPage() {
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Induction Templates
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Create and manage induction questionnaires for your sites.
          </p>
        </div>
        <PageWarningState title="Unable to load templates." description={guard.error} />
      </div>
    );
  }

  const [canManageTemplatePermission, canManageSitePermission, onboardingProgress, result] =
    await Promise.all([
      checkPermissionReadOnly("template:manage"),
      checkPermissionReadOnly("site:manage"),
      getOnboardingProgress(guard.user.companyId),
      listTemplates(guard.user.companyId, { isArchived: false }, { pageSize: 100 }),
    ]);
  const canManageTemplates = canManageTemplatePermission.success;
  const canManageSites = canManageSitePermission.success;

  const templates = result.items;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Induction Templates
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Create and manage induction questionnaires for your sites.
          </p>
        </div>

        {canManageTemplates && (
          <Link
            href="/admin/templates/new"
            className="btn-primary"
          >
            <svg
              className="-ml-1 mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Template
          </Link>
        )}
      </div>

      {templates.length === 0 ? (
        <PageEmptyState
          title="No templates yet"
          description="Get started by creating your first induction template."
          actionHref={canManageTemplates ? "/admin/templates/new" : undefined}
          actionLabel={canManageTemplates ? "Create Template" : undefined}
        >
          <OnboardingChecklist
            progress={onboardingProgress}
            className="text-left"
            canManageSites={canManageSites}
            canManageTemplates={canManageTemplates}
          />
        </PageEmptyState>
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
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <Link
                        href={`/admin/templates/${template.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {template.name}
                      </Link>
                      {template.description && (
                        <p className="text-sm text-muted truncate max-w-xs">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {template.site ? (
                      <span className="text-accent">
                        {template.site.name}
                      </span>
                    ) : (
                      <span className="text-muted">Company-wide</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-primary)]">
                    v{template.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge
                      isPublished={template.is_published}
                      isArchived={template.is_archived}
                      isDefault={template.is_default}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {template._count.questions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {template._count.responses}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      {canManageTemplates && !template.is_archived && (
                        <>
                          {!template.is_published && (
                            <>
                              <Link
                                href={`/admin/templates/${template.id}`}
                                className="text-accent hover:text-accent"
                              >
                                Edit
                              </Link>
                              {template._count.questions > 0 && (
                                <PublishTemplateForm
                                  templateId={template.id}
                                  templateName={template.name}
                                />
                              )}
                              {template._count.responses === 0 && (
                                <DeleteTemplateForm
                                  templateId={template.id}
                                  templateName={template.name}
                                />
                              )}
                            </>
                          )}
                          {template.is_published && (
                            <>
                              <CreateVersionForm
                                templateId={template.id}
                                templateName={template.name}
                              />
                              <ArchiveTemplateForm
                                templateId={template.id}
                                templateName={template.name}
                              />
                            </>
                          )}
                        </>
                      )}
                      <Link
                        href={`/admin/templates/${template.id}`}
                        className="text-secondary hover:text-[color:var(--text-primary)]"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Show archived templates link */}
      <div>
        <Link
          href="/admin/templates/archived"
          className="text-sm font-semibold text-accent hover:underline"
        >
          View archived templates
        </Link>
      </div>
    </div>
  );
}
