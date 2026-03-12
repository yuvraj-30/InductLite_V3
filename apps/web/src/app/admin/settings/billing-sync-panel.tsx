"use client";

import { useState, useTransition } from "react";
import { syncBillingPreviewAction } from "./actions";

interface BillingSyncPanelProps {
  endpointHost: string | null;
}

export default function BillingSyncPanel({ endpointHost }: BillingSyncPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const endpointConfigured = Boolean(endpointHost);

  const handleSync = () => {
    setResult(null);
    startTransition(async () => {
      const response = await syncBillingPreviewAction();
      if (response.success) {
        setResult({
          success: true,
          message: `Synced to ${response.endpointHost} (${response.payloadBytes} bytes, HTTP ${response.statusCode}).`,
        });
        return;
      }

      setResult({
        success: false,
        message: response.error,
      });
    });
  };

  return (
    <section className="surface-panel p-4">
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Accounting Sync</h2>
      <p className="mt-1 text-sm text-secondary">
        Push the current monthly billing preview to your configured accounting endpoint.
      </p>

      <div className="mt-3 rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3 text-sm text-secondary">
        Endpoint:{" "}
        <span className="font-medium">
          {endpointConfigured ? endpointHost : "Not configured"}
        </span>
      </div>

      {result && (
        <div
          className={`mt-3 rounded-md border p-3 text-sm ${
            result.success
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSync}
          disabled={isPending || !endpointConfigured}
          className="btn-primary"
        >
          {isPending ? "Syncing..." : "Sync Billing Preview"}
        </button>
      </div>
    </section>
  );
}

