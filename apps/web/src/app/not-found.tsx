import Link from "next/link";

/**
 * Global 404 Not Found Page
 *
 * Displayed when a route does not exist.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--bg-surface-strong)]">
            <span className="text-4xl font-bold text-muted">404</span>
          </div>
        </div>

        <h1 className="kinetic-title mb-2 text-2xl font-black text-[color:var(--text-primary)]">
          Page not found
        </h1>

        <p className="mb-8 text-secondary">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may
          have been moved or deleted.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="btn-primary px-6 py-3"
          >
            Go home
          </Link>

          <Link
            href="/admin"
            className="btn-secondary px-6 py-3"
          >
            Admin dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
