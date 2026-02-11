import Link from "next/link";

/**
 * Unauthorized Page
 *
 * Shown when a user tries to access a resource they don't have permission for.
 */
export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="text-6xl">🚫</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>

        <p className="text-gray-600 mb-8">
          You don&apos;t have permission to access this page. Please contact
          your administrator if you believe this is an error.
        </p>

        <div className="space-y-4">
          <Link
            href="/admin/dashboard"
            className="block w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/logout"
            className="block w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Sign Out
          </Link>
        </div>
      </div>
    </div>
  );
}
