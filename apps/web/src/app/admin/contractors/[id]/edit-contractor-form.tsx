"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
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

function FormFields({
  contractor,
  getFieldError,
}: {
  contractor: ContractorFormModel;
  getFieldError: (field: string) => string | undefined;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Contractor Name"
          htmlFor="name"
          error={getFieldError("name")}
        >
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={contractor.name}
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>

        <Field label="Trade" htmlFor="trade" error={getFieldError("trade")}>
          <input
            id="trade"
            name="trade"
            type="text"
            defaultValue={contractor.trade || ""}
            maxLength={120}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field
          label="Contact Name"
          htmlFor="contactName"
          error={getFieldError("contactName")}
        >
          <input
            id="contactName"
            name="contactName"
            type="text"
            defaultValue={contractor.contact_name || ""}
            maxLength={120}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>

        <Field
          label="Contact Email"
          htmlFor="contactEmail"
          error={getFieldError("contactEmail")}
        >
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={contractor.contact_email || ""}
            maxLength={160}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>

        <Field
          label="Contact Phone"
          htmlFor="contactPhone"
          error={getFieldError("contactPhone")}
        >
          <input
            id="contactPhone"
            name="contactPhone"
            type="text"
            defaultValue={contractor.contact_phone || ""}
            maxLength={30}
            disabled={pending}
            className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={getFieldError("notes")}>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={contractor.notes || ""}
          maxLength={500}
          disabled={pending}
          className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
        />
      </Field>

      <div className="field-note">
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
      {state && !state.success && <Alert variant="error">{state.error}</Alert>}

      {state?.success && <Alert variant="success">{state.message}</Alert>}

      <FormFields contractor={contractor} getFieldError={getFieldError} />
    </form>
  );
}
