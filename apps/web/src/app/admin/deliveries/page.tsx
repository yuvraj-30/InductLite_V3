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
    return "border-emerald-400/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  return "border-amber-400/45 bg-amber-500/12 text-amber-900 dark:text-amber-100";
}

function deliveryStatusChipClass(status: DeliveryItemStatus): string {
  switch (status) {
    case "ARRIVED":
      return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
    case "NOTIFIED":
      return "border-indigo-400/35 bg-indigo-500/15 text-indigo-950 dark:text-indigo-100";
    case "COLLECTED":
      return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
    case "RETURNED":
      return "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100";
    case "CANCELLED":
      return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
    default:
      return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary";
  }
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Delivery & Mailroom
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Manage inbound deliveries from arrival to recipient collection with an auditable timeline.
        </p>
      </div>

      {params.flashMessage ? (
        <div className={`rounded-xl border p-3 text-sm ${bannerClass(params.flashStatus)}`}>
          {params.flashMessage}
        </div>
      ) : null}

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Log New Delivery
        </h2>
        <form action={createDeliveryItemAction} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
            Reference code (optional)
            <input
              name="referenceCode"
              maxLength={40}
              className="input mt-1"
              placeholder="DLV-..."
            />
          </label>
          <label className="text-sm text-secondary">
            Carrier (optional)
            <input name="carrierName" maxLength={120} className="input mt-1" placeholder="NZ Post, Courier..." />
          </label>
          <label className="text-sm text-secondary">
            Sender (optional)
            <input name="senderName" maxLength={120} className="input mt-1" placeholder="Supplier name" />
          </label>
          <label className="text-sm text-secondary">
            Recipient name
            <input name="recipientName" required maxLength={120} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Recipient email (optional)
            <input name="recipientEmail" type="email" maxLength={200} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Recipient phone (optional)
            <input name="recipientPhone" maxLength={40} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Intended for (optional)
            <input name="intendedFor" maxLength={120} className="input mt-1" placeholder="Department/team" />
          </label>
          <label className="text-sm text-secondary md:col-span-3">
            Notes (optional)
            <textarea name="notes" maxLength={2000} rows={2} className="input mt-1" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-secondary md:col-span-2">
            <input
              name="notifyRecipient"
              type="checkbox"
              className="h-4 w-4 rounded border-[color:var(--border-soft)]"
            />
            Queue recipient notification email now (if recipient email is set)
          </label>
          <div className="md:col-span-1 md:text-right">
            <button
              type="submit"
              className="btn-primary"
            >
              Log Delivery
            </button>
          </div>
        </form>
      </section>

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
          <label className="text-sm text-secondary">
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
          <div className="table-toolbar-actions">
            <button type="submit" className="btn-primary">
              Apply
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Delivery Queue
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">Arrived</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">Site</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">Reference</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">Recipient</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">Status</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-secondary">
                    No delivery items found.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      {delivery.arrived_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {sites.find((site) => site.id === delivery.site_id)?.name ?? delivery.site_id}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      <code className="rounded bg-[color:var(--bg-surface-strong)] px-1.5 py-0.5 text-xs text-[color:var(--text-primary)]">
                        {delivery.reference_code}
                      </code>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      <div className="font-semibold text-[color:var(--text-primary)]">
                        {delivery.recipient_name}
                      </div>
                      {delivery.recipient_email ? <div className="text-xs text-muted">{delivery.recipient_email}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${deliveryStatusChipClass(delivery.status)}`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {delivery.status === "ARRIVED" ? (
                          <form action={transitionDeliveryItemAction}>
                            <input type="hidden" name="deliveryItemId" value={delivery.id} />
                            <input type="hidden" name="nextStatus" value="NOTIFIED" />
                            <button
                              type="submit"
                              className="rounded-lg border border-indigo-400/45 bg-indigo-500/12 px-2 py-1 text-xs font-semibold text-indigo-950 hover:bg-indigo-500/20 dark:text-indigo-100"
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
                              className="rounded-lg border border-emerald-400/40 bg-emerald-500/12 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-100"
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
                              className="rounded-lg border border-amber-400/45 bg-amber-500/12 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
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
                              className="btn-secondary min-h-[30px] px-2 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <form action={addDeliveryNoteAction} className="mt-2 flex w-full flex-col justify-end gap-2 sm:flex-row">
                        <input type="hidden" name="deliveryItemId" value={delivery.id} />
                        <input
                          name="note"
                          maxLength={500}
                          placeholder="Add note"
                          className="input h-8 w-full text-xs sm:w-44"
                        />
                        <button
                          type="submit"
                          className="btn-secondary min-h-[32px] px-2 py-1 text-xs"
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

