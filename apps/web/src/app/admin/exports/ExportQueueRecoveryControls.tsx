"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import {
  runQueuedExportNowFormAction,
  type ExportQueueRecoveryActionState,
} from "./actions";

function RunQueueButton(props: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className="btn-secondary disabled:opacity-50"
    >
      {pending ? "Running..." : "Run Queue Now"}
    </button>
  );
}

export function ExportQueueRecoveryControls(props: {
  hasQueuedJobs: boolean;
  delayedJobCount: number;
  oldestQueuedAgeMinutes: number | null;
}) {
  const router = useRouter();
  const [state, formAction] =
    useActionState<ExportQueueRecoveryActionState, FormData>(
      runQueuedExportNowFormAction,
      null,
    );

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state?.success, state?.success ? state.data.exportJobId ?? "noop" : null]);

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

        <form action={formAction}>
          <RunQueueButton disabled={!props.hasQueuedJobs} />
        </form>
      </div>

      {state ? (
        <Alert
          variant={state.success ? "success" : "error"}
          className="mt-3"
        >
          {state.success
            ? state.message || "Export processor finished."
            : state.error.message || "Could not run the export processor."}
        </Alert>
      ) : null}
    </div>
  );
}
