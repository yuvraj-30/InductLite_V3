import { requireAuthPageReadOnly } from "@/lib/auth";
import Link from "next/link";

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
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
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {user.role}
              </span>
            </span>
            <Link
              href="/change-password"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Password
            </Link>
            <Link
              href="/logout"
              className="text-sm text-red-600 hover:text-red-700"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white border-r min-h-[calc(100vh-73px)] p-4">
          <ul className="space-y-1">
            <li>
              <Link
                href="/admin"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                📊 Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/admin/sites"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                🏗️ Sites
              </Link>
            </li>
            <li>
              <Link
                href="/admin/live-register"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                📍 Live Register
              </Link>
            </li>
            <li>
              <Link
                href="/admin/history"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                📜 Sign-In History
              </Link>
            </li>
            <li>
              <Link
                href="/admin/contractors"
                className="block px-4 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-md"
              >
                🔧 Contractors
              </Link>
            </li>
            <li>
              <Link
                href="/admin/templates"
                className="block px-4 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-md"
              >
                📋 Templates
              </Link>
            </li>
            {user.role === "ADMIN" && (
              <>
                <li className="pt-4 border-t mt-4">
                  <span className="block px-4 py-1 text-xs font-semibold text-gray-400 uppercase">
                    Admin
                  </span>
                </li>
                <li>
                  <Link
                    href="/admin/users"
                    className="block px-4 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-md"
                  >
                    👥 Users
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/audit"
                    className="block px-4 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-md"
                  >
                    📜 Audit Log
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
