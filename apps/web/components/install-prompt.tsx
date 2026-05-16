"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "claudelance-install-prompt-dismissed";

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    setIsDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      window.localStorage.setItem(DISMISSED_KEY, "1");
      setIsDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!installPrompt || isDismissed) {
    return null;
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setIsDismissed(true);
  };

  const install = async () => {
    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "dismissed") {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    }
    setIsDismissed(true);
  };

  return (
    <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-5 md:left-auto md:right-5 md:w-96">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Download className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Install Claudelance</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add the bounty dashboard to your home screen for faster wallet actions.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={install}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Later
            </Button>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={dismiss} aria-label="Dismiss install prompt">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
