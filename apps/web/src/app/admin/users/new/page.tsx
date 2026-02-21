import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import CreateUserForm from "./create-user-form";

export const metadata = {
  title: "Create User | InductLite",
};

export default async function NewUserPage() {
  const guard = await checkPermissionReadOnly("user:manage");
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
                href="/admin/users"
                className="text-gray-500 hover:text-gray-700"
              >
                Users
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
              <span className="font-medium text-gray-900">New User</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Create User</h1>
        <CreateUserForm />
      </div>
    </div>
  );
}
