"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import {
  createExportFormAction,
  type ExportQueueActionState,
} from "./actions";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function SubmitButton(props: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={props.className}
    >
      {pending ? props.pendingLabel : props.label}
    </button>
  );
}

function QuickExportForm(props: {
  action: (payload: FormData) => void;
  exportType:
    | "SIGN_IN_CSV"
    | "INDUCTION_CSV"
    | "SITE_PACK_PDF"
    | "COMPLIANCE_ZIP";
  label: string;
  pendingLabel: string;
  className: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return (
    <form action={props.action}>
      <input type="hidden" name="exportType" value={props.exportType} />
      {props.dateFrom ? (
        <input type="hidden" name="dateFrom" value={props.dateFrom} />
      ) : null}
      {props.dateTo ? <input type="hidden" name="dateTo" value={props.dateTo} /> : null}
      <SubmitButton
        label={props.label}
        pendingLabel={props.pendingLabel}
        className={props.className}
      />
    </form>
  );
}

export function ExportQueuePanel() {
  const router = useRouter();
  const [state, formAction] = useActionState<ExportQueueActionState, FormData>(
    createExportFormAction,
    null,
  );
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const customDateFromIso = useMemo(() => {
    if (!customDateFrom) return "";
    const parsed = new Date(customDateFrom);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [customDateFrom]);
  const customDateToIso = useMemo(() => {
    if (!customDateTo) return "";
    const parsed = new Date(customDateTo);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [customDateTo]);
  const customRangeError =
    customDateFrom &&
    customDateTo &&
    customDateFromIso &&
    customDateToIso &&
    customDateFromIso > customDateToIso
      ? "Date range is invalid. 'From' must be earlier than 'To'."
      : null;

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state?.success, state?.success ? state.data.exportJobId : null]);

  const feedback =
    customRangeError
      ? { kind: "error" as const, text: customRangeError }
      : state
        ? state.success
          ? {
              kind: "success" as const,
              text:
                state.message || "Export queued. It will appear in the list below shortly.",
            }
          : {
              kind: "error" as const,
              text: state.error.message || "Could not queue export",
            }
        : null;

  return (
    <div className="surface-panel mb-6 p-4">
      <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
        Quick Export Actions
      </h2>
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
        <QuickExportForm
          action={formAction}
          exportType="SIGN_IN_CSV"
          label="Queue Sign-In CSV"
          pendingLabel="Queueing..."
          className="btn-primary disabled:opacity-50"
        />

        <QuickExportForm
          action={formAction}
          exportType="INDUCTION_CSV"
          label="Queue Induction CSV"
          pendingLabel="Queueing..."
          className="btn-secondary disabled:opacity-50"
        />

        <QuickExportForm
          action={formAction}
          exportType="SITE_PACK_PDF"
          dateFrom={isoHoursAgo(24)}
          dateTo={new Date().toISOString()}
          label="One-Click Audit Pack PDF (24h)"
          pendingLabel="Queueing..."
          className="btn-secondary disabled:opacity-50"
        />

        <QuickExportForm
          action={formAction}
          exportType="COMPLIANCE_ZIP"
          dateFrom={isoHoursAgo(24)}
          dateTo={new Date().toISOString()}
          label="Compliance Pack ZIP (24h)"
          pendingLabel="Queueing..."
          className="btn-secondary disabled:opacity-50"
        />

        <QuickExportForm
          action={formAction}
          exportType="COMPLIANCE_ZIP"
          dateFrom={isoHoursAgo(24 * 7)}
          dateTo={new Date().toISOString()}
          label="Compliance Pack ZIP (7d)"
          pendingLabel="Queueing..."
          className="btn-secondary disabled:opacity-50"
        />
      </div>

      <form
        action={formAction}
        className="field-section mt-4"
        onSubmit={(event) => {
          if (customRangeError) {
            event.preventDefault();
          }
        }}
      >
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
          <input type="hidden" name="exportType" value="COMPLIANCE_ZIP" />
          <input type="hidden" name="dateFrom" value={customDateFromIso} />
          <input type="hidden" name="dateTo" value={customDateToIso} />
          <SubmitButton
            label="Queue Compliance Pack (Range)"
            pendingLabel="Queueing..."
            className="btn-secondary disabled:opacity-50"
            disabled={
              !customDateFrom ||
              !customDateTo ||
              !customDateFromIso ||
              !customDateToIso ||
              Boolean(customRangeError)
            }
          />
        </div>
      </form>
    </div>
  );
}
