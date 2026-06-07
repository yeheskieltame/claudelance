"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "claudelance-install-prompt-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // Storage can throw in private browsing or locked-down browser contexts.
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  const persistDismissal = useCallback(() => {
    writeDismissed();
    setDismissed(true);
    setDeferredPrompt(null);
    setIsPrompting(false);
  }, []);

  useEffect(() => {
    setDismissed(readDismissed());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (readDismissed()) {
        setDismissed(true);
        return;
      }
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      persistDismissal();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [persistDismissal]);

  const handleInstall = async () => {
    if (!deferredPrompt || isPrompting) return;

    setIsPrompting(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));

      if (outcome === "accepted" || outcome === "dismissed") {
        persistDismissal();
      }
    } finally {
      setIsPrompting(false);
    }
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-glass-strong backdrop-blur-xl md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Claudelance</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add to your home screen for quick access to bounties.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              disabled={isPrompting}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPrompting ? "Opening..." : "Install"}
            </button>
            <button
              type="button"
              onClick={persistDismissal}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={persistDismissal}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
