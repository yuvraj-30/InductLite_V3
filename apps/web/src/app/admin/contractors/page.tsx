import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { listContractors } from "@/lib/repository";
import { redirect } from "next/navigation";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContractorActionButtons } from "./contractor-action-buttons";
import { PageEmptyState } from "@/components/ui/page-state";

export const metadata = {
  title: "Contractors | InductLite",
};

const PAGE_SIZE = 20;

interface ContractorsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    trade?: string;
    status?: string;
  }>;
}

function parsePositiveInt(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  return Math.min(Math.max(page, 1), totalPages);
}

function buildPageHref(
  page: number,
  filters: { search?: string; trade?: string; status?: string },
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (filters.search) params.set("search", filters.search);
  if (filters.trade) params.set("trade", filters.trade);
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  return `/admin/contractors?${params.toString()}`;
}

export default async function ContractorsPage({
  searchParams,
}: ContractorsPageProps) {
  const guard = await checkPermissionReadOnly("contractor:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const params = await searchParams;

  const page = parsePositiveInt(params.page, 1);
  const search = params.search?.trim();
  const trade = params.trade?.trim();
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";

  const [result, activeSummary, inactiveSummary] = await Promise.all([
    listContractors(
      context.companyId,
      {
        ...(search ? { name: search } : {}),
        ...(trade ? { trade } : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
      },
      { page, pageSize: PAGE_SIZE },
    ),
    listContractors(context.companyId, { isActive: true }, { pageSize: 1 }),
    listContractors(context.companyId, { isActive: false }, { pageSize: 1 }),
  ]);

  const currentPage = clampPage(page, result.totalPages);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Contractors
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage contractor companies and contacts for your sites.
          </p>
        </div>
        <Link
          href="/admin/contractors/new"
          className="btn-primary w-full sm:w-auto"
        >
          Add Contractor
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Total Contractors
          </p>
          <p className="mt-1 text-2xl font-black text-[color:var(--text-primary)]">
            {activeSummary.total + inactiveSummary.total}
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Active
          </p>
          <p className="mt-1 text-2xl font-black text-[color:var(--accent-success)]">
            {activeSummary.total}
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Inactive
          </p>
          <p className="mt-1 text-2xl font-black text-secondary">
            {inactiveSummary.total}
          </p>
        </div>
      </div>

      <form
        action="/admin/contractors"
        method="get"
        className="table-toolbar"
      >
        <div className="table-toolbar-heading">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            Filter Contractors
          </h2>
        </div>
        <div className="table-toolbar-grid">
          <div>
            <label htmlFor="search" className="label">
              Search contractor
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={search}
              placeholder="Name"
              maxLength={120}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="trade" className="label">
              Trade
            </label>
            <input
              id="trade"
              name="trade"
              type="text"
              defaultValue={trade}
              placeholder="Electrician"
              maxLength={120}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="input mt-1"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="table-toolbar-actions">
            <button
              type="submit"
              className="btn-primary"
            >
              Apply
            </button>
            <Link
              href="/admin/contractors"
              className="btn-secondary"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      {result.items.length === 0 ? (
        <PageEmptyState
          title="No contractors found"
          description="Try adjusting your filters or add a new contractor."
          actionHref="/admin/contractors/new"
          actionLabel="Add Contractor"
        />
      ) : (
        <DataTableShell>
          <DataTableScroll>
            <DataTable className="min-w-[920px]">
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>
                  Contractor
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  Contact
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  Trade
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  Status
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                  Added
                  </DataTableHeadCell>
                  <DataTableHeadCell className="text-right">
                  Actions
                  </DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
              {result.items.map((contractor) => (
                <DataTableRow key={contractor.id}>
                  <DataTableCell>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {contractor.name}
                    </p>
                    <p className="break-all text-xs text-muted">
                      {contractor.id}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <p>{contractor.contact_name || "Not set"}</p>
                    <p className="break-all text-xs text-muted">
                      {contractor.contact_email || contractor.contact_phone || "-"}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    {contractor.trade || "-"}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={contractor.is_active ? "success" : "neutral"}>
                      {contractor.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-muted">
                    {contractor.created_at.toLocaleDateString("en-NZ")}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/contractors/${contractor.id}`}
                        className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs"
                      >
                        Edit
                      </Link>
                      <ContractorActionButtons
                        contractorId={contractor.id}
                        contractorName={contractor.name}
                        isActive={contractor.is_active}
                      />
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          Showing {result.items.length} of {result.total} contractor
          {result.total === 1 ? "" : "s"}
        </p>
        {result.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Link
              href={buildPageHref(Math.max(currentPage - 1, 1), {
                search,
                trade,
                status,
              })}
              aria-disabled={currentPage === 1}
              className={`btn-secondary min-h-[38px] px-3 py-1.5 text-sm ${
                currentPage === 1
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              Previous
            </Link>
            <span className="text-sm text-secondary">
              Page {currentPage} of {result.totalPages}
            </span>
            <Link
              href={buildPageHref(
                Math.min(currentPage + 1, result.totalPages),
                { search, trade, status },
              )}
              aria-disabled={currentPage === result.totalPages}
              className={`btn-secondary min-h-[38px] px-3 py-1.5 text-sm ${
                currentPage === result.totalPages
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              Next
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

