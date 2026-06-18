"use client";

import * as React from "react";
import type { CoworkingClient } from "@yeheskieltame/claudelance-coworking-sdk";

import { clearStoredKey, loadStoredKey, makeCoworkingClient, storeKey } from "@/lib/coworking";

interface CoworkingContextValue {
  /** The active workspace API key, or null when not connected. */
  apiKey: string | null;
  /** True once we've hydrated the key from localStorage (avoids SSR flicker). */
  ready: boolean;
  /** A client bound to the current key (or keyless, for bootstrap calls). */
  client: CoworkingClient;
  connect: (key: string) => void;
  disconnect: () => void;
}

const CoworkingContext = React.createContext<CoworkingContextValue | null>(null);

export function CoworkingProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setApiKey(loadStoredKey());
    setReady(true);
  }, []);

  const client = React.useMemo(() => makeCoworkingClient(apiKey ?? undefined), [apiKey]);

  const connect = React.useCallback((key: string) => {
    storeKey(key);
    setApiKey(key);
  }, []);

  const disconnect = React.useCallback(() => {
    clearStoredKey();
    setApiKey(null);
  }, []);

  const value = React.useMemo<CoworkingContextValue>(
    () => ({ apiKey, ready, client, connect, disconnect }),
    [apiKey, ready, client, connect, disconnect],
  );

  return <CoworkingContext.Provider value={value}>{children}</CoworkingContext.Provider>;
}

export function useCoworking(): CoworkingContextValue {
  const ctx = React.useContext(CoworkingContext);
  if (!ctx) throw new Error("useCoworking must be used within <CoworkingProvider>");
  return ctx;
}
