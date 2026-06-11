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
export const CALENDAR_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isWeekendPoint(tsUtc: string): boolean {
  const d = new Date(tsUtc);
  const day = d.getUTCDay();
  if (day === 6) return true;
  if (day === 0 && d.getUTCHours() < 21) return true;
  return false;
}

function filterMarketHours(
  points: PerformanceSimulationSeries["points"],
  nowMs: number,
  includeWeekends: boolean,
) {
  const filtered = points.filter((point) => (
    (includeWeekends || !isWeekendPoint(point.ts_utc)) &&
    new Date(point.ts_utc).getTime() <= nowMs
  ));
  if (filtered.length > 0) return filtered;
  const pastPoints = points.filter((point) => new Date(point.ts_utc).getTime() <= nowMs);
  if (pastPoints.length > 0) return pastPoints;
  return points.length > 0 ? [points[0]] : [];
}

function tradingDateKey(tsUtc: string, includeWeekends: boolean) {
  const date = new Date(tsUtc);
  if (!includeWeekends && date.getUTCDay() === 0 && date.getUTCHours() >= 21) {
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
  options: { includeWeekends?: boolean } = {},
): DailySimulationReturn[] {
  const includeWeekends = options.includeWeekends === true;
  const allowedLabels: readonly string[] = includeWeekends ? CALENDAR_DAY_LABELS : WEEKDAY_LABELS;
  const days = new Map<string, DailySimulationReturn>();
  let previousEquity = 0;

  for (const point of [...filterMarketHours(series.points, nowMs, includeWeekends)]
    .sort((left, right) => Date.parse(left.ts_utc) - Date.parse(right.ts_utc))) {
    const dateKey = tradingDateKey(point.ts_utc, includeWeekends);
    const label = formatDayLabel(dateKey);
    const currentEquity = Number.isFinite(point.equity_pct) ? point.equity_pct : previousEquity;

    if (allowedLabels.includes(label)) {
      const existing = days.get(dateKey) ?? {
        dateKey,
        dayLabel: label,
        returnPct: 0,
        maxDrawdownPct: 0,
        activePositions: 0,
      };

      const drawdownPct = typeof point.drawdown_pct === "number" && Number.isFinite(point.drawdown_pct)
        ? Math.abs(point.drawdown_pct)
        : 0;
      days.set(dateKey, {
        ...existing,
        returnPct: existing.returnPct + (currentEquity - previousEquity),
        maxDrawdownPct: Math.max(existing.maxDrawdownPct, drawdownPct),
        activePositions: point.active_positions ?? existing.activePositions,
      });
    }

    previousEquity = currentEquity;
  }

  return [...days.values()]
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .filter((day) => Number.isFinite(day.returnPct));
}
