"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast, Toaster } from "sonner";
import { createPublicClient, http, type Hash, type TransactionReceipt } from "viem";

import { chainById, DEFAULT_CHAIN_ID } from "@/lib/chain";

const CONFIRMED_DURATION_MS = 8_000;
const PERSIST_UNTIL_DISMISSED = Infinity;

export type TransactionToastOptions = {
  chainId?: number;
  confirmations?: number;
  pendingMessage?: string;
  confirmedMessage?: string;
  failedMessage?: string;
  toastId?: string | number;
};

export function TransactionToast() {
  return <Toaster closeButton richColors position="bottom-right" />;
}

export function useTransactionToast(hash: Hash | null | undefined, options: TransactionToastOptions = {}) {
  const {
    chainId = DEFAULT_CHAIN_ID,
    confirmations = 1,
    pendingMessage = "Transaction pending",
    confirmedMessage = "Transaction confirmed",
    failedMessage = "Transaction failed",
    toastId,
  } = options;

  const chain = chainById(chainId) ?? chainById(DEFAULT_CHAIN_ID);
  const client = React.useMemo(() => {
    if (!chain) return null;
    return createPublicClient({
      chain,
      transport: http(),
    });
  }, [chain]);

  React.useEffect(() => {
    if (!hash || !chain || !client) return;

    const id = toastId ?? `tx:${chain.id}:${hash}`;
    const explorerUrl = getTransactionExplorerUrl(chain, hash);
    const action = explorerUrl
      ? {
          label: "View",
          onClick: () => window.open(explorerUrl, "_blank", "noopener,noreferrer"),
        }
      : undefined;

    toast.loading(pendingMessage, {
      id,
      icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden />,
      description: formatTransactionDescription(hash),
      duration: PERSIST_UNTIL_DISMISSED,
      action,
    });

    client
      .waitForTransactionReceipt({ hash, confirmations })
      .then((receipt) => {
        if (receipt.status === "success") {
          toast.success(confirmedMessage, {
            id,
            icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
            description: formatConfirmedDescription(receipt),
            duration: CONFIRMED_DURATION_MS,
            action,
          });
          return;
        }

        toast.error(failedMessage, {
          id,
          icon: <XCircle className="h-4 w-4" aria-hidden />,
          description: "The transaction was included on-chain but reverted.",
          duration: PERSIST_UNTIL_DISMISSED,
          action,
        });
      })
      .catch((error: unknown) => {
        toast.error(failedMessage, {
          id,
          icon: <XCircle className="h-4 w-4" aria-hidden />,
          description: getErrorMessage(error),
          duration: PERSIST_UNTIL_DISMISSED,
          action,
        });
      });
  }, [
    chain,
    client,
    confirmations,
    confirmedMessage,
    failedMessage,
    hash,
    pendingMessage,
    toastId,
  ]);
}

export function getTransactionExplorerUrl(chain: NonNullable<ReturnType<typeof chainById>>, hash: Hash) {
  const baseUrl = chain.blockExplorers?.default.url;
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/tx/${hash}` : null;
}

function formatTransactionDescription(hash: Hash) {
  return `Waiting for ${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatConfirmedDescription(receipt: TransactionReceipt) {
  return `Included in block ${receipt.blockNumber.toString()}.`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unable to confirm the transaction. Please check the explorer for details.";
}
