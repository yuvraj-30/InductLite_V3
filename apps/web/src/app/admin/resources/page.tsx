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
    return "border-green-200 bg-green-50 text-green-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resources & Booking</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure desk/room/equipment resources and manage conflict-safe booking schedules.
        </p>
      </div>

      {params.flashMessage ? (
        <div className={`rounded-lg border p-3 text-sm ${bannerClass(params.flashStatus)}`}>
          {params.flashMessage}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
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
          <button
            type="submit"
            className="min-h-[40px] rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Create Resource
        </h2>
        <form action={createResourceAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Resource name
            <input name="name" required maxLength={120} className="input mt-1" placeholder="Meeting room A" />
          </label>
          <label className="text-sm text-gray-700">
            Type
            <select name="resourceType" defaultValue="OTHER" className="input mt-1">
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Capacity
            <input name="capacity" type="number" min={1} max={500} defaultValue={1} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Location label (optional)
            <input name="locationLabel" maxLength={120} className="input mt-1" placeholder="Level 2 East Wing" />
          </label>
          <label className="text-sm text-gray-700 md:col-span-3">
            Notes (optional)
            <textarea name="notes" rows={2} maxLength={1000} className="input mt-1" />
          </label>
          <div className="md:col-span-3 md:text-right">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Resource
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Create Booking
        </h2>
        <form action={createResourceBookingAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Booking title
            <input name="title" required maxLength={160} className="input mt-1" placeholder="Toolbox talk" />
          </label>
          <label className="text-sm text-gray-700">
            Contact name (optional)
            <input name="contactName" maxLength={120} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Contact email (optional)
            <input name="contactEmail" type="email" maxLength={200} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Starts at
            <input
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocalValue(now)}
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-gray-700">
            Ends at
            <input
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocalValue(new Date(now.getTime() + 60 * 60 * 1000))}
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-3">
            Notes (optional)
            <textarea name="notes" rows={2} maxLength={1000} className="input mt-1" />
          </label>
          <div className="md:col-span-3 md:text-right">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Booking
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Active Resources
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Type</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Capacity</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-gray-500">
                    No active resources found.
                  </td>
                </tr>
              ) : (
                resources.map((resource) => (
                  <tr key={resource.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === resource.site_id)?.name ?? resource.site_id}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{resource.name}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{resource.resource_type}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{resource.capacity}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{resource.location_label ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Upcoming Bookings (14 days)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Start</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">End</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Resource</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Title</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Status</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-gray-500">
                    No upcoming bookings.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const resource = resources.find((item) => item.id === booking.resource_id);
                  return (
                    <tr key={booking.id}>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {booking.starts_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {booking.ends_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {resource ? `${resource.name} (${resource.resource_type})` : booking.resource_id}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">{booking.title}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">{booking.status}</td>
                      <td className="px-3 py-3 text-right">
                        {booking.status === "CONFIRMED" ? (
                          <form action={cancelResourceBookingAction}>
                            <input type="hidden" name="bookingId" value={booking.id} />
                            <button
                              type="submit"
                              className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
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
