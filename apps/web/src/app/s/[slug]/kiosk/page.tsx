import { getSiteForSignIn } from "../actions";
import { SignInFlow } from "./components/SignInFlow";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function KioskPage({ params }: Props) {
  const { slug } = await params;
  const result = await getSiteForSignIn(slug);

  if (!result.success || "notFound" in result.data) {
    notFound();
  }

  const { site, template } = result.data;

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-4">
            Kiosk Mode Active
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            InductLite
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please sign in to the site below.
          </p>
        </div>

        <SignInFlow
          slug={slug}
          site={site}
          template={template}
          isKiosk={true}
        />
      </div>
    </main>
  );
}
