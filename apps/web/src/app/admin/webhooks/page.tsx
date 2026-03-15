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
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { PageWarningState } from "@/components/ui/page-state";

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

function statusBadgeTone(status: WebhookDeliveryStatus): StatusBadgeTone {
  switch (status) {
    case "SENT":
      return "success";
    case "DEAD":
      return "danger";
    case "RETRYING":
      return "warning";
    case "PROCESSING":
      return "accent";
    case "PENDING":
    default:
      return "neutral";
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
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Webhook Deliveries
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Review outbound webhook delivery outcomes, retries, and dead-letter
              events.
            </p>
          </div>
          <PageWarningState
            title="Feature not enabled for this plan."
            description="Outbound webhook deliveries are disabled by entitlements (CONTROL_ID: PLAN-ENTITLEMENT-001)."
          />
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Webhook Deliveries
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Review outbound webhook delivery outcomes, retries, and dead-letter
          events.
        </p>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Last 7 Days Summary
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {WEBHOOK_STATUSES.map((status) => (
            <div
              key={status}
              className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2"
            >
              <p className="text-xs uppercase tracking-[0.08em] text-secondary">
                {status}
              </p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
                {weeklyCounts[status]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="table-toolbar">
        <div className="table-toolbar-heading">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            Filters
          </h2>
        </div>
        <form className="table-toolbar-grid">
          <label className="text-sm text-secondary">
            Site
            <select
              name="siteId"
              defaultValue={selectedSiteId ?? ""}
              className="input mt-1"
            >
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
            <select
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="input mt-1"
            >
              <option value="">All statuses</option>
              {WEBHOOK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Limit
            <input
              name="limit"
              type="number"
              min={1}
              max={500}
              defaultValue={limit}
              className="input mt-1"
            />
          </label>
          <div className="table-toolbar-actions">
            <button
              type="submit"
              className="btn-primary"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <DataTableShell>
        <DataTableScroll>
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHeadCell>
                Created
                </DataTableHeadCell>
                <DataTableHeadCell>
                Site
                </DataTableHeadCell>
                <DataTableHeadCell>
                Event
                </DataTableHeadCell>
                <DataTableHeadCell>
                Target
                </DataTableHeadCell>
                <DataTableHeadCell>
                Status
                </DataTableHeadCell>
                <DataTableHeadCell className="text-right">
                Attempts
                </DataTableHeadCell>
                <DataTableHeadCell>
                Last Attempt
                </DataTableHeadCell>
                <DataTableHeadCell>
                Next Attempt
                </DataTableHeadCell>
                <DataTableHeadCell>
                Last Error
                </DataTableHeadCell>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
            {deliveries.length === 0 ? (
              <DataTableEmptyRow colSpan={9}>
                No webhook deliveries found for the selected filters.
              </DataTableEmptyRow>
            ) : (
              deliveries.map((delivery) => (
                <DataTableRow key={delivery.id}>
                  <DataTableCell>
                    {formatDateTime(delivery.created_at)}
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={`/admin/sites/${delivery.site.id}/webhooks`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {delivery.site.name}
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="text-[color:var(--text-primary)]">
                    {delivery.event_type}
                  </DataTableCell>
                  <DataTableCell className="max-w-[16rem]">
                    <span className="block truncate" title={delivery.target_url}>
                      {delivery.target_url}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={statusBadgeTone(delivery.status)}>
                      {delivery.status}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {delivery.attempts}/{delivery.max_attempts}
                  </DataTableCell>
                  <DataTableCell>
                    {formatDateTime(delivery.last_attempt_at)}
                  </DataTableCell>
                  <DataTableCell>
                    {delivery.status === "SENT" || delivery.status === "DEAD"
                      ? "-"
                      : formatDateTime(delivery.next_attempt_at)}
                  </DataTableCell>
                  <DataTableCell className="max-w-[18rem] text-red-900 dark:text-red-100">
                    <span className="block truncate" title={delivery.last_error ?? ""}>
                      {delivery.last_error || "-"}
                    </span>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
            </DataTableBody>
          </DataTable>
        </DataTableScroll>
      </DataTableShell>
    </div>
  );
}
