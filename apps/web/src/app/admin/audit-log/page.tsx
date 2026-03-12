/**
 * Audit Log Page
 *
 * Displays audit log entries for the current tenant.
 * Only visible to admins.
 */

import { requireAdminPageReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import {
  type AuditAction,
  type AuditLogFilter,
  listAuditLogsWithUsers,
  listDistinctAuditActions,
  listDistinctAuditEntityTypes,
} from "@/lib/repository/audit.repository";
import { PageEmptyState } from "@/components/ui/page-state";

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

  // Check admin permission (read-only guard for server components/pages).
  await requireAdminPageReadOnly();

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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Track all sensitive actions performed in your account
        </p>
      </div>

      {/* Filters */}
      <div className="table-toolbar">
        <div className="table-toolbar-heading">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            Filter Audit Records
          </h2>
        </div>
        <form method="GET" className="table-toolbar-grid">
          <div>
            <label htmlFor="action" className="label mb-1">
              Action
            </label>
            <select
              id="action"
              name="action"
              defaultValue={params.action || ""}
              className="input"
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
            <label htmlFor="entity_type" className="label mb-1">
              Entity Type
            </label>
            <select
              id="entity_type"
              name="entity_type"
              defaultValue={params.entity_type || ""}
              className="input"
            >
              <option value="">All entities</option>
              {entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </div>

          <div className="table-toolbar-actions">
            <button type="submit" className="btn-primary">
              Filter
            </button>

            {(params.action || params.entity_type) && (
              <a href="/admin/audit-log" className="btn-secondary">
                Clear
              </a>
            )}
          </div>
        </form>
      </div>

      {/* Logs Table */}
      <div className="surface-panel overflow-hidden">
        {logs.length === 0 ? (
          <PageEmptyState
            title="No audit logs"
            description="No activity has been recorded yet."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
                <thead className="bg-[color:var(--bg-surface-strong)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-[color:var(--bg-surface-strong)]"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getActionColor(log.action)}`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-primary)]">
                        {log.entity_type && (
                          <span>
                            {log.entity_type}
                            {log.entity_id && (
                              <span className="ml-1 text-xs text-muted">
                                ({log.entity_id.slice(0, 8)}...)
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-primary)]">
                        {log.user ? (
                          <span title={log.user.email}>{log.user.name}</span>
                        ) : (
                          <span className="text-secondary">System</span>
                        )}
                      </td>
                      <td className="max-w-xs truncate px-6 py-4 text-sm text-secondary">
                        {log.details ? (
                          <code className="rounded bg-[color:var(--bg-surface-strong)] px-1.5 py-0.5 text-sm">
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
              <div className="flex items-center justify-between border-t border-[color:var(--border-soft)] px-4 py-3 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  {page > 1 && (
                    <a
                      href={`/admin/audit-log?page=${page - 1}${params.action ? `&action=${params.action}` : ""}${params.entity_type ? `&entity_type=${params.entity_type}` : ""}`}
                      className="btn-secondary"
                    >
                      Previous
                    </a>
                  )}
                  {page < totalPages && (
                    <a
                      href={`/admin/audit-log?page=${page + 1}${params.action ? `&action=${params.action}` : ""}${params.entity_type ? `&entity_type=${params.entity_type}` : ""}`}
                      className="btn-secondary ml-3"
                    >
                      Next
                    </a>
                  )}
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-secondary">
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
                          className="relative inline-flex items-center rounded-l-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-2 py-2 text-sm font-medium text-secondary hover:bg-[color:var(--bg-surface)]"
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
                      <span className="relative inline-flex items-center border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)]">
                        Page {page} of {totalPages}
                      </span>
                      {page < totalPages && (
                        <a
                          href={`/admin/audit-log?page=${page + 1}${params.action ? `&action=${params.action}` : ""}${params.entity_type ? `&entity_type=${params.entity_type}` : ""}`}
                          className="relative inline-flex items-center rounded-r-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-2 py-2 text-sm font-medium text-secondary hover:bg-[color:var(--bg-surface)]"
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
  if (action.includes("create")) {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (action.includes("update")) {
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
  }
  if (action.includes("delete") || action.includes("deactivate"))
    return "border-red-400/40 bg-red-500/15 text-red-950 dark:text-red-100";
  if (action.includes("login") || action.includes("logout"))
    return "border-violet-400/35 bg-violet-500/15 text-violet-950 dark:text-violet-100";
  if (action.includes("password"))
    return "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary";
}

