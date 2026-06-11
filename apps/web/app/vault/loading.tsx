export default function VaultLoading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] animate-fade">
      <div className="space-y-6">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={3} />
      </div>
      <div className="space-y-6">
        <SkeletonCard lines={8} />
        <SkeletonCard lines={6} />
      </div>
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
