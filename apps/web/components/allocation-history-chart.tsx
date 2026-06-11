import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ALLOCATION_COLORS } from "@/lib/contracts";
import { formatUsd, shortenAddress } from "@/lib/format";
import type { AllocationHistoryResponse } from "@/lib/indexer";

type AllocationHistoryChartProps = {
  snapshots: AllocationHistoryResponse["snapshots"];
};

type SeriesPoint = {
  timestamp: number;
  values: number[];
  total: number;
};

type SeriesMeta = {
  key: string;
  label: string;
  color: string;
  latestAssets: number;
  latestPercent: number;
};

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const PADDING = {
  top: 14,
  right: 14,
  bottom: 24,
  left: 38,
};

const colors = ALLOCATION_COLORS;

export function AllocationHistoryChart({ snapshots }: AllocationHistoryChartProps) {
  const model = buildChartModel(snapshots);

  return (
    <Card className="animate-rise">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-sm text-muted">Allocation history</CardTitle>
          <p className="mt-2 text-xs text-muted">
            {model
              ? `${model.points.length} hourly samples · ${formatUtcRange(model.firstTimestamp, model.lastTimestamp)}`
              : "Waiting for allocation samples from the indexer."}
          </p>
        </div>
        {model ? (
          <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted">
            {model.series.length} sources
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!model ? (
          <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-4 text-sm text-muted">
            Allocation history will appear after the indexer records strategy snapshots.
          </div>
        ) : (
          <>
            <AllocationStackedArea points={model.points} series={model.series} />
            <div className="grid gap-2 text-xs text-muted md:grid-cols-2">
              {model.series.map((series) => (
                <div
                  key={series.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surfaceElevated/60 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    <span className="truncate text-text">{series.label}</span>
                  </div>
                  <div className="shrink-0 text-right number">
                    <div>{series.latestPercent.toFixed(1)}%</div>
                    <div className="text-[11px] text-muted">{formatDisplayUsd(series.latestAssets)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AllocationStackedArea({ points, series }: { points: SeriesPoint[]; series: SeriesMeta[] }) {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const xFor = (index: number) =>
    PADDING.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
  const yFor = (percent: number) =>
    PADDING.top + (1 - Math.max(0, Math.min(percent, 100)) / 100) * innerHeight;

  const cumulative: number[][] = points.map(() => Array(series.length + 1).fill(0));
  points.forEach((point, pointIndex) => {
    point.values.forEach((value, seriesIndex) => {
      const percent = point.total > 0 ? (value / point.total) * 100 : 0;
      cumulative[pointIndex][seriesIndex + 1] = cumulative[pointIndex][seriesIndex] + percent;
    });
  });

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Stacked area chart of allocation history"
      className="h-64 w-full overflow-visible"
    >
      {[0, 50, 100].map((tick) => {
        const y = yFor(tick);
        return (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray={tick === 0 ? undefined : "4 6"}
              strokeOpacity="0.8"
            />
            <text x="0" y={y + 4} fill="var(--muted)" fontSize="11" className="number">
              {tick}%
            </text>
          </g>
        );
      })}
      {series.map((item, seriesIndex) => {
        const top = points.map((_, pointIndex) => ({
          x: xFor(pointIndex),
          y: yFor(cumulative[pointIndex][seriesIndex + 1]),
        }));
        const bottom = points
          .map((_, pointIndex) => ({
            x: xFor(pointIndex),
            y: yFor(cumulative[pointIndex][seriesIndex]),
          }))
          .reverse();
        const path = [...top, ...bottom]
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ");
        return (
          <path
            key={item.key}
            d={`${path} Z`}
            fill={item.color}
            opacity="0.78"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />
        );
      })}
      <line
        x1={PADDING.left}
        x2={CHART_WIDTH - PADDING.right}
        y1={CHART_HEIGHT - PADDING.bottom}
        y2={CHART_HEIGHT - PADDING.bottom}
        stroke="var(--border)"
      />
      <text
        x={PADDING.left}
        y={CHART_HEIGHT - 4}
        fill="var(--muted)"
        fontSize="11"
        className="number"
      >
        {formatShortDate(points[0]?.timestamp)}
      </text>
      <text
        x={CHART_WIDTH - PADDING.right}
        y={CHART_HEIGHT - 4}
        fill="var(--muted)"
        fontSize="11"
        textAnchor="end"
        className="number"
      >
        {formatShortDate(points[points.length - 1]?.timestamp)}
      </text>
    </svg>
  );
}

function buildChartModel(snapshots: AllocationHistoryResponse["snapshots"]) {
  const sorted = [...snapshots]
    .filter((snapshot) => snapshot.allocations.length > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length < 2) {
    return null;
  }

  const latest = sorted[sorted.length - 1];
  const latestByStrategy = new Map(
    latest.allocations.map((allocation) => [allocation.strategy, toUsdcNumber(allocation.assets)])
  );
  const orderedStrategies = [...latestByStrategy.entries()]
    .filter(([, assets]) => assets > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([strategy]) => strategy);

  if (orderedStrategies.length === 0) {
    return null;
  }

  const visibleStrategies = orderedStrategies.slice(0, 5);
  const includeOther = orderedStrategies.length > visibleStrategies.length;
  const seriesKeys = includeOther ? [...visibleStrategies, "__other"] : visibleStrategies;

  const points: SeriesPoint[] = sorted.map((snapshot) => {
    const byStrategy = new Map(
      snapshot.allocations.map((allocation) => [allocation.strategy, toUsdcNumber(allocation.assets)])
    );
    const values = visibleStrategies.map((strategy) => byStrategy.get(strategy) ?? 0);
    if (includeOther) {
      const other = snapshot.allocations.reduce((sum, allocation) => {
        if (visibleStrategies.includes(allocation.strategy)) {
          return sum;
        }
        return sum + toUsdcNumber(allocation.assets);
      }, 0);
      values.push(other);
    }
    return {
      timestamp: snapshot.timestamp,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    };
  });

  const latestPoint = points[points.length - 1];
  const series: SeriesMeta[] = seriesKeys.map((key, index) => {
    const latestAssets = latestPoint.values[index] ?? 0;
    return {
      key,
      label: key === "__other" ? "Other strategies" : shortenAddress(key),
      color: colors[index % colors.length],
      latestAssets,
      latestPercent: latestPoint.total > 0 ? (latestAssets / latestPoint.total) * 100 : 0,
    };
  });

  return {
    points,
    series,
    firstTimestamp: points[0].timestamp,
    lastTimestamp: latestPoint.timestamp,
  };
}

function toUsdcNumber(value: string): number {
  try {
    return Number(BigInt(value)) / 1_000_000;
  } catch {
    return 0;
  }
}

function formatDisplayUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatUtcRange(start: number, end: number): string {
  return `${formatShortDate(start)} to ${formatShortDate(end)}`;
}

function formatShortDate(timestamp: number | undefined): string {
  if (!timestamp) {
    return "--";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp * 1000));
}
