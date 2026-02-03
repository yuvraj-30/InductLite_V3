import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InductLite - Site Induction Management",
  description:
    "Multi-tenant SaaS for NZ construction site inductions and visitor management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
