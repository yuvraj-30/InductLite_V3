"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AdminDisclosureSection } from "@/components/ui/admin-disclosure-section";
import { Alert } from "@/components/ui/alert";
import {
  updateComplianceSettingsAction,
  type ComplianceSettingsActionResult,
} from "./actions";

interface ComplianceSettingsFormProps {
  initialSettings: {
    retention_days: number;
    induction_retention_days: number;
    audit_retention_days: number;
    incident_retention_days: number;
    emergency_drill_retention_days: number;
    compliance_legal_hold: boolean;
    compliance_legal_hold_reason: string | null;
    data_residency_region: string | null;
    data_residency_scope: string | null;
    data_residency_notes: string | null;
    data_residency_attested_at: Date | null;
    data_residency_attested_by: string | null;
  };
}

const LEGAL_HOLD_REASON_REQUIRED_MESSAGE =
  "Legal hold reason is required when legal hold is enabled";

export function getComplianceSettingsClientError(input: {
  complianceLegalHold: boolean;
  complianceLegalHoldReason: string;
}): string | null {
  if (
    input.complianceLegalHold &&
    input.complianceLegalHoldReason.trim().length === 0
  ) {
    return LEGAL_HOLD_REASON_REQUIRED_MESSAGE;
  }

  return null;
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? "Saving..." : "Save Settings"}
    </button>
  );
}

export default function ComplianceSettingsForm({
  initialSettings,
}: ComplianceSettingsFormProps) {
  const initialState: ComplianceSettingsActionResult | null = null;
  const [state, formAction] = useActionState(
    updateComplianceSettingsAction,
    initialState,
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const legalHoldCheckboxRef = useRef<HTMLInputElement | null>(null);
  const legalHoldReasonRef = useRef<HTMLTextAreaElement | null>(null);

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  const legalHoldReasonError =
    clientError ?? getFieldError("complianceLegalHoldReason");
  const formError =
    clientError ?? (state && !state.success ? state.error : null);
  const retentionSectionOpen =
    Boolean(getFieldError("retentionDays")) ||
    Boolean(getFieldError("inductionRetentionDays")) ||
    Boolean(getFieldError("auditRetentionDays")) ||
    Boolean(getFieldError("incidentRetentionDays")) ||
    Boolean(getFieldError("emergencyDrillRetentionDays"));
  const legalHoldSectionOpen =
    Boolean(clientError) ||
    Boolean(getFieldError("complianceLegalHold")) ||
    Boolean(getFieldError("complianceLegalHoldReason")) ||
    initialSettings.compliance_legal_hold ||
    Boolean(initialSettings.compliance_legal_hold_reason?.trim());
  const residencySectionOpen =
    Boolean(getFieldError("dataResidencyRegion")) ||
    Boolean(getFieldError("dataResidencyScope")) ||
    Boolean(getFieldError("dataResidencyNotes"));

  return (
    <form
      action={formAction}
      className="space-y-6"
      onSubmit={(event) => {
        const validationError = getComplianceSettingsClientError({
          complianceLegalHold:
            legalHoldCheckboxRef.current?.checked ??
            initialSettings.compliance_legal_hold,
          complianceLegalHoldReason:
            legalHoldReasonRef.current?.value ??
            initialSettings.compliance_legal_hold_reason ??
            "",
        });

        if (!validationError) {
          setClientError(null);
          return;
        }

        event.preventDefault();
        setClientError(validationError);
        legalHoldReasonRef.current?.focus();
      }}
    >
      {formError && <Alert variant="error">{formError}</Alert>}
      {state && state.success && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
            Compliance settings stay collapsed until they need attention.
          </p>
          <p className="mt-1 text-xs text-secondary">
            Open only the section you need, then save without scrolling to the bottom.
          </p>
        </div>
        <SaveButton />
      </div>

      <AdminDisclosureSection
        eyebrow="Retention"
        title="Retention windows"
        description="Set purge windows for each record class without turning the whole page into a spreadsheet."
        summaryMeta={
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            {initialSettings.retention_days}d sign-ins
          </span>
        }
        titleAs="h3"
        defaultOpen={retentionSectionOpen}
        tone="subtle"
      >
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Sign-in register retention (days)
            <input
              name="retentionDays"
              type="number"
              min={1}
              max={36500}
              required
              defaultValue={initialSettings.retention_days}
              autoComplete="off"
              className="input mt-1"
            />
            {getFieldError("retentionDays") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("retentionDays")}
              </p>
            )}
          </label>

          <label className="text-sm text-secondary">
            Induction evidence retention (days)
            <input
              name="inductionRetentionDays"
              type="number"
              min={1}
              max={36500}
              required
              defaultValue={initialSettings.induction_retention_days}
              autoComplete="off"
              className="input mt-1"
            />
            {getFieldError("inductionRetentionDays") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("inductionRetentionDays")}
              </p>
            )}
          </label>

          <label className="text-sm text-secondary">
            Audit log retention (days)
            <input
              name="auditRetentionDays"
              type="number"
              min={1}
              max={36500}
              required
              defaultValue={initialSettings.audit_retention_days}
              autoComplete="off"
              className="input mt-1"
            />
            <p className="mt-1 text-xs text-muted">
              System guardrails still enforce global minimum floors.
            </p>
            {getFieldError("auditRetentionDays") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("auditRetentionDays")}
              </p>
            )}
          </label>

          <label className="text-sm text-secondary">
            Incident retention (days)
            <input
              name="incidentRetentionDays"
              type="number"
              min={1}
              max={36500}
              required
              defaultValue={initialSettings.incident_retention_days}
              autoComplete="off"
              className="input mt-1"
            />
            {getFieldError("incidentRetentionDays") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("incidentRetentionDays")}
              </p>
            )}
          </label>

          <label className="text-sm text-secondary">
            Emergency drill retention (days)
            <input
              name="emergencyDrillRetentionDays"
              type="number"
              min={1}
              max={36500}
              required
              defaultValue={initialSettings.emergency_drill_retention_days}
              autoComplete="off"
              className="input mt-1"
            />
            {getFieldError("emergencyDrillRetentionDays") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("emergencyDrillRetentionDays")}
              </p>
            )}
          </label>
        </div>
      </AdminDisclosureSection>

      <AdminDisclosureSection
        eyebrow="Legal hold"
        title="Pause automated purge rules"
        description="Keep hold state and reason visible without giving this section the same weight as the main retention controls."
        summaryMeta={
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            {initialSettings.compliance_legal_hold ? "Enabled" : "Off"}
          </span>
        }
        titleAs="h3"
        defaultOpen={legalHoldSectionOpen}
        tone="subtle"
      >
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              ref={legalHoldCheckboxRef}
              name="complianceLegalHold"
              type="checkbox"
              value="true"
              defaultChecked={initialSettings.compliance_legal_hold}
              className="check-control"
              onChange={() => setClientError(null)}
            />
            Compliance legal hold enabled
          </label>

          <label className="block text-sm text-secondary">
            Legal hold reason
            <textarea
              ref={legalHoldReasonRef}
              name="complianceLegalHoldReason"
              rows={3}
              maxLength={500}
              defaultValue={initialSettings.compliance_legal_hold_reason ?? ""}
              autoComplete="off"
              className="input mt-1"
              placeholder="Required when legal hold is enabled"
              aria-invalid={legalHoldReasonError ? "true" : undefined}
              aria-describedby={
                legalHoldReasonError ? "compliance-legal-hold-reason-error" : undefined
              }
              onInput={() => setClientError(null)}
            />
            {legalHoldReasonError && (
              <p
                id="compliance-legal-hold-reason-error"
                className="mt-1 text-xs text-red-600"
              >
                {legalHoldReasonError}
              </p>
            )}
          </label>
        </div>
      </AdminDisclosureSection>

      <AdminDisclosureSection
        eyebrow="Residency"
        title="Data residency record"
        description="Keep buyer-facing residency declarations and attestations available behind a calmer disclosure."
        summaryMeta={
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
            {initialSettings.data_residency_region ?? "Undeclared"}
          </span>
        }
        titleAs="h3"
        defaultOpen={residencySectionOpen}
        tone="subtle"
      >
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Residency region
            <select
              name="dataResidencyRegion"
              defaultValue={initialSettings.data_residency_region ?? ""}
              className="input mt-1"
            >
              <option value="">Not declared</option>
              <option value="NZ">New Zealand (NZ)</option>
              <option value="AU">Australia (AU)</option>
              <option value="APAC">APAC</option>
              <option value="GLOBAL">Global</option>
            </select>
            {getFieldError("dataResidencyRegion") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("dataResidencyRegion")}
              </p>
            )}
          </label>

          <label className="text-sm text-secondary">
            Residency scope
            <select
              name="dataResidencyScope"
              defaultValue={initialSettings.data_residency_scope ?? ""}
              className="input mt-1"
            >
              <option value="">Not declared</option>
              <option value="PRIMARY_ONLY">Primary only</option>
              <option value="PRIMARY_AND_BACKUP">Primary and backup</option>
              <option value="PROCESSING_ONLY">Processing only</option>
            </select>
            {getFieldError("dataResidencyScope") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("dataResidencyScope")}
              </p>
            )}
          </label>
        </div>

        <label className="mt-4 block text-sm text-secondary">
          Residency notes (optional)
          <textarea
            name="dataResidencyNotes"
            rows={3}
            maxLength={500}
            defaultValue={initialSettings.data_residency_notes ?? ""}
            autoComplete="off"
            className="input mt-1"
            placeholder="Example: Primary region NZ, backups retained in AU."
          />
          {getFieldError("dataResidencyNotes") && (
            <p className="mt-1 text-xs text-red-600">
              {getFieldError("dataResidencyNotes")}
            </p>
          )}
        </label>

        <p className="mt-2 text-xs text-muted">
          Last attested:{" "}
          {initialSettings.data_residency_attested_at
            ? initialSettings.data_residency_attested_at.toLocaleString("en-NZ")
            : "Not attested"}{" "}
          {initialSettings.data_residency_attested_by
            ? `(by ${initialSettings.data_residency_attested_by})`
            : ""}
        </p>
      </AdminDisclosureSection>

    </form>
  );
}

