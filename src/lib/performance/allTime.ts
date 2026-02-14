import { DateTime } from "luxon";
import { computeReturnStats, type PerformanceModel } from "@/lib/performanceLab";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

type AllTimeRow = {
  week_open_utc: string;
  model: PerformanceModel;
  percent: number;
};

type AllTimeWeekReturn = {
  week: string;
  value: number;
};

type AllTimePerformanceReturn = {
  pair: string;
  percent: number;
};

function isClosedHistoricalWeek(
  weekOpenUtc: string,
  currentWeekMillis: number,
  nowUtcMillis: number,
) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) {
    return false;
  }
  const weekMillis = parsed.toMillis();
  if (weekMillis >= currentWeekMillis) {
    return false;
  }
  return weekMillis <= nowUtcMillis;
}

function buildWeekTotalsByModel(rows: AllTimeRow[]) {
  const totals = new Map<PerformanceModel, Map<string, number>>();
  for (const row of rows) {
    const canonicalWeekOpenUtc = normalizeWeekOpenUtc(row.week_open_utc) ?? row.week_open_utc;
    const modelWeeks = totals.get(row.model) ?? new Map<string, number>();
    modelWeeks.set(
      canonicalWeekOpenUtc,
      (modelWeeks.get(canonicalWeekOpenUtc) ?? 0) + row.percent,
    );
    totals.set(row.model, modelWeeks);
  }
  return totals;
}

function buildHistoricalWeekReturns(
  weekMap: Map<string, number>,
  currentWeekMillis: number,
  nowUtcMillis: number,
): AllTimeWeekReturn[] {
  return Array.from(weekMap.entries())
    .filter(([week]) => isClosedHistoricalWeek(week, currentWeekMillis, nowUtcMillis))
    .map(([week, value]) => ({ week, value }));
}

export function buildAllTimeStats(
  rows: AllTimeRow[],
  models: PerformanceModel[],
  currentWeekMillis: number,
  nowUtcMillis: number,
) {
  const weekTotalsByModel = buildWeekTotalsByModel(rows);
  return models.map((model) => {
    const weekMap = weekTotalsByModel.get(model) ?? new Map<string, number>();
    const weekReturns = buildHistoricalWeekReturns(weekMap, currentWeekMillis, nowUtcMillis);
    const totalPercent = weekReturns.reduce((sum, item) => sum + item.value, 0);
    const wins = weekReturns.filter((item) => item.value > 0).length;
    const avgWeekly = weekReturns.length > 0 ? totalPercent / weekReturns.length : 0;
    return {
      model,
      totalPercent,
      weeks: weekReturns.length,
      winRate: weekReturns.length > 0 ? (wins / weekReturns.length) * 100 : 0,
      avgWeekly,
    };
  });
}

export function buildAllTimePerformance(
  rows: AllTimeRow[],
  models: PerformanceModel[],
  currentWeekMillis: number,
  nowUtcMillis: number,
) {
  const weekTotalsByModel = buildWeekTotalsByModel(rows);
  return models.map((model) => {
    const weekMap = weekTotalsByModel.get(model) ?? new Map<string, number>();
    const weekReturns: AllTimePerformanceReturn[] = buildHistoricalWeekReturns(
      weekMap,
      currentWeekMillis,
      nowUtcMillis,
    ).map(({ week, value }) => ({
      pair: weekLabelFromOpen(week),
      percent: value,
    }));
    const totalPercent = weekReturns.reduce((sum, item) => sum + item.percent, 0);
    const stats = computeReturnStats(weekReturns);
    const weeks = weekReturns.length;
    return {
      model,
      percent: totalPercent,
      priced: weeks,
      total: weeks,
      note: "All-time aggregation",
      returns: weekReturns,
      pair_details: [],
      stats,
    };
  });
}
