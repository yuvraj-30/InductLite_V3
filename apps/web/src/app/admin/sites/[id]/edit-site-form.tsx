"use client";

/**
 * Edit Site Form Component
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Field, FieldSection } from "@/components/ui/field";
import { updateSiteAction, SiteActionResult } from "../actions";

interface Site {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  location_radius_m: number | null;
}

interface EditSiteFormProps {
  site: Site;
}

const initialState: SiteActionResult | null = null;

function FormFields({ site }: { site: Site }) {
  const { pending } = useFormStatus();

  return (
    <>
      <Field label="Site Name" htmlFor="name" required>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={site.name}
          required
          minLength={2}
          maxLength={100}
          disabled={pending}
          className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
        />
      </Field>

      <Field label="Address" htmlFor="address">
        <input
          type="text"
          id="address"
          name="address"
          defaultValue={site.address || ""}
          maxLength={200}
          disabled={pending}
          className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={site.description || ""}
          maxLength={500}
          disabled={pending}
          className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
        />
      </Field>

      <FieldSection>
        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
          Location Audit
        </h3>
        <p className="mt-1 text-xs text-secondary">
          Leave all location fields blank to disable location verification for this site.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Latitude" htmlFor="locationLatitude">
            <input
              type="number"
              id="locationLatitude"
              name="locationLatitude"
              defaultValue={site.location_latitude ?? ""}
              step="0.000001"
              min="-90"
              max="90"
              disabled={pending}
              className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
            />
          </Field>

          <Field label="Longitude" htmlFor="locationLongitude">
            <input
              type="number"
              id="locationLongitude"
              name="locationLongitude"
              defaultValue={site.location_longitude ?? ""}
              step="0.000001"
              min="-180"
              max="180"
              disabled={pending}
              className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
            />
          </Field>

          <Field label="Radius (m)" htmlFor="locationRadiusM">
            <input
              type="number"
              id="locationRadiusM"
              name="locationRadiusM"
              defaultValue={site.location_radius_m ?? ""}
              step="1"
              min="25"
              max="2000"
              disabled={pending}
              className="input disabled:cursor-not-allowed disabled:bg-[color:var(--bg-surface-strong)]"
            />
          </Field>
        </div>
      </FieldSection>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary disabled:cursor-not-allowed"
        >
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );
}

export function EditSiteForm({ site }: EditSiteFormProps) {
  // Bind the siteId to the action
  const boundUpdateAction = updateSiteAction.bind(null, site.id);
  const [state, formAction] = useActionState(boundUpdateAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <Alert variant="error">{state.error}</Alert>
      )}

      {state?.success && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <FormFields site={site} />
    </form>
  );
}


