"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { http } from "viem";
import { base } from "viem/chains";
import { WagmiProvider, createConfig } from "wagmi";
import { appConfig } from "../lib/config";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "demo";

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "EarnGrid",
    projectId,
    chains: [base],
    transports: {
      [base.id]: http(appConfig.rpcUrl)
    },
    ssr: true
  })
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
