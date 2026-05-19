/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: dailySimulationReturns.ts
 *
 * Description:
 * Shared helpers for deriving trading-day returns from a simulation equity curve.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { PerformanceSimulationSeries } from "@/components/performance/PerformanceSimulationSection";

export type DailySimulationReturn = {
  dateKey: string;
  dayLabel: string;
  returnPct: number;
  maxDrawdownPct: number;
  activePositions: number;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function isWeekendPoint(tsUtc: string): boolean {
  const d = new Date(tsUtc);
  const day = d.getUTCDay();
  if (day === 6) return true;
  if (day === 0 && d.getUTCHours() < 21) return true;
  return false;
}

function filterMarketHours(points: PerformanceSimulationSeries["points"], nowMs: number) {
  const filtered = points.filter((point) => !isWeekendPoint(point.ts_utc) && new Date(point.ts_utc).getTime() <= nowMs);
  if (filtered.length > 0) return filtered;
  const pastPoints = points.filter((point) => new Date(point.ts_utc).getTime() <= nowMs);
  if (pastPoints.length > 0) return pastPoints;
  return points.length > 0 ? [points[0]] : [];
}

function tradingDateKey(tsUtc: string) {
  const date = new Date(tsUtc);
  if (date.getUTCDay() === 0 && date.getUTCHours() >= 21) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function buildDailySimulationReturns(
  series: PerformanceSimulationSeries,
  nowMs = Date.now(),
): DailySimulationReturn[] {
  const groups = new Map<string, PerformanceSimulationSeries["points"]>();
  for (const point of filterMarketHours(series.points, nowMs)) {
    const dateKey = tradingDateKey(point.ts_utc);
    const label = formatDayLabel(dateKey);
    if (!WEEKDAY_LABELS.includes(label as (typeof WEEKDAY_LABELS)[number])) continue;
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(point);
  }

  let previousClose: number | null = null;
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, points]) => {
      const ordered = [...points].sort((left, right) => Date.parse(left.ts_utc) - Date.parse(right.ts_utc));
      const first = ordered[0];
      const last = ordered.at(-1);
      const startEquity = previousClose ?? first?.equity_pct ?? 0;
      const endEquity = last?.equity_pct ?? startEquity;
      previousClose = endEquity;
      const drawdowns = ordered
        .map((point) => point.drawdown_pct)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      return {
        dateKey,
        dayLabel: formatDayLabel(dateKey),
        returnPct: endEquity - startEquity,
        maxDrawdownPct: drawdowns.length > 0 ? Math.abs(Math.min(...drawdowns)) : 0,
        activePositions: last?.active_positions ?? 0,
      };
    })
    .filter((day) => Number.isFinite(day.returnPct));
}
