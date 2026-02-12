import { requireAuthPageReadOnly } from "@/lib/auth";
import Link from "next/link";
import { NavLink } from "./nav-link";

/**
 * Admin Layout
 *
 * Shared layout for all admin pages with navigation sidebar.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthPageReadOnly();
  const canManageContractors =
    user.role === "ADMIN" || user.role === "SITE_MANAGER";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="text-xl font-bold text-gray-900">
              InductLite
            </Link>
            <span className="text-sm text-gray-500">|</span>
            <span className="text-sm text-gray-600">{user.companyName}</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {user.name}{" "}
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                {user.role}
              </span>
            </span>
            <Link
              href="/change-password"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Password
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="text-sm text-red-600 hover:text-red-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex">
        <nav className="min-h-[calc(100vh-73px)] w-64 border-r bg-white p-4">
          <ul className="space-y-1">
            <li>
              <NavLink href="/admin" exact>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink href="/admin/sites">Sites</NavLink>
            </li>
            <li>
              <NavLink href="/admin/live-register">Live Register</NavLink>
            </li>
            <li>
              <NavLink href="/admin/history">Sign-In History</NavLink>
            </li>
            <li>
              {canManageContractors ? (
                <NavLink href="/admin/contractors">Contractors</NavLink>
              ) : (
                <span className="block cursor-not-allowed rounded-md px-4 py-2 text-sm text-gray-400">
                  Contractors
                </span>
              )}
            </li>
            <li>
              <NavLink href="/admin/templates">Templates</NavLink>
            </li>
            {user.role === "ADMIN" && (
              <>
                <li className="mt-4 border-t pt-4">
                  <span className="block px-4 py-1 text-xs font-semibold uppercase text-gray-400">
                    Admin
                  </span>
                </li>
                <li>
                  <NavLink href="/admin/users">Users</NavLink>
                </li>
                <li>
                  <NavLink href="/admin/audit-log">Audit Log</NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
