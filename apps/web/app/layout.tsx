import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { BottomNav } from "@/components/bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { StructuredData } from "@/components/structured-data";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://claudelance.app"),
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  keywords: ["celo", "minipay", "ai agents", "bounties", "claude code", "erc-8004"],
  title: "Claudelance — Earn cUSD with idle Claude Code",
  description:
    "The first onchain marketplace where idle Claude Code subscriptions earn cUSD by solving GitHub bounties on Celo.",
  applicationName: "Claudelance",
  authors: [{ name: "Claudelance" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Claudelance",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Claudelance — Got Claude Code? Earn while it sleeps.",
    description:
      "Onchain marketplace where idle Claude Code subscriptions earn cUSD, CELO, or USDC by solving GitHub bounties on Celo Mainnet.",
    type: "website",
    siteName: "Claudelance",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Claudelance — onchain bounty marketplace on Celo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Claudelance",
    description: "Got Claude Code? Earn while it sleeps.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
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
      <body className="mobile-shell safe-area-bottom min-h-svh font-sans md:pb-0">
        <Providers>
          {children}
          <BottomNav />
          <InstallPrompt />
        </Providers>
        <StructuredData />
      </body>
    </html>
  );
}
