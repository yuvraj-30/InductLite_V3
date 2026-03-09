import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  listSafetyFormSubmissions,
  listSafetyFormTemplates,
} from "@/lib/repository/safety-form.repository";
import {
  createSafetyFormTemplateAction,
  deactivateSafetyFormTemplateAction,
  installSafetyFormDefaultsAction,
  reviewSafetyFormSubmissionAction,
  submitSafetyFormAction,
} from "./actions";

export const metadata = {
  title: "Safety Forms | InductLite",
};

interface SafetyFormsPageProps {
  searchParams?: Promise<{ status?: string; message?: string }>;
}

function statusBannerClass(status: string | undefined): string {
  if (status === "success") {
    return "border-green-200 bg-green-50 text-green-800";
  }
  if (status === "error") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default async function SafetyFormsPage({
  searchParams,
}: SafetyFormsPageProps) {
  const auth = await checkAuthReadOnly();
  if (!auth.success) {
    if (auth.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  if (auth.user.role !== "ADMIN" && auth.user.role !== "SITE_MANAGER") {
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const params = (await searchParams) ?? {};

  const [sites, templates, submissions] = await Promise.all([
    findAllSites(context.companyId),
    listSafetyFormTemplates(context.companyId, {
      include_inactive: true,
      limit: 400,
    }),
    listSafetyFormSubmissions(context.companyId, { limit: 300 }),
  ]);

  const templateNameById = new Map(templates.map((template) => [template.id, template.name]));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Safety Forms Suite</h1>
          <p className="mt-1 text-gray-600">
            Manage SWMS, JSA, RAMS, toolbox talks, and fatigue declarations in one place.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Install default form pack</h2>
        <p className="mt-1 text-sm text-gray-600">
          Installs starter templates for SWMS, JSA, RAMS, toolbox talk, and fatigue declaration.
        </p>
        <form action={installSafetyFormDefaultsAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm text-gray-700">
            Site (optional)
            <select name="siteId" className="input mt-1">
              <option value="">Global (all sites)</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Install defaults
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Create custom safety template</h2>
        <form action={createSafetyFormTemplateAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            Site (optional)
            <select name="siteId" className="input mt-1">
              <option value="">Global (all sites)</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Form type
            <select name="formType" className="input mt-1" defaultValue="SWMS" required>
              <option value="SWMS">SWMS</option>
              <option value="JSA">JSA</option>
              <option value="RAMS">RAMS</option>
              <option value="TOOLBOX_TALK">TOOLBOX_TALK</option>
              <option value="FATIGUE_DECLARATION">FATIGUE_DECLARATION</option>
            </select>
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Template name
            <input name="name" className="input mt-1" maxLength={160} required />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Description
            <textarea name="description" rows={2} className="input mt-1" maxLength={4000} />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Field schema JSON
            <textarea
              name="fieldSchemaJson"
              rows={7}
              className="input mt-1 font-mono text-xs"
              defaultValue={JSON.stringify(
                {
                  version: 1,
                  fields: [
                    {
                      key: "fieldKey",
                      label: "Field label",
                      type: "text",
                      required: true,
                    },
                  ],
                },
                null,
                2,
              )}
              required
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save template
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Record form submission</h2>
        <p className="mt-1 text-sm text-gray-600">
          Capture completed form outcomes from workers or supervisors.
        </p>

        <form action={submitSafetyFormAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            Site
            <select name="siteId" className="input mt-1" required>
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Template
            <select name="templateId" className="input mt-1" required>
              <option value="">Select template</option>
              {templates
                .filter((template) => template.is_active)
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.form_type} - {template.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Submitted by
            <input name="submittedByName" className="input mt-1" maxLength={160} required />
          </label>
          <label className="text-sm text-gray-700">
            Email (optional)
            <input name="submittedByEmail" type="email" className="input mt-1" maxLength={320} />
          </label>
          <label className="text-sm text-gray-700">
            Phone (optional)
            <input name="submittedByPhone" className="input mt-1" maxLength={64} />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Summary (optional)
            <input name="summary" className="input mt-1" maxLength={2000} />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Submission payload JSON
            <textarea
              name="payloadJson"
              rows={7}
              className="input mt-1 font-mono text-xs"
              defaultValue={JSON.stringify(
                {
                  checklist: [
                    { key: "example", value: "complete" },
                  ],
                },
                null,
                2,
              )}
              required
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save submission
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
        </div>
        {templates.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No safety form templates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{template.name}</div>
                      {template.description ? (
                        <div className="mt-1 text-xs text-gray-500">{template.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === template.site_id)?.name ?? "Global"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{template.form_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {template.is_active ? "ACTIVE" : "ARCHIVED"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {template.is_active ? (
                        <form action={deactivateSafetyFormTemplateAction}>
                          <input type="hidden" name="templateId" value={template.id} />
                          <input type="hidden" name="siteId" value={template.site_id ?? ""} />
                          <button
                            type="submit"
                            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Archive
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent submissions</h2>
        </div>
        {submissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Submitted by
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Submitted at
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{submission.submitted_by_name}</div>
                      <div className="text-xs text-gray-500">
                        {submission.submitted_by_email || submission.submitted_by_phone || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {templateNameById.get(submission.template_id) ?? submission.template_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {submission.submitted_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{submission.status}</td>
                    <td className="px-4 py-3 text-right">
                      {submission.status === "SUBMITTED" ? (
                        <form action={reviewSafetyFormSubmissionAction} className="inline-flex items-center gap-2">
                          <input type="hidden" name="submissionId" value={submission.id} />
                          <input type="hidden" name="siteId" value={submission.site_id} />
                          <select name="status" defaultValue="REVIEWED" className="input h-8 w-28 text-xs">
                            <option value="REVIEWED">REVIEWED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                          <input
                            name="notes"
                            className="input h-8 w-40 text-xs"
                            placeholder="Review notes"
                            maxLength={2000}
                          />
                          <button
                            type="submit"
                            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-gray-500">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
