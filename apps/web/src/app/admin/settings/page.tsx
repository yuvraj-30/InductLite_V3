import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findCompanyComplianceSettings } from "@/lib/repository/company.repository";
import ComplianceSettingsForm from "./compliance-settings-form";

export const metadata = {
  title: "Settings | InductLite",
};

export default async function AdminSettingsPage() {
  const guard = await checkPermissionReadOnly("settings:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const settings = await findCompanyComplianceSettings(context.companyId);

  if (!settings) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <h1 className="text-lg font-semibold text-red-800">Settings unavailable</h1>
          <p className="mt-1 text-sm text-red-700">
            Unable to load company compliance settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Settings</h1>
        <p className="mt-1 text-gray-600">
          Configure retention windows and legal hold controls for compliance
          evidence.
        </p>
      </div>

      <ComplianceSettingsForm initialSettings={settings} />
    </div>
  );
}
