import { DateTime } from "luxon";
import { getConnectedAccount } from "./connectedAccounts";
import { getWeekWindow } from "./weekBoundaries";
import type { WeekOption } from "./weekState";

/**
 * Account equity curve point with full context
 */
export type AccountEquityPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
  balance: number;
  equity: number;
  equity_usd?: number;
  static_baseline_usd?: number | null;
  static_drawdown_pct?: number;
  trailing_drawdown_pct?: number;
};

/**
 * Build equity curve for a connected account and specific week
 *
 * @param accountKey - The connected account key
 * @param weekOpenUtc - Week to build curve for, or "all" for all-time
 * @returns Array of equity points representing the curve
 */
export async function buildAccountEquityCurve(
  accountKey: string,
  weekOpenUtc: WeekOption
): Promise<AccountEquityPoint[]> {
  const account = await getConnectedAccount(accountKey);
  if (!account) {
    return [];
  }

  const analysis = account.analysis as Record<string, unknown> | null | undefined;
  const numericValue = (value: unknown) => (typeof value === "number" ? value : 0);
  const numericOrNull = (value: unknown) => (typeof value === "number" ? value : null);

  if (weekOpenUtc === "all") {
    return buildAccountAllTimeEquityCurve(accountKey);
  }

  // TODO: Fetch actual snapshot data from database for this week
  // const snapshots = await readAccountSnapshotsByWeek(accountKey, weekOpenUtc);

  // For now, create a placeholder curve with start and current points
  const weekStart = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekEnd = weekStart.plus({ days: 7 });
  const now = DateTime.utc();

  // Use actual week end or current time, whichever is earlier
  const curveEnd = now < weekEnd ? now : weekEnd;

  const startingEquity =
    numericValue(analysis?.equity) || numericValue(analysis?.balance);
  const currentEquity = numericValue(analysis?.equity) || startingEquity;
  const weeklyPnlPct = numericValue(analysis?.weekly_pnl_pct);
  const balanceValue = numericValue(analysis?.balance);
  const lockedProfitPct = numericOrNull(analysis?.locked_profit_pct);

  return [
    {
      ts_utc: weekStart.toISO()!,
      equity_pct: 0, // Start of week is baseline (0%)
      lock_pct: null,
      balance: balanceValue,
      equity: startingEquity,
      equity_usd: startingEquity,
      static_baseline_usd: startingEquity > 0 ? startingEquity : null,
      static_drawdown_pct: 0,
      trailing_drawdown_pct: 0,
    },
    {
      ts_utc: curveEnd.toISO()!,
      equity_pct: weeklyPnlPct, // Current weekly P&L
      lock_pct: lockedProfitPct,
      balance: balanceValue,
      equity: currentEquity,
      equity_usd: currentEquity,
      static_baseline_usd: startingEquity > 0 ? startingEquity : null,
      static_drawdown_pct:
        startingEquity > 0 ? Math.max(0, ((startingEquity - currentEquity) / startingEquity) * 100) : 0,
      trailing_drawdown_pct: Math.max(0, -weeklyPnlPct),
    },
  ];
}

/**
 * Build all-time equity curve for a connected account
 *
 * @param accountKey - The connected account key
 * @returns Array of equity points representing the all-time curve
 */
export async function buildAccountAllTimeEquityCurve(
  accountKey: string
): Promise<AccountEquityPoint[]> {
  const account = await getConnectedAccount(accountKey);
  if (!account) {
    return [];
  }

  const analysis = account.analysis as Record<string, unknown> | null | undefined;
  const numericValue = (value: unknown) => (typeof value === "number" ? value : 0);
  const numericOrNull = (value: unknown) => (typeof value === "number" ? value : null);

  // TODO: Fetch all historical snapshots and build complete curve
  // For now, return a simple two-point curve from account creation to now

  const createdAt = DateTime.fromISO(account.created_at, { zone: "utc" });
  const now = DateTime.utc();

  const startingEquity = 0; // Assuming account started at 0% return
  const currentEquity = numericValue(analysis?.equity);
  const totalPnlPct = numericValue(analysis?.basket_pnl_pct);
  const balanceValue = numericValue(analysis?.balance);
  const lockedProfitPct = numericOrNull(analysis?.locked_profit_pct);

  return [
    {
      ts_utc: createdAt.toISO()!,
      equity_pct: 0,
      lock_pct: null,
      balance: 0,
      equity: 0,
      equity_usd: balanceValue,
      static_baseline_usd: balanceValue > 0 ? balanceValue : null,
      static_drawdown_pct: 0,
      trailing_drawdown_pct: 0,
    },
    {
      ts_utc: now.toISO()!,
      equity_pct: totalPnlPct,
      lock_pct: lockedProfitPct,
      balance: balanceValue,
      equity: currentEquity,
      equity_usd: currentEquity,
      static_baseline_usd: balanceValue > 0 ? balanceValue : null,
      static_drawdown_pct:
        balanceValue > 0 ? Math.max(0, ((balanceValue - currentEquity) / balanceValue) * 100) : 0,
      trailing_drawdown_pct: Math.max(0, -totalPnlPct),
    },
  ];
}

/**
 * Compress equity curve to reduce number of points while preserving shape
 * Uses Douglas-Peucker algorithm to simplify the curve
 *
 * @param points - Original equity curve points
 * @param maxPoints - Maximum number of points to retain (default: 200)
 * @returns Compressed curve
 */
export function compressEquityCurve(
  points: AccountEquityPoint[],
  maxPoints: number = 200
): AccountEquityPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  // Simple uniform sampling for now
  // TODO: Implement Douglas-Peucker for better compression
  const step = Math.ceil(points.length / maxPoints);
  const compressed: AccountEquityPoint[] = [];

  for (let i = 0; i < points.length; i += step) {
    compressed.push(points[i]);
  }

  // Always include the last point
  if (compressed[compressed.length - 1] !== points[points.length - 1]) {
    compressed.push(points[points.length - 1]);
  }

  return compressed;
}

/**
 * Calculate equity curve statistics
 */
export function calculateCurveStats(points: AccountEquityPoint[]) {
  if (points.length === 0) {
    return {
      totalReturn: 0,
      maxDrawdown: 0,
      peakEquity: 0,
      currentEquity: 0,
      volatility: 0,
    };
  }

  let peak = points[0].equity_pct;
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

  const lastPoint = points[points.length - 1];
  const returns = points.slice(1).map((p, i) => p.equity_pct - points[i].equity_pct);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance =
    returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0;
  const volatility = Math.sqrt(variance);

  return {
    totalReturn: lastPoint.equity_pct,
    maxDrawdown,
    peakEquity: peak,
    currentEquity: lastPoint.equity_pct,
    volatility,
  };
}
