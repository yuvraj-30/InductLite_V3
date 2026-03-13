"use client";

import { useState, useTransition } from "react";
import { createExportAction } from "./actions";

type Feedback = { kind: "success" | "error"; text: string } | null;

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function ExportQueuePanel() {
  const [isPending, startTransition] = useTransition();
  const [isQueueing, setIsQueueing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const controlsDisabled = isPending || isQueueing;

  const syncCustomDateFrom = (value: string) => {
    setCustomDateFrom(value);
  };

  const syncCustomDateTo = (value: string) => {
    setCustomDateTo(value);
  };

  const queueExport = (input: {
    exportType:
      | "SIGN_IN_CSV"
      | "INDUCTION_CSV"
      | "SITE_PACK_PDF"
      | "COMPLIANCE_ZIP";
    dateFrom?: string;
    dateTo?: string;
  }) => {
    setFeedback(null);
    setIsQueueing(true);
    startTransition(async () => {
      try {
        const result = await createExportAction(input);
        if (!result.success) {
          setFeedback({
            kind: "error",
            text: result.error.message || "Could not queue export",
          });
          return;
        }
        setFeedback({
          kind: "success",
          text: "Export queued. It will appear in the list below shortly.",
        });
      } finally {
        setIsQueueing(false);
      }
    });
  };

  return (
    <div className="surface-panel mb-6 p-4">
      <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">Quick Export Actions</h2>
      <p className="mt-1 text-sm text-secondary">
        Use one click for common auditor requests, including full compliance packs.
      </p>

      {feedback && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            feedback.kind === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role="alert"
        >
          {feedback.text}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => queueExport({ exportType: "SIGN_IN_CSV" })}
          className="btn-primary"
        >
          {controlsDisabled ? "Queueing..." : "Queue Sign-In CSV"}
        </button>

        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => queueExport({ exportType: "INDUCTION_CSV" })}
          className="btn-secondary disabled:opacity-50"
        >
          Queue Induction CSV
        </button>

        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() =>
            queueExport({
              exportType: "SITE_PACK_PDF",
              dateFrom: isoHoursAgo(24),
              dateTo: new Date().toISOString(),
            })
          }
          className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          One-Click Audit Pack PDF (24h)
        </button>

        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() =>
            queueExport({
              exportType: "COMPLIANCE_ZIP",
              dateFrom: isoHoursAgo(24),
              dateTo: new Date().toISOString(),
            })
          }
          className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
        >
          Compliance Pack ZIP (24h)
        </button>

        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() =>
            queueExport({
              exportType: "COMPLIANCE_ZIP",
              dateFrom: isoHoursAgo(24 * 7),
              dateTo: new Date().toISOString(),
            })
          }
          className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
        >
          Compliance Pack ZIP (7d)
        </button>
      </div>

      <div className="mt-4 rounded-md border border-[color:var(--border-soft)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Custom Date Range
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-secondary">
            From
            <input
              type="datetime-local"
              value={customDateFrom}
              onChange={(event) => syncCustomDateFrom(event.currentTarget.value)}
              onInput={(event) => syncCustomDateFrom(event.currentTarget.value)}
              className="mt-1 block rounded-md border border-[color:var(--border-soft)] px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-secondary">
            To
            <input
              type="datetime-local"
              value={customDateTo}
              onChange={(event) => syncCustomDateTo(event.currentTarget.value)}
              onInput={(event) => syncCustomDateTo(event.currentTarget.value)}
              className="mt-1 block rounded-md border border-[color:var(--border-soft)] px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={controlsDisabled || !customDateFrom || !customDateTo}
            onClick={() => {
              const fromIso = new Date(customDateFrom).toISOString();
              const toIso = new Date(customDateTo).toISOString();
              if (fromIso > toIso) {
                setFeedback({
                  kind: "error",
                  text: "Date range is invalid. 'From' must be earlier than 'To'.",
                });
                return;
              }

              queueExport({
                exportType: "COMPLIANCE_ZIP",
                dateFrom: fromIso,
                dateTo: toIso,
              });
            }}
            className="inline-flex items-center rounded-md border border-indigo-300 bg-[color:var(--bg-surface)] px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            Queue Compliance Pack (Range)
          </button>
        </div>
      </div>
    </div>
  );
}


