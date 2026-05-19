/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: DailyReturnDistribution.tsx
 *
 * Description:
 * Week-view histogram of daily returns derived from a simulation equity curve.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import type { PerformanceSimulationSeries } from "@/components/performance/PerformanceSimulationSection";

type DailyReturn = {
  dayLabel: string;
  returnPct: number;
};

function isWeekendPoint(tsUtc: string): boolean {
  const d = new Date(tsUtc);
  const day = d.getUTCDay();
  if (day === 6) return true;
  if (day === 0 && d.getUTCHours() < 21) return true;
  return false;
}

function filterMarketHours(points: PerformanceSimulationSeries["points"]) {
  const now = Date.now();
  const filtered = points.filter((point) => !isWeekendPoint(point.ts_utc) && new Date(point.ts_utc).getTime() <= now);
  if (filtered.length > 0) return filtered;
  const pastPoints = points.filter((point) => new Date(point.ts_utc).getTime() <= now);
  if (pastPoints.length > 0) return pastPoints;
  return points.length > 0 ? [points[0]] : [];
}

function extractDailyReturns(series: PerformanceSimulationSeries): DailyReturn[] {
  const groups = new Map<string, PerformanceSimulationSeries["points"]>();
  for (const point of filterMarketHours(series.points)) {
    const dateKey = point.ts_utc.slice(0, 10);
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(point);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, points]) => {
      const ordered = [...points].sort((left, right) => Date.parse(left.ts_utc) - Date.parse(right.ts_utc));
      const first = ordered[0];
      const last = ordered.at(-1);
      return {
        dayLabel: formatDayLabel(dateKey),
        returnPct: first && last ? last.equity_pct - first.equity_pct : 0,
      };
    })
    .filter((day) => Number.isFinite(day.returnPct));
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function computeBins(returns: number[], binCount: number) {
  if (returns.length === 0) return { bins: [], min: 0, max: 0 };
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const range = max - min;
  if (range === 0) {
    return { bins: [{ start: min, end: min, count: returns.length }], min, max };
  }
  const binWidth = range / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + index * binWidth,
    end: min + (index + 1) * binWidth,
    count: 0,
  }));
  for (const value of returns) {
    const index = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
    bins[index]!.count += 1;
  }
  return { bins, min, max };
}

export default function DailyReturnDistribution({
  series,
}: {
  series: PerformanceSimulationSeries;
}) {
  const dailyReturns = extractDailyReturns(series);
  if (dailyReturns.length < 3) return null;

  const returns = dailyReturns.map((day) => day.returnPct).sort((left, right) => left - right);
  const binCount = Math.min(Math.max(Math.ceil(Math.sqrt(returns.length)), 3), 8);
  const { bins } = computeBins(returns, binCount);
  if (bins.length === 0) return null;

  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const median = returns.length % 2 === 0
    ? ((returns[returns.length / 2 - 1] ?? 0) + (returns[returns.length / 2] ?? 0)) / 2
    : returns[Math.floor(returns.length / 2)] ?? 0;
  const variance = returns.length > 1
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);

  const chartW = 600;
  const chartH = 180;
  const padL = 40;
  const padR = 20;
  const padT = 10;
  const padB = 36;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const barGap = 2;
  const barW = (plotW - barGap * (bins.length - 1)) / bins.length;

  const globalMin = bins[0]?.start ?? 0;
  const globalMax = bins.at(-1)?.end ?? 0;
  const toX = (value: number) =>
    globalMax === globalMin
      ? padL + plotW / 2
      : padL + ((value - globalMin) / (globalMax - globalMin)) * plotW;
  const meanX = toX(mean);

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Daily Return Distribution
        </h3>
        <div className="flex gap-4 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          <span>
            Mean:{" "}
            <strong className={mean >= 0 ? "text-lime-400" : "text-red-400"}>
              {mean >= 0 ? "+" : ""}{mean.toFixed(2)}%
            </strong>
          </span>
          <span>
            Median:{" "}
            <strong className={median >= 0 ? "text-lime-400" : "text-red-400"}>
              {median >= 0 ? "+" : ""}{median.toFixed(2)}%
            </strong>
          </span>
          <span>
            StdDev: <strong>{stdDev.toFixed(2)}</strong>
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {bins.map((bin, index) => {
          const x = padL + index * (barW + barGap);
          const h = (bin.count / maxCount) * plotH;
          const y = padT + plotH - h;
          const midValue = (bin.start + bin.end) / 2;
          const fill = midValue >= 0 ? "#10b981" : "#f43f5e";
          return (
            <g key={`${bin.start}-${bin.end}`}>
              <rect x={x} y={y} width={barW} height={h} rx={2} fill={fill} opacity={0.72} />
              {bin.count > 0 ? (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="var(--muted)" fontSize={9}>
                  {bin.count}
                </text>
              ) : null}
            </g>
          );
        })}
        {globalMin < 0 && globalMax > 0 ? (
          <line
            x1={toX(0)}
            y1={padT}
            x2={toX(0)}
            y2={padT + plotH}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.4}
          />
        ) : null}
        <line
          x1={meanX}
          y1={padT}
          x2={meanX}
          y2={padT + plotH + 4}
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="3,2"
        />
        <text x={meanX} y={padT + plotH + 16} textAnchor="middle" fill="#60a5fa" fontSize={9}>
          u
        </text>
        {bins.map((bin, index) => (
          <text
            key={`label-${bin.start}-${index}`}
            x={padL + index * (barW + barGap) + barW / 2}
            y={padT + plotH + 30}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize={9}
          >
            {bin.start.toFixed(1)}%
          </text>
        ))}
      </svg>
    </div>
  );
}
