import type { ModelPerformance } from "@/lib/performanceLab";
import { computeReturnStats } from "@/lib/performanceLab";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import type {
  KataraktiMarketSnapshot,
  KataraktiWeeklySnapshot,
} from "@/lib/performance/kataraktiHistory";

export const KATARAKTI_CARD_MODEL = "antikythera_v3" as const;

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

function normalizeWeek(weekOpenUtc: string): string {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function resolveSelectedWeek(period: KataraktiPeriodValue): string | null {
  if (!period || period === "all") return null;
  return normalizeWeek(period);
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
  const maxDrawdownFromWeeks =
    weeks.length > 0
      ? weeks.reduce(
          (max, week) => Math.max(max, week.staticDrawdownPct),
          0,
        )
      : null;

  return {
    totalReturnPct,
    weeks: weeksCount,
    weeklyWinRatePct: weeksCount > 0 ? (weekWins / weeksCount) * 100 : 0,
    sharpe: computeSharpe(weeklyReturns),
    avgWeeklyPct: weeksCount > 0 ? totalReturnPct / weeksCount : 0,
    maxDrawdownPct:
      maxDrawdownFromWeeks !== null && maxDrawdownFromWeeks > 0
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
  const weeks = selectKataraktiWeeks(snapshot, period);
  if (weeks.length === 0) {
    return null;
  }
  const metrics = buildKataraktiPeriodMetrics(snapshot, period);
  const returns = weeks.map((week) => ({
    pair: weekLabelFromOpen(week.weekOpenUtc),
    percent: week.returnPct,
  }));
  const pairDetails = weeks.map((week) => ({
    pair: weekLabelFromOpen(week.weekOpenUtc),
    direction:
      week.returnPct > 0 ? ("LONG" as const) : week.returnPct < 0 ? ("SHORT" as const) : ("NEUTRAL" as const),
    reason: [
      `Trades ${week.trades}`,
      `Win rate ${week.winRatePct.toFixed(1)}%`,
      `Static DD ${week.staticDrawdownPct.toFixed(2)}%`,
    ],
    percent: week.returnPct,
  }));

  return {
    model: KATARAKTI_CARD_MODEL,
    percent: metrics.totalReturnPct,
    priced: returns.length,
    total: returns.length,
    note: snapshot.selectedVariantId
      ? `Katarakti variant ${snapshot.selectedVariantId}`
      : "Katarakti snapshot",
    returns,
    pair_details: pairDetails,
    stats: computeReturnStats(returns),
  };
}
