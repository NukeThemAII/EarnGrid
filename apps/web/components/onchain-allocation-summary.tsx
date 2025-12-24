"use client";

import * as React from "react";
import { formatUnits } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

import { blendedVaultAbi } from "@blended-vault/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd, shortenAddress } from "@/lib/format";
import { usdcDecimals, vaultAddress } from "@/lib/chain";

const erc20MetadataAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

const colors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--accent)",
  "var(--accent-strong)",
  "var(--chart-3)",
];

type AllocationRow = {
  address: `0x${string}`;
  name: string | null;
  symbol: string | null;
  assets: bigint;
  percent: number;
};

export function OnchainAllocationSummary() {
  const safeVaultAddress = (vaultAddress ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const { data: totalAssets } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "totalAssets",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: strategiesRaw } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "getStrategies",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: depositQueueRaw } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "getDepositQueue",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: withdrawQueueRaw } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "getWithdrawQueue",
    query: { enabled: Boolean(vaultAddress) },
  });

  const strategies = (strategiesRaw ?? []) as `0x${string}`[];
  const depositQueue = (depositQueueRaw ?? []) as `0x${string}`[];
  const withdrawQueue = (withdrawQueueRaw ?? []) as `0x${string}`[];

  const assetContracts = React.useMemo(
    () =>
      strategies.map((strategy) => ({
        address: safeVaultAddress,
        abi: blendedVaultAbi,
        functionName: "strategyAssets",
        args: [strategy],
      })),
    [strategies, safeVaultAddress]
  );

  const nameContracts = React.useMemo(
    () =>
      strategies.map((strategy) => ({
        address: strategy,
        abi: erc20MetadataAbi,
        functionName: "name",
      })),
    [strategies]
  );

  const symbolContracts = React.useMemo(
    () =>
      strategies.map((strategy) => ({
        address: strategy,
        abi: erc20MetadataAbi,
        functionName: "symbol",
      })),
    [strategies]
  );

  const { data: assetsData } = useReadContracts({
    contracts: assetContracts,
    query: { enabled: Boolean(vaultAddress && strategies.length) },
  });

  const { data: namesData } = useReadContracts({
    contracts: nameContracts,
    query: { enabled: Boolean(vaultAddress && strategies.length) },
  });

  const { data: symbolsData } = useReadContracts({
    contracts: symbolContracts,
    query: { enabled: Boolean(vaultAddress && strategies.length) },
  });

  const rows = React.useMemo<AllocationRow[]>(() => {
    const total = totalAssets ?? 0n;
    const totalFloat = toFloat(total, usdcDecimals);
    return strategies
      .map((address, index) => {
        const assets = unwrapResult<bigint>(assetsData?.[index]) ?? 0n;
        const name = unwrapResult<string>(namesData?.[index]);
        const symbol = unwrapResult<string>(symbolsData?.[index]);
        const percent = totalFloat > 0 ? (toFloat(assets, usdcDecimals) / totalFloat) * 100 : 0;
        return {
          address,
          name: name ?? null,
          symbol: symbol ?? null,
          assets,
          percent,
        };
      })
      .filter((row) => row.assets > 0n)
      .sort((a, b) => b.assets - a.assets);
  }, [strategies, assetsData, namesData, symbolsData, totalAssets]);

  const totalLabel = totalAssets ? formatUsd(totalAssets, usdcDecimals) : "--";
  const gradient = buildGradient(rows);

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-sm text-muted">Onchain allocation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!vaultAddress ? (
          <p className="text-xs text-muted">Set `NEXT_PUBLIC_VAULT_ADDRESS` to load onchain data.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No strategy allocations onchain yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative h-40 w-40">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: gradient }}
                />
                <div className="absolute inset-5 rounded-full bg-surface" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-muted">
                  <span className="text-[10px] uppercase tracking-[0.2em]">TVL</span>
                  <span className="mt-1 text-sm font-semibold text-text number">{totalLabel}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-xs text-muted">
                {rows.slice(0, 5).map((row, index) => (
                  <div key={row.address} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <span className="text-text">
                        {row.name ?? row.symbol ?? shortenAddress(row.address)}
                      </span>
                    </div>
                    <span className="number">{row.percent.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 text-xs text-muted md:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-3">
                <p className="text-text">Deposit queue</p>
                {depositQueue.length ? (
                  <div className="mt-2 space-y-1">
                    {depositQueue.map((address, index) => (
                      <div key={address} className="flex items-center justify-between">
                        <span>#{index + 1}</span>
                        <span className="text-text">{shortenAddress(address)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2">No deposit queue set.</p>
                )}
              </div>
              <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-3">
                <p className="text-text">Withdraw queue</p>
                {withdrawQueue.length ? (
                  <div className="mt-2 space-y-1">
                    {withdrawQueue.map((address, index) => (
                      <div key={address} className="flex items-center justify-between">
                        <span>#{index + 1}</span>
                        <span className="text-text">{shortenAddress(address)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2">No withdraw queue set.</p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function buildGradient(rows: AllocationRow[]): string {
  if (rows.length === 0) {
    return "conic-gradient(var(--border) 0% 100%)";
  }
  let offset = 0;
  const stops = rows.map((row, index) => {
    const value = Math.max(row.percent, 0);
    const start = offset;
    offset += value;
    return `${colors[index % colors.length]} ${start}% ${offset}%`;
  });
  if (offset < 100) {
    stops.push(`var(--border) ${offset}% 100%`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function unwrapResult<T>(value: unknown): T | null {
  if (value && typeof value === "object" && "result" in value) {
    const result = (value as { result?: T | null }).result;
    return result ?? null;
  }
  if (value !== undefined && value !== null) {
    return value as T;
  }
  return null;
}

function toFloat(value: bigint, decimals: number): number {
  return Number(formatUnits(value, decimals));
}
