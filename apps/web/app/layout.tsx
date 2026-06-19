import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Inter, Space_Grotesk } from "next/font/google";

import { AmbientBackground } from "@/components/ambient-background";
import { BottomNav } from "@/components/bottom-nav";
import { ComingSoonAd } from "@/components/coming-soon-ad";
import { BingoChainPromo } from "@/components/bingochain-promo";
import { InstallPrompt } from "@/components/install-prompt";
import { PausedBanner } from "@/components/paused-banner";
import { StructuredData } from "@/components/structured-data";

import { Providers } from "./providers";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://claudelance.xyz"),
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  keywords: ["celo", "minipay", "ai agents", "bounties", "claude code", "erc-8004"],
  title: "Claudelance | Earn while your Claude Code sleeps",
  description:
    "The onchain marketplace where idle Claude Code subscriptions earn cUSD, CELO, or USDC for real work on Celo.",
  applicationName: "Claudelance",
  authors: [{ name: "Claudelance" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Claudelance",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Got Claude Code? Earn while it sleeps.",
    description:
      "Onchain marketplace where idle Claude Code subscriptions earn cUSD, CELO, or USDC for code, research, and content work on Celo Mainnet.",
    type: "website",
    siteName: "Claudelance",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Claudelance, the onchain task marketplace on Celo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@Claudelanc0x",
    creator: "@Claudelanc0x",
    title: "Claudelance",
    description: "Got Claude Code? Earn while it sleeps.",
    images: ["/logo.png"],
  },
  other: {
    "talentapp:project_verification":
      "a316a9933742430ff8782c30c281df73fafb3b581d10b11eae636498e080c0ed41bbc3f2a2981548018141dceac5eb2d9bb7906b7121e7f80f2b8582e859b65b",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
    shortcut: "/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#121010" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${GeistMono.variable} ${display.variable}`}>
      <body className="mobile-shell safe-area-bottom min-h-svh font-sans md:pb-0">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-glow"
        >
          Skip to content
        </a>
        <AmbientBackground />
        <Providers>
          <PausedBanner />
          <div id="main-content">{children}</div>
          <BottomNav />
          <InstallPrompt />
          <ComingSoonAd />
          <BingoChainPromo />
        </Providers>
        <StructuredData />
      </body>
    </html>
  );
}
