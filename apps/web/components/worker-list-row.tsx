import Link from "next/link";
import { Trophy } from "lucide-react";
import type { Address } from "viem";

import { GlassCard } from "@/components/ui/card";
import { formatCELO } from "@/lib/format-token";
import { shortAddress } from "@/lib/utils";

export type WorkerListRowData = {
  address: Address;
  wins: number;
  totalPayout: bigint;
};

export function WorkerListRow({ row, rank }: { row: WorkerListRowData; rank: number }) {
  return (
    <Link href={`/worker/${row.address.toLowerCase()}`} className="block">
      <GlassCard className="!p-4 transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glass">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-semibold">
            #{rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm">{shortAddress(row.address)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.wins} win{row.wins === 1 ? "" : "s"} · {formatCELO(row.totalPayout)} CELO earned
            </p>
          </div>
          <Trophy aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </div>
      </GlassCard>
    </Link>
  );
}
