"use client";

import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setRetrying(true);
      window.location.reload();
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">You are offline.</h1>
        <p className="mt-3 text-sm text-slate-600">
          Please check your internet connection to sign in.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={retrying}
        >
          {retrying ? "Retrying..." : "Retry Now"}
        </button>
      </section>
    </main>
  );
}
