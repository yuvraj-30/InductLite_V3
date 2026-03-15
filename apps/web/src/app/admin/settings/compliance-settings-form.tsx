"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.success && (
        <Alert variant="error">{state.error}</Alert>
      )}
      {state && state.success && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Retention Windows</h2>
        <p className="mt-1 text-sm text-secondary">
          Set retention in days for each compliance record class.
        </p>

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
              className="input mt-1"
            />
            {getFieldError("emergencyDrillRetentionDays") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("emergencyDrillRetentionDays")}
              </p>
            )}
          </label>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Legal Hold</h2>
        <p className="mt-1 text-sm text-secondary">
          Enable legal hold to block automated purges for compliance records.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              name="complianceLegalHold"
              type="checkbox"
              value="true"
              defaultChecked={initialSettings.compliance_legal_hold}
              className="check-control"
            />
            Compliance legal hold enabled
          </label>

          <label className="block text-sm text-secondary">
            Legal hold reason
            <textarea
              name="complianceLegalHoldReason"
              rows={3}
              maxLength={500}
              defaultValue={initialSettings.compliance_legal_hold_reason ?? ""}
              className="input mt-1"
              placeholder="Required when legal hold is enabled"
            />
            {getFieldError("complianceLegalHoldReason") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("complianceLegalHoldReason")}
              </p>
            )}
          </label>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Data Residency</h2>
        <p className="mt-1 text-sm text-secondary">
          Record tenant-level data residency choices for compliance evidence and buyer assurance.
        </p>

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
      </section>

      <div className="flex items-center justify-end border-t pt-4">
        <SaveButton />
      </div>
    </form>
  );
}

