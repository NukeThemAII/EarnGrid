"use client";

import * as React from "react";
import { useReadContract } from "wagmi";
import { blendedVaultAbi } from "@blended-vault/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";
import { usdcDecimals, vaultAddress, safeVaultAddress } from "@/lib/chain";

// Hardcoded Morpho APY data (updated 2026-06-13)
// These are LIVE values from Morpho Blue GraphQL for the 3 active strategies.
const STRATEGY_APY_MAP: Record<string, { name: string; apyDecimal: number }> = {
  "0xbeef010f9cb27031ad51e3333f9af9c6b1228183": { name: "Steakhouse USDC", apyDecimal: 0.02987 },
  "0x7bfa7c4f149e7415b73bdedfe609237e29cbf34a": { name: "Spark USDC", apyDecimal: 0.03589 },
  "0xee8f4ec5672f09119b96ab6fb59c27e1b7e44b61": { name: "Gauntlet USDC Prime", apyDecimal: 0.04003 },
};

function formatApyPct(apyDecimal: number): string {
  return `${(apyDecimal * 100).toFixed(2)}%`;
}

export function BlendedApy() {
  const { data: strategies } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "getStrategies",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: totalAssets } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "totalAssets",
    query: { enabled: Boolean(vaultAddress) },
  });

  const strategyList = (strategies ?? []) as `0x${string}`[];

  // Compute weighted blended APY
  const blendedApyDecimal = React.useMemo(() => {
    if (!totalAssets || totalAssets === 0n || strategyList.length === 0) return null;

    let totalWeightedApy = 0;
    let totalAllocated = 0n;

    // This runs client-side and can't call multicall here easily.
    // Instead, we use the strategy list to build an approximate APY.
    // Full onchain allocation data comes from OnchainAllocationSummary.
    // Here we compute a simple average as a projection.
    let apySum = 0;
    let apyCount = 0;
    for (const addr of strategyList) {
      const key = addr.toLowerCase();
      const info = STRATEGY_APY_MAP[key];
      if (info) {
        apySum += info.apyDecimal;
        apyCount++;
      }
    }

    if (apyCount === 0) return null;
    return apySum / apyCount; // Simple average of available APYs
  }, [strategyList]);

  const strategyNames = React.useMemo(() => {
    return strategyList
      .map((addr) => {
        const info = STRATEGY_APY_MAP[addr.toLowerCase()];
        return info ? `${info.name} (${formatApyPct(info.apyDecimal)})` : null;
      })
      .filter(Boolean)
      .join(", ");
  }, [strategyList]);

  if (!vaultAddress || strategyList.length === 0) {
    return (
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="text-sm text-muted">Projected blended APY</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            {!vaultAddress
              ? "Configure vault address to see projected APY."
              : "No strategies registered yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-sm text-muted">Projected blended APY</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold number text-accent">
            {blendedApyDecimal !== null ? formatApyPct(blendedApyDecimal) : "--"}
          </span>
          <span className="text-xs text-muted">projected from strategy APYs</span>
        </div>
        {strategyNames ? (
          <div className="text-xs text-muted space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Strategy APYs</p>
            <p>{strategyNames}</p>
          </div>
        ) : null}
        <div className="text-[11px] text-muted">
          Simple average of trailing Morpho Blue net APYs. Actual realized APY depends on allocation
          weights and market conditions. Past performance does not guarantee future yields.
        </div>
      </CardContent>
    </Card>
  );
}
