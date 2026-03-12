import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import CreateContractorForm from "./create-contractor-form";

export const metadata = {
  title: "Create Contractor | InductLite",
};

export default async function NewContractorPage() {
  const guard = await checkPermissionReadOnly("contractor:manage");
  if (!guard.success) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{guard.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link
                href="/admin/contractors"
                className="text-muted hover:text-secondary"
              >
                Contractors
              </Link>
            </li>
            <li>
              <svg
                className="h-5 w-5 flex-shrink-0 text-muted"
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
              <span className="font-medium text-[color:var(--text-primary)]">New Contractor</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="max-w-3xl">
        <h1 className="kinetic-title mb-6 text-2xl font-black text-[color:var(--text-primary)]">
          Create Contractor
        </h1>
        <CreateContractorForm />
      </div>
    </div>
  );
}
