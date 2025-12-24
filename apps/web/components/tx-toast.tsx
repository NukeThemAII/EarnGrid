"use client";

import * as React from "react";
import { usePublicClient } from "wagmi";

import { Button } from "@/components/ui/button";
import { chain, chainId } from "@/lib/chain";
import { cn } from "@/lib/utils";

type TxStatus = "pending" | "success" | "error";

type TxToast = {
  id: string;
  title: string;
  description?: string;
  status: TxStatus;
  hash?: `0x${string}`;
};

type TrackTxOptions = {
  title: string;
  description?: string;
};

type TxToastContextValue = {
  trackTx: (action: () => Promise<`0x${string}`>, options: TrackTxOptions) => Promise<void>;
};

const TxToastContext = React.createContext<TxToastContextValue | null>(null);

export function TxToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<TxToast[]>([]);
  const publicClient = usePublicClient({ chainId });

  const trackTx = React.useCallback(
    async (action: () => Promise<`0x${string}`>, options: TrackTxOptions) => {
      const id = createId();
      setToasts((current) => [
        { id, title: options.title, description: options.description, status: "pending" },
        ...current,
      ]);

      try {
        const hash = await action();
        setToasts((current) =>
          current.map((toast) =>
            toast.id === id ? { ...toast, hash, description: "Transaction submitted." } : toast
          )
        );

        if (!publicClient) {
          return;
        }

        await publicClient.waitForTransactionReceipt({ hash });
        setToasts((current) =>
          current.map((toast) =>
            toast.id === id
              ? { ...toast, status: "success", description: "Transaction confirmed." }
              : toast
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transaction failed.";
        setToasts((current) =>
          current.map((toast) =>
            toast.id === id ? { ...toast, status: "error", description: message } : toast
          )
        );
      }
    },
    [publicClient]
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <TxToastContext.Provider value={{ trackTx }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[320px] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-lg border border-border/70 bg-surface/95 p-3 shadow-glow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-2">
                <span className={cn("mt-1 h-2 w-2 rounded-full", statusColor(toast.status))} />
                <div>
                  <p className="text-sm font-medium text-text">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-xs text-muted">{toast.description}</p>
                  ) : null}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => dismiss(toast.id)}>
                Close
              </Button>
            </div>
            {toast.hash ? (
              <a
                href={`${chain.blockExplorers?.default.url}/tx/${toast.hash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs text-accent hover:text-accentStrong"
              >
                View on explorer
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </TxToastContext.Provider>
  );
}

export function useTxToast(): TxToastContextValue {
  const context = React.useContext(TxToastContext);
  if (!context) {
    throw new Error("useTxToast must be used within TxToastProvider.");
  }
  return context;
}

function statusColor(status: TxStatus): string {
  if (status === "success") {
    return "bg-accent";
  }
  if (status === "error") {
    return "bg-rose-400";
  }
  return "bg-chart-2";
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
