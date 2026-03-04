import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSitePermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findSiteById } from "@/lib/repository/site.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { parseLmsConnectorConfig } from "@/lib/lms/config";
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
        <div className="p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">LMS Connector</h1>
              <p className="mt-1 text-gray-600">
                {site.name}: manage one-way completion sync into your LMS.
              </p>
            </div>
            <Link
              href={`/admin/sites/${siteId}`}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Back to Site
            </Link>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Feature not enabled for this site plan
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              LMS connector is disabled by entitlements (CONTROL_ID:
              PLAN-ENTITLEMENT-001).
            </p>
          </div>
        </div>
      );
    }
    throw error;
  }

  const config = parseLmsConnectorConfig(site.lms_connector);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LMS Connector</h1>
          <p className="mt-1 text-gray-600">
            {site.name}: configure one-way induction completion sync.
          </p>
        </div>
        <Link
          href={`/admin/sites/${siteId}`}
          className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
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

