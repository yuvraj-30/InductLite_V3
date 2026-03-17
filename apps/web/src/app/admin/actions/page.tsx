import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { PageEmptyState } from "@/components/ui/page-state";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository/site.repository";
import { listUsers } from "@/lib/repository/user.repository";
import {
  getActionSummary,
  listActionComments,
  listActionEntries,
} from "@/lib/repository/action.repository";
import type { ActionComment } from "@prisma/client";
import {
  addActionCommentAction,
  createActionEntryAction,
  updateActionStatusAction,
} from "./actions";

export const metadata = {
  title: "Action Register | InductLite",
};

interface ActionsPageProps {
  searchParams?: Promise<{
    flashStatus?: string;
    flashMessage?: string;
    site?: string;
    status?: string;
  }>;
}

function bannerClass(status: string | undefined): string {
  if (status === "ok") {
    return "border-emerald-400/35 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  return "border-amber-400/35 bg-amber-500/12 text-amber-900 dark:text-amber-100";
}

function statusClass(status: string): string {
  if (status === "CLOSED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "BLOCKED") {
    return "border-red-400/35 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  if (status === "IN_PROGRESS") {
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
  }
  return "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100";
}

function priorityClass(priority: string): string {
  if (priority === "CRITICAL") {
    return "border-red-500/45 bg-red-500/20 text-red-950 dark:text-red-100";
  }
  if (priority === "HIGH") {
    return "border-amber-400/45 bg-amber-500/20 text-amber-900 dark:text-amber-100";
  }
  if (priority === "LOW") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary";
}

function sourceHref(sourceType: string): string | null {
  switch (sourceType) {
    case "INCIDENT":
      return "/admin/incidents";
    case "HAZARD":
      return "/admin/hazards";
    case "PERMIT":
      return "/admin/permits";
    case "EMERGENCY":
      return "/admin/sites";
    case "INSPECTION":
      return "/admin/inspections";
    case "COMPETENCY":
      return "/admin/competency";
    case "RESOURCE":
      return "/admin/resources";
    default:
      return null;
  }
}

export default async function ActionsPage({ searchParams }: ActionsPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();
  const [sites, userPage, summary, actions] = await Promise.all([
    findAllSites(context.companyId),
    listUsers(context.companyId, { isActive: true }, { page: 1, pageSize: 200 }),
    getActionSummary(context.companyId),
    listActionEntries(context.companyId, {
      site_id: params.site || undefined,
      status:
        params.status && ["OPEN", "IN_PROGRESS", "BLOCKED", "CLOSED"].includes(params.status)
          ? (params.status as "OPEN" | "IN_PROGRESS" | "BLOCKED" | "CLOSED")
          : undefined,
    }),
  ]);

  const commentEntries = await Promise.all(
    actions.items.map(
      async (action): Promise<[string, ActionComment[]]> => [
        action.id,
        await listActionComments(context.companyId, action.id),
      ],
    ),
  );
  const commentsByActionId = new Map<string, ActionComment[]>(commentEntries);
  const siteNameById = new Map(sites.map((site) => [site.id, site.name]));
  const users = userPage.items;
  const userNameById = new Map(users.map((user) => [user.id, user.name]));

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Action Register
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Track follow-up work across incidents, hazards, inspections, and manual compliance tasks.
            </p>
          </div>
          <Link href="/admin/dashboard" className="text-sm font-semibold text-accent hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>

      {params.flashMessage ? (
        <div className={`rounded-xl border p-3 text-sm ${bannerClass(params.flashStatus)}`}>
          {params.flashMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Open</p>
          <p className="mt-2 text-3xl font-black text-[color:var(--text-primary)]">{summary.open}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/35 bg-cyan-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-950 dark:text-cyan-100">
            In progress
          </p>
          <p className="mt-2 text-3xl font-black text-cyan-950 dark:text-cyan-100">{summary.in_progress}</p>
        </div>
        <div className="rounded-2xl border border-red-400/35 bg-red-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-950 dark:text-red-100">
            Blocked
          </p>
          <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">{summary.blocked}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
            Overdue
          </p>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">{summary.overdue}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-900 dark:text-emerald-100">
            Closed
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">{summary.closed}</p>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Create Action</h2>
        <form action={createActionEntryAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Site (optional)
            <select name="siteId" defaultValue={params.site ?? ""} className="input mt-1">
              <option value="">All / company-wide</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary">
            Owner (optional)
            <select name="ownerUserId" defaultValue="" className="input mt-1">
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Title
            <input name="title" maxLength={160} required className="input mt-1" />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Description
            <textarea name="description" rows={3} maxLength={4000} className="input mt-1" />
          </label>

          <label className="text-sm text-secondary">
            Priority
            <select name="priority" defaultValue="MEDIUM" className="input mt-1">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>

          <label className="text-sm text-secondary">
            Due at (optional)
            <input name="dueAt" type="datetime-local" className="input mt-1" />
          </label>

          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">
              Create Action
            </button>
          </div>
        </form>
      </section>

      <section className="table-toolbar">
        <div className="table-toolbar-heading">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">Filters</h2>
        </div>
        <form method="get" className="table-toolbar-grid">
          <label className="text-sm text-secondary">
            Site
            <select name="site" defaultValue={params.site ?? ""} className="input mt-1 min-w-[220px]">
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Status
            <select name="status" defaultValue={params.status ?? ""} className="input mt-1 min-w-[180px]">
              <option value="">All statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <div className="table-toolbar-actions">
            <button type="submit" className="btn-primary">
              Apply
            </button>
          </div>
        </form>
      </section>

      {actions.items.length === 0 ? (
        <div className="surface-panel p-4">
          <PageEmptyState
            title="No actions yet"
            description="Create follow-up work from incidents, hazards, inspections, or add a manual action here."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {actions.items.map((action) => {
            const comments = commentsByActionId.get(action.id) ?? [];
            const sourceLink = sourceHref(action.source_type);
            return (
              <article key={action.id} className="surface-panel p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                        {action.title}
                      </h2>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(action.status)}`}>
                        {action.status}
                      </span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityClass(action.priority)}`}>
                        {action.priority}
                      </span>
                    </div>
                    {action.description ? (
                      <p className="mt-2 text-sm text-secondary">{action.description}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                      <span>
                        Site: {action.site_id ? (siteNameById.get(action.site_id) ?? action.site_id) : "Company-wide"}
                      </span>
                      <span>
                        Owner: {action.owner_user_id ? (userNameById.get(action.owner_user_id) ?? action.owner_user_id) : "Unassigned"}
                      </span>
                      <span>
                        Due: {action.due_at ? action.due_at.toLocaleString("en-NZ") : "No due date"}
                      </span>
                      <span>Source: {action.source_type}</span>
                      {sourceLink ? (
                        <Link href={sourceLink} className="font-semibold text-accent hover:underline">
                          Open source
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {action.status !== "IN_PROGRESS" && action.status !== "CLOSED" ? (
                      <form action={updateActionStatusAction}>
                        <input type="hidden" name="actionId" value={action.id} />
                        <input type="hidden" name="status" value="IN_PROGRESS" />
                        <button type="submit" className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs">
                          Start
                        </button>
                      </form>
                    ) : null}
                    {action.status !== "BLOCKED" && action.status !== "CLOSED" ? (
                      <form action={updateActionStatusAction}>
                        <input type="hidden" name="actionId" value={action.id} />
                        <input type="hidden" name="status" value="BLOCKED" />
                        <button type="submit" className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs">
                          Block
                        </button>
                      </form>
                    ) : null}
                    {action.status !== "CLOSED" ? (
                      <form action={updateActionStatusAction}>
                        <input type="hidden" name="actionId" value={action.id} />
                        <input type="hidden" name="status" value="CLOSED" />
                        <button type="submit" className="btn-primary min-h-[36px] px-3 py-1.5 text-xs">
                          Close
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Recent Notes</p>
                    {comments.length === 0 ? (
                      <p className="mt-2 text-sm text-muted">No comments yet.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {comments.slice(-3).map((comment) => (
                          <div key={comment.id} className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3">
                            <p className="text-sm text-[color:var(--text-primary)]">{comment.body}</p>
                            <p className="mt-1 text-xs text-muted">
                              {comment.author_user_id
                                ? userNameById.get(comment.author_user_id) ?? comment.author_user_id
                                : "System"}{" "}
                              · {comment.created_at.toLocaleString("en-NZ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form action={addActionCommentAction} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
                    <input type="hidden" name="actionId" value={action.id} />
                    <label className="text-sm text-secondary">
                      Add note
                      <textarea name="body" rows={4} maxLength={2000} className="input mt-2" />
                    </label>
                    <div className="mt-3">
                      <button type="submit" className="btn-secondary">
                        Save Note
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
