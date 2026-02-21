import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findContractorById } from "@/lib/repository";
import { EditContractorForm } from "./edit-contractor-form";

export const metadata = {
  title: "Contractor Details | InductLite",
};

interface ContractorDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractorDetailPage({
  params,
}: ContractorDetailPageProps) {
  const guard = await checkPermissionReadOnly("contractor:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const { id } = await params;
  const contractor = await findContractorById(context.companyId, id);
  if (!contractor) {
    notFound();
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link
                href="/admin/contractors"
                className="text-gray-500 hover:text-gray-700"
              >
                Contractors
              </Link>
            </li>
            <li>
              <svg
                className="h-5 w-5 flex-shrink-0 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </li>
            <li>
              <span className="font-medium text-gray-900">{contractor.name}</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="max-w-3xl rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">
          {contractor.name}
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          {contractor.trade || "No trade specified"}
        </p>
        <EditContractorForm contractor={contractor} />
      </div>
    </div>
  );
}
