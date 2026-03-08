import type { DeliveryItemStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { listDeliveryItems } from "@/lib/repository/delivery.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  addDeliveryNoteAction,
  createDeliveryItemAction,
  transitionDeliveryItemAction,
} from "./actions";

export const metadata = {
  title: "Delivery & Mailroom | InductLite",
};

interface DeliveryPageProps {
  searchParams?: Promise<{
    site?: string;
    status?: string;
    flashMessage?: string;
    flashStatus?: string;
  }>;
}

const STATUS_FILTER_OPTIONS: DeliveryItemStatus[] = [
  "ARRIVED",
  "NOTIFIED",
  "COLLECTED",
  "RETURNED",
  "CANCELLED",
];

function parseDeliveryStatus(value: string | undefined): DeliveryItemStatus | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase() as DeliveryItemStatus;
  return STATUS_FILTER_OPTIONS.includes(normalized) ? normalized : undefined;
}

function bannerClass(statusCode: string | undefined): string {
  if (statusCode === "ok") {
    return "border-green-200 bg-green-50 text-green-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default async function DeliveryPage({ searchParams }: DeliveryPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();
  const statusFilter = parseDeliveryStatus(params.status);

  const [sites, deliveries] = await Promise.all([
    findAllSites(context.companyId),
    listDeliveryItems(context.companyId, {
      site_id: params.site || undefined,
      status: statusFilter,
      limit: 300,
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Delivery & Mailroom</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage inbound deliveries from arrival to recipient collection with an auditable timeline.
        </p>
      </div>

      {params.flashMessage ? (
        <div className={`rounded-lg border p-3 text-sm ${bannerClass(params.flashStatus)}`}>
          {params.flashMessage}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Log New Delivery
        </h2>
        <form action={createDeliveryItemAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
            Reference code (optional)
            <input
              name="referenceCode"
              maxLength={40}
              className="input mt-1"
              placeholder="DLV-..."
            />
          </label>
          <label className="text-sm text-gray-700">
            Carrier (optional)
            <input name="carrierName" maxLength={120} className="input mt-1" placeholder="NZ Post, Courier..." />
          </label>
          <label className="text-sm text-gray-700">
            Sender (optional)
            <input name="senderName" maxLength={120} className="input mt-1" placeholder="Supplier name" />
          </label>
          <label className="text-sm text-gray-700">
            Recipient name
            <input name="recipientName" required maxLength={120} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Recipient email (optional)
            <input name="recipientEmail" type="email" maxLength={200} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Recipient phone (optional)
            <input name="recipientPhone" maxLength={40} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Intended for (optional)
            <input name="intendedFor" maxLength={120} className="input mt-1" placeholder="Department/team" />
          </label>
          <label className="text-sm text-gray-700 md:col-span-3">
            Notes (optional)
            <textarea name="notes" maxLength={2000} rows={2} className="input mt-1" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
            <input
              name="notifyRecipient"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Queue recipient notification email now (if recipient email is set)
          </label>
          <div className="md:col-span-1 md:text-right">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Log Delivery
            </button>
          </div>
        </form>
      </section>

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
          <label className="text-sm text-gray-700">
            Status filter
            <select name="status" defaultValue={statusFilter ?? ""} className="input mt-1 min-w-[220px]">
              <option value="">All statuses</option>
              {STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
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
          Delivery Queue
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Arrived</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Reference</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Recipient</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Status</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-gray-500">
                    No delivery items found.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {delivery.arrived_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === delivery.site_id)?.name ?? delivery.site_id}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <code>{delivery.reference_code}</code>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <div className="font-medium">{delivery.recipient_name}</div>
                      {delivery.recipient_email ? <div className="text-xs text-gray-500">{delivery.recipient_email}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{delivery.status}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {delivery.status === "ARRIVED" ? (
                          <form action={transitionDeliveryItemAction}>
                            <input type="hidden" name="deliveryItemId" value={delivery.id} />
                            <input type="hidden" name="nextStatus" value="NOTIFIED" />
                            <button
                              type="submit"
                              className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Mark Notified
                            </button>
                          </form>
                        ) : null}

                        {(delivery.status === "ARRIVED" || delivery.status === "NOTIFIED") ? (
                          <form action={transitionDeliveryItemAction}>
                            <input type="hidden" name="deliveryItemId" value={delivery.id} />
                            <input type="hidden" name="nextStatus" value="COLLECTED" />
                            <button
                              type="submit"
                              className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Mark Collected
                            </button>
                          </form>
                        ) : null}

                        {(delivery.status === "ARRIVED" || delivery.status === "NOTIFIED") ? (
                          <form action={transitionDeliveryItemAction}>
                            <input type="hidden" name="deliveryItemId" value={delivery.id} />
                            <input type="hidden" name="nextStatus" value="RETURNED" />
                            <button
                              type="submit"
                              className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Mark Returned
                            </button>
                          </form>
                        ) : null}

                        {(delivery.status === "ARRIVED" || delivery.status === "NOTIFIED") ? (
                          <form action={transitionDeliveryItemAction}>
                            <input type="hidden" name="deliveryItemId" value={delivery.id} />
                            <input type="hidden" name="nextStatus" value="CANCELLED" />
                            <button
                              type="submit"
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <form action={addDeliveryNoteAction} className="mt-2 flex justify-end gap-2">
                        <input type="hidden" name="deliveryItemId" value={delivery.id} />
                        <input
                          name="note"
                          maxLength={500}
                          placeholder="Add note"
                          className="input h-8 w-44 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
