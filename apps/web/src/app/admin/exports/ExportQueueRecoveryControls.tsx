"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { runQueuedExportNowAction } from "./actions";

type Feedback = { kind: "success" | "error"; text: string } | null;

export function ExportQueueRecoveryControls(props: {
  hasQueuedJobs: boolean;
  delayedJobCount: number;
  oldestQueuedAgeMinutes: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleRunNow = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await runQueuedExportNowAction();
      if (!result.success) {
        setFeedback({
          kind: "error",
          text: result.error.message || "Could not run the export processor.",
        });
        return;
      }

      setFeedback({
        kind: "success",
        text: result.message || "Export processor finished.",
      });
    });
  };

  const oldestQueuedLabel =
    props.oldestQueuedAgeMinutes === null
      ? "No queued jobs"
      : `${Math.max(1, Math.ceil(props.oldestQueuedAgeMinutes))} minute(s)`;

  return (
    <div className="surface-panel mb-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
            Queue Recovery
          </h2>
          <p className="text-sm text-secondary">
            Oldest queued export: {oldestQueuedLabel}. Delayed jobs:{" "}
            {props.delayedJobCount}.
          </p>
          <p className="text-xs text-muted">
            Use this when a customer queued an export and the background scheduler has
            not moved it yet.
          </p>
        </div>

        <button
          type="button"
          disabled={isPending || !props.hasQueuedJobs}
          onClick={handleRunNow}
          className="btn-secondary disabled:opacity-50"
        >
          {isPending ? "Running..." : "Run Queue Now"}
        </button>
      </div>

      {feedback ? (
        <Alert
          variant={feedback.kind === "success" ? "success" : "error"}
          className="mt-3"
        >
          {feedback.text}
        </Alert>
      ) : null}
    </div>
  );
}
