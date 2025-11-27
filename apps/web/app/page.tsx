"use client";

import { useMemo } from "react";
import { Radio, ShieldCheck, Sparkles } from "lucide-react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { ActionPanel } from "../components/ActionPanel";
import { MetricCard } from "../components/MetricCard";
import { StrategyTable } from "../components/StrategyTable";
import { earngridVaultAbi } from "../lib/abi/earngridVault";
import { erc20Abi } from "../lib/abi/erc20";
import { appConfig } from "../lib/config";
import { primaryVault } from "../lib/vaults";

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function Home() {
  const vault = primaryVault;
  const chainId = appConfig.chainId;

  const { data: assetAddress } = useReadContract({
    address: appConfig.vaultAddress,
    abi: earngridVaultAbi,
    functionName: "asset",
    chainId,
    query: { enabled: appConfig.vaultAddress !== "0x0000000000000000000000000000000000000000" }
  });

  const resolvedAsset = (assetAddress as `0x${string}` | undefined) || appConfig.assetAddress;

  const { data: totalAssets } = useReadContract({
    address: appConfig.vaultAddress,
    abi: earngridVaultAbi,
    functionName: "totalAssets",
    chainId,
    query: { enabled: appConfig.vaultAddress !== "0x0000000000000000000000000000000000000000" }
  });

  const { data: totalSupply } = useReadContract({
    address: appConfig.vaultAddress,
    abi: earngridVaultAbi,
    functionName: "totalSupply",
    chainId,
    query: { enabled: appConfig.vaultAddress !== "0x0000000000000000000000000000000000000000" }
  });

  const { data: decimals } = useReadContract({
    address: resolvedAsset,
    abi: erc20Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: resolvedAsset !== "0x0000000000000000000000000000000000000000" }
  });

  const assetDecimals = typeof decimals === "number" ? decimals : 6;

  const sharePrice = useMemo(() => {
    if (!totalAssets || !totalSupply || totalSupply === 0n) return vault.sharePrice;
    const price = Number(totalAssets) / Number(totalSupply);
    return price;
  }, [totalAssets, totalSupply, vault.sharePrice]);

  const tvl = useMemo(() => {
    if (!totalAssets) return vault.tvl;
    return Number(formatUnits(totalAssets, assetDecimals));
  }, [assetDecimals, totalAssets, vault.tvl]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-white/95 via-white/80 to-teal/5 p-6 shadow-soft backdrop-blur">
        <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">EarnGrid Vault</p>
            <h2 className="text-3xl font-semibold text-ink">
              Curated USDC yield, diversified across trusted ERC-4626 vaults.
            </h2>
            <p className="max-w-2xl text-slate-600">
              EarnGrid pairs Euler Earn&apos;s battle-tested meta-vault with risk-filtered strategies, caps, and queues.
              Deposit once, and let allocations adapt as yields shift.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-ink">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-soft">
                <ShieldCheck size={16} />
                Curated caps & queues
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-soft">
                <Sparkles size={16} />
                Live APY targeting {(vault.apy * 100).toFixed(1)}%
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-soft">
                <Radio size={16} />
                Base mainnet USDC
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Vault health</p>
              <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">Live</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-slate-600">TVL</p>
                <p className="text-lg font-semibold text-ink">{formatUsd(tvl)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-slate-600">APY (placeholder)</p>
                <p className="text-lg font-semibold text-ink">{(vault.apy * 100).toFixed(2)}%</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-slate-600">Share price</p>
                <p className="text-lg font-semibold text-ink">${sharePrice.toFixed(4)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-slate-600">Cash buffer</p>
                <p className="text-lg font-semibold text-ink">{(vault.cashBuffer * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total assets" value={formatUsd(tvl)} helper="USDC across all strategies" />
        <MetricCard
          label="Blended APY"
          value={`${(vault.apy * 100).toFixed(2)}%`}
          helper="Net of curator-defined caps"
        />
        <MetricCard
          label="Smearing window"
          value={`${vault.smearDuration / 3600} hours`}
          helper="Rebalances avoid sudden moves"
        />
        <MetricCard label="Vault symbol" value={vault.symbol} helper="ERC-4626 compliant shares" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <StrategyTable strategies={vault.strategies} />
        <ActionPanel
          vaultAddress={appConfig.vaultAddress}
          assetAddress={resolvedAsset}
          chainId={chainId}
          decimals={assetDecimals}
          sharePrice={sharePrice}
        />
      </section>
    </div>
  );
}
