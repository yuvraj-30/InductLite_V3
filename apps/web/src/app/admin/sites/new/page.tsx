/**
 * Create New Site Page
 */

import { checkPermissionReadOnly } from "@/lib/auth";
import Link from "next/link";
import CreateSiteForm from "./create-site-form";

export const metadata = {
  title: "Create Site | InductLite",
};

export default async function NewSitePage() {
  // Check permission
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
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
                href="/admin/sites"
                className="text-gray-500 hover:text-gray-700"
              >
                Sites
              </Link>
            </li>
            <li>
              <svg
                className="flex-shrink-0 h-5 w-5 text-gray-400"
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
              <span className="text-gray-900 font-medium">New Site</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Site
        </h1>
        <CreateSiteForm />
      </div>
    </div>
  );
}
