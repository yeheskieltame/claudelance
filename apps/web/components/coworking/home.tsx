"use client";

import { useCoworking } from "./provider";
import { Dashboard } from "./dashboard";
import { Onboarding } from "./onboarding";
import { Spinner } from "./ui";

/** Routes between the connect flow and the workspace dashboard based on the key. */
export function CoworkingHome() {
  const { apiKey, ready } = useCoworking();

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return apiKey ? <Dashboard /> : <Onboarding />;
}
