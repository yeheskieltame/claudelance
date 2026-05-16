"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md px-4 md:bottom-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <div className="flex-1 text-sm">
          <p className="font-semibold">Install Claudelance</p>
          <p className="text-muted-foreground text-xs">
            Add to home screen for quick access
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/80"
          onClick={async () => {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === "accepted") setDeferredPrompt(null);
            setDismissed(true);
          }}
        >
          Install
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
