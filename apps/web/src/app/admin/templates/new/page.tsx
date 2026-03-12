/**
 * New Template Page
 *
 * Form for creating a new induction template.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { findAllSites } from "@/lib/repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { NewTemplateForm } from "./new-template-form";

export const metadata = {
  title: "New Template | InductLite",
};

export default async function NewTemplatePage() {
  const guard = await checkPermissionReadOnly("template:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const sites = await findAllSites(context.companyId);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-3 sm:p-4">
      <div>
        <Link
          href="/admin/templates"
          className="text-sm font-semibold text-accent hover:underline"
        >
          Back to Templates
        </Link>
      </div>

      <div className="surface-panel-strong p-5 sm:p-6">
        <h1 className="kinetic-title mb-6 text-2xl font-black text-[color:var(--text-primary)]">
          Create New Template
        </h1>

        <NewTemplateForm sites={sites} />
      </div>
    </div>
  );
}
