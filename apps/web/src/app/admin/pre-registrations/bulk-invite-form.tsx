"use client";

import { useActionState, useEffect, useState, type ComponentType } from "react";
import { useFormStatus } from "react-dom";
import {
  bulkCreatePreRegistrationInvitesAction,
  type BulkPreRegistrationActionResult,
} from "./actions";

interface BulkInviteFormProps {
  sites: Array<{
    id: string;
    name: string;
    is_active: boolean;
  }>;
  defaultSiteId?: string;
}

type QrPackPrintProfile = "A4_GRID" | "THERMAL_STACK";
const QR_PACK_PRINT_INK_COLOR = "#171924";

type QRCodeSvgProps = {
  value: string;
  size: number;
  level?: "L" | "M" | "Q" | "H";
  includeMargin?: boolean;
};

function BulkSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Processing..." : "Create Invites From CSV"}
    </button>
  );
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-NZ");
}

export function BulkInviteForm({ sites, defaultSiteId }: BulkInviteFormProps) {
  const initialState: BulkPreRegistrationActionResult | null = null;
  const [state, formAction] = useActionState(
    bulkCreatePreRegistrationInvitesAction,
    initialState,
  );
  const [printProfile, setPrintProfile] = useState<QrPackPrintProfile>("A4_GRID");
  const [QRCodeSVGComponent, setQRCodeSVGComponent] =
    useState<ComponentType<QRCodeSvgProps> | null>(null);
  const qrSize = printProfile === "THERMAL_STACK" ? 116 : 148;

  useEffect(() => {
    const hasCreated = Boolean(state?.success && state.created.length > 0);
    if (!hasCreated || QRCodeSVGComponent) {
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
    <section className="surface-panel mt-6 p-4">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          Bulk Invite Upload (CSV)
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Import up to 200 invite rows and generate a printable QR pack.
        </p>
      </div>

      {state && !state.success && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">{state.message}</p>
          <p className="mt-1 text-xs text-green-800">
            Created: {state.created.length} | Failed: {state.failed.length}
          </p>
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
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

          <label className="mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[color:var(--border-soft)] px-3 text-sm text-secondary">
            <input
              type="checkbox"
              name="sendInviteEmail"
              defaultChecked
              className="h-4 w-4 rounded border-[color:var(--border-soft)] text-indigo-600"
            />
            Queue invite email when visitor email exists
          </label>
        </div>

        <label className="block text-sm text-secondary">
          CSV rows
          <textarea
            name="csvData"
            rows={7}
            className="input mt-1 font-mono text-xs"
            placeholder="visitorName,visitorPhone,visitorEmail,employerName,visitorType,roleOnSite,notes,expiresAt&#10;John Worker,0211234567,john@example.com,BuildCo,CONTRACTOR,Electrician,Induction at 6am,2026-03-15T09:00"
            required
          />
          {getFieldError("csvData") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("csvData")}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Supported columns: visitorName, visitorPhone, visitorEmail, employerName,
            visitorType, roleOnSite, notes, expiresAt.
          </p>
        </label>

        <div className="flex justify-end border-t pt-3">
          <BulkSubmitButton />
        </div>
      </form>

      {state?.success && state.created.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
              Created Invites
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                Print Profile
                <select
                  value={printProfile}
                  onChange={(event) =>
                    setPrintProfile(event.target.value as QrPackPrintProfile)
                  }
                  className="ml-2 rounded-md border border-[color:var(--border-soft)] px-2 py-1 text-xs font-medium text-[color:var(--text-primary)]"
                >
                  <option value="A4_GRID">A4 grid</option>
                  <option value="THERMAL_STACK">Thermal stack (62mm)</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md border border-[color:var(--border-soft)] px-3 py-1 text-xs font-semibold text-secondary hover:bg-[color:var(--bg-surface-strong)]"
              >
                Print QR Pack
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-[color:var(--border-soft)]">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Visitor
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Expires
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Invite Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {state.created.map((row) => (
                  <tr key={row.inviteId}>
                    <td className="px-3 py-2 text-sm text-[color:var(--text-primary)]">
                      <p className="font-medium">{row.visitorName}</p>
                      <p className="text-xs text-muted">Row {row.row}</p>
                    </td>
                    <td className="px-3 py-2 text-sm text-secondary">{row.visitorType}</td>
                    <td className="px-3 py-2 text-sm text-secondary">
                      {formatDateTime(row.expiresAt)}
                    </td>
                    <td className="px-3 py-2 text-sm text-secondary">
                      {row.inviteEmailQueued ? "Queued" : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-secondary">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(row.inviteLink)}
                        className="rounded border border-[color:var(--border-soft)] px-2 py-1 font-semibold hover:bg-[color:var(--bg-surface-strong)]"
                      >
                        Copy Link
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            id="bulk-invite-qr-pack"
            data-print-profile={printProfile.toLowerCase()}
            className={`grid grid-cols-1 gap-4 ${
              printProfile === "THERMAL_STACK" ? "md:grid-cols-1" : "md:grid-cols-2"
            }`}
          >
            {state.created.map((row) => (
              <article
                key={`qr-${row.inviteId}`}
                className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3"
              >
                <p className="text-xs uppercase tracking-[0.08em] text-muted">Visitor</p>
                <p className="text-base font-semibold text-[color:var(--text-primary)]">{row.visitorName}</p>
                <p className="mt-1 text-xs text-secondary">
                  {row.visitorType} - Expires {formatDateTime(row.expiresAt)}
                </p>
                <div className="mt-3 inline-flex rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-2">
                  {QRCodeSVGComponent ? (
                    <QRCodeSVGComponent
                      value={row.inviteLink}
                      size={qrSize}
                      includeMargin
                      level="M"
                    />
                  ) : (
                    <div
                      className="animate-pulse rounded bg-[color:var(--bg-surface-strong)]"
                      style={{ height: qrSize, width: qrSize }}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>

          {state.failed.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <h4 className="text-sm font-semibold text-amber-900">
                Failed rows ({state.failed.length})
              </h4>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {state.failed.map((row, index) => (
                  <li key={`${row.row}-${index}`}>
                    Row {row.row}: {row.error}
                    {row.visitorName ? ` (${row.visitorName})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #bulk-invite-qr-pack,
          #bulk-invite-qr-pack * {
            visibility: visible !important;
          }
          #bulk-invite-qr-pack {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            gap: 8mm !important;
          }
          #bulk-invite-qr-pack[data-print-profile="a4_grid"] {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          #bulk-invite-qr-pack[data-print-profile="thermal_stack"] {
            display: block !important;
          }
          #bulk-invite-qr-pack[data-print-profile="thermal_stack"] article {
            width: 62mm !important;
            margin: 0 0 4mm 0 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border-color: ${QR_PACK_PRINT_INK_COLOR} !important;
          }
        }
      `}</style>
    </section>
  );
}



