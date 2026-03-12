import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeRuntime } from "@/components/ui/theme-runtime";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { isFeatureEnabled } from "@/lib/feature-flags";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "InductLite - Site Induction Management",
  description:
    "Multi-tenant SaaS for NZ construction site inductions and visitor management",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const a11yHardeningEnabled = isFeatureEnabled("UIX_S5_A11Y");

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${spaceGrotesk.variable}`}
    >
      <body
        className={`min-h-screen font-body text-[color:var(--text-primary)] antialiased ${a11yHardeningEnabled ? "uix-s5-a11y" : ""}`}
      >
        <ThemeRuntime />
        <ThemeSwitcher />
        {children}
      </body>
    </html>
  );
}
