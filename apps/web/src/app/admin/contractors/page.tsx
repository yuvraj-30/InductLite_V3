import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { listContractors } from "@/lib/repository";
import { redirect } from "next/navigation";

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contractors</h1>
        <p className="mt-1 text-gray-600">
          Manage contractor companies and contacts for your sites.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Total Contractors</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {activeSummary.total + inactiveSummary.total}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">
            {activeSummary.total}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="mt-1 text-2xl font-semibold text-gray-700">
            {inactiveSummary.total}
          </p>
        </div>
      </div>

      <form
        action="/admin/contractors"
        method="get"
        className="rounded-lg border bg-white p-4 mb-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700"
            >
              Search contractor
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={search}
              placeholder="Name"
              maxLength={120}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="trade"
              className="block text-sm font-medium text-gray-700"
            >
              Trade
            </label>
            <input
              id="trade"
              name="trade"
              type="text"
              defaultValue={trade}
              placeholder="Electrician"
              maxLength={120}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply
            </button>
            <Link
              href="/admin/contractors"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-medium text-gray-900">
            No contractors found
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your filters.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Contractor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Trade
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {result.items.map((contractor) => (
                <tr key={contractor.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {contractor.name}
                    </p>
                    <p className="text-xs text-gray-500">{contractor.id}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <p>{contractor.contact_name || "Not set"}</p>
                    <p className="text-xs text-gray-500">
                      {contractor.contact_email || contractor.contact_phone || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {contractor.trade || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        contractor.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {contractor.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {contractor.created_at.toLocaleDateString("en-NZ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
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
              className={`rounded-md border px-3 py-1.5 text-sm ${
                currentPage === 1
                  ? "pointer-events-none cursor-not-allowed text-gray-400"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Previous
            </Link>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {result.totalPages}
            </span>
            <Link
              href={buildPageHref(
                Math.min(currentPage + 1, result.totalPages),
                { search, trade, status },
              )}
              aria-disabled={currentPage === result.totalPages}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                currentPage === result.totalPages
                  ? "pointer-events-none cursor-not-allowed text-gray-400"
                  : "text-gray-700 hover:bg-gray-50"
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
