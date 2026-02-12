"use client";

import { useId, useMemo, useState } from "react";

type EquityPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
  equity_usd?: number;
  static_baseline_usd?: number | null;
  static_drawdown_pct?: number;
  trailing_drawdown_pct?: number;
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
  watermarkText,
  referenceEquityUsd,
}: {
  points?: EquityPoint[];
  series?: EquitySeries[];
  title: string;
  interactive?: boolean;
  watermarkText?: string;
  referenceEquityUsd?: number;
}) {
  const chartId = useId().replace(/:/g, "");
  const [hoverTsMs, setHoverTsMs] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"compare" | "isolate">("compare");
  const [unitMode, setUnitMode] = useState<"pct" | "usd">("pct");

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

  const canShowUsd = normalized.every((row) =>
    row.points.every(
      (p) => Number.isFinite(Number(p.equity_usd)) || Number.isFinite(Number(referenceEquityUsd)),
    ),
  );
  const resolvedUnitMode = unitMode === "usd" && !canShowUsd ? "pct" : unitMode;
  const valueForPoint = (point: EquityPoint) => {
    if (resolvedUnitMode === "pct") return point.equity_pct;
    if (Number.isFinite(Number(point.equity_usd))) return Number(point.equity_usd);
    const base = Number(referenceEquityUsd);
    if (Number.isFinite(base) && base > 0) {
      return base * (1 + point.equity_pct / 100);
    }
    return point.equity_pct;
  };

  const primary = displaySeries[0].points;
  const width = 980;
  const height = 320;
  const paddingX = 44;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const startTs = new Date(primary[0].ts_utc).getTime();
  const endTs = new Date(primary[primary.length - 1].ts_utc).getTime();
  const tsSpan = Math.max(endTs - startTs, 1);

  const toXFromTs = (tsMs: number) => paddingX + ((tsMs - startTs) / tsSpan) * chartW;
  const toXFromIndex = (index: number) => toXFromTs(new Date(primary[index].ts_utc).getTime());

  const allValues = normalized.flatMap((row) => row.points.map((p) => valueForPoint(p)));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const span = Math.max(maxValue - minValue, 1e-6);
  const yMin = minValue - span * 0.08;
  const yMax = maxValue + span * 0.08;
  const ySpan = yMax - yMin;
  const toY = (value: number) => paddingY + ((yMax - value) / ySpan) * chartH;

  const trailingValues = primary.map((p) => valueForPoint(p));
  let peakIndex = 0;
  let troughIndex = 0;
  let runningPeak = trailingValues[0] ?? 0;
  let maxDrawdown = 0;
  for (let i = 0; i < trailingValues.length; i += 1) {
    const current = trailingValues[i];
    if (current > runningPeak) {
      runningPeak = current;
      peakIndex = i;
    }
    const drawdown = runningPeak - current;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      troughIndex = i;
    }
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = yMin + ySpan * ratio;
    return { value, y: toY(value) };
  });
  const formatY = (value: number) =>
    resolvedUnitMode === "usd"
      ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `${value.toFixed(1)}%`;

  const spanDays = (endTs - startTs) / 86400000;
  const xTicks = [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1].map((ratio) => {
    const tsMs = startTs + ratio * tsSpan;
    const index = nearestIndexByTs(primary, tsMs);
    const pointTs = new Date(primary[index]?.ts_utc ?? primary[0].ts_utc);
    return {
      tsMs: pointTs.getTime(),
      x: toXFromTs(pointTs.getTime()),
      label: pointTs.toLocaleString("en-US", spanDays > 2
        ? { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }
        : { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
    };
  });

  const baselineValue =
    resolvedUnitMode === "pct"
      ? 0
      : Number.isFinite(Number(primary[primary.length - 1]?.static_baseline_usd))
        ? Number(primary[primary.length - 1]?.static_baseline_usd)
        : Number.isFinite(Number(primary[0]?.equity_usd))
          ? Number(primary[0]?.equity_usd)
          : 0;
  const baselineY = toY(baselineValue);

  const last = primary[primary.length - 1];
  const first = primary[0];
  const lastValue = valueForPoint(last);
  const firstValue = valueForPoint(first);
  const endChange = lastValue - firstValue;
  const endColor = endChange >= 0 ? "#10b981" : "#f43f5e";

  const hoverPrimaryIndex =
    hoverTsMs === null ? null : nearestIndexByTs(primary, hoverTsMs);
  const hoverX =
    hoverPrimaryIndex === null ? null : toXFromIndex(hoverPrimaryIndex);

  const dayBoundaries: number[] = [];
  if (spanDays >= 1) {
    const cursor = new Date(startTs);
    cursor.setUTCHours(0, 0, 0, 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    while (cursor.getTime() < endTs) {
      dayBoundaries.push(cursor.getTime());
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const primaryLinePath = primary
    .map((p, i) => {
      const tsMs = new Date(p.ts_utc).getTime();
      return `${i === 0 ? "M" : "L"} ${toXFromTs(tsMs).toFixed(2)} ${toY(valueForPoint(p)).toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${primaryLinePath} L ${toXFromTs(endTs).toFixed(2)} ${baselineY.toFixed(2)} L ${toXFromTs(startTs).toFixed(2)} ${baselineY.toFixed(2)} Z`;

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
          {resolvedUnitMode === "usd"
            ? `$${lastValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
            : `${lastValue >= 0 ? "+" : ""}${lastValue.toFixed(2)}%`}
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
          <button
            type="button"
            onClick={() => setUnitMode("pct")}
            className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${
              resolvedUnitMode === "pct"
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] text-[color:var(--muted)]"
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => setUnitMode("usd")}
            disabled={!canShowUsd}
            className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${
              resolvedUnitMode === "usd"
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] text-[color:var(--muted)]"
            } ${canShowUsd ? "" : "cursor-not-allowed opacity-45"}`}
            title={canShowUsd ? "Show values in USD" : "USD values unavailable for this series"}
          >
            $
          </button>
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
            setHoverTsMs(startTs + ratio * tsSpan);
          }}
          onMouseLeave={() => setHoverTsMs(null)}
        >
          <defs>
            <clipPath id={`clip-above-${chartId}`}>
              <rect x="0" y="0" width={width} height={baselineY} />
            </clipPath>
            <clipPath id={`clip-below-${chartId}`}>
              <rect x="0" y={baselineY} width={width} height={height - baselineY} />
            </clipPath>
          </defs>

          {dayBoundaries.map((ts, idx) => (
            <rect
              key={`day-${ts}`}
              x={toXFromTs(ts)}
              y={paddingY}
              width={Math.max(1, chartW / Math.max(dayBoundaries.length + 1, 1))}
              height={chartH}
              fill={idx % 2 === 0 ? "rgba(148,163,184,0.03)" : "rgba(148,163,184,0.015)"}
            />
          ))}

          {watermarkText ? (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fill="rgba(148,163,184,0.12)"
              fontSize="54"
              fontWeight="700"
              letterSpacing="0.18em"
            >
              {watermarkText}
            </text>
          ) : null}

          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line x1={paddingX} y1={tick.y} x2={width - paddingX} y2={tick.y} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
              <text x={paddingX - 8} y={tick.y - 4} fill="rgba(100,116,139,0.9)" fontSize="10" textAnchor="end">
                {formatY(tick.value)}
              </text>
            </g>
          ))}

          <line x1={paddingX} y1={baselineY} x2={width - paddingX} y2={baselineY} stroke="rgba(226,232,240,0.45)" strokeWidth="1.5" strokeDasharray="4 4" />

          {xTicks.map((tick) => (
            <g key={`${tick.tsMs}-${tick.label}`}>
              <line x1={tick.x} y1={height - paddingY} x2={tick.x} y2={height - paddingY + 4} stroke="rgba(148,163,184,0.45)" strokeWidth="1" />
              <text x={tick.x} y={height - 2} fill="rgba(100,116,139,0.9)" fontSize="10" textAnchor="middle">
                {tick.label}
              </text>
            </g>
          ))}

          {primaryLinePath ? (
            <>
              <path d={areaPath} fill="rgba(16,185,129,0.16)" clipPath={`url(#clip-above-${chartId})`} />
              <path d={areaPath} fill="rgba(244,63,94,0.16)" clipPath={`url(#clip-below-${chartId})`} />
            </>
          ) : null}

          {displaySeries.map((row, rowIndex) => {
            const path = row.points
              .map((p, i) => {
                const x = toXFromTs(new Date(p.ts_utc).getTime());
                const y = toY(valueForPoint(p));
                return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              })
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
              <circle cx={toXFromIndex(0)} cy={toY(valueForPoint(primary[0]))} r="4" fill="#38bdf8" />
              <circle cx={toXFromIndex(peakIndex)} cy={toY(valueForPoint(primary[peakIndex]))} r="4" fill="#22c55e" />
              <circle cx={toXFromIndex(troughIndex)} cy={toY(valueForPoint(primary[troughIndex]))} r="4" fill="#f43f5e" />
            </>
          ) : null}

          {hoverPrimaryIndex !== null && hoverTsMs !== null && hoverX !== null ? (
            <>
              <line
                x1={hoverX}
                y1={paddingY}
                x2={hoverX}
                y2={height - paddingY}
                stroke="rgba(148,163,184,0.7)"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              {displaySeries.map((row, idx) => {
                const pointIndex = nearestIndexByTs(row.points, hoverTsMs);
                const point = row.points[pointIndex];
                if (!point) return null;
                const value = valueForPoint(point);
                const x = toXFromTs(new Date(point.ts_utc).getTime());
                const y = toY(value);
                return (
                  <g key={`${row.id}-hover`}>
                    <circle cx={x} cy={y} r="4.5" fill={row.color ?? SERIES_COLORS[idx % SERIES_COLORS.length]} />
                    <text
                      x={x + 6}
                      y={y - 6}
                      fill={row.color ?? SERIES_COLORS[idx % SERIES_COLORS.length]}
                      fontSize="10"
                    >
                      {resolvedUnitMode === "usd"
                        ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                        : `${value.toFixed(2)}%`}
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
