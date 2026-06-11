import type { Metadata } from "next";

import { DepositWithdrawPanel } from "@/components/deposit-withdraw-panel";
import { OnchainMetrics } from "@/components/onchain-metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchApy, fetchTvl } from "@/lib/indexer";
import { formatNumber, formatPercent, formatUsd } from "@/lib/format";

export const metadata: Metadata = {
  title: "Vault · EarnGrid",
  description: "Deposit and withdraw USDC from the EarnGrid Blended Vault on Base.",
};

export default async function VaultPage() {
  const [apy, tvl] = await Promise.all([fetchApy(), fetchTvl()]);
  const tvlUsd = tvl ? formatUsd(tvl.totalAssets) : "--";
  const sharePrice = tvl ? formatNumber(tvl.assetsPerShare, 18, 6) : "--";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle className="text-sm text-muted">Vault status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">TVL</span>
              <span className="text-lg font-semibold number">{tvlUsd}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Share price</span>
              <span className="text-lg font-semibold number">{sharePrice} USDC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Realized APY (7d)</span>
              <span className="text-lg font-semibold number">{formatPercent(apy?.apy7d ?? null)}</span>
            </div>
            <div className="section-divider" />
            <div className="space-y-2 text-xs text-muted">
              <p>
                Deposits are allocated across whitelisted strategies via the deposit queue. Withdraws
                unwind in queue order and revert if liquidity is insufficient.
              </p>
              <p>
                Performance fee is 3% of profits above the high-water mark, minted as shares to the
                fee recipient.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle className="text-sm text-muted">Fee disclosure</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted">
            EarnGrid charges a 3% performance fee only on gains above the high-water mark. There is
            no management fee. Fees are minted as vault shares to the fee recipient.
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <DepositWithdrawPanel />
        <OnchainMetrics />
      </div>
    </div>
  );
}
