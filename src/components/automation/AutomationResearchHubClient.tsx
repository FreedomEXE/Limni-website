/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AutomationResearchHubClient.tsx
 *
 * Description:
 * Lightweight multi-series research chart surface for the Automation
 * landing page. Kept intentionally simple and self-contained.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useMemo, useState } from "react";

type HubSeriesPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
};

type HubSeries = {
  id: string;
  label: string;
  color?: string;
  points: HubSeriesPoint[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function SimpleSeriesChart({
  title,
  description,
  trailingLabel,
  series,
}: {
  title: string;
  description: string;
  trailingLabel: string;
  series: HubSeries[];
}) {
  const [visibleIds, setVisibleIds] = useState<string[]>(() => series.map((item) => item.id));

  const visibleSeries = useMemo(() => {
    const filtered = series.filter((item) => visibleIds.includes(item.id));
    return filtered.length > 0 ? filtered : series;
  }, [series, visibleIds]);

  const dimensions = {
    width: 980,
    height: 320,
    paddingX: 40,
    paddingY: 24,
  };
  const chartW = dimensions.width - dimensions.paddingX * 2;
  const chartH = dimensions.height - dimensions.paddingY * 2;

  const allPoints = visibleSeries.flatMap((item) => item.points);
  if (allPoints.length === 0) {
    return null;
  }

  const sortedTs = allPoints
    .map((point) => Date.parse(point.ts_utc))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const minTs = sortedTs[0] ?? Date.now();
  const maxTs = sortedTs[sortedTs.length - 1] ?? minTs + 1;
  const tsSpan = Math.max(maxTs - minTs, 1);
  const values = allPoints.map((point) => point.equity_pct);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const span = Math.max(maxValue - minValue, 1);
  const yMin = minValue - span * 0.08;
  const yMax = maxValue + span * 0.08;
  const ySpan = Math.max(yMax - yMin, 1);

  const toX = (tsUtc: string) => {
    const ts = Date.parse(tsUtc);
    const ratio = clamp((ts - minTs) / tsSpan, 0, 1);
    return dimensions.paddingX + ratio * chartW;
  };
  const toY = (value: number) => {
    const ratio = (yMax - value) / ySpan;
    return dimensions.paddingY + clamp(ratio, 0, 1) * chartH;
  };
  const zeroY = toY(0);

  const toggleSeries = (id: string) => {
    setVisibleIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        return next.length > 0 ? next : current;
      }
      return [...current, id];
    });
  };

  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {description}
          </p>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {trailingLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {series.map((item) => {
          const active = visibleIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleSeries(item.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                active
                  ? "border-[var(--panel-border)] bg-[var(--panel)]/80 text-[var(--foreground)]"
                  : "border-[var(--panel-border)]/70 bg-[var(--panel)]/40 text-[color:var(--muted)] opacity-60"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? "#10b981" }} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3">
        <svg viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} className="h-[320px] w-full">
          <rect
            x={dimensions.paddingX}
            y={dimensions.paddingY}
            width={chartW}
            height={chartH}
            rx="18"
            fill="rgba(255,255,255,0.02)"
          />
          <line
            x1={dimensions.paddingX}
            y1={zeroY}
            x2={dimensions.width - dimensions.paddingX}
            y2={zeroY}
            stroke="rgba(148,163,184,0.45)"
            strokeDasharray="5 5"
          />

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = yMin + ySpan * ratio;
            const y = toY(value);
            return (
              <g key={ratio}>
                <line
                  x1={dimensions.paddingX}
                  y1={y}
                  x2={dimensions.width - dimensions.paddingX}
                  y2={y}
                  stroke="rgba(148,163,184,0.12)"
                />
                <text x={6} y={y + 4} fill="currentColor" fontSize="11" opacity="0.7">
                  {value.toFixed(0)}%
                </text>
              </g>
            );
          })}

          {visibleSeries.map((item) => {
            const path = item.points
              .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(point.ts_utc).toFixed(2)} ${toY(point.equity_pct).toFixed(2)}`)
              .join(" ");
            const lastPoint = item.points[item.points.length - 1];
            return (
              <g key={item.id}>
                <path d={path} fill="none" stroke={item.color ?? "#10b981"} strokeWidth="2.4" strokeLinecap="round" />
                {lastPoint ? (
                  <circle
                    cx={toX(lastPoint.ts_utc)}
                    cy={toY(lastPoint.equity_pct)}
                    r="4"
                    fill={item.color ?? "#10b981"}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export default function AutomationResearchHubClient({
  compositeSeries,
  flagshipFocusSeries,
  canonicalWeeks,
  flagshipLabel,
}: {
  compositeSeries: HubSeries[];
  flagshipFocusSeries: HubSeries[];
  canonicalWeeks: number;
  flagshipLabel: string;
}) {
  return (
    <>
      <SimpleSeriesChart
        title="Composite System Curves"
        description="Simple-sum weekly cumulative view for all canonical composite systems. Use the toggles to compare or isolate specific variants."
        trailingLabel={`Canonical weeks: ${canonicalWeeks}`}
        series={compositeSeries}
      />
      <SimpleSeriesChart
        title="Flagship Focus"
        description="Compare the promoted weekly flagship against its baseline variant and the standalone models inside its stack."
        trailingLabel={`Current flagship: ${flagshipLabel}`}
        series={flagshipFocusSeries}
      />
    </>
  );
}
