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
import { UnarchiveButton } from "./unarchive-button";
import { DeleteButton } from "./delete-button";

export const metadata = {
  title: "Archived Templates | InductLite",
};

export default async function ArchivedTemplatesPage() {
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

  const context = await requireAuthenticatedContextReadOnly();
  const canManage = await checkPermissionReadOnly("template:manage");
  const canManageTemplates = canManage.success;

  // Fetch archived templates
  const result = await listTemplates(
    context.companyId,
    { isArchived: true },
    { pageSize: 100 },
  );

  const templates = result.items;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Archived Induction Templates
          </h1>
          <p className="text-gray-600 mt-1">
            View all archived induction questionnaires for your company
          </p>
        </div>
        <Link
          href="/admin/templates"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to Templates
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No archived templates
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no archived induction templates for your company.
          </p>
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
              {templates.map((template: TemplateWithCounts) => (
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Archived
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {template._count.questions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {template._count.responses}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
                    <Link
                      href={`/admin/templates/${template.id}`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      View
                    </Link>
                    {canManageTemplates && (
                      <>
                        <UnarchiveButton templateId={template.id} />
                        <DeleteButton templateId={template.id} />
                      </>
                    )}
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
