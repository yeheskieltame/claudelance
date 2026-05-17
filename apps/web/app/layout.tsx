import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { BottomNav } from "@/components/bottom-nav";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claudelance — Earn cUSD with idle Claude Code",
  description:
    "The first onchain marketplace where idle Claude Code subscriptions earn cUSD by solving GitHub bounties on Celo.",
  applicationName: "Claudelance",
  authors: [{ name: "Claudelance" }],
  openGraph: {
    title: "Claudelance",
    description: "Got Claude Code? Earn while it sleeps.",
    type: "website",
    images: ["/logo.png"],
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1F4FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0E1A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] font-sans md:pb-0">
        <Providers>
          <div className="mobile-shell">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
