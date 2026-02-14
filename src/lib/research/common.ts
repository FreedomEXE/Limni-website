import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import {
  computeStaticDrawdownPctFromPercentCurve,
  computeTrailingDrawdownPct,
} from "@/lib/risk/drawdown";

export function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function pickParams(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.length === 0) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function computeMaxDrawdown(points: Array<{ equity_pct: number }>) {
  return computeTrailingDrawdownPct(points.map((point) => point.equity_pct));
}

export function computeStaticDrawdown(points: Array<{ equity_pct: number }>) {
  return computeStaticDrawdownPctFromPercentCurve(points);
}

export function buildWeekOptionsFromCurve(
  points: Array<{ ts_utc: string }>,
  currentWeekOpenUtc: string = points.at(-1)?.ts_utc ?? points[0]?.ts_utc ?? "",
  extraWeeks: string[] = [],
) {
  const historicalWeeks = [...points.map((point) => point.ts_utc), ...extraWeeks];
  const weeks = buildDataWeekOptions({
    historicalWeeks,
    currentWeekOpenUtc,
    includeAll: false,
    limit: 12,
  }).filter((week): week is string => week !== "all");
  return weeks.map((week) => ({ value: week, label: weekLabelFromOpen(week) }));
}
