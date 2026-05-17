import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { InstallBanner } from "@/components/install-banner";
import { BottomNav } from "@/components/bottom-nav";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claudelance - Earn cUSD with idle Claude Code",
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
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1F4FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0E1A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/logo.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/logo@2x.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Claudelance" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] font-sans md:pb-0">
        <Providers>
          {children}
          <InstallBanner />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
