type EquityPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function EquityCurveChart({
  points,
  title,
}: {
  points: EquityPoint[];
  title: string;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-sm text-[color:var(--muted)]">
        No equity-curve data available.
      </div>
    );
  }

  const width = 980;
  const height = 320;
  const paddingX = 24;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const values = points.flatMap((p) =>
    p.lock_pct === null ? [p.equity_pct] : [p.equity_pct, p.lock_pct],
  );
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(maxValue - minValue, 1e-6);
  const yMin = minValue - span * 0.08;
  const yMax = maxValue + span * 0.08;
  const ySpan = yMax - yMin;

  const toX = (index: number) =>
    paddingX + (index / Math.max(points.length - 1, 1)) * chartW;
  const toY = (value: number) =>
    paddingY + ((yMax - value) / ySpan) * chartH;

  const equityPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(p.equity_pct).toFixed(2)}`)
    .join(" ");
  const lockPath = points
    .map((p, index) => ({ ...p, index }))
    .filter((p) => p.lock_pct !== null)
    .map((p, i) => {
      return `${i === 0 ? "M" : "L"} ${toX(p.index).toFixed(2)} ${toY(p.lock_pct ?? 0).toFixed(2)}`;
    })
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const endChange = last.equity_pct - first.equity_pct;
  const endColor = endChange >= 0 ? "#10b981" : "#f43f5e";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = yMin + ySpan * ratio;
    return {
      value,
      y: toY(value),
    };
  });

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {title}
        </h3>
        <span className="text-xs font-semibold" style={{ color: endColor }}>
          {last.equity_pct >= 0 ? "+" : ""}
          {last.equity_pct.toFixed(2)}%
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
          <defs>
            <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
            <filter id="equity-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={paddingX}
                y1={tick.y}
                x2={width - paddingX}
                y2={tick.y}
                stroke="rgba(148,163,184,0.28)"
                strokeWidth="1"
              />
              <text
                x={clamp(paddingX - 8, 0, width)}
                y={tick.y - 4}
                fill="rgba(100,116,139,0.9)"
                fontSize="10"
                textAnchor="end"
              >
                {tick.value.toFixed(1)}%
              </text>
            </g>
          ))}

          {equityPath ? (
            <>
              <path
                d={`${equityPath} L ${toX(points.length - 1).toFixed(2)} ${(height - paddingY).toFixed(2)} L ${toX(0).toFixed(2)} ${(height - paddingY).toFixed(2)} Z`}
                fill="url(#equity-fill)"
              />
              <path
                d={equityPath}
                fill="none"
                stroke={endColor}
                strokeWidth="3"
                filter="url(#equity-glow)"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          ) : null}

          {lockPath ? (
            <path
              d={lockPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
      </div>
    </div>
  );
}
