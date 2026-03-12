import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { listExportJobs } from "@/lib/repository/export.repository";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { ExportQueuePanel } from "./ExportQueuePanel";
import { statusChipClass } from "../components/status-chip";
import { PageEmptyState, PageWarningState } from "@/components/ui/page-state";

export const metadata = {
  title: "Exports | InductLite",
};

function statusBadgeClass(status: string): string {
  if (status === "SUCCEEDED") {
    return statusChipClass("success");
  }
  if (status === "RUNNING") {
    return statusChipClass("info");
  }
  if (status === "FAILED") {
    return statusChipClass("danger");
  }
  return statusChipClass("neutral");
}

export default async function AdminExportsPage() {
  const guard = await checkPermissionReadOnly("export:create");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const jobs = await listExportJobs(
    guard.user.companyId,
    {},
    { page: 1, pageSize: 50 },
  );

  const log = createRequestLogger(generateRequestId());
  log.info(
    { companyId: guard.user.companyId, jobsCount: jobs.items.length },
    "Viewed admin exports page",
  );

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Exports
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Queue and download CSV, PDF, and compliance-pack ZIP files.
        </p>
      </div>

      {isFeatureEnabled("EXPORTS") ? (
        <ExportQueuePanel />
      ) : (
        <PageWarningState
          title="Exports disabled"
          description="Export generation is currently disabled for this environment."
        />
      )}

      {jobs.items.length === 0 ? (
        <PageEmptyState
          title="No exports yet"
          description="Queue an export to generate downloadable files."
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <table className="min-w-[760px] divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Requested By
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  File
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {jobs.items.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-[color:var(--bg-surface-strong)]"
                >
                  <td className="break-all px-4 py-3 text-sm text-secondary">
                    {job.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-[color:var(--text-primary)]">
                    {job.export_type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={statusBadgeClass(job.status)}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="break-all px-4 py-3 text-sm text-secondary">
                    {job.requested_by}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {job.status === "SUCCEEDED" && job.file_path ? (
                      <a
                        href={`/api/exports/${job.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        {job.file_name}
                      </a>
                    ) : (
                      <span className="text-muted">-</span>
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
