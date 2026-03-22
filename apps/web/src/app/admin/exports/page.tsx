import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { listExportJobs } from "@/lib/repository/export.repository";
import { findSiteById } from "@/lib/repository/site.repository";
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
import { ExportQueueRecoveryControls } from "./ExportQueueRecoveryControls";
import { PageEmptyState, PageWarningState } from "@/components/ui/page-state";
import {
  describeExportLifecycle,
  describeExportRequest,
  parseExportRequestParameters,
} from "@/lib/export/intent";

function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const now = new Date();
  const siteIds = [...new Set(
    jobs.items
      .map((job) => parseExportRequestParameters(job.parameters).siteId)
      .filter((value): value is string => Boolean(value)),
  )];
  const sites = await Promise.all(
    siteIds.map(async (siteId) => [siteId, await findSiteById(guard.user.companyId, siteId)] as const),
  );
  const siteNameById = new Map(
    sites.map(([siteId, site]) => [siteId, site?.name ?? null]),
  );
  const queuedJobs = jobs.items.filter((job) => job.status === "QUEUED");
  const delayedJobCount = queuedJobs.filter(
    (job) => now.getTime() - job.queued_at.getTime() >= 10 * 60 * 1000,
  ).length;
  const oldestQueuedAgeMinutes =
    queuedJobs.length > 0
      ? Math.max(
          ...queuedJobs.map(
            (job) => (now.getTime() - job.queued_at.getTime()) / 60_000,
          ),
        )
      : null;

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

      {isFeatureEnabled("EXPORTS") ? (
        <ExportQueueRecoveryControls
          hasQueuedJobs={queuedJobs.length > 0}
          delayedJobCount={delayedJobCount}
          oldestQueuedAgeMinutes={oldestQueuedAgeMinutes}
        />
      ) : null}

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
                  Request
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
                    <div className="space-y-1">
                      <div>{job.id}</div>
                      <div className="text-xs text-muted">
                        Requested by {job.requested_by}
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-[color:var(--text-primary)]">
                    {(() => {
                      const request = parseExportRequestParameters(job.parameters);
                      const summary = describeExportRequest({
                        exportType: job.export_type,
                        parameters: job.parameters,
                        siteName: request.siteId
                          ? siteNameById.get(request.siteId) ?? null
                          : null,
                      });

                      return (
                        <div className="space-y-1">
                          <div className="font-semibold">{summary.title}</div>
                          {summary.filters.map((line) => (
                            <div key={`${job.id}-${line}`} className="text-xs text-secondary">
                              {line}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </DataTableCell>
                  <DataTableCell>
                    {(() => {
                      const lifecycle = describeExportLifecycle(job, now);
                      return (
                        <div className="space-y-1">
                          <StatusBadge
                            tone={job.status === "SUCCEEDED" ? "success" : job.status === "RUNNING" ? "info" : job.status === "FAILED" ? "danger" : lifecycle.isDelayed ? "warning" : "neutral"}
                          >
                            {job.status}
                          </StatusBadge>
                          <div className="text-xs text-secondary">{lifecycle.headline}</div>
                          <div className="text-xs text-muted">{lifecycle.detail}</div>
                        </div>
                      );
                    })()}
                  </DataTableCell>
                  <DataTableCell className="break-all">
                    <div className="space-y-1">
                      <div>{job.attempts} attempt(s)</div>
                      <div className="text-xs text-muted">
                        Next run {job.run_at > now ? "scheduled" : "eligible"} at{" "}
                        {job.run_at.toISOString().slice(0, 16).replace("T", " ")}
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    {job.status === "SUCCEEDED" && job.file_path ? (
                      <div className="space-y-1">
                        <a
                          href={`/api/exports/${job.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-accent hover:underline"
                        >
                          {job.file_name}
                        </a>
                        <div className="text-xs text-muted">
                          {formatBytes(job.file_size) ?? "Size pending"} | Expires{" "}
                          {job.expires_at
                            ? job.expires_at.toISOString().slice(0, 16).replace("T", " ")
                            : "never"}
                        </div>
                      </div>
                    ) : job.status === "FAILED" ? (
                      <div className="max-w-xs text-xs text-red-900 dark:text-red-100">
                        {job.error_message || "The export failed before a file was produced."}
                      </div>
                    ) : (
                      <span className="text-muted">Waiting for processor</span>
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
