"use client";

import { useAccount, useReadContract } from "wagmi";

import { blendedVaultAbi } from "@blended-vault/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatUsd } from "@/lib/format";
import { usdcDecimals, vaultAddress } from "@/lib/chain";

export function OnchainMetrics() {
  const { address } = useAccount();
  const safeVaultAddress = (vaultAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const { data: totalAssets } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "totalAssets",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: totalSupply } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "totalSupply",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: assetsPerShare } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "assetsPerShare",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: idleLiquidityBps } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "idleLiquidityBps",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: maxDailyIncreaseBps } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "maxDailyIncreaseBps",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: pausedDeposits } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "pausedDeposits",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: pausedWithdrawals } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "pausedWithdrawals",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: userShares } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "balanceOf",
    args: [address ?? safeVaultAddress],
    query: { enabled: Boolean(address && vaultAddress) },
  });

  const { data: maxWithdraw } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "maxWithdraw",
    args: [address ?? safeVaultAddress],
    query: { enabled: Boolean(address && vaultAddress) },
  });

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-sm text-muted">Onchain snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm text-muted md:grid-cols-2">
          <div className="flex items-center justify-between">
            <span>Vault assets</span>
            <span className="text-text number">
              {totalAssets !== undefined ? formatUsd(totalAssets, usdcDecimals) : "--"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Vault supply</span>
            <span className="text-text number">
              {totalSupply !== undefined ? formatNumber(totalSupply, usdcDecimals) : "--"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Assets per share</span>
            <span className="text-text number">
              {assetsPerShare !== undefined ? formatNumber(assetsPerShare, 18, 6) : "--"} USDC
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Deposits / Withdrawals</span>
            <span className="text-text">
              {(pausedDeposits || pausedWithdrawals) ? "Paused" : "Active"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Idle liquidity target</span>
            <span className="text-text number">
              {idleLiquidityBps !== undefined ? `${formatBps(idleLiquidityBps)}%` : "--"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Harvest guard</span>
            <span className="text-text number">
              {maxDailyIncreaseBps !== undefined
                ? maxDailyIncreaseBps === 0n
                  ? "Disabled"
                  : `${formatBps(maxDailyIncreaseBps)}% / day`
                : "--"}
            </span>
          </div>
        </div>
        <div className="section-divider" />
        <div className="space-y-2 text-sm text-muted">
          <div className="flex items-center justify-between">
            <span>Your shares</span>
            <span className="text-text number">{userShares ? formatNumber(userShares, usdcDecimals) : "--"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Max withdraw</span>
            <span className="text-text number">{maxWithdraw ? formatUsd(maxWithdraw, usdcDecimals) : "--"}</span>
          </div>
        </div>
        {!vaultAddress ? (
          <p className="text-xs text-muted">
            Set `NEXT_PUBLIC_VAULT_ADDRESS` to enable onchain reads.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatBps(value: bigint): string {
  return (Number(value) / 100).toFixed(2);
}
