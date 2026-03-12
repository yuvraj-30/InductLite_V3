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
    return "border-emerald-400/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "error") {
    return "border-red-500/45 bg-red-500/12 text-red-950 dark:text-red-100";
  }
  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary";
}

function templateStatusChipClass(status: string): string {
  if (status === "ACTIVE") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface)]0/12 text-secondary";
}

function submissionStatusChipClass(status: string): string {
  if (status === "REVIEWED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "REJECTED") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Safety Forms Suite
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage SWMS, JSA, RAMS, toolbox talks, and fatigue declarations in one place.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="btn-secondary"
        >
          Back to Dashboard
        </Link>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          {params.message}
        </div>
      ) : null}

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Install default form pack</h2>
        <p className="mt-1 text-sm text-secondary">
          Installs starter templates for SWMS, JSA, RAMS, toolbox talk, and fatigue declaration.
        </p>
        <form action={installSafetyFormDefaultsAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm text-secondary">
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
              className="btn-primary"
            >
              Install defaults
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Create custom safety template</h2>
        <form action={createSafetyFormTemplateAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
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
          <label className="text-sm text-secondary">
            Form type
            <select name="formType" className="input mt-1" defaultValue="SWMS" required>
              <option value="SWMS">SWMS</option>
              <option value="JSA">JSA</option>
              <option value="RAMS">RAMS</option>
              <option value="TOOLBOX_TALK">TOOLBOX_TALK</option>
              <option value="FATIGUE_DECLARATION">FATIGUE_DECLARATION</option>
            </select>
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Template name
            <input name="name" className="input mt-1" maxLength={160} required />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Description
            <textarea name="description" rows={2} className="input mt-1" maxLength={4000} />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
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
              className="btn-primary"
            >
              Save template
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Record form submission</h2>
        <p className="mt-1 text-sm text-secondary">
          Capture completed form outcomes from workers or supervisors.
        </p>

        <form action={submitSafetyFormAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
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

          <label className="text-sm text-secondary">
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

          <label className="text-sm text-secondary">
            Submitted by
            <input name="submittedByName" className="input mt-1" maxLength={160} required />
          </label>
          <label className="text-sm text-secondary">
            Email (optional)
            <input name="submittedByEmail" type="email" className="input mt-1" maxLength={320} />
          </label>
          <label className="text-sm text-secondary">
            Phone (optional)
            <input name="submittedByPhone" className="input mt-1" maxLength={64} />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Summary (optional)
            <input name="summary" className="input mt-1" maxLength={2000} />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
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
              className="btn-primary"
            >
              Save submission
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel">
        <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Templates</h2>
        </div>
        {templates.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No safety form templates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-4 py-3 text-sm text-[color:var(--text-primary)]">
                      <div className="font-medium">{template.name}</div>
                      {template.description ? (
                        <div className="mt-1 text-xs text-muted">{template.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {sites.find((site) => site.id === template.site_id)?.name ?? "Global"}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">{template.form_type}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${templateStatusChipClass(template.is_active ? "ACTIVE" : "ARCHIVED")}`}
                      >
                        {template.is_active ? "ACTIVE" : "ARCHIVED"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {template.is_active ? (
                        <form action={deactivateSafetyFormTemplateAction}>
                          <input type="hidden" name="templateId" value={template.id} />
                          <input type="hidden" name="siteId" value={template.site_id ?? ""} />
                          <button
                            type="submit"
                            className="btn-secondary min-h-[32px] px-3 py-1.5 text-xs"
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

      <section className="surface-panel">
        <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Recent submissions</h2>
        </div>
        {submissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Submitted by
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Submitted at
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {submissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-4 py-3 text-sm text-[color:var(--text-primary)]">
                      <div className="font-medium">{submission.submitted_by_name}</div>
                      <div className="text-xs text-muted">
                        {submission.submitted_by_email || submission.submitted_by_phone || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {templateNameById.get(submission.template_id) ?? submission.template_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {submission.submitted_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${submissionStatusChipClass(submission.status)}`}
                      >
                        {submission.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {submission.status === "SUBMITTED" ? (
                        <form
                          action={reviewSafetyFormSubmissionAction}
                          className="inline-flex flex-wrap items-center justify-end gap-2"
                        >
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
                            className="btn-secondary min-h-[32px] px-3 py-1.5 text-xs"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted">Reviewed</span>
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
