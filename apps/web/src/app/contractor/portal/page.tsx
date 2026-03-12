import { getContractorSession } from "@/lib/auth/contractor-session";
import { findContractorByIdWithDocuments } from "@/lib/repository";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";

export const metadata = {
  title: "Contractor Portal | InductLite",
};

export default async function ContractorPortalPage() {
  const session = await getContractorSession();
  if (!session) {
    return (
      <div className="space-y-3 p-6">
        <Alert variant="error">
          Your session has expired. Please request a new magic link.
        </Alert>
        <Link
          href="/contractor?status=invalid"
          className="btn-primary"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  const contractor = await findContractorByIdWithDocuments(
    session.companyId,
    session.contractorId,
  );

  if (!contractor) {
    return (
      <div className="p-6">
        <Alert variant="error">Contractor not found.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <section className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Contractor Portal
        </h1>
        <p className="mt-1 text-sm text-secondary">Welcome, {contractor.name}.</p>
      </section>

      <div className="surface-panel overflow-hidden">
        <div className="border-b border-[color:var(--border-soft)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
            Documents
          </h2>
        </div>
        <ul className="divide-y divide-[color:var(--border-soft)]">
          {contractor.documents.length === 0 ? (
            <li className="px-4 py-4 text-sm text-secondary">No documents available.</li>
          ) : (
            contractor.documents.map((doc) => (
              <li key={doc.id} className="flex justify-between px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-secondary">
                    {doc.document_type} | {doc.mime_type}
                  </p>
                </div>
                <a
                  href={`/api/storage/sign/${doc.id}`}
                  className="text-sm font-semibold text-accent hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
