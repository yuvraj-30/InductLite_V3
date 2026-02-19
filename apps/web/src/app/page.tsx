import Link from "next/link";

// Nonce-based CSP requires runtime rendering so Next can attach per-request nonce
// attributes to inline hydration scripts.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="card w-full max-w-md text-center">
        <div className="mb-6">
          <h1 className="text-gray-900">InductLite</h1>
          <p className="mt-2 text-gray-600">
            Site Induction Management for NZ Construction
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/login" className="btn-primary w-full">
            Admin Login
          </Link>

          <p className="text-sm text-gray-700">
            Scan a site QR code to sign in as a visitor
          </p>
        </div>

        <div className="mt-8 border-t pt-4">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} InductLite. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}

