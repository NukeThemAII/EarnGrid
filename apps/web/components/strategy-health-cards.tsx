import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shortenAddress } from "@/lib/format";
import type { StrategyHealthResponse } from "@/lib/indexer";

type StrategyHealthCardsProps = {
  health: StrategyHealthResponse | null;
};

const TIER_LABELS: Record<number, string> = { 0: "Core", 1: "Tier 1", 2: "Tier 2" };

const UTILIZATION_THRESHOLDS = {
  warn: 0.75,
  danger: 0.9,
} as const;

function utilizationColor(utilization: number): string {
  if (utilization >= UTILIZATION_THRESHOLDS.danger) return "text-red-400";
  if (utilization >= UTILIZATION_THRESHOLDS.warn) return "text-amber-400";
  return "text-emerald-400";
}

function utilizationBg(utilization: number): string {
  if (utilization >= UTILIZATION_THRESHOLDS.danger) return "bg-red-400/20";
  if (utilization >= UTILIZATION_THRESHOLDS.warn) return "bg-amber-400/20";
  return "bg-emerald-400/20";
}

export function StrategyHealthCards({ health }: StrategyHealthCardsProps) {
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-sm text-muted">Strategy health</CardTitle>
        {health ? (
          <p className="text-xs text-muted">
            {health.strategies.length} strategies · snapshot{" "}
            {new Date(health.timestamp * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })}
          </p>
        ) : (
          <p className="text-xs text-muted">Waiting for strategy health data from the indexer.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!health || health.strategies.length === 0 ? (
          <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-4 text-sm text-muted">
            Strategy health metrics will appear after the indexer records allocation snapshots with
            utilization and share price tracking.
          </div>
        ) : (
          health.strategies.map((strategy) => {
            const utilizationPct = (strategy.utilization * 100).toFixed(2);
            const deltaSign = strategy.sharePriceDeltaBps >= 0 ? "+" : "";
            const deltaClass =
              strategy.sharePriceDeltaBps >= 0 ? "text-emerald-400" : "text-red-400";

            return (
              <div
                key={strategy.strategy}
                className="rounded-lg border border-border/70 bg-surfaceElevated/60 px-4 py-3 space-y-3"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-sm font-medium text-text">
                      {shortenAddress(strategy.strategy)}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted">
                    {TIER_LABELS[strategy.tier] ?? `Tier ${strategy.tier}`}
                  </span>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {/* Assets */}
                  <div>
                    <div className="text-muted mb-0.5">Assets</div>
                    <div className="text-text number">
                      ${(Number(strategy.assets) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Utilization */}
                  <div>
                    <div className="text-muted mb-0.5">Utilization</div>
                    <div className="flex items-center gap-1.5">
                      <span className={`number ${utilizationColor(strategy.utilization)}`}>
                        {utilizationPct}%
                      </span>
                      {strategy.utilization >= UTILIZATION_THRESHOLDS.warn && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${utilizationBg(strategy.utilization)} ${utilizationColor(strategy.utilization)}`}
                        >
                          {strategy.utilization >= UTILIZATION_THRESHOLDS.danger ? "NEAR CAP" : "HIGH"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delta */}
                  <div>
                    <div className="text-muted mb-0.5">Δ (bps)</div>
                    <div className={`number ${deltaClass}`}>
                      {strategy.sharePriceDeltaBps === 0
                        ? "--"
                        : `${deltaSign}${strategy.sharePriceDeltaBps}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
