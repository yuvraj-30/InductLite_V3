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
        <p>
          {footerText || (
            <>
              Powered by{" "}
              <Link href="/" className="font-medium text-blue-700 hover:underline">
                InductLite
              </Link>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
