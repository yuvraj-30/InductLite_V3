import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { listUsers } from "@/lib/repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Users | InductLite",
};

const PAGE_SIZE = 20;

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    name?: string;
    email?: string;
    role?: string;
    status?: string;
  }>;
}

function parsePositiveInt(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseRole(input: string | undefined): UserRole | undefined {
  if (!input) return undefined;
  if (input === "ADMIN" || input === "SITE_MANAGER" || input === "VIEWER") {
    return input;
  }
  return undefined;
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  return Math.min(Math.max(page, 1), totalPages);
}

function buildPageHref(
  page: number,
  filters: {
    name?: string;
    email?: string;
    role?: string;
    status?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (filters.name) params.set("name", filters.name);
  if (filters.email) params.set("email", filters.email);
  if (filters.role) params.set("role", filters.role);
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  return `/admin/users?${params.toString()}`;
}

function roleBadgeClass(role: UserRole): string {
  if (role === "ADMIN") return "bg-red-100 text-red-800";
  if (role === "SITE_MANAGER") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-700";
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const guard = await checkPermissionReadOnly("user:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const params = await searchParams;

  const page = parsePositiveInt(params.page, 1);
  const name = params.name?.trim();
  const email = params.email?.trim();
  const role = parseRole(params.role);
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";

  const [result, activeSummary, inactiveSummary] = await Promise.all([
    listUsers(
      context.companyId,
      {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(role ? { role } : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
      },
      { page, pageSize: PAGE_SIZE },
    ),
    listUsers(context.companyId, { isActive: true }, { pageSize: 1 }),
    listUsers(context.companyId, { isActive: false }, { pageSize: 1 }),
  ]);

  const currentPage = clampPage(page, result.totalPages);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-gray-600">
          Manage authenticated users and role assignments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Total Users</p>
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
        action="/admin/users"
        method="get"
        className="rounded-lg border bg-white p-4 mb-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={name}
              maxLength={120}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="text"
              defaultValue={email}
              maxLength={160}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700"
            >
              Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue={role || ""}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SITE_MANAGER">SITE_MANAGER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
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
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          <Link
            href="/admin/users"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </Link>
        </div>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-medium text-gray-900">No users found</h2>
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
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Last Login
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {result.items.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {user.name}
                      {user.id === context.userId ? (
                        <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                          You
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass(user.role)}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {user.last_login_at
                      ? user.last_login_at.toLocaleString("en-NZ")
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {user.created_at.toLocaleDateString("en-NZ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing {result.items.length} of {result.total} user
          {result.total === 1 ? "" : "s"}
        </p>
        {result.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Link
              href={buildPageHref(Math.max(currentPage - 1, 1), {
                name,
                email,
                role,
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
                { name, email, role, status },
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
