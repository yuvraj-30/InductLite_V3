import { getContractorSession } from "@/lib/auth/contractor-session";
import { findContractorByIdWithDocuments } from "@/lib/repository";
import { Alert } from "@/components/ui/alert";

export const metadata = {
  title: "Contractor Portal | InductLite",
};

export default async function ContractorPortalPage() {
  const session = await getContractorSession();
  if (!session) {
    return (
      <div className="p-6">
        <Alert variant="error">
          Your session has expired. Please request a new magic link.
        </Alert>
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
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Contractor Portal</h1>
      <p className="mb-6 text-gray-600">Welcome, {contractor.name}.</p>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-medium text-gray-900">Documents</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {contractor.documents.length === 0 ? (
            <li className="px-4 py-4 text-sm text-gray-500">No documents available.</li>
          ) : (
            contractor.documents.map((doc) => (
              <li key={doc.id} className="flex justify-between px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {doc.document_type} | {doc.mime_type}
                  </p>
                </div>
                <a
                  href={`/api/storage/sign/${doc.id}`}
                  className="text-sm text-blue-600 hover:text-blue-500"
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
