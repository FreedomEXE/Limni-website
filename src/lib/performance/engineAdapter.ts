/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: engineAdapter.ts
 *
 * Description:
 * Converts weeklyHoldEngine output (WeeklyHoldResult / MultiWeekResult)
 * into GridProps that the existing PerformanceGrid component expects.
 * Maps card breakdown by bias source type: asset_class, tiers, or per_model.
 *
 * Card slot mapping (reuses PerformanceModel enum):
 *   asset_class → dealer=FX, commercial=Commodities&Indices, sentiment=Crypto
 *   tiers       → dealer=Tier1, commercial=Tier2, sentiment=Tier3
 *   per_model   → strategy-defined model list
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { WeeklyHoldResult, WeeklyHoldTrade, MultiWeekResult } from "@/lib/performance/weeklyHoldEngine";
import type { BiasSourceConfig } from "@/lib/performance/strategyConfig";
import type { ModelPerformance, PerformanceModel, TradeDetailMeta } from "@/lib/performanceLab";
import { computeReturnStats } from "@/lib/performanceLab";
import { PERFORMANCE_MODEL_LABELS } from "@/lib/performance/modelConfig";
import type {
  BasketPathPoint,
  BasketPathResult,
  BasketPathSummary,
} from "@/lib/performance/basketPathEngine";
import type { PositionLeg } from "@/lib/performance/positionLedger";

// ─── Card slot mapping ──────────────────────────────────────────

const DEFAULT_CARD_SLOTS = [
  "dealer",
  "commercial",
  "sentiment",
] as const satisfies readonly PerformanceModel[];

export function resolveCardSlots(
  biasSource: BiasSourceConfig,
): readonly PerformanceModel[] {
  return biasSource.models ?? DEFAULT_CARD_SLOTS;
}

const ASSET_CLASS_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "FX",
  commercial: "Commodities & Indices",
  sentiment: "Crypto",
  strength: "Strength",
};

const TIER_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "Tier 1 — High Confidence",
  commercial: "Tier 2 — Medium Confidence",
  sentiment: "Tier 3 — Low Confidence",
  strength: "Strength",
};

const PER_MODEL_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "Dealer Portfolio",
  commercial: "Commercial Portfolio",
  sentiment: "Sentiment Portfolio",
  strength: "Strength Portfolio",
};

const ASSET_SECTIONS = [
  { id: "fx", label: "FX" },
  { id: "indices", label: "Indices" },
  { id: "commodities", label: "Commodities" },
  { id: "crypto", label: "Crypto" },
] as const;

// ─── Trade grouping ─────────────────────────────────────────────

function groupByAssetClass(trades: WeeklyHoldTrade[]): WeeklyHoldTrade[][] {
  return [
    trades.filter((t) => t.assetClass === "fx"),
    trades.filter((t) => t.assetClass === "commodities" || t.assetClass === "indices"),
    trades.filter((t) => t.assetClass === "crypto"),
  ];
}

function groupByTier(trades: WeeklyHoldTrade[]): WeeklyHoldTrade[][] {
  return [
    trades.filter((t) => t.tier === 1),
    trades.filter((t) => t.tier === 2),
    trades.filter((t) => t.tier === 3),
  ];
}

function groupByModel(
  trades: WeeklyHoldTrade[],
  models: readonly PerformanceModel[],
): WeeklyHoldTrade[][] {
  return models.map((model) => trades.filter((t) => t.source === model));
}

function slotTrades(
  trades: WeeklyHoldTrade[],
  breakdown: BiasSourceConfig["cardBreakdown"],
  models: readonly PerformanceModel[],
): WeeklyHoldTrade[][] {
  switch (breakdown) {
    case "asset_class":
      return groupByAssetClass(trades);
    case "tiers":
      return groupByTier(trades);
    case "per_model":
      return groupByModel(trades, models);
  }
}

function getLabels(breakdown: BiasSourceConfig["cardBreakdown"]): Record<PerformanceModel, string> {
  switch (breakdown) {
    case "asset_class":
      return ASSET_CLASS_LABELS;
    case "tiers":
      return TIER_LABELS;
    case "per_model":
      return PER_MODEL_LABELS;
  }
}

function getStrategyLabels(biasSource: BiasSourceConfig): Record<PerformanceModel, string> {
  return {
    ...getLabels(biasSource.cardBreakdown),
    ...(biasSource.modelLabels ?? {}),
  };
}

function legSlotByAssetClass(leg: PositionLeg): number {
  if (leg.assetClass === "fx") return 0;
  if (leg.assetClass === "commodities" || leg.assetClass === "indices") return 1;
  if (leg.assetClass === "crypto") return 2;
  return 0;
}

function legSlotByTier(leg: PositionLeg): number {
  if (leg.tier === 1) return 0;
  if (leg.tier === 2) return 1;
  if (leg.tier === 3) return 2;
  return 0;
}

function legSlotByModel(leg: PositionLeg, models: readonly PerformanceModel[]): number {
  const idx = models.indexOf(leg.source as PerformanceModel);
  return idx >= 0 ? idx : 0;
}

export function resolveLegSlotFn(
  breakdown: BiasSourceConfig["cardBreakdown"],
  models: readonly PerformanceModel[],
): (leg: PositionLeg) => number {
  switch (breakdown) {
    case "asset_class":
      return legSlotByAssetClass;
    case "tiers":
      return legSlotByTier;
    case "per_model":
      return (leg) => legSlotByModel(leg, models);
  }
}

// ─── Trade → ModelPerformance conversion ────────────────────────

function toDetailMeta(t: WeeklyHoldTrade): TradeDetailMeta | undefined {
  if (!t.detail) return undefined;
  return {
    tradeNumber: t.detail.tradeNumber,
    entryPrice: t.openPrice,
    exitPrice: t.closePrice || null,
    tpPrice: t.detail.tpPrice,
    adrPct: t.detail.adrPct,
    maePct: t.detail.maePct,
    exitReason: t.detail.exitReason,
    entryTimeUtc: t.detail.entryTimeUtc,
  };
}

function buildReasonLines(t: WeeklyHoldTrade): string[] {
  if (t.detail) {
    const lines = [
      `#${t.detail.tradeNumber}`,
      `Entry ${t.openPrice.toFixed(5)}`,
    ];
    if (t.detail.tpPrice) lines.push(`TP ${t.detail.tpPrice.toFixed(5)}`);
    lines.push(`Exit ${t.closePrice.toFixed(5)}`);
    if (t.detail.exitReason) lines.push(t.detail.exitReason.toUpperCase());
    if (t.detail.maePct != null) lines.push(`MAE ${t.detail.maePct.toFixed(2)}%`);
    lines.push(`${t.returnPct >= 0 ? "+" : ""}${t.returnPct.toFixed(2)}%`);
    return lines;
  }
  return [
    `${t.assetClass.charAt(0).toUpperCase()}${t.assetClass.slice(1)} basket`,
    `Open ${t.openPrice.toFixed(5)}`,
    `Close ${t.closePrice.toFixed(5)}`,
    `Return ${t.returnPct >= 0 ? "+" : ""}${t.returnPct.toFixed(2)}%`,
  ];
}

function tradesToModelPerformance(
  slot: PerformanceModel,
  trades: WeeklyHoldTrade[],
  note: string,
): ModelPerformance {
  const returns = trades.map((t) => ({ pair: t.symbol, percent: t.returnPct }));

  // Group trades by symbol for expandable view
  const bySymbol = new Map<string, WeeklyHoldTrade[]>();
  for (const t of trades) {
    const key = t.symbol;
    if (!bySymbol.has(key)) bySymbol.set(key, []);
    bySymbol.get(key)!.push(t);
  }

  const pairDetails: ModelPerformance["pair_details"] = [];
  for (const [symbol, group] of bySymbol) {
    if (group.length === 1) {
      // Single trade — flat row with detail
      const t = group[0]!;
      pairDetails.push({
        pair: t.symbol,
        direction: t.direction,
        reason: buildReasonLines(t),
        percent: t.returnPct,
        tradeDetail: toDetailMeta(t),
      });
    } else {
      // Multiple trades — parent with children
      const totalReturn = group.reduce((s, t) => s + t.returnPct, 0);
      const wins = group.filter((t) => t.returnPct > 0).length;
      const parent = group[0]!;
      pairDetails.push({
        pair: symbol,
        direction: parent.direction,
        reason: [
          `${group.length} trades`,
          `${wins}W ${group.length - wins}L`,
          `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`,
        ],
        percent: totalReturn,
        children: group.map((t) => ({
          pair: t.symbol,
          direction: t.direction,
          reason: buildReasonLines(t),
          percent: t.returnPct,
          tradeDetail: toDetailMeta(t),
        })),
      });
    }
  }

  return {
    model: slot,
    percent: returns.reduce((s, r) => s + r.percent, 0),
    priced: trades.length,
    total: trades.length,
    note,
    returns,
    pair_details: pairDetails,
    stats: computeReturnStats(returns),
    diagnostics: { max_drawdown: null, profit_factor: null },
  };
}

// ─── GridProps types (matches PerformanceGrid expectations) ─────

export type EngineGridProps = {
  combined: {
    id: string;
    label: string;
    description: string;
    models: ModelPerformance[];
  };
  perAsset: Array<{
    id: string;
    label: string;
    description: string;
    models: ModelPerformance[];
  }>;
  labels: Record<PerformanceModel, string>;
  allTime: {
    combined: Array<{
      model: PerformanceModel;
      totalPercent: number;
      weeks: number;
      winRate: number;
      avgWeekly: number;
    }>;
    perAsset: Record<
      string,
      Array<{
        model: PerformanceModel;
        totalPercent: number;
        weeks: number;
        winRate: number;
        avgWeekly: number;
      }>
    >;
  };
  showAllTime: boolean;
};

function buildExecutionLabel(biasSource: BiasSourceConfig, selectionLabel: string) {
  return `${biasSource.label} · ${selectionLabel}`;
}

// ─── Single-week adapter ────────────────────────────────────────

export function weeklyHoldToGridProps(
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  weekLabel: string,
  selectionLabel = "Weekly Hold",
): EngineGridProps {
  const { trades } = result;
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getStrategyLabels(biasSource);
  const slotted = slotTrades(trades, biasSource.cardBreakdown, cardSlots);

  const slotLabels = cardSlots.map((slot) => labels[slot]);

  const models: ModelPerformance[] = cardSlots.map((slot, i) =>
    tradesToModelPerformance(slot, slotted[i] ?? [], `${slotLabels[i]} contribution for ${weekLabel}.`),
  );

  // Build perAsset only for tiers and per_model breakdowns
  // For asset_class breakdown, cards already ARE the asset breakdown
  const perAsset: EngineGridProps["perAsset"] = [];
  if (biasSource.cardBreakdown !== "asset_class") {
    for (const ac of ASSET_SECTIONS) {
      const acTrades = trades.filter((t) => t.assetClass === ac.id);
      const acSlotted = slotTrades(acTrades, biasSource.cardBreakdown, cardSlots);
      perAsset.push({
        id: ac.id,
        label: ac.label,
        description: `${ac.label} contribution`,
        models: cardSlots.map((slot, i) =>
          tradesToModelPerformance(slot, acSlotted[i] ?? [], `${slotLabels[i]} — ${ac.label}.`),
        ),
      });
    }
  }

  return {
    combined: {
      id: "combined",
      label: "All",
      description: `${buildExecutionLabel(biasSource, selectionLabel)} · ${weekLabel}`,
      models,
    },
    perAsset,
    labels,
    allTime: { combined: [], perAsset: {} },
    showAllTime: false,
  };
}

// ─── Multi-week adapter (for all-time stats) ────────────────────

export function multiWeekToGridProps(
  result: MultiWeekResult,
  biasSource: BiasSourceConfig,
  selectionLabel = "Weekly Hold",
): EngineGridProps {
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getStrategyLabels(biasSource);
  const slotLabels = cardSlots.map((slot) => labels[slot]);

  // Aggregate trades across all weeks, grouped per-week for returns array
  const weeklySlotReturns: Array<Array<{ pair: string; percent: number }>> = cardSlots.map(() => []);

  for (const week of result.weeks) {
    const slotted = slotTrades(week.trades, biasSource.cardBreakdown, cardSlots);
    for (let i = 0; i < cardSlots.length; i++) {
      const weekReturn = (slotted[i] ?? []).reduce((s, t) => s + t.returnPct, 0);
      weeklySlotReturns[i].push({
        pair: `Week of ${week.weekOpenUtc.split("T")[0]}`,
        percent: weekReturn,
      });
    }
  }

  const models: ModelPerformance[] = cardSlots.map((slot, i) => ({
    model: slot,
    percent: weeklySlotReturns[i].reduce((s, r) => s + r.percent, 0),
    priced: weeklySlotReturns[i].length,
    total: weeklySlotReturns[i].length,
    note:
      biasSource.cardBreakdown === "tiers"
        ? `${slotLabels[i]} contribution across ${result.weeks.length} weeks.`
        : biasSource.description,
    returns: weeklySlotReturns[i],
    pair_details: weeklySlotReturns[i].map((r) => ({
      pair: r.pair,
      direction: (r.percent >= 0 ? "LONG" : "SHORT") as "LONG" | "SHORT",
      reason: [`Weekly return ${r.percent >= 0 ? "+" : ""}${r.percent.toFixed(2)}%`],
      percent: r.percent,
    })),
    stats: computeReturnStats(weeklySlotReturns[i]),
    diagnostics: { max_drawdown: null, profit_factor: null },
  }));

  const allTimeCombined = cardSlots.map((slot, i) => ({
    model: slot,
    totalPercent: weeklySlotReturns[i].reduce((s, r) => s + r.percent, 0),
    weeks: weeklySlotReturns[i].length,
    winRate: computeReturnStats(weeklySlotReturns[i]).win_rate,
    avgWeekly: computeReturnStats(weeklySlotReturns[i]).avg_return,
  }));

  // Per-asset all-time (for tiers/per_model)
  const allTimePerAsset: Record<string, typeof allTimeCombined> = {};
  if (biasSource.cardBreakdown !== "asset_class") {
    for (const ac of ASSET_SECTIONS) {
      const weeklyAcSlotReturns: typeof weeklySlotReturns = cardSlots.map(() => []);
      for (const week of result.weeks) {
        const acTrades = week.trades.filter((t) => t.assetClass === ac.id);
        const acSlotted = slotTrades(acTrades, biasSource.cardBreakdown, cardSlots);
        for (let i = 0; i < cardSlots.length; i++) {
          const weekReturn = (acSlotted[i] ?? []).reduce((s, t) => s + t.returnPct, 0);
          weeklyAcSlotReturns[i].push({
            pair: `Week of ${week.weekOpenUtc.split("T")[0]}`,
            percent: weekReturn,
          });
        }
      }
      allTimePerAsset[ac.id] = cardSlots.map((slot, i) => ({
        model: slot,
        totalPercent: weeklyAcSlotReturns[i].reduce((s, r) => s + r.percent, 0),
        weeks: weeklyAcSlotReturns[i].length,
        winRate: computeReturnStats(weeklyAcSlotReturns[i]).win_rate,
        avgWeekly: computeReturnStats(weeklyAcSlotReturns[i]).avg_return,
      }));
    }
  }

  // Per-asset sections for the multi-week view
  const perAsset: EngineGridProps["perAsset"] = [];
  if (biasSource.cardBreakdown !== "asset_class") {
    for (const ac of ASSET_SECTIONS) {
      const weeklyAcSlotReturns: typeof weeklySlotReturns = cardSlots.map(() => []);
      for (const week of result.weeks) {
        const acTrades = week.trades.filter((t) => t.assetClass === ac.id);
        const acSlotted = slotTrades(acTrades, biasSource.cardBreakdown, cardSlots);
        for (let i = 0; i < cardSlots.length; i++) {
          const weekReturn = (acSlotted[i] ?? []).reduce((s, t) => s + t.returnPct, 0);
          weeklyAcSlotReturns[i].push({
            pair: `Week of ${week.weekOpenUtc.split("T")[0]}`,
            percent: weekReturn,
          });
        }
      }
      perAsset.push({
        id: ac.id,
        label: ac.label,
        description: `${ac.label} contribution across ${result.weeks.length} weeks`,
        models: cardSlots.map((slot, i) => ({
          model: slot,
          percent: weeklyAcSlotReturns[i].reduce((s, r) => s + r.percent, 0),
          priced: weeklyAcSlotReturns[i].length,
          total: weeklyAcSlotReturns[i].length,
          note:
            biasSource.cardBreakdown === "tiers"
              ? `${slotLabels[i]} — ${ac.label} across ${result.weeks.length} weeks.`
              : biasSource.description,
          returns: weeklyAcSlotReturns[i],
          pair_details: weeklyAcSlotReturns[i].map((r) => ({
            pair: r.pair,
            direction: (r.percent >= 0 ? "LONG" : "SHORT") as "LONG" | "SHORT",
            reason: [`Weekly return ${r.percent >= 0 ? "+" : ""}${r.percent.toFixed(2)}%`],
            percent: r.percent,
          })),
          stats: computeReturnStats(weeklyAcSlotReturns[i]),
          diagnostics: { max_drawdown: null, profit_factor: null },
        })),
      });
    }
  }

  return {
    combined: {
      id: "combined",
      label: "All",
      description: `${buildExecutionLabel(biasSource, selectionLabel)} · ${result.weeks.length} weeks`,
      models,
    },
    perAsset,
    labels,
    allTime: { combined: allTimeCombined, perAsset: allTimePerAsset },
    showAllTime: false,
  };
}

// ─── Simulation equity curve from multi-week ────────────────────

const SERIES_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a78bfa", "#f43f5e", "#ef4444"];

export type EngineSimulationGroup = {
  title: string;
  description: string;
  metrics: {
    returnPct: number | null;
    maxDrawdownPct: number | null;
    trades: number | null;
  };
  series: Array<{
    id: string;
    label: string;
    color?: string;
    points: Array<{
      ts_utc: string;
      equity_pct: number;
      lock_pct: number | null;
    }>;
  }>;
  seriesGroups?: Array<{
    id: string;
    label: string;
    description: string;
    seriesIds: string[];
  }>;
};

export function singleWeekToSimulation(
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  weekLabel: string,
  selectionLabel = "Weekly Hold",
): EngineSimulationGroup {
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getStrategyLabels(biasSource);
  const slotLabels = cardSlots.map((slot) => labels[slot]);
  const slotted = slotTrades(result.trades, biasSource.cardBreakdown, cardSlots);

  const weekStart = result.weekOpenUtc;
  // Approximate week end (5 days later)
  const endDate = new Date(new Date(weekStart).getTime() + 5 * 24 * 60 * 60 * 1000);
  const weekEnd = endDate.toISOString();

  const series = cardSlots.map((slot, i) => {
    const slotReturn = (slotted[i] ?? []).reduce((s, t) => s + t.returnPct, 0);
    return {
      id: slot,
      label: slotLabels[i],
      color: SERIES_COLORS[i],
      points: [
        { ts_utc: weekStart, equity_pct: 0, lock_pct: null },
        { ts_utc: weekEnd, equity_pct: slotReturn, lock_pct: null },
      ],
    };
  });

  const totalSeries = {
    id: "total",
    label: "Total",
    color: "#ffffff",
    points: [
      { ts_utc: weekStart, equity_pct: 0, lock_pct: null },
      { ts_utc: weekEnd, equity_pct: result.totalReturnPct, lock_pct: null },
    ],
  };

  const assetSeries = ASSET_SECTIONS.map((asset, index) => {
    const assetReturn = result.trades
      .filter((trade) => trade.assetClass === asset.id)
      .reduce((sum, trade) => sum + trade.returnPct, 0);
    return {
      id: `asset:${asset.id}`,
      label: asset.label,
      color: SERIES_COLORS[index + 1],
      points: [
        { ts_utc: weekStart, equity_pct: 0, lock_pct: null },
        { ts_utc: weekEnd, equity_pct: assetReturn, lock_pct: null },
      ],
    };
  });

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Equity curve for ${weekLabel}.`,
    metrics: {
      returnPct: result.totalReturnPct,
      maxDrawdownPct: null,
      trades: result.tradeCount,
    },
    series: [totalSeries, ...assetSeries, ...series],
    seriesGroups: buildSeriesGroups(totalSeries, assetSeries, series),
  };
}

export function multiWeekToSimulation(
  result: MultiWeekResult,
  biasSource: BiasSourceConfig,
  selectionLabel = "Weekly Hold",
): EngineSimulationGroup {
  const chronologicalWeeks = sortWeeksChronologically(result.weeks);
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getStrategyLabels(biasSource);
  const slotLabels = cardSlots.map((slot) => labels[slot]);

  // Build one cumulative equity curve per card slot
  const series = cardSlots.map((slot, i) => {
    let cumulative = 0;
    const points = chronologicalWeeks.map((week) => {
      const slotted = slotTrades(week.trades, biasSource.cardBreakdown, cardSlots);
      const weekReturn = (slotted[i] ?? []).reduce((s, t) => s + t.returnPct, 0);
      cumulative += weekReturn;
      return {
        ts_utc: week.weekOpenUtc,
        equity_pct: cumulative,
        lock_pct: null,
      };
    });
    return {
      id: slot,
      label: slotLabels[i],
      color: SERIES_COLORS[i],
      points,
    };
  });

  // Also build a "Total" series (sum of all slots)
  let totalCum = 0;
  const totalSeries = {
    id: "total",
    label: "Total",
    color: "#ffffff",
    points: chronologicalWeeks.map((week) => {
      totalCum += week.totalReturnPct;
      return {
        ts_utc: week.weekOpenUtc,
        equity_pct: totalCum,
        lock_pct: null,
      };
    }),
  };

  const assetSeries = ASSET_SECTIONS.map((asset, index) => {
    let cumulative = 0;
    const points = chronologicalWeeks.map((week) => {
      const weekReturn = week.trades
        .filter((trade) => trade.assetClass === asset.id)
        .reduce((sum, trade) => sum + trade.returnPct, 0);
      cumulative += weekReturn;
      return {
        ts_utc: week.weekOpenUtc,
        equity_pct: cumulative,
        lock_pct: null,
      };
    });
    return {
      id: `asset:${asset.id}`,
      label: asset.label,
      color: SERIES_COLORS[(index + 1) % SERIES_COLORS.length],
      points,
    };
  });

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Cumulative equity curves across ${result.weeks.length} weeks.`,
    metrics: {
      returnPct: result.totalReturnPct,
      maxDrawdownPct: result.maxDrawdownPct,
      trades: result.totalTrades,
    },
    series: [totalSeries, ...assetSeries, ...series],
    seriesGroups: buildSeriesGroups(totalSeries, assetSeries, series),
  };
}

function buildSeriesGroups(
  totalSeries: EngineSimulationGroup["series"][number],
  assetSeries: EngineSimulationGroup["series"],
  layerSeries: EngineSimulationGroup["series"],
): NonNullable<EngineSimulationGroup["seriesGroups"]> {
  const totalIds = [totalSeries.id];
  const assetIds = assetSeries.map((series) => series.id);
  const layerIds = layerSeries.map((series) => series.id);
  return [
    {
      id: "assets",
      label: "Assets",
      description: "Total curve plus FX, indices, commodities, and crypto sleeves.",
      seriesIds: [...totalIds, ...assetIds],
    },
    {
      id: "layers",
      label: "Layers",
      description: "Total curve plus the strategy's internal sleeves.",
      seriesIds: [...totalIds, ...layerIds],
    },
    {
      id: "total",
      label: "Total",
      description: "Consolidated portfolio equity curve only.",
      seriesIds: totalIds,
    },
    {
      id: "all",
      label: "All",
      description: "Total, asset sleeves, and internal strategy sleeves together.",
      seriesIds: [...totalIds, ...assetIds, ...layerIds],
    },
  ];
}

export function withTradeDerivedSeriesGroups(
  group: EngineSimulationGroup,
  result: WeeklyHoldResult | MultiWeekResult,
): EngineSimulationGroup {
  const totalSeries = group.series[0];
  if (!totalSeries) return group;
  const layerSeries = group.series
    .slice(1)
    .filter((series) => !series.id.startsWith("asset:"));
  const assetSeries = "weeks" in result
    ? buildMultiWeekAssetSeriesFromTrades(result)
    : buildSingleWeekAssetSeriesFromTrades(result, result.weekOpenUtc);
  return {
    ...group,
    series: [totalSeries, ...assetSeries, ...layerSeries],
    seriesGroups: buildSeriesGroups(totalSeries, assetSeries, layerSeries),
  };
}

function pathPointsToSimulationPoints(points: BasketPathPoint[]) {
  return points.map((point) => ({
    ts_utc: point.tsUtc,
    equity_pct: point.equityPct,
    lock_pct: null,
  }));
}

function buildSingleWeekAssetSeriesFromTrades(
  result: WeeklyHoldResult,
  weekStart: string,
): EngineSimulationGroup["series"] {
  const endDate = new Date(new Date(weekStart).getTime() + 5 * 24 * 60 * 60 * 1000);
  const weekEnd = endDate.toISOString();
  return ASSET_SECTIONS.map((asset, index) => {
    const assetReturn = result.trades
      .filter((trade) => trade.assetClass === asset.id)
      .reduce((sum, trade) => sum + trade.returnPct, 0);
    return {
      id: `asset:${asset.id}`,
      label: asset.label,
      color: SERIES_COLORS[(index + 1) % SERIES_COLORS.length],
      points: [
        { ts_utc: weekStart, equity_pct: 0, lock_pct: null },
        { ts_utc: weekEnd, equity_pct: assetReturn, lock_pct: null },
      ],
    };
  });
}

function buildMultiWeekAssetSeriesFromTrades(
  result: MultiWeekResult,
): EngineSimulationGroup["series"] {
  const chronologicalWeeks = sortWeeksChronologically(result.weeks);
  return ASSET_SECTIONS.map((asset, index) => {
    let cumulative = 0;
    const points = chronologicalWeeks.map((week) => {
      const weekReturn = week.trades
        .filter((trade) => trade.assetClass === asset.id)
        .reduce((sum, trade) => sum + trade.returnPct, 0);
      cumulative += weekReturn;
      return {
        ts_utc: week.weekOpenUtc,
        equity_pct: cumulative,
        lock_pct: null,
      };
    });
    return {
      id: `asset:${asset.id}`,
      label: asset.label,
      color: SERIES_COLORS[(index + 1) % SERIES_COLORS.length],
      points,
    };
  });
}

function sortWeeksChronologically<T extends { weekOpenUtc: string }>(weeks: readonly T[]): T[] {
  return [...weeks].sort(
    (left, right) => Date.parse(left.weekOpenUtc) - Date.parse(right.weekOpenUtc),
  );
}

type MultiWeekPathAggregate = {
  points: BasketPathPoint[];
  summary: BasketPathSummary;
};

export function singleWeekPathToSimulation(
  path: BasketPathResult,
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  weekLabel: string,
  selectionLabel = "Weekly Hold",
  slotPaths: BasketPathResult[] = [],
  assetPaths: BasketPathResult[] = [],
): EngineSimulationGroup {
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getStrategyLabels(biasSource);
  const slotLabels = cardSlots.map((slot) => labels[slot]);
  const totalSeries = {
    id: "equity",
    label: "Total",
    color: "#ffffff",
    points: pathPointsToSimulationPoints(path.points),
  };
  const assetSeries = assetPaths.length > 0
    ? assetPaths.map((assetPath, index) => ({
        id: `asset:${ASSET_SECTIONS[index]?.id ?? index}`,
        label: ASSET_SECTIONS[index]?.label ?? `Asset ${index + 1}`,
        color: SERIES_COLORS[(index + 1) % SERIES_COLORS.length],
        points: pathPointsToSimulationPoints(assetPath.points),
      }))
    : buildSingleWeekAssetSeriesFromTrades(result, result.weekOpenUtc);
  const layerSeries = slotPaths.map((slotPath, index) => ({
    id: cardSlots[index] ?? `slot-${index + 1}`,
    label: slotLabels[index] ?? `Slot ${index + 1}`,
    color: SERIES_COLORS[(index + assetSeries.length + 1) % SERIES_COLORS.length],
    points: pathPointsToSimulationPoints(slotPath.points),
  }));

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Hourly equity path for ${weekLabel}.`,
    metrics: {
      returnPct: path.summary.totalReturnPct,
      maxDrawdownPct: path.summary.maxDrawdownPct,
      trades: result.tradeCount,
    },
    series: [totalSeries, ...assetSeries, ...layerSeries],
    seriesGroups: buildSeriesGroups(totalSeries, assetSeries, layerSeries),
  };
}

export function multiWeekPathToSimulation(
  path: MultiWeekPathAggregate,
  result: MultiWeekResult,
  biasSource: BiasSourceConfig,
  selectionLabel = "Weekly Hold",
  slotPaths: MultiWeekPathAggregate[] = [],
  assetPaths: MultiWeekPathAggregate[] = [],
): EngineSimulationGroup {
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getStrategyLabels(biasSource);
  const slotLabels = cardSlots.map((slot) => labels[slot]);
  const totalSeries = {
    id: "equity",
    label: "Total",
    color: "#ffffff",
    points: pathPointsToSimulationPoints(path.points),
  };
  const assetSeries = assetPaths.length > 0
    ? assetPaths.map((assetPath, index) => ({
        id: `asset:${ASSET_SECTIONS[index]?.id ?? index}`,
        label: ASSET_SECTIONS[index]?.label ?? `Asset ${index + 1}`,
        color: SERIES_COLORS[(index + 1) % SERIES_COLORS.length],
        points: pathPointsToSimulationPoints(assetPath.points),
      }))
    : buildMultiWeekAssetSeriesFromTrades(result);
  const layerSeries = slotPaths.map((slotPath, index) => ({
    id: cardSlots[index] ?? `slot-${index + 1}`,
    label: slotLabels[index] ?? `Slot ${index + 1}`,
    color: SERIES_COLORS[(index + assetSeries.length + 1) % SERIES_COLORS.length],
    points: pathPointsToSimulationPoints(slotPath.points),
  }));

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Continuous hourly equity path across ${result.weeks.length} weeks.`,
    metrics: {
      returnPct: path.summary.totalReturnPct,
      maxDrawdownPct: path.summary.maxDrawdownPct,
      trades: result.totalTrades,
    },
    series: [totalSeries, ...assetSeries, ...layerSeries],
    seriesGroups: buildSeriesGroups(totalSeries, assetSeries, layerSeries),
  };
}

// ─── Sidebar stats (lightweight summary) ────────────────────────

export type EngineSidebarStats = {
  biasSourceId: string;
  biasSourceLabel: string;
  weekOpenUtc: string;
  weekReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  /** Multi-week aggregate (null when viewing single week) */
  allTime: {
    totalReturnPct: number;
    totalTrades: number;
    weeklyWinRate: number;
    maxDrawdownPct: number;
    weeks: number;
    avgWeeklyReturn: number;
    sharpe: number;
    profitFactor: number | null;
  } | null;
  trades: Array<{
    symbol: string;
    direction: "LONG" | "SHORT";
    returnPct: number;
    assetClass: string;
  }>;
};

function computeSharpe(weeklyReturns: number[]): number {
  if (weeklyReturns.length <= 1) return 0;
  const avg = weeklyReturns.reduce((s, r) => s + r, 0) / weeklyReturns.length;
  const variance = weeklyReturns.reduce((s, r) => s + (r - avg) ** 2, 0) / (weeklyReturns.length - 1);
  const std = Math.sqrt(variance);
  return std > 0 ? avg / std : 0;
}

function computeProfitFactor(weeklyReturns: number[]): number | null {
  const grossProfit = weeklyReturns.filter((r) => r > 0).reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(weeklyReturns.filter((r) => r < 0).reduce((s, r) => s + r, 0));
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Infinity;
  return null;
}

export function weeklyHoldToSidebarStats(
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  multiWeek?: MultiWeekResult,
): EngineSidebarStats {
  return weeklyHoldToSidebarStatsWithPath(result, biasSource, {
    multiWeek,
    currentWeekPathSummary: null,
    multiWeekPathSummary: null,
  });
}

export function weeklyHoldToSidebarStatsWithPath(
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  options?: {
    multiWeek?: MultiWeekResult;
    currentWeekPathSummary?: BasketPathSummary | null;
    multiWeekPathSummary?: BasketPathSummary | null;
  },
): EngineSidebarStats {
  const multiWeek = options?.multiWeek;
  const currentWeekPathSummary = options?.currentWeekPathSummary ?? null;
  const multiWeekPathSummary = options?.multiWeekPathSummary ?? null;
  let allTime: EngineSidebarStats["allTime"] = null;
  if (multiWeek && multiWeek.weeks.length > 0) {
    const weeklyReturns = multiWeek.weeks.map((w) => w.totalReturnPct);
    const weeklyWins = multiWeek.weeks.filter((w) => w.totalReturnPct > 0).length;
    allTime = {
      totalReturnPct: multiWeek.totalReturnPct,
      totalTrades: multiWeek.totalTrades,
      weeklyWinRate: (weeklyWins / multiWeek.weeks.length) * 100,
      maxDrawdownPct: multiWeekPathSummary?.maxDrawdownPct ?? multiWeek.maxDrawdownPct,
      weeks: multiWeek.weeks.length,
      avgWeeklyReturn: multiWeek.totalReturnPct / multiWeek.weeks.length,
      sharpe: computeSharpe(weeklyReturns),
      profitFactor: computeProfitFactor(weeklyReturns),
    };
  }

  return {
    biasSourceId: result.biasSourceId,
    biasSourceLabel: biasSource.label,
    weekOpenUtc: result.weekOpenUtc,
    weekReturnPct: result.totalReturnPct,
    tradeCount: result.tradeCount,
    winCount: result.winCount,
    lossCount: result.lossCount,
    winRate: result.winRate,
    allTime,
    maxDrawdownPct: currentWeekPathSummary?.maxDrawdownPct ?? 0,
    trades: result.trades.map((t) => ({
      symbol: t.symbol,
      direction: t.direction,
      returnPct: t.returnPct,
      assetClass: t.assetClass,
    })),
  };
}
