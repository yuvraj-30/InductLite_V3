import { getContractorSession } from "@/lib/auth/contractor-session";
import { findContractorByIdWithDocuments } from "@/lib/repository";
import { getSignedDownloadUrl } from "@/lib/storage";

export const metadata = {
  title: "Contractor Portal | InductLite",
};

export default async function ContractorPortalPage() {
  const session = await getContractorSession();
  if (!session) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">
            Your session has expired. Please request a new magic link.
          </p>
        </div>
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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Contractor not found.</p>
        </div>
      </div>
    );
  }

  const documents = await Promise.all(
    contractor.documents.map(async (doc) => ({
      ...doc,
      downloadUrl: await getSignedDownloadUrl(doc.file_path, 300),
    })),
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Contractor portal
      </h1>
      <p className="text-gray-600 mb-6">Welcome, {contractor.name}.</p>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Documents</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {documents.length === 0 ? (
            <li className="px-4 py-4 text-sm text-gray-500">
              No documents available.
            </li>
          ) : (
            documents.map((doc) => (
              <li key={doc.id} className="px-4 py-4 flex justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {doc.document_type} · {doc.mime_type}
                  </p>
                </div>
                <a
                  href={doc.downloadUrl}
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
