import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { listExportJobs } from "@/lib/repository/export.repository";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportQueuePanel } from "./ExportQueuePanel";
import { PageEmptyState, PageWarningState } from "@/components/ui/page-state";

export const metadata = {
  title: "Exports | InductLite",
};

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
        <DataTableShell>
          <DataTableScroll>
            <DataTable className="min-w-[760px]">
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>
                  ID
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  Type
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  Status
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  Requested By
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  File
                  </DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
              {jobs.items.map((job) => (
                <DataTableRow key={job.id}>
                  <DataTableCell className="break-all">
                    {job.id}
                  </DataTableCell>
                  <DataTableCell className="text-[color:var(--text-primary)]">
                    {job.export_type}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={job.status === "SUCCEEDED" ? "success" : job.status === "RUNNING" ? "info" : job.status === "FAILED" ? "danger" : "neutral"}
                    >
                      {job.status}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="break-all">
                    {job.requested_by}
                  </DataTableCell>
                  <DataTableCell>
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
                  </DataTableCell>
                </DataTableRow>
              ))}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
      )}
    </div>
  );
}
