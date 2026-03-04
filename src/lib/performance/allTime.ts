import { DateTime } from "luxon";
import { computeReturnStats, type PerformanceModel } from "@/lib/performanceLab";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

type AllTimeRow = {
  week_open_utc: string;
  model: PerformanceModel;
  percent: number;
  returns?: Array<{ pair: string; percent: number }>;
  pair_details?: Array<{
    pair: string;
    direction: "LONG" | "SHORT" | "NEUTRAL";
    reason: string[];
    percent: number | null;
    children?: Array<{
      pair: string;
      direction: "LONG" | "SHORT" | "NEUTRAL";
      reason: string[];
      percent: number | null;
    }>;
  }>;
};

type AllTimeWeekReturn = {
  week: string;
  value: number;
};

type AllTimePerformanceReturn = {
  pair: string;
  percent: number;
};

type AllTimeBreakdownChild = {
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  reason: string[];
  percent: number | null;
};

type AllTimeWeekAggregate = {
  percent: number;
  children: AllTimeBreakdownChild[];
  tradeReturns: number[];
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

function computeDrawdownFromTradeReturns(tradeReturns: number[]) {
  if (tradeReturns.length === 0) return 0;
  let equity = 100;
  let peak = equity;
  let maxDrawdown = 0;
  for (const value of tradeReturns) {
    if (!Number.isFinite(value)) continue;
    equity *= 1 + value / 100;
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
  return maxDrawdown;
}

function computeProfitFactorFromTradeReturns(tradeReturns: number[]) {
  const grossProfit = tradeReturns
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    tradeReturns
      .filter((value) => Number.isFinite(value) && value < 0)
      .reduce((sum, value) => sum + value, 0),
  );
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function inferDirectionFromPercent(percent: number | null): "LONG" | "SHORT" | "NEUTRAL" {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return "NEUTRAL";
  if (percent > 0) return "LONG";
  if (percent < 0) return "SHORT";
  return "NEUTRAL";
}

function normalizeBreakdownChild(
  child: Partial<AllTimeBreakdownChild> | null | undefined,
): AllTimeBreakdownChild | null {
  if (!child || typeof child.pair !== "string" || child.pair.trim().length === 0) {
    return null;
  }
  const percent =
    typeof child.percent === "number" && Number.isFinite(child.percent)
      ? child.percent
      : null;
  const direction =
    child.direction === "LONG" || child.direction === "SHORT" || child.direction === "NEUTRAL"
      ? child.direction
      : inferDirectionFromPercent(percent);
  const reason = Array.isArray(child.reason)
    ? child.reason
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];
  return {
    pair: child.pair.trim(),
    direction,
    reason,
    percent,
  };
}

function toBreakdownChildren(row: AllTimeRow): AllTimeBreakdownChild[] {
  const pairDetails = row.pair_details ?? [];
  if (pairDetails.length > 0) {
    const children = pairDetails.flatMap((detail) => {
      const detailChildren = Array.isArray(detail.children) ? detail.children : [];
      if (detailChildren.length > 0) {
        return detailChildren
          .map((child) =>
            normalizeBreakdownChild({
              pair: child.pair,
              direction: child.direction,
              reason: child.reason,
              percent: child.percent,
            }),
          )
          .filter((child): child is AllTimeBreakdownChild => child !== null);
      }
      return [
        normalizeBreakdownChild({
          pair: detail.pair,
          direction: detail.direction,
          reason: detail.reason,
          percent: detail.percent,
        }),
      ].filter((child): child is AllTimeBreakdownChild => child !== null);
    });
    if (children.length > 0) {
      return children;
    }
  }

  return (row.returns ?? [])
    .map((entry) =>
      normalizeBreakdownChild({
        pair: entry.pair,
        direction: inferDirectionFromPercent(entry.percent),
        reason: ["Trade return"],
        percent: entry.percent,
      }),
    )
    .filter((child): child is AllTimeBreakdownChild => child !== null);
}

function buildWeekAggregatesByModel(rows: AllTimeRow[]) {
  const aggregates = new Map<PerformanceModel, Map<string, AllTimeWeekAggregate>>();
  for (const row of rows) {
    const canonicalWeekOpenUtc = normalizeWeekOpenUtc(row.week_open_utc) ?? row.week_open_utc;
    const modelWeeks = aggregates.get(row.model) ?? new Map<string, AllTimeWeekAggregate>();
    const existing = modelWeeks.get(canonicalWeekOpenUtc) ?? {
      percent: 0,
      children: [],
      tradeReturns: [],
    };
    const children = toBreakdownChildren(row);
    const childReturns = children
      .flatMap((child) =>
        typeof child.percent === "number" && Number.isFinite(child.percent) ? [child.percent] : [],
      );
    modelWeeks.set(canonicalWeekOpenUtc, {
      percent: existing.percent + row.percent,
      children: [...existing.children, ...children],
      tradeReturns: [...existing.tradeReturns, ...childReturns],
    });
    aggregates.set(row.model, modelWeeks);
  }
  return aggregates;
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
  const weekAggregatesByModel = buildWeekAggregatesByModel(rows);
  const weekTotalsByModel = buildWeekTotalsByModel(rows);
  return models.map((model) => {
    const weekMap = weekTotalsByModel.get(model) ?? new Map<string, number>();
    const weekAggregates = weekAggregatesByModel.get(model) ?? new Map<string, AllTimeWeekAggregate>();
    const weekReturns: AllTimePerformanceReturn[] = buildHistoricalWeekReturns(
      weekMap,
      currentWeekMillis,
      nowUtcMillis,
    ).map(({ week, value }) => ({
      pair: weekLabelFromOpen(week),
      percent: value,
    }));
    const weekBreakdown = buildHistoricalWeekReturns(
      weekMap,
      currentWeekMillis,
      nowUtcMillis,
    ).map(({ week, value }) => {
      const aggregate = weekAggregates.get(week) ?? {
        percent: value,
        children: [],
        tradeReturns: [],
      };
      const tradeReturns = aggregate.tradeReturns.filter((item) => Number.isFinite(item));
      const wins = tradeReturns.filter((item) => item > 0).length;
      const tradeCount = tradeReturns.length;
      const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
      const worstTradeLoss = tradeReturns.reduce((maxLoss, item) => {
        if (item >= 0) return maxLoss;
        return Math.max(maxLoss, Math.abs(item));
      }, 0);
      const weekDrawdown = Math.max(
        computeDrawdownFromTradeReturns(tradeReturns),
        worstTradeLoss,
        value < 0 ? Math.abs(value) : 0,
      );
      return {
        pair: weekLabelFromOpen(week),
        direction: "NEUTRAL" as const,
        reason: [
          `Trades ${tradeCount}`,
          `Win rate ${winRate.toFixed(1)}%`,
          `Static DD ${weekDrawdown.toFixed(2)}%`,
        ],
        percent: value,
        children: aggregate.children,
      };
    });
    const allTradeReturns = weekBreakdown.flatMap((week) =>
      (week.children ?? []).flatMap((child) =>
        typeof child.percent === "number" && Number.isFinite(child.percent) ? [child.percent] : [],
      ),
    );
    const worstWeekDrawdown = weekBreakdown.reduce((maxDrawdown, week) => {
      const childReturns = (week.children ?? []).flatMap((child) =>
        typeof child.percent === "number" && Number.isFinite(child.percent) ? [child.percent] : [],
      );
      const worstTradeLoss = childReturns.reduce((maxLoss, value) => {
        if (value >= 0) return maxLoss;
        return Math.max(maxLoss, Math.abs(value));
      }, 0);
      const weekReturnDrawdown =
        typeof week.percent === "number" && week.percent < 0 ? Math.abs(week.percent) : 0;
      const weekDrawdown = Math.max(
        computeDrawdownFromTradeReturns(childReturns),
        worstTradeLoss,
        weekReturnDrawdown,
      );
      return Math.max(maxDrawdown, weekDrawdown);
    }, 0);
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
      pair_details: weekBreakdown,
      stats,
      diagnostics: {
        max_drawdown: weeks > 0 ? worstWeekDrawdown : null,
        profit_factor: computeProfitFactorFromTradeReturns(allTradeReturns),
      },
    };
  });
}
