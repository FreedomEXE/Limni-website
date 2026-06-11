type SparkPoint = {
  ts_utc: string;
  equity_pct: number;
};

type MiniSparklineProps = {
  points: SparkPoint[];
  height?: number;
};

function buildPath(points: SparkPoint[], width: number, height: number) {
  if (points.length === 0) {
    return "";
  }
  const values = points.map((p) => p.equity_pct);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.equity_pct - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function MiniSparkline({ points, height = 80 }: MiniSparklineProps) {
  const width = 320;
  const path = buildPath(points, width, height);

  if (!path) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/50 p-4 text-sm text-[color:var(--muted)]">
        No equity data for this week yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-4">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-[var(--accent-strong)]"
        />
      </svg>
    </div>
  );
}
