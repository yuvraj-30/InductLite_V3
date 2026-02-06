import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { createExportActionFromForm } from "./actions";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { listExportJobs } from "@/lib/repository/export.repository";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function AdminExportsPage() {
  const context = await requireAuthenticatedContextReadOnly();
  const jobs = await listExportJobs(
    context.companyId,
    {},
    { page: 1, pageSize: 50 },
  );

  // Log page view for observability
  const log = createRequestLogger(generateRequestId());
  log.info(
    { companyId: context.companyId, jobsCount: jobs.items.length },
    "Viewed admin exports page",
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Exports</h1>
        {isFeatureEnabled("EXPORTS") ? (
          <form action={createExportActionFromForm}>
            <select name="exportType" className="mr-2 border p-1 rounded">
              <option value="SIGN_IN_CSV">Sign In CSV</option>
              <option value="INDUCTION_CSV">Induction CSV</option>
            </select>
            <button className="btn btn-primary" type="submit">
              Queue Export
            </button>
          </form>
        ) : (
          <div className="text-sm text-gray-500">Exports are disabled</div>
        )}
      </div>

      <table className="w-full table-fixed border">
        <thead>
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Type</th>
            <th className="p-2">Status</th>
            <th className="p-2">Requested By</th>
            <th className="p-2">File</th>
          </tr>
        </thead>
        <tbody>
          {jobs.items.map((j) => (
            <tr key={j.id} className="border-t">
              <td className="p-2">{j.id}</td>
              <td className="p-2">{j.export_type}</td>
              <td className="p-2">{j.status}</td>
              <td className="p-2">{j.requested_by}</td>
              <td className="p-2">
                {j.status === "SUCCEEDED" && j.file_path ? (
                  <a
                    href={`/api/exports/${j.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {j.file_name}
                  </a>
                ) : (
                  ""
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
