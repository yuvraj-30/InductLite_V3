"use client";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create Site"}
    </button>
  );
}

/**
 * Create Site Form Component
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, FieldSection } from "@/components/ui/field";
import { createSiteAction, SiteActionResult } from "../actions";

export default function CreateSiteForm() {
  const initialState: SiteActionResult | null = null;
  const router = useRouter();
  const [state, formAction] = useActionState(createSiteAction, initialState);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  useEffect(() => {
    if (state?.success) {
      // Redirect to the new site page or sites list
      router.push("/admin/sites");
    }
  }, [state, router]);

  // Helper to get field errors
  const getFieldError = (field: string): string | undefined => {
    if (
      state &&
      !state.success &&
      "fieldErrors" in state &&
      state.fieldErrors
    ) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.success && (
        <Alert variant="error">{state.error}</Alert>
      )}

      <Field label="Site Name" htmlFor="name" required error={getFieldError("name")}>
        <input
          type="text"
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          className="input"
          placeholder="e.g., 123 Main Street Renovation"
        />
      </Field>

      <div>
        <button
          type="button"
          onClick={() => setShowOptionalFields((prev) => !prev)}
          className="text-sm font-medium text-accent hover:text-accent"
        >
          {showOptionalFields ? "Hide optional details" : "Add optional details"}
        </button>
      </div>

      {showOptionalFields && (
        <>
          <Field label="Address" htmlFor="address" error={getFieldError("address")}>
            <input
              type="text"
              id="address"
              name="address"
              maxLength={200}
              className="input"
              placeholder="e.g., 123 Main Street, Auckland 1010"
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={getFieldError("description")}
          >
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
              className="input"
              placeholder="Optional description of the site or project"
            />
          </Field>

          <FieldSection>
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
              Location Audit (Optional)
            </h3>
            <p className="mt-1 text-xs text-secondary">
              Configure site coordinates to show in-radius/out-of-radius status during sign-in.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field
                label="Latitude"
                htmlFor="locationLatitude"
                error={getFieldError("locationLatitude")}
              >
                <input
                  type="number"
                  id="locationLatitude"
                  name="locationLatitude"
                  step="0.000001"
                  min="-90"
                  max="90"
                  className="input"
                  placeholder="-36.8485"
                />
              </Field>

              <Field
                label="Longitude"
                htmlFor="locationLongitude"
                error={getFieldError("locationLongitude")}
              >
                <input
                  type="number"
                  id="locationLongitude"
                  name="locationLongitude"
                  step="0.000001"
                  min="-180"
                  max="180"
                  className="input"
                  placeholder="174.7633"
                />
              </Field>

              <Field
                label="Radius (m)"
                htmlFor="locationRadiusM"
                error={getFieldError("locationRadiusM")}
              >
                <input
                  type="number"
                  id="locationRadiusM"
                  name="locationRadiusM"
                  step="1"
                  min="25"
                  max="2000"
                  className="input"
                  placeholder="150"
                />
              </Field>
            </div>
          </FieldSection>
        </>
      )}

      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Cancel
        </button>
        <SubmitButton />
      </div>
    </form>
  );
}

