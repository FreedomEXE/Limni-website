"use client";

import { useMemo, useState } from "react";

type EquityPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
};

type EquitySeries = {
  id: string;
  label: string;
  color?: string;
  points: EquityPoint[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function nearestIndexByTs(points: EquityPoint[], tsMs: number) {
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const diff = Math.abs(new Date(points[i].ts_utc).getTime() - tsMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

const SERIES_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a78bfa", "#f43f5e"];

export default function EquityCurveChart({
  points,
  series,
  title,
  interactive = true,
}: {
  points?: EquityPoint[];
  series?: EquitySeries[];
  title: string;
  interactive?: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"compare" | "isolate">("compare");
  const normalized = useMemo(() => {
    if (series && series.length > 0) {
      return series.filter((row) => row.points.length > 0).map((row, idx) => ({
        ...row,
        color: row.color ?? SERIES_COLORS[idx % SERIES_COLORS.length],
      }));
    }
    if (points && points.length > 0) {
      return [{ id: "primary", label: "Equity", color: SERIES_COLORS[0], points }];
    }
    return [];
  }, [points, series]);

  if (normalized.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-sm text-[color:var(--muted)]">
        No equity-curve data available.
      </div>
    );
  }

  const resolvedVisible =
    visibleSeries ?? (normalized.length > 0 ? normalized.map((row) => row.id) : []);
  const displaySeries = normalized.filter((row) => resolvedVisible.includes(row.id));

  if (displaySeries.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-sm text-[color:var(--muted)]">
        No equity-curve data available.
      </div>
    );
  }

  const primary = displaySeries[0].points;
  const width = 980;
  const height = 320;
  const paddingX = 30;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const allValues = normalized.flatMap((row) =>
    row.points.flatMap((p) => (p.lock_pct === null ? [p.equity_pct] : [p.equity_pct, p.lock_pct])),
  );
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const span = Math.max(maxValue - minValue, 1e-6);
  const yMin = minValue - span * 0.08;
  const yMax = maxValue + span * 0.08;
  const ySpan = yMax - yMin;

  const toX = (index: number) =>
    paddingX + (index / Math.max(primary.length - 1, 1)) * chartW;
  const toY = (value: number) =>
    paddingY + ((yMax - value) / ySpan) * chartH;

  // FIXED: Proper peak/drawdown calculation
  // Track running peak and calculate max drawdown (peak → trough sequence)
  let peakIndex = 0;
  let troughIndex = 0;
  let maxDrawdown = 0;
  let runningPeak = primary[0]?.equity_pct ?? 0;
  let runningPeakIndex = 0;

  for (let i = 0; i < primary.length; i += 1) {
    const current = primary[i].equity_pct;

    // Update absolute peak
    if (current > runningPeak) {
      runningPeak = current;
      runningPeakIndex = i;
      peakIndex = i;
    }

    // Calculate drawdown from running peak
    const drawdown = runningPeak - current;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      troughIndex = i; // Trough is the lowest point after the peak
    }
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = yMin + ySpan * ratio;
    return { value, y: toY(value) };
  });

  const spanDays =
    primary.length > 1
      ? (new Date(primary[primary.length - 1].ts_utc).getTime() - new Date(primary[0].ts_utc).getTime()) / 86400000
      : 0;
  const tickFormat: Intl.DateTimeFormatOptions =
    spanDays > 2
      ? { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }
      : { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" };
  const xTicks = [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1].map((ratio) => {
    const index = Math.round(ratio * Math.max(primary.length - 1, 1));
    return {
      index,
      x: toX(index),
      label: new Date(primary[index]?.ts_utc ?? primary[0].ts_utc).toLocaleString("en-US", tickFormat),
    };
  });

  const zeroY = toY(0);
  const last = primary[primary.length - 1];
  const first = primary[0];
  const endChange = last.equity_pct - first.equity_pct;
  const endColor = endChange >= 0 ? "#10b981" : "#f43f5e";

  const hoverTsMs =
    hoverIndex === null ? null : new Date(primary[hoverIndex].ts_utc).getTime();

  const toggleSeries = (id: string) => {
    if (!interactive) return;
    setVisibleSeries((prev) => {
      const current = prev ?? normalized.map((row) => row.id);
      if (mode === "isolate") {
        return current.length === 1 && current[0] === id ? normalized.map((row) => row.id) : [id];
      }
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        return next.length > 0 ? next : current;
      }
      return [...current, id];
    });
  };

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {interactive ? (
            <>
              <button
                type="button"
                onClick={() => setMode("compare")}
                className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${
                  mode === "compare"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] text-[color:var(--muted)]"
                }`}
              >
                Compare
              </button>
              <button
                type="button"
                onClick={() => setMode("isolate")}
                className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${
                  mode === "isolate"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] text-[color:var(--muted)]"
                }`}
              >
                Isolate
              </button>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {normalized.map((row) => {
            const active = resolvedVisible.includes(row.id);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => toggleSeries(row.id)}
                className={`flex items-center gap-2 text-xs ${
                  active ? "text-[var(--foreground)]" : "text-[color:var(--muted)]"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: row.color, opacity: active ? 1 : 0.3 }}
                />
                {row.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[280px] w-full"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const localX = ((event.clientX - rect.left) / rect.width) * width;
            const ratio = clamp((localX - paddingX) / chartW, 0, 1);
            setHoverIndex(Math.round(ratio * Math.max(primary.length - 1, 1)));
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line x1={paddingX} y1={tick.y} x2={width - paddingX} y2={tick.y} stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
              <text x={paddingX - 8} y={tick.y - 4} fill="rgba(100,116,139,0.9)" fontSize="10" textAnchor="end">
                {tick.value.toFixed(1)}%
              </text>
            </g>
          ))}

          <line x1={paddingX} y1={zeroY} x2={width - paddingX} y2={zeroY} stroke="rgba(239,68,68,0.55)" strokeWidth="1.5" strokeDasharray="4 4" />

          {xTicks.map((tick) => (
            <g key={`${tick.index}-${tick.label}`}>
              <line x1={tick.x} y1={height - paddingY} x2={tick.x} y2={height - paddingY + 4} stroke="rgba(148,163,184,0.45)" strokeWidth="1" />
              <text x={tick.x} y={height - 2} fill="rgba(100,116,139,0.9)" fontSize="10" textAnchor="middle">
                {tick.label}
              </text>
            </g>
          ))}

          {displaySeries.map((row, rowIndex) => {
            const path = row.points
              .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(p.equity_pct).toFixed(2)}`)
              .join(" ");
            if (!path) return null;
            const stroke = row.color ?? SERIES_COLORS[rowIndex % SERIES_COLORS.length];
            return (
              <path
                key={row.id}
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={rowIndex === 0 ? 3 : 2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={rowIndex === 0 ? 1 : 0.9}
              />
            );
          })}

          {primary.length > 0 ? (
            <>
              <circle cx={toX(0)} cy={toY(primary[0].equity_pct)} r="4" fill="#38bdf8" />
              <circle cx={toX(peakIndex)} cy={toY(primary[peakIndex].equity_pct)} r="4" fill="#22c55e" />
              <circle cx={toX(troughIndex)} cy={toY(primary[troughIndex].equity_pct)} r="4" fill="#f43f5e" />
              <circle cx={toX(primary.length - 1)} cy={toY(last.equity_pct)} r="4" fill="#e2e8f0" />
              <text x={toX(0)} y={toY(primary[0].equity_pct) - 8} fill="#38bdf8" fontSize="10" textAnchor="middle">
                Start
              </text>
              <text x={toX(peakIndex)} y={toY(primary[peakIndex].equity_pct) - 10} fill="#22c55e" fontSize="10" textAnchor="middle">
                Peak {primary[peakIndex].equity_pct.toFixed(1)}%
              </text>
              <text x={toX(troughIndex)} y={toY(primary[troughIndex].equity_pct) + 16} fill="#f43f5e" fontSize="10" textAnchor="middle">
                Low {primary[troughIndex].equity_pct.toFixed(1)}%
              </text>
              <text x={toX(primary.length - 1)} y={toY(last.equity_pct) - 8} fill="#e2e8f0" fontSize="10" textAnchor="end">
                End {last.equity_pct.toFixed(1)}%
              </text>
            </>
          ) : null}

          {hoverIndex !== null && hoverTsMs !== null ? (
            <>
              <line
                x1={toX(hoverIndex)}
                y1={paddingY}
                x2={toX(hoverIndex)}
                y2={height - paddingY}
                stroke="rgba(148,163,184,0.6)"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              {displaySeries.map((row, idx) => {
                const pointIndex = nearestIndexByTs(row.points, hoverTsMs);
                const point = row.points[pointIndex];
                if (!point) return null;
                return (
                  <g key={`${row.id}-hover`}>
                    <circle cx={toX(pointIndex)} cy={toY(point.equity_pct)} r="4.5" fill={row.color ?? SERIES_COLORS[idx % SERIES_COLORS.length]} />
                    <text
                      x={toX(pointIndex) + 6}
                      y={toY(point.equity_pct) - 6}
                      fill={row.color ?? SERIES_COLORS[idx % SERIES_COLORS.length]}
                      fontSize="10"
                    >
                      {point.equity_pct.toFixed(2)}%
                    </text>
                  </g>
                );
              })}
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
