/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: RollingPerformanceWindows.tsx
 *
 * Description:
 * Displays trailing 4/8/12-week rolling performance windows showing
 * return, max drawdown, and Sharpe ratio for each window. Gives a
 * quick read on recent momentum vs. all-time stats.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import type { WeekReturn } from "@/components/performance/ReturnsCalendar";
import type { PerformanceSimulationSeries } from "@/components/performance/PerformanceSimulationSection";
import { computeRollingWindowStatsFromWeekReturns } from "@/lib/performance/resolvedPerformanceMetrics";

const WINDOWS = [4, 8, 12] as const;

type WindowStats = {
  weeks: number;
  returnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
};

export function computeWindowStats(weeks: WeekReturn[]): WindowStats {
  return computeRollingWindowStatsFromWeekReturns(weeks);
}

function computeWindowStatsFromPath(
  weeks: WeekReturn[],
  series: PerformanceSimulationSeries | null | undefined,
): WindowStats | null {
  if (!series || series.points.length === 0 || weeks.length === 0) return null;
  const sortedWeeks = [...weeks].sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));
  const startMs = Date.parse(sortedWeeks[0]?.weekOpenUtc ?? "");
  if (!Number.isFinite(startMs)) return null;
  const points = series.points
    .filter((point) => Date.parse(point.ts_utc) >= startMs)
    .sort((left, right) => Date.parse(left.ts_utc) - Date.parse(right.ts_utc));
  if (points.length === 0) return null;

  const baseline = points[0]?.equity_pct ?? 0;
  const shiftedReturns = points.map((point) => point.equity_pct - baseline);
  const returnPct = shiftedReturns.at(-1) ?? 0;
  let peak = 0;
  let maxDrawdownPct = 0;
  for (const value of shiftedReturns) {
    peak = Math.max(peak, value);
    const drawdownPct = (100 + peak) <= 0
      ? 100
      : Math.abs((((100 + value) / (100 + peak)) - 1) * 100);
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct);
  }

  const returns = sortedWeeks.map((week) => week.returnPct);
  let sharpe = 0;
  if (returns.length > 1) {
    const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? avg / std : 0;
  }

  return {
    weeks: sortedWeeks.length,
    returnPct,
    maxDrawdownPct,
    sharpe,
  };
}

export default function RollingPerformanceWindows({
  weeks,
  series,
}: {
  weeks: WeekReturn[];
  series?: PerformanceSimulationSeries | null;
}) {
  if (weeks.length < WINDOWS[0]) return null;

  const sorted = [...weeks].sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));

  const windows = WINDOWS
    .filter((size) => sorted.length >= size)
    .map((size) => ({
      size,
      stats: computeWindowStatsFromPath(sorted.slice(-size), series) ?? computeWindowStats(sorted.slice(-size)),
    }));

  if (windows.length === 0) return null;

  const returnColor = (v: number) => (v >= 0 ? "text-lime-400" : "text-red-400");

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Rolling Windows
      </h3>
      <div className="grid gap-3 md:grid-cols-3">
        {windows.map(({ size, stats }) => (
          <div
            key={size}
            className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/50 p-3"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
              Last {size} Weeks
            </div>
            <div className={`mt-1.5 text-xl font-bold ${returnColor(stats.returnPct)}`}>
              {stats.returnPct >= 0 ? "+" : ""}
              {stats.returnPct.toFixed(2)}%
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                  Max DD
                </div>
                <div className="font-bold text-red-400">{stats.maxDrawdownPct.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                  Sharpe
                </div>
                <div className="font-bold">{stats.sharpe.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
