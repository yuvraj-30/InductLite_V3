"use client";

import { useActionState, useEffect, useMemo, useState, type ComponentType } from "react";
import { useFormStatus } from "react-dom";
import {
  createPreRegistrationInviteAction,
  type PreRegistrationActionResult,
} from "./actions";

interface CreateInviteFormProps {
  sites: Array<{
    id: string;
    name: string;
    is_active: boolean;
  }>;
  defaultSiteId?: string;
}

type QRCodeSvgProps = {
  value: string;
  size: number;
  level?: "L" | "M" | "Q" | "H";
  includeMargin?: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create Invite"}
    </button>
  );
}

export function CreateInviteForm({ sites, defaultSiteId }: CreateInviteFormProps) {
  const initialState: PreRegistrationActionResult | null = null;
  const [state, formAction] = useActionState(
    createPreRegistrationInviteAction,
    initialState,
  );
  const [QRCodeSVGComponent, setQRCodeSVGComponent] =
    useState<ComponentType<QRCodeSvgProps> | null>(null);

  const defaultExpiry = useMemo(() => {
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  useEffect(() => {
    if (!state?.success || !state.inviteLink || QRCodeSVGComponent) {
      return;
    }

    let cancelled = false;
    void import("qrcode.react").then((mod) => {
      if (!cancelled) {
        setQRCodeSVGComponent(() => mod.QRCodeSVG as ComponentType<QRCodeSvgProps>);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [QRCodeSVGComponent, state]);

  const getFieldError = (field: string): string | undefined => {
    if (state && !state.success && state.fieldErrors) {
      return state.fieldErrors[field]?.[0];
    }
    return undefined;
  };

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Create Pre-Registration</h2>
        <p className="mt-1 text-sm text-gray-600">
          Generate an invite link and QR-ready URL for faster arrival check-in.
        </p>
      </div>

      {state && !state.success && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">{state.message}</p>
          {state.inviteLink && (
            <div className="mt-2">
              <p className="text-xs text-green-700">Invite link</p>
              <p className="break-all rounded border border-green-200 bg-white px-2 py-2 text-xs text-green-900">
                {state.inviteLink}
              </p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(state.inviteLink!)}
                className="mt-2 inline-flex min-h-[40px] items-center rounded-md border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50"
              >
                Copy Invite Link
              </button>
              <div className="mt-3 inline-flex rounded-md border border-green-200 bg-white p-3">
                {QRCodeSVGComponent ? (
                  <QRCodeSVGComponent
                    value={state.inviteLink}
                    size={172}
                    level="M"
                    includeMargin
                  />
                ) : (
                  <div className="h-[172px] w-[172px] animate-pulse rounded bg-green-100" />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-700">
          Site
          <select
            name="siteId"
            defaultValue={defaultSiteId ?? sites[0]?.id}
            className="input mt-1"
            required
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
                {site.is_active ? "" : " (Inactive)"}
              </option>
            ))}
          </select>
          {getFieldError("siteId") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("siteId")}</p>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Visitor Type
          <select name="visitorType" defaultValue="CONTRACTOR" className="input mt-1" required>
            <option value="CONTRACTOR">Contractor</option>
            <option value="VISITOR">Visitor</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="DELIVERY">Delivery</option>
          </select>
          {getFieldError("visitorType") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("visitorType")}</p>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Full Name
          <input
            name="visitorName"
            type="text"
            minLength={2}
            maxLength={100}
            required
            className="input mt-1"
          />
          {getFieldError("visitorName") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("visitorName")}</p>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Phone
          <input
            name="visitorPhone"
            type="tel"
            minLength={6}
            maxLength={20}
            placeholder="+64 21 123 4567"
            required
            className="input mt-1"
          />
          {getFieldError("visitorPhone") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("visitorPhone")}</p>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Email
          <input name="visitorEmail" type="email" maxLength={160} className="input mt-1" />
          {getFieldError("visitorEmail") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("visitorEmail")}</p>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Employer
          <input name="employerName" type="text" maxLength={100} className="input mt-1" />
          {getFieldError("employerName") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("employerName")}</p>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Role on Site
          <input name="roleOnSite" type="text" maxLength={100} className="input mt-1" />
          {getFieldError("roleOnSite") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("roleOnSite")}</p>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Expires At
          <input
            name="expiresAt"
            type="datetime-local"
            defaultValue={defaultExpiry}
            className="input mt-1"
          />
          {getFieldError("expiresAt") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("expiresAt")}</p>
          )}
        </label>
      </div>

      <label className="block text-sm text-gray-700">
        Notes
        <textarea name="notes" rows={2} maxLength={1000} className="input mt-1" />
        {getFieldError("notes") && (
          <p className="mt-1 text-xs text-red-600">{getFieldError("notes")}</p>
        )}
      </label>

      <div className="flex justify-end border-t pt-3">
        <SubmitButton />
      </div>
    </form>
  );
}
