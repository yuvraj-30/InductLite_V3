import { redirect } from "next/navigation";
import type { ResourceType } from "@prisma/client";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  listBookableResources,
  listResourceBookings,
} from "@/lib/repository/resource-booking.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  cancelResourceBookingAction,
  createResourceAction,
  createResourceBookingAction,
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

function toDateTimeLocalValue(input: Date): string {
  const local = new Date(input.getTime() - input.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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

  const [sites, resources, bookings] = await Promise.all([
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
            Location label (optional)
            <input name="locationLabel" maxLength={120} className="input mt-1" placeholder="Level 2 East Wing" />
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
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-muted">
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
                    <td className="px-3 py-3 text-sm text-secondary">{resource.location_label ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    </div>
  );
}
