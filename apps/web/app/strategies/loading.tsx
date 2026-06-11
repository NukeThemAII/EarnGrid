export default function StrategiesLoading() {
  return (
    <div className="space-y-6 animate-fade">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={6} />
      <SkeletonCard lines={5} />
    </div>
  );
}

function SkeletonCard({ lines }: { lines: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/80 p-5 space-y-3">
      <div className="h-3 w-28 rounded bg-border animate-pulse" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-border/60 animate-pulse"
          style={{ width: `${55 + Math.random() * 40}%` }}
        />
      ))}
    </div>
  );
}
