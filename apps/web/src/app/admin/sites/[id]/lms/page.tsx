import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSitePermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findSiteById } from "@/lib/repository/site.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { parseLmsConnectorConfig } from "@/lib/lms/config";
import { PageWarningState } from "@/components/ui/page-state";
import { LmsSettingsForm } from "./lms-settings-form";

interface SiteLmsPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Site LMS Connector | InductLite",
};

export default async function SiteLmsPage({ params }: SiteLmsPageProps) {
  const { id: siteId } = await params;

  const guard = await checkSitePermissionReadOnly("site:manage", siteId);
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    notFound();
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "LMS_CONNECTOR", siteId);
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">LMS Connector</h1>
              <p className="mt-1 text-secondary">
                {site.name}: manage one-way completion sync into your LMS.
              </p>
            </div>
            <Link href={`/admin/sites/${siteId}`} className="btn-secondary w-full sm:w-auto">
              Back to Site
            </Link>
          </div>

          <div className="max-w-3xl">
            <PageWarningState
              title="Feature not enabled for this site plan."
              description="LMS connector is disabled by entitlements (CONTROL_ID: PLAN-ENTITLEMENT-001)."
            />
          </div>
        </div>
      );
    }
    throw error;
  }

  const config = parseLmsConnectorConfig(site.lms_connector);

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">LMS Connector</h1>
          <p className="mt-1 text-secondary">
            {site.name}: configure one-way induction completion sync.
          </p>
        </div>
        <Link href={`/admin/sites/${siteId}`} className="btn-secondary w-full sm:w-auto">
          Back to Site
        </Link>
      </div>

      <LmsSettingsForm
        siteId={siteId}
        initialEnabled={config.enabled}
        initialEndpointUrl={config.endpointUrl ?? ""}
        initialProvider={config.provider ?? ""}
        initialCourseCode={config.courseCode ?? ""}
        hasAuthToken={Boolean(config.authToken)}
        updatedAt={config.updatedAt}
      />
    </div>
  );
}
