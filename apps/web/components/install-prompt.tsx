"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!installPrompt || dismissed) return null;

  const install = async () => {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-white/15 bg-background/95 p-4 shadow-2xl backdrop-blur md:left-auto md:right-6 md:max-w-sm md:bottom-6">
      <div className="flex items-start gap-3">
        <img src="/logo-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-semibold">Install Claudelance</p>
            <p className="text-sm text-muted-foreground">Add the bounty marketplace to your home screen.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={install}>Install</Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>Not now</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
