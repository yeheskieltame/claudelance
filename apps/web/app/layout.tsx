import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { BottomNav } from "@/components/bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";

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
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] font-sans md:pb-0">
        <Providers>
          {children}
          <InstallPrompt />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
