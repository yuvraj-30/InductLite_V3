/**
 * New Template Page
 *
 * Form for creating a new induction template.
 */

import Link from "next/link";
import { checkAuthReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository";
import { NewTemplateForm } from "./new-template-form";

export const metadata = {
  title: "New Template | InductLite",
};

export default async function NewTemplatePage() {
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{guard.error}</p>
        </div>
      </div>
    );
  }

  const context = await requireAuthenticatedContextReadOnly();
  const sites = await findAllSites(context.companyId);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/templates"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Templates
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Template
        </h1>

        <NewTemplateForm sites={sites} />
      </div>
    </div>
  );
}
