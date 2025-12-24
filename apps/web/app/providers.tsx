"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { base, baseSepolia } from "wagmi/chains";

import { TxToastProvider } from "@/components/tx-toast";
import { defaultRpcUrl } from "@/lib/chain";

const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [injected()],
  transports: {
    [base.id]: http(defaultRpcUrl),
    [baseSepolia.id]: http(defaultRpcUrl),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TxToastProvider>{children}</TxToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
