import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  countOutboundWebhookDeliveriesByStatus,
  findAllSites,
  listOutboundWebhookDeliveries,
} from "@/lib/repository";
import type { WebhookDeliveryStatus } from "@prisma/client";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

export const metadata = {
  title: "Webhook Deliveries | InductLite",
};

const WEBHOOK_STATUSES: WebhookDeliveryStatus[] = [
  "PENDING",
  "PROCESSING",
  "RETRYING",
  "SENT",
  "DEAD",
];

function parseStatus(value: string | undefined): WebhookDeliveryStatus | undefined {
  if (!value) return undefined;
  return WEBHOOK_STATUSES.includes(value as WebhookDeliveryStatus)
    ? (value as WebhookDeliveryStatus)
    : undefined;
}

function parseLimit(value: string | undefined): number {
  if (!value) return 100;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return Math.max(1, Math.min(parsed, 500));
}

function formatDateTime(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusChipClasses(status: WebhookDeliveryStatus): string {
  switch (status) {
    case "SENT":
      return "bg-emerald-100 text-emerald-800";
    case "DEAD":
      return "bg-red-100 text-red-800";
    case "RETRYING":
      return "bg-amber-100 text-amber-800";
    case "PROCESSING":
      return "bg-indigo-100 text-indigo-800";
    case "PENDING":
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export default async function AdminWebhookDeliveriesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    siteId?: string;
    status?: string;
    limit?: string;
  }>;
}) {
  const auth = await checkAuthReadOnly();
  if (!auth.success) {
    if (auth.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  if (auth.user.role !== "ADMIN" && auth.user.role !== "SITE_MANAGER") {
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const selectedStatus = parseStatus(params.status);
  const selectedSiteId = params.siteId?.trim() || undefined;
  const limit = parseLimit(params.limit);

  const context = await requireAuthenticatedContextReadOnly();
  try {
    await assertCompanyFeatureEnabled(context.companyId, "WEBHOOKS_OUTBOUND");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Webhook Deliveries</h1>
            <p className="mt-1 text-gray-600">
              Review outbound webhook delivery outcomes, retries, and dead-letter
              events.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Feature not enabled for this plan
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Outbound webhook deliveries are disabled by entitlements
              (CONTROL_ID: PLAN-ENTITLEMENT-001).
            </p>
          </div>
        </div>
      );
    }
    throw error;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [sites, deliveries, weeklyCounts] = await Promise.all([
    findAllSites(context.companyId),
    listOutboundWebhookDeliveries(context.companyId, {
      siteId: selectedSiteId,
      status: selectedStatus,
      limit,
    }),
    countOutboundWebhookDeliveriesByStatus(context.companyId, {
      since: sevenDaysAgo,
    }),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Webhook Deliveries</h1>
        <p className="mt-1 text-gray-600">
          Review outbound webhook delivery outcomes, retries, and dead-letter
          events.
        </p>
      </div>

      <section className="mb-6 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Last 7 Days Summary
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {WEBHOOK_STATUSES.map((status) => (
            <div
              key={status}
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <p className="text-xs uppercase tracking-[0.08em] text-gray-600">
                {status}
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {weeklyCounts[status]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Filters
        </h2>
        <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm text-gray-700">
            Site
            <select
              name="siteId"
              defaultValue={selectedSiteId ?? ""}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Status
            <select
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {WEBHOOK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Limit
            <input
              name="limit"
              type="number"
              min={1}
              max={500}
              defaultValue={limit}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Created
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Site
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Event
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Target
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Attempts
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Last Attempt
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Next Attempt
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                Last Error
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500">
                  No webhook deliveries found for the selected filters.
                </td>
              </tr>
            ) : (
              deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDateTime(delivery.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <Link
                      href={`/admin/sites/${delivery.site.id}/webhooks`}
                      className="text-blue-700 hover:text-blue-900"
                    >
                      {delivery.site.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {delivery.event_type}
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-sm text-gray-700">
                    <span className="block truncate" title={delivery.target_url}>
                      {delivery.target_url}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusChipClasses(delivery.status)}`}
                    >
                      {delivery.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {delivery.attempts}/{delivery.max_attempts}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDateTime(delivery.last_attempt_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {delivery.status === "SENT" || delivery.status === "DEAD"
                      ? "-"
                      : formatDateTime(delivery.next_attempt_at)}
                  </td>
                  <td className="max-w-[18rem] px-4 py-3 text-sm text-red-700">
                    <span className="block truncate" title={delivery.last_error ?? ""}>
                      {delivery.last_error || "-"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
