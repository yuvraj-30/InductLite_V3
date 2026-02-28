"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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
  };
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}
      {state && state.success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">{state.message}</p>
        </div>
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Retention Windows</h2>
        <p className="mt-1 text-sm text-gray-600">
          Set retention in days for each compliance record class.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700">
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
            <p className="mt-1 text-xs text-gray-500">
              System guardrails still enforce global minimum floors.
            </p>
            {getFieldError("auditRetentionDays") && (
              <p className="mt-1 text-xs text-red-600">
                {getFieldError("auditRetentionDays")}
              </p>
            )}
          </label>

          <label className="text-sm text-gray-700">
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

          <label className="text-sm text-gray-700">
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Legal Hold</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enable legal hold to block automated purges for compliance records.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              name="complianceLegalHold"
              type="checkbox"
              value="true"
              defaultChecked={initialSettings.compliance_legal_hold}
              className="h-4 w-4 rounded border-gray-300"
            />
            Compliance legal hold enabled
          </label>

          <label className="block text-sm text-gray-700">
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

      <div className="flex items-center justify-end border-t pt-4">
        <SaveButton />
      </div>
    </form>
  );
}
