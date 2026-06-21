"use client";

import { ExternalLink } from "lucide-react";

import { MINIPAY_ADD_CASH, useMiniPayDetection } from "@/lib/minipay";
import { cn } from "@/lib/utils";

/**
 * "Add cash in MiniPay" deeplink. MiniPay holds only stablecoins, so this is the
 * top-up path when a user is short on funds. Renders nothing outside MiniPay.
 */
export function MiniPayAddCash({ className }: { className?: string }) {
  const isMiniPay = useMiniPayDetection();
  if (!isMiniPay) return null;
  return (
    <a
      href={MINIPAY_ADD_CASH}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline",
        className,
      )}
    >
      Low on funds? Add cash in MiniPay
      <ExternalLink aria-hidden className="h-3.5 w-3.5" />
    </a>
  );
}
