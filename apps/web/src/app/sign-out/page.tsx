/**
 * Self-Service Sign-Out Page
 *
 * Allows visitors to sign out using their token.
 * Token is passed in URL query parameter.
 */

import { Metadata } from "next";
import { SignOutForm } from "./components/SignOutForm";
import { PublicShell } from "@/components/ui/public-shell";

export const metadata: Metadata = {
  title: "Sign Out | InductLite",
  description: "Sign out from your site visit",
};

interface SignOutPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function SignOutPage({ searchParams }: SignOutPageProps) {
  const { token } = await searchParams;

  return (
    <PublicShell brand="InductLite" subtitle="Visitor Sign-Out">
      <section>
        <SignOutForm initialToken={token || ""} />
      </section>
    </PublicShell>
  );
}
