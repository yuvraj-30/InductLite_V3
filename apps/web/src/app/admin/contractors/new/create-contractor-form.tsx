"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import {
  createContractorAction,
  type ContractorActionResult,
} from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? "Creating..." : "Create Contractor"}
    </button>
  );
}

export default function CreateContractorForm() {
  const initialState: ContractorActionResult | null = null;
  const router = useRouter();
  const [state, formAction] = useActionState(
    createContractorAction,
    initialState,
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/contractors");
    }
  }, [state, router]);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Contractor Name" htmlFor="name" error={getFieldError("name")}>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            className="input"
          />
        </Field>

        <Field label="Trade" htmlFor="trade" error={getFieldError("trade")}>
          <input
            id="trade"
            name="trade"
            type="text"
            maxLength={120}
            placeholder="Electrician"
            className="input"
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
            maxLength={120}
            className="input"
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
            maxLength={160}
            className="input"
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
            maxLength={30}
            placeholder="+64..."
            className="input"
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={getFieldError("notes")}>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={500}
          className="input"
        />
      </Field>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Link
          href="/admin/contractors"
          className="btn-secondary"
        >
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}

