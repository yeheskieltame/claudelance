"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void> | void;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

const STORAGE_KEY = "claudelance-install-banner-dismissed";

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === "1") {
        setIsDismissed(true);
        return;
      }
    } catch {
      // Ignore storage failures and fall back to session state only.
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsDismissed(true);
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    setDeferredPrompt(null);
    setIsDismissed(true);

    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
  };

  const installApp = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    dismiss();
  };

  if (!deferredPrompt || isDismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom)+1rem)] z-50 mx-auto max-w-lg md:bottom-6">
      <div className="glass-strong pointer-events-auto flex items-start gap-3 rounded-3xl px-4 py-3 shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Download className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Claudelance</p>
          <p className="text-sm text-muted-foreground">
            Add the app to your home screen for faster access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={installApp}>
            Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={dismiss}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
