/**
 * Templates List Page
 *
 * Displays all induction templates with versioning info and management actions.
 */

import Link from "next/link";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { listTemplates } from "@/lib/repository";
import {
  PublishTemplateForm,
  ArchiveTemplateForm,
  DeleteTemplateForm,
  CreateVersionForm,
} from "./template-action-forms";

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
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{guard.error}</p>
        </div>
      </div>
    );
  }

  const [canManage, result] = await Promise.all([
    checkPermissionReadOnly("template:manage"),
    listTemplates(guard.user.companyId, { isArchived: false }, { pageSize: 100 }),
  ]);
  const canManageTemplates = canManage.success;

  const templates = result.items;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Induction Templates
          </h1>
          <p className="text-gray-600 mt-1">
            Create and manage induction questionnaires for your sites
          </p>
        </div>

        {canManageTemplates && (
          <Link
            href="/admin/templates/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No templates yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first induction template.
          </p>
          {canManageTemplates && (
            <div className="mt-6">
              <Link
                href="/admin/templates/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Template
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Questions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Responses
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <Link
                        href={`/admin/templates/${template.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {template.name}
                      </Link>
                      {template.description && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {template.site ? (
                      <span className="text-blue-600">
                        {template.site.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">Company-wide</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    v{template.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge
                      isPublished={template.is_published}
                      isArchived={template.is_archived}
                      isDefault={template.is_default}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {template._count.questions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                                className="text-blue-600 hover:text-blue-900"
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
                        className="text-gray-600 hover:text-gray-900"
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
      <div className="mt-6">
        <Link
          href="/admin/templates/archived"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          View archived templates →
        </Link>
      </div>
    </div>
  );
}
