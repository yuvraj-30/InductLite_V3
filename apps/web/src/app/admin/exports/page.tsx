import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { createExportActionFromForm } from "./actions";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { listExportJobs } from "@/lib/repository/export.repository";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const metadata = {
  title: "Exports | InductLite",
};

function statusBadgeClass(status: string): string {
  if (status === "SUCCEEDED") return "bg-green-100 text-green-800";
  if (status === "RUNNING") return "bg-blue-100 text-blue-800";
  if (status === "FAILED") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

export default async function AdminExportsPage() {
  const guard = await checkPermissionReadOnly("export:create");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const jobs = await listExportJobs(
    context.companyId,
    {},
    { page: 1, pageSize: 50 },
  );

  const log = createRequestLogger(generateRequestId());
  log.info(
    { companyId: context.companyId, jobsCount: jobs.items.length },
    "Viewed admin exports page",
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Exports</h1>
        <p className="mt-1 text-gray-600">
          Queue and download CSV export files for your company.
        </p>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4">
        {isFeatureEnabled("EXPORTS") ? (
          <form action={createExportActionFromForm} className="flex flex-wrap gap-2">
            <select
              name="exportType"
              className="block rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="SIGN_IN_CSV">Sign In CSV</option>
              <option value="INDUCTION_CSV">Induction CSV</option>
            </select>
            <button
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              type="submit"
            >
              Queue Export
            </button>
          </form>
        ) : (
          <div className="text-sm text-gray-500">Exports are disabled</div>
        )}
      </div>

      {jobs.items.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-medium text-gray-900">No exports yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Queue an export to generate downloadable files.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Requested By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  File
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {jobs.items.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{job.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{job.export_type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{job.requested_by}</td>
                  <td className="px-4 py-3 text-sm">
                    {job.status === "SUCCEEDED" && job.file_path ? (
                      <a
                        href={`/api/exports/${job.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {job.file_name}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
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
