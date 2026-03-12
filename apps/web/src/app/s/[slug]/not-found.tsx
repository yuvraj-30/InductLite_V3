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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface-panel-strong w-full max-w-md p-8 text-center">
        <div className="mb-4 text-muted">
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
        <h1 className="kinetic-title mb-2 text-2xl font-black text-[color:var(--text-primary)]">
          Link Not Found
        </h1>
        <p className="mb-6 text-secondary">
          This sign-in link may have expired or been replaced. Please scan the
          current QR code at the site entrance, or contact the site manager for
          assistance.
        </p>
        <div className="space-y-3">
          <Link
            href="/"
            className="btn-secondary w-full"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
