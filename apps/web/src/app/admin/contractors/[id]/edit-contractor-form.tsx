"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateContractorAction,
  type ContractorActionResult,
} from "../actions";
import { ContractorActionButtons } from "../contractor-action-buttons";

interface ContractorFormModel {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  trade: string | null;
  notes: string | null;
  is_active: boolean;
}

interface EditContractorFormProps {
  contractor: ContractorFormModel;
}

const initialState: ContractorActionResult | null = null;

function FormFields({ contractor }: { contractor: ContractorFormModel }) {
  const { pending } = useFormStatus();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-secondary"
          >
            Contractor Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={contractor.name}
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>

        <div>
          <label
            htmlFor="trade"
            className="block text-sm font-medium text-secondary"
          >
            Trade
          </label>
          <input
            id="trade"
            name="trade"
            type="text"
            defaultValue={contractor.trade || ""}
            maxLength={120}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label
            htmlFor="contactName"
            className="block text-sm font-medium text-secondary"
          >
            Contact Name
          </label>
          <input
            id="contactName"
            name="contactName"
            type="text"
            defaultValue={contractor.contact_name || ""}
            maxLength={120}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>

        <div>
          <label
            htmlFor="contactEmail"
            className="block text-sm font-medium text-secondary"
          >
            Contact Email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={contractor.contact_email || ""}
            maxLength={160}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>

        <div>
          <label
            htmlFor="contactPhone"
            className="block text-sm font-medium text-secondary"
          >
            Contact Phone
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="text"
            defaultValue={contractor.contact_phone || ""}
            maxLength={30}
            disabled={pending}
            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-secondary"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={contractor.notes || ""}
          maxLength={500}
          disabled={pending}
          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
        />
      </div>

      <div className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3 text-sm text-secondary">
        Status:{" "}
        <span className="font-medium">
          {contractor.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContractorActionButtons
          contractorId={contractor.id}
          contractorName={contractor.name}
          isActive={contractor.is_active}
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );
}

export function EditContractorForm({ contractor }: EditContractorFormProps) {
  const boundAction = updateContractorAction.bind(null, contractor.id);
  const [state, formAction] = useActionState(boundAction, initialState);

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {state?.success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">{state.message}</p>
        </div>
      )}

      <FormFields contractor={contractor} />

      {!state?.success && (
        <div className="grid grid-cols-1 gap-1 text-xs text-red-600">
          {getFieldError("name") && <p>{getFieldError("name")}</p>}
          {getFieldError("contactName") && <p>{getFieldError("contactName")}</p>}
          {getFieldError("contactEmail") && (
            <p>{getFieldError("contactEmail")}</p>
          )}
          {getFieldError("contactPhone") && (
            <p>{getFieldError("contactPhone")}</p>
          )}
          {getFieldError("trade") && <p>{getFieldError("trade")}</p>}
          {getFieldError("notes") && <p>{getFieldError("notes")}</p>}
        </div>
      )}
    </form>
  );
}
