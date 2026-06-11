/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: performanceMetricBasis.ts
 *
 * Description:
 * Canonical metric basis helpers for Performance surfaces. Path metrics use
 * resolved equity paths, trade metrics use closed trade/fill returns, and
 * period metrics use weekly period returns.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type MetricPathPoint = {
  ts_utc: string;
  equity_pct: number;
  drawdown_pct?: number;
};

export type SidebarAllTimeMetricBasis = {
  totalReturnPct: number;
  totalTrades: number;
  weeklyWinRate: number;
  maxDrawdownPct: number;
  weeks: number;
  avgWeeklyReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  profitFactor: number | null;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
};

const TRADING_DAYS_PER_YEAR = 252;

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function computeReturnSharpe(returns: number[], annualizationPeriods = 1): number {
  if (returns.length <= 1) return 0;
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  return std > 0 ? (avg / std) * Math.sqrt(annualizationPeriods) : 0;
}

export function computeReturnSortino(returns: number[], annualizationPeriods = 1): number {
  if (returns.length <= 1) return 0;
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const downside = returns.filter((value) => value < 0);
  if (downside.length === 0) return avg > 0 ? Number.POSITIVE_INFINITY : 0;
  const downsideVariance = downside.reduce((sum, value) => sum + value ** 2, 0) / downside.length;
  const downsideDeviation = Math.sqrt(downsideVariance);
  return downsideDeviation > 0 ? (avg / downsideDeviation) * Math.sqrt(annualizationPeriods) : 0;
}

export function computeProfitFactorFromTradeReturns(returns: number[]): number | null {
  const grossProfit = returns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(returns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  if (grossLoss > 0) return grossProfit / grossLoss;
  return grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
}

export function computeTradeExpectancy(returns: number[]): {
  expectancy: number;
  avgWin: number;
  avgLoss: number;
} {
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  const avgWin = wins.length > 0 ? wins.reduce((sum, value) => sum + value, 0) / wins.length : 0;
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, value) => sum + value, 0) / losses.length)
    : 0;
  const winRate = returns.length > 0 ? wins.length / returns.length : 0;
  return {
    expectancy: (winRate * avgWin) - ((1 - winRate) * avgLoss),
    avgWin,
    avgLoss,
  };
}

export function computeMaxConsecutivePeriodStreaks(returns: number[]): {
  wins: number;
  losses: number;
} {
  let maxWins = 0;
  let maxLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;
  for (const value of returns) {
    if (value > 0) {
      currentWins += 1;
      currentLosses = 0;
    } else if (value < 0) {
      currentLosses += 1;
      currentWins = 0;
    } else {
      currentWins = 0;
      currentLosses = 0;
    }
    maxWins = Math.max(maxWins, currentWins);
    maxLosses = Math.max(maxLosses, currentLosses);
  }
  return { wins: maxWins, losses: maxLosses };
}

export function dailyReturnsFromPath(points: MetricPathPoint[]): number[] {
  const dailyCloses = new Map<string, { tsMs: number; equityPct: number }>();
  for (const point of points) {
    if (!finiteNumber(point.equity_pct)) continue;
    const tsMs = Date.parse(point.ts_utc);
    if (!Number.isFinite(tsMs)) continue;
    const dateKey = new Date(tsMs).toISOString().slice(0, 10);
    const existing = dailyCloses.get(dateKey);
    if (!existing || tsMs >= existing.tsMs) {
      dailyCloses.set(dateKey, { tsMs, equityPct: point.equity_pct });
    }
  }

  let previousClose = 0;
  return Array.from(dailyCloses.values())
    .sort((left, right) => left.tsMs - right.tsMs)
    .map((close) => {
      const ret = close.equityPct - previousClose;
      previousClose = close.equityPct;
      return ret;
    })
    .filter(Number.isFinite);
}

function computePathMaxDrawdown(points: MetricPathPoint[]): number {
  const drawdowns = points
    .map((point) => point.drawdown_pct)
    .filter(finiteNumber);
  if (drawdowns.length > 0) {
    return Math.abs(Math.min(...drawdowns));
  }

  let peak = 0;
  let maxDrawdown = 0;
  for (const point of points) {
    if (!finiteNumber(point.equity_pct)) continue;
    peak = Math.max(peak, point.equity_pct);
    maxDrawdown = Math.min(maxDrawdown, point.equity_pct - peak);
  }
  return Math.abs(maxDrawdown);
}

export function computeSidebarAllTimeMetricBasis(options: {
  weeklyReturns: number[];
  tradeReturns: number[];
  pathPoints?: MetricPathPoint[] | null;
  totalTrades: number;
}): SidebarAllTimeMetricBasis {
  const { weeklyReturns, tradeReturns, totalTrades } = options;
  const pathPoints = options.pathPoints?.filter((point) => finiteNumber(point.equity_pct)) ?? [];
  const pathReturns = dailyReturnsFromPath(pathPoints);
  const pathTotalReturn = pathPoints.at(-1)?.equity_pct;
  const weeklyTotalReturn = weeklyReturns.reduce((sum, value) => sum + value, 0);
  const totalReturnPct = finiteNumber(pathTotalReturn) ? pathTotalReturn : weeklyTotalReturn;
  const maxDrawdownPct = pathPoints.length > 0 ? computePathMaxDrawdown(pathPoints) : 0;
  const weeklyWins = weeklyReturns.filter((value) => value > 0).length;
  const tradeExpectancy = computeTradeExpectancy(tradeReturns);
  const streaks = computeMaxConsecutivePeriodStreaks(weeklyReturns);

  return {
    totalReturnPct,
    totalTrades,
    weeklyWinRate: weeklyReturns.length > 0 ? (weeklyWins / weeklyReturns.length) * 100 : 0,
    maxDrawdownPct,
    weeks: weeklyReturns.length,
    avgWeeklyReturn: weeklyReturns.length > 0 ? totalReturnPct / weeklyReturns.length : 0,
    sharpe: computeReturnSharpe(pathReturns.length > 1 ? pathReturns : weeklyReturns, pathReturns.length > 1 ? TRADING_DAYS_PER_YEAR : 1),
    sortino: computeReturnSortino(pathReturns.length > 1 ? pathReturns : weeklyReturns, pathReturns.length > 1 ? TRADING_DAYS_PER_YEAR : 1),
    calmar:
      maxDrawdownPct > 0 && weeklyReturns.length > 0
        ? ((totalReturnPct / weeklyReturns.length) * 52) / maxDrawdownPct
        : 0,
    profitFactor: computeProfitFactorFromTradeReturns(tradeReturns),
    expectancy: tradeExpectancy.expectancy,
    avgWin: tradeExpectancy.avgWin,
    avgLoss: tradeExpectancy.avgLoss,
    maxConsecutiveWins: streaks.wins,
    maxConsecutiveLosses: streaks.losses,
  };
}
