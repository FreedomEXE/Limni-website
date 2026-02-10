import { weekLabelFromOpen } from "@/lib/performanceSnapshots";

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
  if (points.length === 0) return 0;
  let peak = points[0].equity_pct;
  let maxDd = 0;
  for (const point of points) {
    if (point.equity_pct > peak) peak = point.equity_pct;
    const drawdown = peak - point.equity_pct;
    if (drawdown > maxDd) maxDd = drawdown;
  }
  return maxDd;
}

export function buildWeekOptionsFromCurve(points: Array<{ ts_utc: string }>) {
  return points
    .map((point) => point.ts_utc)
    .slice()
    .reverse()
    .map((week) => ({ value: week, label: weekLabelFromOpen(week) }));
}
