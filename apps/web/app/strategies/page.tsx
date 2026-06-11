import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnchainStrategies } from "@/components/onchain-strategies";
import { fetchAllocations } from "@/lib/indexer";
import { formatUsd, shortenAddress } from "@/lib/format";

export const metadata: Metadata = {
  title: "Strategies · EarnGrid",
  description: "Explore the EarnGrid strategy universe — risk tiers, caps, and allocations.",
};

export default async function StrategiesPage() {
  const allocations = await fetchAllocations();

  return (
    <div className="space-y-6">
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="text-sm text-muted">Strategy universe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted">
          <p>
            EarnGrid only integrates synchronous ERC-4626 vaults for v0.1. Each strategy is
            allowlisted, capped, and assigned a risk tier.
          </p>
          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-3">
              <p className="text-text">Tier 0</p>
              <p>Blue-chip, highest confidence.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-3">
              <p className="text-text">Tier 1</p>
              <p>Curated blue-chip vaults.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-3">
              <p className="text-text">Tier 2</p>
              <p>Newer or higher risk exposures.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <OnchainStrategies />

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="text-sm text-muted">Indexer snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted">Hourly snapshot from the indexer service.</p>
          <div className="space-y-3">
            {allocations?.allocations.length ? (
              allocations.allocations.map((strategy) => (
                <div
                  key={strategy.strategy}
                  className="grid gap-3 rounded-lg border border-border/70 bg-surfaceElevated/60 p-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.6fr]"
                >
                  <div>
                    <div className="text-sm text-text">{shortenAddress(strategy.strategy)}</div>
                    <div className="text-xs text-muted">Tier {strategy.tier}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Allocation</div>
                    <div className="text-sm text-text number">{formatUsd(strategy.assets)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Cap</div>
                    <div className="text-sm text-text number">{formatUsd(strategy.capAssets)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Status</div>
                    <div className="text-sm text-text">
                      {strategy.enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted">No strategies indexed yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
