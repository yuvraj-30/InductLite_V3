import Link from "next/link";

/**
 * Unauthorized Page
 *
 * Shown when a user tries to access a resource they don't have permission for.
 */
export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-6 text-red-500">
          <svg
            className="mx-auto h-14 w-14"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3z"
            />
          </svg>
        </div>

        <h1 className="mb-4 text-3xl font-bold text-gray-900">Access Denied</h1>

        <p className="mb-8 text-gray-600">
          You don&apos;t have permission to access this page. Contact your
          administrator if you believe this is an error.
        </p>

        <div className="space-y-4">
          <Link href="/admin/dashboard" className="btn-primary block w-full">
            Go to Dashboard
          </Link>

          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn-secondary block w-full">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
