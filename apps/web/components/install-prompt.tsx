"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = React.useState(true);

  React.useEffect(() => {
    // Check if user already dismissed or installed the PWA in this session/browser
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (!dismissed) {
      setIsDismissed(false);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (isDismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-[4.75rem] inset-x-4 z-50 mx-auto w-auto max-w-sm md:bottom-6 md:right-6 md:left-auto md:mx-0">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-background/80 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display font-semibold text-foreground">Install Claudelance</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Add to your home screen for a fast, native app experience.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={handleInstall} className="w-full gap-2">
          <Download className="h-4 w-4" />
          Install App
        </Button>
      </div>
    </div>
  );
}
