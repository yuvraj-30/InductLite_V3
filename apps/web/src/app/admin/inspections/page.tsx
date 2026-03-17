import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { PageEmptyState } from "@/components/ui/page-state";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository/site.repository";
import { listUsers } from "@/lib/repository/user.repository";
import { listSafetyFormTemplates } from "@/lib/repository/safety-form.repository";
import {
  getInspectionSummary,
  listInspectionRuns,
  listInspectionSchedules,
} from "@/lib/repository/inspection.repository";
import {
  createInspectionScheduleAction,
  recordInspectionRunAction,
} from "./actions";

export const metadata = {
  title: "Inspections | InductLite",
};

interface InspectionsPageProps {
  searchParams?: Promise<{
    flashStatus?: string;
    flashMessage?: string;
  }>;
}

function bannerClass(status: string | undefined): string {
  if (status === "ok") {
    return "border-emerald-400/35 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  return "border-amber-400/35 bg-amber-500/12 text-amber-900 dark:text-amber-100";
}

function scheduleTone(nextDueAt: Date): string {
  return nextDueAt < new Date()
    ? "border-red-400/35 bg-red-500/15 text-red-950 dark:text-red-100"
    : "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
}

export default async function InspectionsPage({
  searchParams,
}: InspectionsPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();
  const [sites, userPage, templates, summary, schedules, runs] = await Promise.all([
    findAllSites(context.companyId),
    listUsers(context.companyId, { isActive: true }, { page: 1, pageSize: 200 }),
    listSafetyFormTemplates(context.companyId, { include_inactive: false, limit: 500 }),
    getInspectionSummary(context.companyId),
    listInspectionSchedules(context.companyId, { is_active: true }),
    listInspectionRuns(context.companyId),
  ]);

  const siteNameById = new Map(sites.map((site) => [site.id, site.name]));
  const userNameById = new Map(userPage.items.map((user) => [user.id, user.name]));
  const templateLabelById = new Map(
    templates.map((template) => [
      template.id,
      `${template.name} (${template.form_type})`,
    ]),
  );

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Inspections
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Schedule recurring site inspections, record completed runs, and spin failed findings into follow-up work.
            </p>
          </div>
          <Link href="/admin/actions" className="text-sm font-semibold text-accent hover:underline">
            View Action Register
          </Link>
        </div>
      </div>

      {params.flashMessage ? (
        <div className={`rounded-xl border p-3 text-sm ${bannerClass(params.flashStatus)}`}>
          {params.flashMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Active schedules</p>
          <p className="mt-2 text-3xl font-black text-[color:var(--text-primary)]">{summary.active_schedules}</p>
        </div>
        <div className="rounded-2xl border border-red-400/35 bg-red-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-950 dark:text-red-100">
            Overdue
          </p>
          <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">{summary.overdue_schedules}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/35 bg-cyan-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-950 dark:text-cyan-100">
            Runs last 30 days
          </p>
          <p className="mt-2 text-3xl font-black text-cyan-950 dark:text-cyan-100">
            {summary.completed_runs_last_30_days}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
            Failed runs
          </p>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
            {summary.failed_runs_last_30_days}
          </p>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Create Inspection Schedule</h2>
        <form action={createInspectionScheduleAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Site
            <select name="siteId" required className="input mt-1">
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary">
            Safety form template
            <select name="templateId" required className="input mt-1">
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.form_type})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Schedule name
            <input name="name" maxLength={160} required className="input mt-1" placeholder="Weekly plant walkdown" />
          </label>

          <label className="text-sm text-secondary">
            Frequency
            <select name="frequency" defaultValue="WEEKLY" className="input mt-1">
              <option value="DAILY">DAILY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="MONTHLY">MONTHLY</option>
              <option value="QUARTERLY">QUARTERLY</option>
              <option value="AD_HOC">AD_HOC</option>
            </select>
          </label>

          <label className="text-sm text-secondary">
            Starts at
            <input name="startsAt" type="datetime-local" required className="input mt-1" />
          </label>

          <label className="text-sm text-secondary">
            Assigned owner (optional)
            <select name="assignedUserId" className="input mt-1">
              <option value="">Unassigned</option>
              {userPage.items.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">
              Create Schedule
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Record Inspection Run</h2>
        <form action={recordInspectionRunAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Schedule
            <select name="scheduleId" required className="input mt-1">
              <option value="">Select schedule</option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name} · {siteNameById.get(schedule.site_id) ?? schedule.site_id}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary">
            Score percent (optional)
            <input name="scorePercent" type="number" min={0} max={100} className="input mt-1" />
          </label>

          <label className="text-sm text-secondary">
            Failed items
            <input name="failedItemCount" type="number" min={0} max={500} defaultValue={0} className="input mt-1" />
          </label>

          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              name="createFollowUpAction"
              type="checkbox"
              value="true"
              defaultChecked
              className="h-4 w-4 rounded border-[color:var(--border-soft)]"
            />
            Create follow-up action when findings are present
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Summary
            <textarea name="summary" rows={3} maxLength={2000} className="input mt-1" />
          </label>

          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">
              Record Inspection
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Scheduled Inspections</h2>
        {schedules.length === 0 ? (
          <div className="mt-3">
            <PageEmptyState
              title="No inspection schedules yet"
              description="Create a recurring inspection from an existing safety form template."
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {schedules.map((schedule) => (
              <article key={schedule.id} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[color:var(--text-primary)]">{schedule.name}</h3>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${scheduleTone(schedule.next_due_at)}`}>
                    {schedule.frequency}
                  </span>
                </div>
                <p className="mt-2 text-sm text-secondary">
                  {siteNameById.get(schedule.site_id) ?? schedule.site_id} · {templateLabelById.get(schedule.template_id) ?? schedule.template_id}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                  <span>Next due: {schedule.next_due_at.toLocaleString("en-NZ")}</span>
                  <span>
                    Owner: {schedule.assigned_user_id ? userNameById.get(schedule.assigned_user_id) ?? schedule.assigned_user_id : "Unassigned"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Recent Runs</h2>
        {runs.length === 0 ? (
          <div className="mt-3">
            <PageEmptyState
              title="No inspection runs recorded"
              description="Record completed inspections here to keep schedules current and generate follow-up work automatically."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Completed</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Schedule</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Failed items</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Score</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Performed by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {runs.slice(0, 25).map((run) => (
                  <tr key={run.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      {(run.completed_at ?? run.created_at).toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                      {schedules.find((schedule) => schedule.id === run.schedule_id)?.name ?? run.schedule_id}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{run.failed_item_count}</td>
                    <td className="px-3 py-3 text-sm text-secondary">{run.score_percent ?? "-"}</td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {run.performed_by_user_id ? userNameById.get(run.performed_by_user_id) ?? run.performed_by_user_id : "Unknown"}
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
