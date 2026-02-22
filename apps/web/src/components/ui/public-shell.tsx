import Link from "next/link";
import type { ReactNode } from "react";

interface PublicShellProps {
  brand: string;
  subtitle: string;
  children: ReactNode;
  footerText?: string;
  className?: string;
}

export function PublicShell({
  brand,
  subtitle,
  children,
  footerText,
  className = "",
}: PublicShellProps) {
  return (
    <div className={`min-h-screen bg-gray-100 ${className}`.trim()}>
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="mx-auto max-w-lg px-4 py-4">
          <h1 className="text-xl font-bold">{brand}</h1>
          <p className="text-sm text-blue-50">{subtitle}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>

      <footer className="py-4 text-center text-sm text-gray-600">
        {footerText ? (
          <p>{footerText}</p>
        ) : (
          <p className="flex flex-wrap items-center justify-center gap-2">
            <span>Powered by</span>
            <Link href="/" className="font-medium text-blue-700 hover:underline">
              InductLite
            </Link>
            <span aria-hidden="true">|</span>
            <Link href="/terms" className="text-blue-700 hover:underline">
              Terms
            </Link>
            <span aria-hidden="true">|</span>
            <Link href="/privacy" className="text-blue-700 hover:underline">
              Privacy
            </Link>
            <span aria-hidden="true">|</span>
            <a
              href="mailto:support@inductlite.nz"
              className="text-blue-700 hover:underline"
            >
              Support
            </a>
          </p>
        )}
      </footer>
    </div>
  );
}
