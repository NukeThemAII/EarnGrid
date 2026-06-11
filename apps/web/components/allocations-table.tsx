import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatUsd, shortenAddress } from "@/lib/format";

type Allocation = {
  strategy: string;
  assets: string;
  tier: number;
  capAssets: string;
  enabled: boolean;
  isSynchronous: boolean;
};

type AllocationsTableProps = {
  allocations: Allocation[];
};

export function AllocationsTable({ allocations }: AllocationsTableProps) {
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-sm text-muted">Current allocations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allocations.length === 0 ? (
            <div className="text-sm text-muted">No strategies indexed yet.</div>
          ) : (
            allocations.map((allocation) => {
              const utilization = capUtilization(allocation.assets, allocation.capAssets);
              return (
                <div
                  key={allocation.strategy}
                  className="space-y-3 rounded-lg border border-border/60 bg-surfaceElevated/60 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-sm font-medium">{shortenAddress(allocation.strategy)}</div>
                      <div className="text-xs text-muted">
                        Tier {allocation.tier} · Cap {formatUsd(allocation.capAssets)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <Badge variant={allocation.enabled ? "accent" : "default"}>
                        {allocation.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant={allocation.isSynchronous ? "accent" : "default"}>
                        {allocation.isSynchronous ? "Sync" : "Async"}
                      </Badge>
                      <div className="text-sm text-text number">{formatNumber(allocation.assets)} USDC</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Cap utilization</span>
                      <span className="number">{utilization === null ? "--" : `${utilization.toFixed(1)}%`}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(utilization ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function capUtilization(assets: string, capAssets: string): number | null {
  try {
    const cap = BigInt(capAssets);
    if (cap === 0n) {
      return null;
    }
    const current = BigInt(assets);
    return Number((current * 10_000n) / cap) / 100;
  } catch {
    return null;
  }
}
