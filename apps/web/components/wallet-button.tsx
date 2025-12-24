"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chain, chainId } from "@/lib/chain";
import { shortenAddress } from "@/lib/format";

type WalletButtonProps = {
  size?: "sm" | "md" | "lg";
};

export function WalletButton({ size = "md" }: WalletButtonProps) {
  const { address, isConnected, chain: activeChain } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const hasConnector = connectors.length > 0;
  const isWrongNetwork =
    isConnected && activeChain ? activeChain.id !== chainId : false;

  if (!hasConnector) {
    return (
      <Button variant="outline" size={size} disabled>
        No wallet detected
      </Button>
    );
  }

  if (isConnected && address) {
    if (isWrongNetwork) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="default">Wrong network</Badge>
          <Button
            size={size}
            onClick={() => void switchChainAsync({ chainId })}
            disabled={isSwitching}
          >
            Switch to {chain.name}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Badge variant="accent">{activeChain?.name ?? chain.name}</Badge>
        <Button variant="outline" size={size} onClick={() => disconnect()}>
          {shortenAddress(address)}
        </Button>
      </div>
    );
  }

  return (
    <Button
      size={size}
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
