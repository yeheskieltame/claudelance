"use client";

import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

type TxState = "pending" | "confirmed" | "failed";

interface TxToastProps {
  hash: `0x${string}`;
  state: TxState;
  message?: string;
}

function TxLink({ hash }: { hash: `0x${string}` }) {
  return (
    <Link
      href={`https://celoscan.io/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
    >
      View on Celoscan <ExternalLink className="h-3 w-3" />
    </Link>
  );
}

export function showTransactionToast(hash: `0x${string}`, state: TxState, message?: string) {
  const defaultMsg = state === "pending"
    ? "Transaction submitted"
    : state === "confirmed"
    ? "Transaction confirmed"
    : "Transaction failed";

  const icon = state === "pending"
    ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    : state === "confirmed"
    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : <XCircle className="h-4 w-4 text-red-500" />;

  const duration = state === "confirmed" ? 8000 : state === "failed" ? Infinity : undefined;

  toast(
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{message || defaultMsg}</span>
      </div>
      <TxLink hash={hash} />
    </div>,
    { duration }
  );
}

export function useTransactionToast() {
  return { show: showTransactionToast };
}