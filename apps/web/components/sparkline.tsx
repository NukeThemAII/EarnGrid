type SparklineProps = {
  points: number[];
};

export function Sparkline({ points }: SparklineProps) {
  if (points.length < 2) {
    return <div className="h-16 w-full rounded-md border border-border bg-surface" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-16 w-full" role="img" aria-label="Share price trend sparkline">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--chart-1)" />
          <stop offset="100%" stopColor="var(--chart-2)" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#spark)"
        strokeWidth="3"
        points={path}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
