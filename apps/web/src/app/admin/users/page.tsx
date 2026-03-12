import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { listUsers } from "@/lib/repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { UserActionButtons } from "./user-action-buttons";
import { statusChipClass } from "../components/status-chip";
import { PageEmptyState } from "@/components/ui/page-state";

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
  if (role === "ADMIN") {
    return statusChipClass("danger");
  }
  if (role === "SITE_MANAGER") {
    return statusChipClass("info");
  }
  return statusChipClass("neutral");
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Users
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage authenticated users and role assignments.
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="btn-primary w-full sm:w-auto"
        >
          Add User
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Total Users
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

      <form action="/admin/users" method="get" className="table-toolbar">
        <div className="table-toolbar-heading">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            Filter Users
          </h2>
        </div>
        <div className="table-toolbar-grid md:grid-cols-6">
          <div className="md:col-span-2">
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={name}
              maxLength={120}
              className="input mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="text"
              defaultValue={email}
              maxLength={160}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="role" className="label">
              Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue={role || ""}
              className="input mt-1"
            >
              <option value="">All</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SITE_MANAGER">SITE_MANAGER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
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
        </div>
        <div className="table-toolbar-footer">
          <div className="table-toolbar-actions">
            <button type="submit" className="btn-primary">
              Apply
            </button>
            <Link href="/admin/users" className="btn-secondary">
              Reset
            </Link>
          </div>
        </div>
      </form>

      {result.items.length === 0 ? (
        <PageEmptyState
          title="No users found"
          description="Try adjusting your filters or add a new user."
          actionHref="/admin/users/new"
          actionLabel="Add User"
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <table className="min-w-[920px] divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Last Login
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {result.items.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-[color:var(--bg-surface-strong)]"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {user.name}
                      {user.id === context.userId ? (
                        <span
                          className={`ml-2 ${statusChipClass("info")}`}
                        >
                          You
                        </span>
                      ) : null}
                    </p>
                    <p className="break-all text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={roleBadgeClass(user.role)}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={statusChipClass(
                        user.is_active ? "success" : "neutral",
                      )}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary">
                    {user.last_login_at
                      ? user.last_login_at.toLocaleString("en-NZ")
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary">
                    {user.created_at.toLocaleDateString("en-NZ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs"
                      >
                        Edit
                      </Link>
                      <UserActionButtons
                        userId={user.id}
                        userName={user.name}
                        isActive={user.is_active}
                        isCurrentUser={user.id === context.userId}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
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
                { name, email, role, status },
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
