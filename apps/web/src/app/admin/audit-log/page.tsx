/**
 * Audit Log Page
 *
 * Displays audit log entries for the current tenant.
 * Only visible to admins.
 */

import { checkAdmin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import {
  type AuditAction,
  type AuditLogFilter,
  listAuditLogsWithUsers,
  listDistinctAuditActions,
  listDistinctAuditEntityTypes,
} from "@/lib/repository/audit.repository";

export const metadata = {
  title: "Audit Log | InductLite",
};

interface AuditLogPageProps {
  searchParams: Promise<{
    page?: string;
    action?: string;
    entity_type?: string;
  }>;
}

export default async function AuditLogPage({
  searchParams,
}: AuditLogPageProps) {
  const params = await searchParams;

  // Check admin permission
  const guard = await checkAdmin();
  if (!guard.success) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{guard.error}</p>
        </div>
      </div>
    );
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();
  const companyId = context.companyId;

  // Pagination
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 25;

  const [actionTypes, entityTypes] = await Promise.all([
    listDistinctAuditActions(companyId),
    listDistinctAuditEntityTypes(companyId),
  ]);

  const actionFilter = actionTypes.includes(params.action || "")
    ? (params.action as AuditAction)
    : undefined;

  const filter: AuditLogFilter = {
    ...(actionFilter && { action: actionFilter }),
    ...(params.entity_type && { entity_type: params.entity_type }),
  };

  const logsResult = await listAuditLogsWithUsers(companyId, filter, {
    page,
    pageSize,
  });

  const totalPages = Math.ceil(logsResult.total / pageSize);
  const totalCount = logsResult.total;
  const skip = (page - 1) * pageSize;

  const logs = logsResult.items;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-600 mt-1">
          Track all sensitive actions performed in your account
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <form method="GET" className="flex flex-wrap gap-4 items-end">
          <div>
            <label
              htmlFor="action"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Action
            </label>
            <select
              id="action"
              name="action"
              defaultValue={params.action || ""}
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All actions</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {formatAction(action)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="entity_type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Entity Type
            </label>
            <select
              id="entity_type"
              name="entity_type"
              defaultValue={params.entity_type || ""}
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All entities</option>
              {entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Filter
          </button>

          {(params.action || params.entity_type) && (
            <a
              href="/admin/audit-log"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No audit logs
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              No activity has been recorded yet.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.entity_type && (
                          <span>
                            {log.entity_type}
                            {log.entity_id && (
                              <span className="text-gray-500 text-xs ml-1">
                                ({log.entity_id.slice(0, 8)}...)
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.user ? (
                          <span title={log.user.email}>{log.user.name}</span>
                        ) : (
                          <span className="text-gray-500">System</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {log.details ? (
                          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {JSON.stringify(log.details).slice(0, 50)}
                            {JSON.stringify(log.details).length > 50 && "..."}
                          </code>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  {page > 1 && (
                    <a
                      href={`/admin/audit-log?page=${page - 1}${params.action ? `&action=${params.action}` : ""}${params.entity_type ? `&entity_type=${params.entity_type}` : ""}`}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Previous
                    </a>
                  )}
                  {page < totalPages && (
                    <a
                      href={`/admin/audit-log?page=${page + 1}${params.action ? `&action=${params.action}` : ""}${params.entity_type ? `&entity_type=${params.entity_type}` : ""}`}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Next
                    </a>
                  )}
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{skip + 1}</span> to{" "}
                      <span className="font-medium">
                        {Math.min(skip + pageSize, totalCount)}
                      </span>{" "}
                      of <span className="font-medium">{totalCount}</span>{" "}
                      results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {page > 1 && (
                        <a
                          href={`/admin/audit-log?page=${page - 1}${params.action ? `&action=${params.action}` : ""}${params.entity_type ? `&entity_type=${params.entity_type}` : ""}`}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          <span className="sr-only">Previous</span>
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </a>
                      )}
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        Page {page} of {totalPages}
                      </span>
                      {page < totalPages && (
                        <a
                          href={`/admin/audit-log?page=${page + 1}${params.action ? `&action=${params.action}` : ""}${params.entity_type ? `&entity_type=${params.entity_type}` : ""}`}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          <span className="sr-only">Next</span>
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </a>
                      )}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Format action for display
 */
function formatAction(action: string): string {
  return action.replace(".", " ").replace(/_/g, " ");
}

/**
 * Get color classes for action type
 */
function getActionColor(action: string): string {
  if (action.includes("create")) return "bg-green-100 text-green-800";
  if (action.includes("update")) return "bg-blue-100 text-blue-800";
  if (action.includes("delete") || action.includes("deactivate"))
    return "bg-red-100 text-red-800";
  if (action.includes("login") || action.includes("logout"))
    return "bg-purple-100 text-purple-800";
  if (action.includes("password")) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
}
