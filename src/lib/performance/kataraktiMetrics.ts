/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/performance/kataraktiMetrics.ts
 *
 * Description:
 * Computes period-level metrics and model cards for Katarakti snapshots.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import type { ModelPerformance } from "@/lib/performanceLab";
import { computeReturnStats } from "@/lib/performanceLab";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import type {
  KataraktiMarketSnapshot,
  KataraktiTradeDetail,
  KataraktiWeeklySnapshot,
} from "@/lib/performance/kataraktiHistory";

export const KATARAKTI_CARD_MODEL = "antikythera_v3" as const;
const ANNUALIZATION_FACTOR = Math.sqrt(52);

export type KataraktiPeriodValue = "all" | string | null | undefined;

export type KataraktiPeriodMetrics = {
  totalReturnPct: number;
  weeks: number;
  weeklyWinRatePct: number;
  sharpe: number;
  avgWeeklyPct: number;
  maxDrawdownPct: number | null;
  trades: number;
  tradeWins: number;
  tradeWinRatePct: number;
  avgTradePct: number | null;
  profitFactor: number | null;
};

function computeSharpe(weeklyReturnsPct: number[]) {
  if (weeklyReturnsPct.length <= 1) return 0;
  const mean =
    weeklyReturnsPct.reduce((sum, value) => sum + value, 0) / weeklyReturnsPct.length;
  if (mean === 0) return 0;
  const variance =
    weeklyReturnsPct.reduce((sum, value) => {
      const diff = value - mean;
      return sum + diff * diff;
    }, 0) / (weeklyReturnsPct.length - 1);
  const stdDev = Math.sqrt(variance);
  return stdDev > 0 ? mean / stdDev : 0;
}

function computeSharpeWithSingleWeekFallback(
  weeklyReturnsPct: number[],
  fallbackReturnsPct: number[],
) {
  if (weeklyReturnsPct.length > 1) {
    return computeSharpe(weeklyReturnsPct);
  }
  if (fallbackReturnsPct.length > 1) {
    return computeSharpe(fallbackReturnsPct);
  }
  return computeSharpe(weeklyReturnsPct);
}

function normalizeWeek(weekOpenUtc: string): string {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function computeCurveMaxDrawdownFromWeeklyReturns(weeklyReturnsPct: number[]) {
  if (weeklyReturnsPct.length === 0) return null;
  let equity = 100;
  let peak = equity;
  let maxDrawdown = 0;
  for (const weeklyReturn of weeklyReturnsPct) {
    equity *= 1 + weeklyReturn / 100;
    if (equity > peak) {
      peak = equity;
      continue;
    }
    if (peak <= 0) continue;
    const drawdown = ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown > 0 ? maxDrawdown : null;
}

function resolveSelectedWeek(period: KataraktiPeriodValue): string | null {
  if (!period || period === "all") return null;
  return normalizeWeek(period);
}

function buildTradeReturnLabel(trade: KataraktiTradeDetail, index: number) {
  const suffix = trade.direction === "NEUTRAL" ? `#${index + 1}` : trade.direction;
  return `${trade.pair} ${suffix}`;
}

function getTradesForWeek(
  snapshot: KataraktiMarketSnapshot,
  weekOpenUtc: string,
): KataraktiTradeDetail[] {
  const direct = snapshot.tradeDetailsByWeek[weekOpenUtc];
  if (direct) return direct;
  const canonicalTarget = normalizeWeek(weekOpenUtc);
  for (const [key, trades] of Object.entries(snapshot.tradeDetailsByWeek)) {
    if (normalizeWeek(key) === canonicalTarget) {
      return trades;
    }
  }
  return [];
}

export function selectKataraktiWeeks(
  snapshot: KataraktiMarketSnapshot,
  period: KataraktiPeriodValue,
): KataraktiWeeklySnapshot[] {
  const selectedWeek = resolveSelectedWeek(period);
  if (!selectedWeek) {
    return [...snapshot.weekly].sort(
      (left, right) =>
        new Date(left.weekOpenUtc).getTime() - new Date(right.weekOpenUtc).getTime(),
    );
  }
  return snapshot.weekly
    .filter((week) => normalizeWeek(week.weekOpenUtc) === selectedWeek)
    .sort(
      (left, right) =>
        new Date(left.weekOpenUtc).getTime() - new Date(right.weekOpenUtc).getTime(),
    );
}

function weightedAverage(weeks: KataraktiWeeklySnapshot[]): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const week of weeks) {
    if (week.avgTradePct === null || !Number.isFinite(week.avgTradePct)) continue;
    if (!Number.isFinite(week.trades) || week.trades <= 0) continue;
    weightedSum += week.avgTradePct * week.trades;
    totalWeight += week.trades;
  }
  if (totalWeight <= 0) return null;
  return weightedSum / totalWeight;
}

function aggregateProfitFactor(weeks: KataraktiWeeklySnapshot[]): number | null {
  const grossProfit = weeks.reduce((sum, week) => sum + week.grossProfitUsd, 0);
  const grossLoss = weeks.reduce((sum, week) => sum + week.grossLossUsd, 0);
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

export function buildKataraktiPeriodMetrics(
  snapshot: KataraktiMarketSnapshot,
  period: KataraktiPeriodValue,
): KataraktiPeriodMetrics {
  const weeks = selectKataraktiWeeks(snapshot, period);
  const selectedWeek = resolveSelectedWeek(period);
  const weeklyReturns = weeks.map((week) => week.returnPct);
  const totalReturnPct =
    selectedWeek === null && weeks.length === snapshot.weekly.length
      ? snapshot.totalReturnPct
      : weeklyReturns.reduce((sum, value) => sum + value, 0);
  const weekWins = weeklyReturns.filter((value) => value > 0).length;
  const weeksCount = weeks.length;
  const trades = weeks.reduce((sum, week) => sum + week.trades, 0);
  const tradeWins = weeks.reduce((sum, week) => sum + week.wins, 0);
  const avgTradePct =
    weightedAverage(weeks) ??
    (selectedWeek === null ? snapshot.avgTradePct : null);
  const profitFactor =
    aggregateProfitFactor(weeks) ??
    (selectedWeek === null ? snapshot.profitFactor : null);
  const maxDrawdownFromCurve = computeCurveMaxDrawdownFromWeeklyReturns(weeklyReturns);
  const maxStaticWeekDrawdown =
    weeks.length > 0
      ? weeks.reduce((max, week) => Math.max(max, week.staticDrawdownPct), 0)
      : 0;
  const maxDrawdownFromWeeks = Math.max(
    maxDrawdownFromCurve ?? 0,
    maxStaticWeekDrawdown,
  );
  const tradeReturnsPct = weeks.flatMap((week) =>
    (snapshot.tradeDetailsByWeek[week.weekOpenUtc] ?? []).flatMap((trade) =>
      typeof trade.percent === "number" && Number.isFinite(trade.percent)
        ? [trade.percent]
        : [],
    ),
  );
  const rawSharpe = computeSharpeWithSingleWeekFallback(weeklyReturns, tradeReturnsPct);
  const sharpe =
    period === "all" || period === null || period === undefined
      ? rawSharpe * ANNUALIZATION_FACTOR
      : rawSharpe;

  return {
    totalReturnPct,
    weeks: weeksCount,
    weeklyWinRatePct: weeksCount > 0 ? (weekWins / weeksCount) * 100 : 0,
    sharpe,
    avgWeeklyPct: weeksCount > 0 ? totalReturnPct / weeksCount : 0,
    maxDrawdownPct: maxDrawdownFromWeeks > 0
      ? maxDrawdownFromWeeks
      : selectedWeek === null
        ? snapshot.maxDrawdownPct
        : null,
    trades,
    tradeWins,
    tradeWinRatePct: trades > 0 ? (tradeWins / trades) * 100 : 0,
    avgTradePct,
    profitFactor,
  };
}

export function buildKataraktiModelPerformance(
  snapshot: KataraktiMarketSnapshot,
  period: KataraktiPeriodValue,
): ModelPerformance | null {
  const selectedWeek = resolveSelectedWeek(period);
  let effectivePeriod = period;
  let weeks = selectKataraktiWeeks(snapshot, period);
  if (
    selectedWeek !== null &&
    weeks.length === 0 &&
    snapshot.weekly.length > 0
  ) {
    effectivePeriod = "all";
    weeks = selectKataraktiWeeks(snapshot, effectivePeriod);
  }
  if (weeks.length === 0) {
    return null;
  }
  const metrics = buildKataraktiPeriodMetrics(snapshot, effectivePeriod);

  const selectedWeekTrades =
    selectedWeek !== null ? getTradesForWeek(snapshot, selectedWeek) : [];

  const weeklyReturns = weeks.map((week) => ({
    pair: weekLabelFromOpen(week.weekOpenUtc),
    percent: week.returnPct,
  }));
  const weeklyPairDetails = weeks.map((week) => ({
    pair: weekLabelFromOpen(week.weekOpenUtc),
    direction: "NEUTRAL" as const,
    reason: [
      `Trades ${week.trades}`,
      `Win rate ${week.winRatePct.toFixed(1)}%`,
      `Static DD ${week.staticDrawdownPct.toFixed(2)}%`,
    ],
    percent: week.returnPct,
    children: getTradesForWeek(snapshot, week.weekOpenUtc),
  }));
  const tradeReturns = selectedWeekTrades.flatMap((trade, index) =>
    typeof trade.percent === "number" && Number.isFinite(trade.percent)
      ? [{
          pair: buildTradeReturnLabel(trade, index),
          percent: trade.percent,
        }]
      : [],
  );

  const returns =
    selectedWeek !== null && selectedWeekTrades.length > 0
      ? tradeReturns
      : weeklyReturns;
  const pairDetails =
    selectedWeek !== null && selectedWeekTrades.length > 0
      ? selectedWeekTrades
      : weeklyPairDetails;
  const pricedCount =
    selectedWeek !== null && selectedWeekTrades.length > 0
      ? selectedWeekTrades.filter(
          (trade) => typeof trade.percent === "number" && Number.isFinite(trade.percent),
        ).length
      : returns.length;
  const totalCount =
    selectedWeek !== null && selectedWeekTrades.length > 0
      ? selectedWeekTrades.length
      : returns.length;

  return {
    model: KATARAKTI_CARD_MODEL,
    percent: metrics.totalReturnPct,
    priced: pricedCount,
    total: totalCount,
    note: snapshot.selectedVariantId
      ? `Katarakti variant ${snapshot.selectedVariantId}`
      : "Katarakti snapshot",
    returns,
    pair_details: pairDetails,
    stats: computeReturnStats(returns),
    diagnostics: {
      max_drawdown: metrics.maxDrawdownPct,
      profit_factor: metrics.profitFactor,
    },
  };
}
