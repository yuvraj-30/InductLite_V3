/**
 * Not Found Page for Invalid/Expired Public Slugs
 *
 * Shown when:
 * - Slug doesn't exist
 * - Link has been deactivated
 * - Link has expired
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg
            className="mx-auto h-16 w-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Link Not Found
        </h1>
        <p className="text-gray-600 mb-6">
          This sign-in link may have expired or been replaced. Please scan the
          current QR code at the site entrance, or contact the site manager for
          assistance.
        </p>
        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
