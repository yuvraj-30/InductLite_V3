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
    <div className="space-y-6 p-3 sm:p-4">
      <div>
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link
                href="/admin/users"
                className="text-muted hover:text-secondary"
              >
                Users
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
              <span className="font-medium text-[color:var(--text-primary)]">{user.name}</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="surface-panel-strong max-w-3xl p-5 sm:p-6">
        <h1 className="mb-1 kinetic-title text-2xl font-black text-[color:var(--text-primary)]">{user.name}</h1>
        <p className="mb-6 text-sm text-secondary">{user.email}</p>
        <EditUserForm user={user} isCurrentUser={isCurrentUser} />
      </div>
    </div>
  );
}
