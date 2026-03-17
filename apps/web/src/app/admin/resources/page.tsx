import { redirect } from "next/navigation";
import type { ResourceReadinessStatus, ResourceType } from "@prisma/client";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  getResourceReadinessSummary,
  listBookableResources,
  listResourceBookings,
  listResourceInspectionRecords,
} from "@/lib/repository/resource-booking.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  cancelResourceBookingAction,
  createResourceAction,
  createResourceBookingAction,
  recordResourceInspectionAction,
  updateResourceComplianceAction,
} from "./actions";

export const metadata = {
  title: "Resources & Booking | InductLite",
};

interface ResourcePageProps {
  searchParams?: Promise<{
    site?: string;
    flashMessage?: string;
    flashStatus?: string;
  }>;
}

const RESOURCE_TYPES: ResourceType[] = [
  "DESK",
  "ROOM",
  "VEHICLE",
  "TOOL",
  "EQUIPMENT",
  "OTHER",
];

const READINESS_STATUSES: ResourceReadinessStatus[] = [
  "READY",
  "REVIEW_REQUIRED",
  "BLOCKED",
];

function bannerClass(statusCode: string | undefined): string {
  if (statusCode === "ok") {
    return "border-emerald-400/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  return "border-amber-400/45 bg-amber-500/12 text-amber-900 dark:text-amber-100";
}

function bookingStatusChipClass(status: string): string {
  if (status === "CONFIRMED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "CANCELLED") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
}

function readinessChipClass(status: ResourceReadinessStatus): string {
  if (status === "BLOCKED") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  if (status === "REVIEW_REQUIRED") {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
}

function toDateTimeLocalValue(input: Date): string {
  const local = new Date(input.getTime() - input.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatOptionalDateTime(input: Date | null | undefined): string {
  if (!input) return "-";
  return input.toLocaleString("en-NZ");
}

export default async function ResourceBookingPage({ searchParams }: ResourcePageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();
  const now = new Date();
  const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [sites, resources, bookings, readinessSummary, inspectionRecords] = await Promise.all([
    findAllSites(context.companyId),
    listBookableResources(context.companyId, {
      site_id: params.site || undefined,
      is_active: true,
      limit: 300,
    }),
    listResourceBookings(context.companyId, {
      site_id: params.site || undefined,
      ends_after: now,
      starts_before: next14Days,
      limit: 400,
    }),
    getResourceReadinessSummary(context.companyId, now),
    listResourceInspectionRecords(context.companyId, {
      site_id: params.site || undefined,
      limit: 100,
    }),
  ]);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Resources & Booking
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Configure desk/room/equipment resources and manage conflict-safe booking schedules.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Blocked resources
          </p>
          <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">
            {readinessSummary.blocked}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Resources blocked from booking until compliance issues are cleared.
          </p>
        </article>
        <article className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Review required
          </p>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
            {readinessSummary.review_required}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Resources that need a compliance review before they can be trusted.
          </p>
        </article>
        <article className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            Overdue compliance
          </p>
          <p className="mt-2 text-3xl font-black text-[color:var(--text-primary)]">
            {readinessSummary.overdue_compliance}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Inspection or service dates already inside or past the booking window.
          </p>
        </article>
      </section>

      {params.flashMessage ? (
        <div className={`rounded-xl border p-3 text-sm ${bannerClass(params.flashStatus)}`}>
          {params.flashMessage}
        </div>
      ) : null}

      <section className="table-toolbar">
        <div className="table-toolbar-heading">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            Filters
          </h2>
        </div>
        <form method="get" className="table-toolbar-grid">
          <label className="text-sm text-secondary">
            Site filter
            <select name="site" defaultValue={params.site ?? ""} className="input mt-1 min-w-[220px]">
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <div className="table-toolbar-actions">
            <button type="submit" className="btn-primary">
              Apply
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Create Resource
        </h2>
        <form action={createResourceAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
            Resource name
            <input name="name" required maxLength={120} className="input mt-1" placeholder="Meeting room A" />
          </label>
          <label className="text-sm text-secondary">
            Type
            <select name="resourceType" defaultValue="OTHER" className="input mt-1">
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Capacity
            <input name="capacity" type="number" min={1} max={500} defaultValue={1} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Readiness
            <select name="readinessStatus" defaultValue="READY" className="input mt-1">
              {READINESS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Location label (optional)
            <input name="locationLabel" maxLength={120} className="input mt-1" placeholder="Level 2 East Wing" />
          </label>
          <label className="text-sm text-secondary">
            Inspection due (optional)
            <input
              name="inspectionDueAt"
              type="datetime-local"
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-secondary">
            Service due (optional)
            <input
              name="serviceDueAt"
              type="datetime-local"
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-secondary md:col-span-3">
            Block reason (optional)
            <input name="blockedReason" maxLength={500} className="input mt-1" placeholder="Explain why this resource is blocked or under review" />
          </label>
          <label className="text-sm text-secondary md:col-span-3">
            Notes (optional)
            <textarea name="notes" rows={2} maxLength={1000} className="input mt-1" />
          </label>
          <div className="md:col-span-3 md:text-right">
            <button
              type="submit"
              className="btn-primary"
            >
              Create Resource
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Create Booking
        </h2>
        <form action={createResourceBookingAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
            Resource
            <select name="resourceId" required className="input mt-1">
              <option value="">Select resource</option>
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name} ({resource.resource_type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Booking title
            <input name="title" required maxLength={160} className="input mt-1" placeholder="Toolbox talk" />
          </label>
          <label className="text-sm text-secondary">
            Contact name (optional)
            <input name="contactName" maxLength={120} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Contact email (optional)
            <input name="contactEmail" type="email" maxLength={200} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Starts at
            <input
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocalValue(now)}
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-secondary">
            Ends at
            <input
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocalValue(new Date(now.getTime() + 60 * 60 * 1000))}
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-secondary md:col-span-3">
            Notes (optional)
            <textarea name="notes" rows={2} maxLength={1000} className="input mt-1" />
          </label>
          <div className="md:col-span-3 md:text-right">
            <button
              type="submit"
              className="btn-primary"
            >
              Create Booking
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Active Resources
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Type</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Capacity</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Readiness</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Inspection Due</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Service Due</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-sm text-muted">
                    No active resources found.
                  </td>
                </tr>
              ) : (
                resources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      {sites.find((site) => site.id === resource.site_id)?.name ?? resource.site_id}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                      {resource.name}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className="inline-flex rounded-full border border-cyan-400/35 bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-950 dark:text-cyan-100">
                        {resource.resource_type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{resource.capacity}</td>
                    <td className="px-3 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${readinessChipClass(resource.readiness_status)}`}
                      >
                        {resource.readiness_status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {formatOptionalDateTime(resource.inspection_due_at)}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {formatOptionalDateTime(resource.service_due_at)}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{resource.location_label ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
              Compliance controls
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Update readiness, due dates, and inspection outcomes before resources are booked.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {resources.length === 0 ? (
            <p className="text-sm text-muted">Create a resource first to manage readiness.</p>
          ) : (
            resources.map((resource) => (
              <article key={`${resource.id}-compliance`} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {resource.name}
                    </p>
                    <p className="text-xs text-secondary">
                      {sites.find((site) => site.id === resource.site_id)?.name ?? resource.site_id}
                    </p>
                    {resource.blocked_reason ? (
                      <p className="mt-2 text-xs text-red-800 dark:text-red-100">
                        {resource.blocked_reason}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${readinessChipClass(resource.readiness_status)}`}
                  >
                    {resource.readiness_status}
                  </span>
                </div>

                <form action={updateResourceComplianceAction} className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="resourceId" value={resource.id} />
                  <label className="text-sm text-secondary">
                    Readiness
                    <select name="readinessStatus" defaultValue={resource.readiness_status} className="input mt-1">
                      {READINESS_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-secondary">
                    Inspection due
                    <input
                      name="inspectionDueAt"
                      type="datetime-local"
                      defaultValue={resource.inspection_due_at ? toDateTimeLocalValue(resource.inspection_due_at) : ""}
                      className="input mt-1"
                    />
                  </label>
                  <label className="text-sm text-secondary">
                    Service due
                    <input
                      name="serviceDueAt"
                      type="datetime-local"
                      defaultValue={resource.service_due_at ? toDateTimeLocalValue(resource.service_due_at) : ""}
                      className="input mt-1"
                    />
                  </label>
                  <label className="text-sm text-secondary md:col-span-2">
                    Block reason
                    <input
                      name="blockedReason"
                      defaultValue={resource.blocked_reason ?? ""}
                      maxLength={500}
                      className="input mt-1"
                    />
                  </label>
                  <div className="md:col-span-2 md:text-right">
                    <button type="submit" className="btn-secondary">
                      Update Compliance
                    </button>
                  </div>
                </form>

                <form action={recordResourceInspectionAction} className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="resourceId" value={resource.id} />
                  <input type="hidden" name="siteId" value={resource.site_id} />
                  <label className="text-sm text-secondary">
                    Inspection outcome
                    <select name="status" defaultValue="PASS" className="input mt-1">
                      <option value="PASS">PASS</option>
                      <option value="FAIL">FAIL</option>
                    </select>
                  </label>
                  <label className="text-sm text-secondary">
                    Inspected at
                    <input
                      name="inspectedAt"
                      type="datetime-local"
                      defaultValue={toDateTimeLocalValue(now)}
                      className="input mt-1"
                    />
                  </label>
                  <label className="text-sm text-secondary md:col-span-2">
                    Inspection notes
                    <textarea name="notes" rows={2} maxLength={1000} className="input mt-1" />
                  </label>
                  <div className="md:col-span-2 md:text-right">
                    <button type="submit" className="btn-primary">
                      Record Inspection
                    </button>
                  </div>
                </form>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Upcoming Bookings (14 days)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Start</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">End</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Resource</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Title</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Status</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-muted">
                    No upcoming bookings.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const resource = resources.find((item) => item.id === booking.resource_id);
                  return (
                    <tr key={booking.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                      <td className="px-3 py-3 text-sm text-secondary">
                        {booking.starts_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {booking.ends_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {resource ? `${resource.name} (${resource.resource_type})` : booking.resource_id}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                        {booking.title}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${bookingStatusChipClass(booking.status)}`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {booking.status === "CONFIRMED" ? (
                          <form action={cancelResourceBookingAction}>
                            <input type="hidden" name="bookingId" value={booking.id} />
                            <button
                              type="submit"
                              className="btn-secondary min-h-[30px] px-2 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Recent compliance inspections
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">When</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Resource</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Outcome</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {inspectionRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-muted">
                    No resource inspections recorded yet.
                  </td>
                </tr>
              ) : (
                inspectionRecords.map((inspection) => {
                  const resource = resources.find((item) => item.id === inspection.resource_id);
                  return (
                    <tr key={inspection.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                      <td className="px-3 py-3 text-sm text-secondary">
                        {inspection.inspected_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                        {resource?.name ?? inspection.resource_id}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {sites.find((site) => site.id === inspection.site_id)?.name ?? inspection.site_id}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${inspection.status === "FAIL" ? "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100" : "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"}`}
                        >
                          {inspection.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {inspection.notes ?? "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
