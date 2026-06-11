export default function DashboardLoading() {
  return (
    <div className="space-y-10 animate-fade">
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-surface animate-pulse" />
          <div className="h-8 w-96 max-w-full rounded bg-surface animate-pulse" />
          <div className="h-4 w-72 max-w-full rounded bg-surface animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface/80 p-5 space-y-3"
            >
              <div className="h-3 w-24 rounded bg-border animate-pulse" />
              <div className="h-7 w-32 rounded bg-border animate-pulse" />
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={6} />
        </div>
        <div className="space-y-6">
          <SkeletonCard lines={8} />
          <SkeletonCard lines={3} />
        </div>
      </section>
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
          style={{ width: `${60 + Math.random() * 35}%` }}
        />
      ))}
    </div>
  );
}
