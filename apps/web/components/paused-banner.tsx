"use client";

import { useReadContract } from "wagmi";
import { AlertTriangle } from "lucide-react";
import { CLAUDELANCE_CORE_V3_ABI, deploymentByChainId } from "@yeheskieltame/claudelance-types";
import type { Address } from "viem";

import { DEFAULT_CHAIN_ID } from "@/lib/chain";

/**
 * App-wide circuit-breaker notice. The v3 contract is Pausable: while paused,
 * every state-changing call except withdrawEarnings reverts EnforcedPause.
 * Renders nothing in the normal (unpaused) case.
 */
export function PausedBanner() {
  const core = deploymentByChainId(DEFAULT_CHAIN_ID)!.core as Address;
  const { data: paused } = useReadContract({
    address: core,
    abi: CLAUDELANCE_CORE_V3_ABI,
    functionName: "paused",
    query: { refetchInterval: 60_000 },
  });

  if (!paused) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/95 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        Protocol writes are paused by the owner. Posting, claiming, and
        submitting are disabled; withdrawing earnings still works.
      </span>
    </div>
  );
}
