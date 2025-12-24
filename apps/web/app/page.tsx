import { AllocationsTable } from "@/components/allocations-table";
import { MetricCard } from "@/components/metric-card";
import { OnchainAllocationSummary } from "@/components/onchain-allocation-summary";
import { OnchainMetrics } from "@/components/onchain-metrics";
import { Sparkline } from "@/components/sparkline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAllocations, fetchApy, fetchPriceHistory, fetchTvl } from "@/lib/indexer";
import { formatNumber, formatPercent, formatUsd } from "@/lib/format";

function buildSparkline(value: string | undefined, history?: string[]): number[] {
  if (history && history.length > 1) {
    const points = history
      .map((entry) => Number(entry) / 1e18)
      .filter((entry) => Number.isFinite(entry));
    if (points.length > 1) {
      return points;
    }
  }

  if (!value) {
    return [1, 1.01, 1.015, 1.02, 1.03, 1.035, 1.04];
  }
  const base = Number(value) / 1e18;
  if (!Number.isFinite(base) || base === 0) {
    return [1, 1.01, 1.015, 1.02, 1.03, 1.035, 1.04];
  }
  return Array.from({ length: 12 }, (_, index) => base * (0.985 + index * 0.0035));
}

export default async function DashboardPage() {
  const [apy, tvl, allocations, history] = await Promise.all([
    fetchApy(),
    fetchTvl(),
    fetchAllocations(),
    fetchPriceHistory(48),
  ]);

  const sharePrice = tvl ? formatNumber(tvl.assetsPerShare, 18, 6) : "--";
  const tvlUsd = tvl ? formatUsd(tvl.totalAssets) : "--";
  const apy7d = formatPercent(apy?.apy7d ?? null);
  const apy30d = formatPercent(apy?.apy30d ?? null);
  const totalStrategies = allocations?.allocations.length ?? 0;
  const historyPoints = history?.snapshots.map((snapshot) => snapshot.assetsPerShare);

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">MetaYield Dashboard</p>
            <h2 className="text-3xl font-semibold text-balance">
              USDC savings with guardrails, not guesswork.
            </h2>
            <p className="max-w-2xl text-sm text-muted">
              The Blended Vault allocates across vetted Base strategies with caps, tier limits, and
              transparent queues. Realized APY and allocations update hourly from the indexer.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-surface/70 px-4 py-3 text-xs text-muted">
            Last snapshot: {apy?.timestamp ? new Date(apy.timestamp * 1000).toUTCString() : "--"}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total value locked" value={tvlUsd} hint="USDC across vault + strategies" />
          <MetricCard label="Share price" value={`${sharePrice} USDC`} hint="assets per share" />
          <MetricCard label="Realized APY (7d)" value={apy7d} hint="from assetsPerShare" />
          <MetricCard label="Realized APY (30d)" value={apy30d} hint="from assetsPerShare" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <AllocationsTable allocations={allocations?.allocations ?? []} />
          <OnchainAllocationSummary />
        </div>
        <div className="space-y-6">
          <OnchainMetrics />
          <Card className="animate-rise">
            <CardHeader>
              <CardTitle className="text-sm text-muted">Share price trend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Sparkline points={buildSparkline(tvl?.assetsPerShare, historyPoints)} />
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="number">{sharePrice} USDC</span>
                <span>{totalStrategies} active strategies</span>
              </div>
              <div className="section-divider" />
              <div className="space-y-2 text-xs text-muted">
                <div className="flex items-center justify-between">
                  <span>Deposit queue</span>
                  <span>Allocator controlled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Withdraw queue</span>
                  <span>Liquidity-first</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Performance fee</span>
                  <span>3% HWM</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
