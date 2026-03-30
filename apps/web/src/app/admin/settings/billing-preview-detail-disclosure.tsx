"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { loadBillingPreviewDetailAction } from "./actions";

interface BillingPreviewDetailDisclosureProps {
  initialSiteCount: number;
}

interface BillingPreviewSiteInvoice {
  siteId: string;
  siteName: string;
  plan: "STANDARD" | "PLUS" | "PRO";
  basePriceCents: number;
  creditAppliedCents: number;
  finalPriceCents: number;
}

const PLAN_PRESENTATION = {
  STANDARD: { label: "Standard", badgeTone: "default" as const },
  PLUS: { label: "Plus", badgeTone: "primary" as const },
  PRO: { label: "Pro", badgeTone: "success" as const },
};

function formatNzd(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
}

export default function BillingPreviewDetailDisclosure({
  initialSiteCount,
}: BillingPreviewDetailDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<{
    generatedAt: string;
    siteInvoices: BillingPreviewSiteInvoice[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (!nextOpen || detail || isPending) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await loadBillingPreviewDetailAction();
      if (response.success) {
        setDetail({
          generatedAt: response.generatedAt,
          siteInvoices: response.siteInvoices,
        });
        return;
      }

      setError(response.error);
    });
  };

  return (
    <section className="mt-4 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
            Per-site billing detail
          </p>
          <p className="text-xs text-secondary">
            {initialSiteCount} billable site
            {initialSiteCount === 1 ? "" : "s"} in the current preview.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="btn-secondary min-h-[38px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
        >
          {isOpen ? "Hide breakdown" : isPending ? "Loading..." : "View breakdown"}
        </button>
      </div>

      {isOpen ? (
        <div className="border-t border-[color:var(--border-soft)] px-4 py-4">
          {isPending && !detail ? (
            <div className="space-y-3">
              <div className="h-4 w-48 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
              <div className="h-40 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]" />
            </div>
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}

          {detail ? (
            <div className="space-y-3">
              <p className="text-xs text-secondary">
                Detail generated{" "}
                {new Date(detail.generatedAt).toLocaleString("en-NZ")}
              </p>
              <DataTableShell className="rounded-xl border-[color:var(--border-soft)] bg-transparent shadow-none">
                <DataTableScroll>
                  <DataTable className="data-table-compact">
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHeadCell className="w-[38%] min-w-[15rem]">
                          Site
                        </DataTableHeadCell>
                        <DataTableHeadCell className="w-[18%] min-w-[10rem]">
                          Plan
                        </DataTableHeadCell>
                        <DataTableHeadCell className="w-[14%] min-w-[8rem] text-right">
                          Base
                        </DataTableHeadCell>
                        <DataTableHeadCell className="w-[14%] min-w-[8rem] text-right">
                          Credits
                        </DataTableHeadCell>
                        <DataTableHeadCell className="w-[16%] min-w-[8rem] text-right">
                          Total
                        </DataTableHeadCell>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {detail.siteInvoices.map((siteInvoice) => {
                        const tier = PLAN_PRESENTATION[siteInvoice.plan];
                        return (
                          <DataTableRow key={siteInvoice.siteId}>
                            <DataTableCell className="font-medium text-[color:var(--text-primary)]">
                              {siteInvoice.siteName}
                            </DataTableCell>
                            <DataTableCell>
                              <Badge variant={tier.badgeTone}>{tier.label}</Badge>
                            </DataTableCell>
                            <DataTableCell className="text-right">
                              {formatNzd(siteInvoice.basePriceCents)}
                            </DataTableCell>
                            <DataTableCell className="text-right">
                              -{formatNzd(siteInvoice.creditAppliedCents)}
                            </DataTableCell>
                            <DataTableCell className="text-right font-semibold text-[color:var(--text-primary)]">
                              {formatNzd(siteInvoice.finalPriceCents)}
                            </DataTableCell>
                          </DataTableRow>
                        );
                      })}
                    </DataTableBody>
                  </DataTable>
                </DataTableScroll>
              </DataTableShell>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
