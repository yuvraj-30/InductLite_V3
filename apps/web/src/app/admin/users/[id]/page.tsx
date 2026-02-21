import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findUserById } from "@/lib/repository";
import { EditUserForm } from "./edit-user-form";

export const metadata = {
  title: "User Details | InductLite",
};

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const guard = await checkPermissionReadOnly("user:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const { id } = await params;
  const user = await findUserById(context.companyId, id);

  if (!user) {
    notFound();
  }

  const isCurrentUser = user.id === context.userId;

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
              <span className="font-medium text-gray-900">{user.name}</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="max-w-3xl rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">{user.name}</h1>
        <p className="mb-6 text-sm text-gray-600">{user.email}</p>
        <EditUserForm user={user} isCurrentUser={isCurrentUser} />
      </div>
    </div>
  );
}
