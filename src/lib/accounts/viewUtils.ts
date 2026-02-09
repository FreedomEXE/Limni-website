import { DateTime } from "luxon";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
}

export function computeMaxDrawdown(points: { equity_pct: number }[]) {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.equity_pct > peak) {
      peak = point.equity_pct;
    }
    const drawdown = peak - point.equity_pct;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

export function extendToWindow<T extends { ts_utc: string }>(
  points: T[],
  windowEndUtc: string | null,
) {
  if (!windowEndUtc || points.length === 0) {
    return points;
  }
  const last = points[points.length - 1];
  if (
    DateTime.fromISO(last.ts_utc, { zone: "utc" }) >=
    DateTime.fromISO(windowEndUtc, { zone: "utc" })
  ) {
    return points;
  }
  return [...points, { ...last, ts_utc: windowEndUtc }];
}
