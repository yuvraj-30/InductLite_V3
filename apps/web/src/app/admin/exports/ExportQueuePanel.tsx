"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { createExportAction } from "./actions";

type Feedback = { kind: "success" | "error"; text: string } | null;

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function ExportQueuePanel() {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

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
    startTransition(async () => {
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
    });
  };

  return (
    <div className="surface-panel mb-6 p-4">
      <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">Quick Export Actions</h2>
      <p className="mt-1 text-sm text-secondary">
        Use one click for common auditor requests, including full compliance packs.
      </p>

      {feedback ? (
        <Alert
          variant={feedback.kind === "success" ? "success" : "error"}
          className="mt-3"
        >
          {feedback.text}
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => queueExport({ exportType: "SIGN_IN_CSV" })}
          className="btn-primary"
        >
          {isPending ? "Queueing..." : "Queue Sign-In CSV"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => queueExport({ exportType: "INDUCTION_CSV" })}
          className="btn-secondary disabled:opacity-50"
        >
          Queue Induction CSV
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            queueExport({
              exportType: "SITE_PACK_PDF",
              dateFrom: isoHoursAgo(24),
              dateTo: new Date().toISOString(),
            })
          }
          className="btn-secondary disabled:opacity-50"
        >
          One-Click Audit Pack PDF (24h)
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            queueExport({
              exportType: "COMPLIANCE_ZIP",
              dateFrom: isoHoursAgo(24),
              dateTo: new Date().toISOString(),
            })
          }
          className="btn-secondary disabled:opacity-50"
        >
          Compliance Pack ZIP (24h)
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            queueExport({
              exportType: "COMPLIANCE_ZIP",
              dateFrom: isoHoursAgo(24 * 7),
              dateTo: new Date().toISOString(),
            })
          }
          className="btn-secondary disabled:opacity-50"
        >
          Compliance Pack ZIP (7d)
        </button>
      </div>

      <div className="field-section mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Custom Date Range
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-secondary">
            From
            <input
              type="datetime-local"
              value={customDateFrom}
              onChange={(event) => setCustomDateFrom(event.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-secondary">
            To
            <input
              type="datetime-local"
              value={customDateTo}
              onChange={(event) => setCustomDateTo(event.target.value)}
              className="input mt-1"
            />
          </label>
          <button
            type="button"
            disabled={isPending || !customDateFrom || !customDateTo}
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
            className="btn-secondary disabled:opacity-50"
          >
            Queue Compliance Pack (Range)
          </button>
        </div>
      </div>
    </div>
  );
}


