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
 *   per_model   → dealer=Dealer, commercial=Commercial, sentiment=Sentiment
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { WeeklyHoldResult, WeeklyHoldTrade, MultiWeekResult } from "@/lib/performance/weeklyHoldEngine";
import type { BiasSourceConfig } from "@/lib/performance/strategyConfig";
import type { ModelPerformance, PerformanceModel } from "@/lib/performanceLab";
import { computeReturnStats } from "@/lib/performanceLab";
import { PERFORMANCE_MODEL_LABELS } from "@/lib/performance/modelConfig";

// ─── Card slot mapping ──────────────────────────────────────────

const CARD_SLOTS: [PerformanceModel, PerformanceModel, PerformanceModel] = [
  "dealer",
  "commercial",
  "sentiment",
];

const ASSET_CLASS_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "FX",
  commercial: "Commodities & Indices",
  sentiment: "Crypto",
};

const TIER_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "Tier 1 — High Confidence",
  commercial: "Tier 2 — Medium Confidence",
  sentiment: "Tier 3 — Low Confidence",
};

const PER_MODEL_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "Dealer Portfolio",
  commercial: "Commercial Portfolio",
  sentiment: "Sentiment Portfolio",
};

const ASSET_SECTIONS = [
  { id: "fx", label: "FX" },
  { id: "indices", label: "Indices" },
  { id: "commodities", label: "Commodities" },
  { id: "crypto", label: "Crypto" },
] as const;

// ─── Trade grouping ─────────────────────────────────────────────

type SlottedTrades = [WeeklyHoldTrade[], WeeklyHoldTrade[], WeeklyHoldTrade[]];

function groupByAssetClass(trades: WeeklyHoldTrade[]): SlottedTrades {
  return [
    trades.filter((t) => t.assetClass === "fx"),
    trades.filter((t) => t.assetClass === "commodities" || t.assetClass === "indices"),
    trades.filter((t) => t.assetClass === "crypto"),
  ];
}

function groupByTier(trades: WeeklyHoldTrade[]): SlottedTrades {
  return [
    trades.filter((t) => t.tier === 1),
    trades.filter((t) => t.tier === 2),
    trades.filter((t) => t.tier === 3),
  ];
}

function groupByModel(trades: WeeklyHoldTrade[]): SlottedTrades {
  return [
    trades.filter((t) => t.source === "dealer"),
    trades.filter((t) => t.source === "commercial"),
    trades.filter((t) => t.source === "sentiment"),
  ];
}

function slotTrades(
  trades: WeeklyHoldTrade[],
  breakdown: BiasSourceConfig["cardBreakdown"],
): SlottedTrades {
  switch (breakdown) {
    case "asset_class":
      return groupByAssetClass(trades);
    case "tiers":
      return groupByTier(trades);
    case "per_model":
      return groupByModel(trades);
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

// ─── Trade → ModelPerformance conversion ────────────────────────

function tradesToModelPerformance(
  slot: PerformanceModel,
  trades: WeeklyHoldTrade[],
  note: string,
): ModelPerformance {
  const returns = trades.map((t) => ({ pair: t.symbol, percent: t.returnPct }));
  const pairDetails = trades.map((t) => ({
    pair: t.symbol,
    direction: t.direction,
    reason: [
      `${t.assetClass.charAt(0).toUpperCase()}${t.assetClass.slice(1)} basket`,
      `Open ${t.openPrice.toFixed(5)}`,
      `Close ${t.closePrice.toFixed(5)}`,
      `Return ${t.returnPct >= 0 ? "+" : ""}${t.returnPct.toFixed(2)}%`,
    ],
    percent: t.returnPct,
  }));

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

// ─── Single-week adapter ────────────────────────────────────────

export function weeklyHoldToGridProps(
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  weekLabel: string,
): EngineGridProps {
  const { trades } = result;
  const labels = getLabels(biasSource.cardBreakdown);
  const slotted = slotTrades(trades, biasSource.cardBreakdown);

  const slotLabels = [labels[CARD_SLOTS[0]], labels[CARD_SLOTS[1]], labels[CARD_SLOTS[2]]];

  const models: ModelPerformance[] = CARD_SLOTS.map((slot, i) =>
    tradesToModelPerformance(slot, slotted[i], `${slotLabels[i]} contribution for ${weekLabel}.`),
  );

  // Build perAsset only for tiers and per_model breakdowns
  // For asset_class breakdown, cards already ARE the asset breakdown
  const perAsset: EngineGridProps["perAsset"] = [];
  if (biasSource.cardBreakdown !== "asset_class") {
    for (const ac of ASSET_SECTIONS) {
      const acTrades = trades.filter((t) => t.assetClass === ac.id);
      const acSlotted = slotTrades(acTrades, biasSource.cardBreakdown);
      perAsset.push({
        id: ac.id,
        label: ac.label,
        description: `${ac.label} contribution`,
        models: CARD_SLOTS.map((slot, i) =>
          tradesToModelPerformance(slot, acSlotted[i], `${slotLabels[i]} — ${ac.label}.`),
        ),
      });
    }
  }

  return {
    combined: {
      id: "combined",
      label: "All",
      description: `${biasSource.label} · Weekly Hold · ${weekLabel}`,
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
): EngineGridProps {
  const labels = getLabels(biasSource.cardBreakdown);
  const slotLabels = [labels[CARD_SLOTS[0]], labels[CARD_SLOTS[1]], labels[CARD_SLOTS[2]]];

  // Aggregate trades across all weeks, grouped per-week for returns array
  const weeklySlotReturns: [
    Array<{ pair: string; percent: number }>,
    Array<{ pair: string; percent: number }>,
    Array<{ pair: string; percent: number }>,
  ] = [[], [], []];

  for (const week of result.weeks) {
    const slotted = slotTrades(week.trades, biasSource.cardBreakdown);
    for (let i = 0; i < 3; i++) {
      const weekReturn = slotted[i].reduce((s, t) => s + t.returnPct, 0);
      weeklySlotReturns[i].push({
        pair: `Week of ${week.weekOpenUtc.split("T")[0]}`,
        percent: weekReturn,
      });
    }
  }

  const models: ModelPerformance[] = CARD_SLOTS.map((slot, i) => ({
    model: slot,
    percent: weeklySlotReturns[i].reduce((s, r) => s + r.percent, 0),
    priced: weeklySlotReturns[i].length,
    total: weeklySlotReturns[i].length,
    note: `${slotLabels[i]} contribution across ${result.weeks.length} weeks.`,
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

  const allTimeCombined = CARD_SLOTS.map((slot, i) => ({
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
      const weeklyAcSlotReturns: typeof weeklySlotReturns = [[], [], []];
      for (const week of result.weeks) {
        const acTrades = week.trades.filter((t) => t.assetClass === ac.id);
        const acSlotted = slotTrades(acTrades, biasSource.cardBreakdown);
        for (let i = 0; i < 3; i++) {
          const weekReturn = acSlotted[i].reduce((s, t) => s + t.returnPct, 0);
          weeklyAcSlotReturns[i].push({
            pair: `Week of ${week.weekOpenUtc.split("T")[0]}`,
            percent: weekReturn,
          });
        }
      }
      allTimePerAsset[ac.id] = CARD_SLOTS.map((slot, i) => ({
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
      const weeklyAcSlotReturns: typeof weeklySlotReturns = [[], [], []];
      for (const week of result.weeks) {
        const acTrades = week.trades.filter((t) => t.assetClass === ac.id);
        const acSlotted = slotTrades(acTrades, biasSource.cardBreakdown);
        for (let i = 0; i < 3; i++) {
          const weekReturn = acSlotted[i].reduce((s, t) => s + t.returnPct, 0);
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
        models: CARD_SLOTS.map((slot, i) => ({
          model: slot,
          percent: weeklyAcSlotReturns[i].reduce((s, r) => s + r.percent, 0),
          priced: weeklyAcSlotReturns[i].length,
          total: weeklyAcSlotReturns[i].length,
          note: `${slotLabels[i]} — ${ac.label} across ${result.weeks.length} weeks.`,
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
      description: `${biasSource.label} · Weekly Hold · ${result.weeks.length} weeks`,
      models,
    },
    perAsset,
    labels,
    allTime: { combined: allTimeCombined, perAsset: allTimePerAsset },
    showAllTime: false,
  };
}

// ─── Simulation equity curve from multi-week ────────────────────

const SERIES_COLORS = ["#10b981", "#38bdf8", "#f59e0b"];

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
};

export function singleWeekToSimulation(
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  weekLabel: string,
): EngineSimulationGroup {
  const labels = getLabels(biasSource.cardBreakdown);
  const slotLabels = [labels[CARD_SLOTS[0]], labels[CARD_SLOTS[1]], labels[CARD_SLOTS[2]]];
  const slotted = slotTrades(result.trades, biasSource.cardBreakdown);

  const weekStart = result.weekOpenUtc;
  // Approximate week end (5 days later)
  const endDate = new Date(new Date(weekStart).getTime() + 5 * 24 * 60 * 60 * 1000);
  const weekEnd = endDate.toISOString();

  const series = CARD_SLOTS.map((slot, i) => {
    const slotReturn = slotted[i].reduce((s, t) => s + t.returnPct, 0);
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

  return {
    title: `${biasSource.label} · Weekly Hold`,
    description: `Equity curve for ${weekLabel}.`,
    metrics: {
      returnPct: result.totalReturnPct,
      maxDrawdownPct: null,
      trades: result.tradeCount,
    },
    series: [totalSeries, ...series],
  };
}

export function multiWeekToSimulation(
  result: MultiWeekResult,
  biasSource: BiasSourceConfig,
): EngineSimulationGroup {
  const labels = getLabels(biasSource.cardBreakdown);
  const slotLabels = [labels[CARD_SLOTS[0]], labels[CARD_SLOTS[1]], labels[CARD_SLOTS[2]]];

  // Build one cumulative equity curve per card slot
  const series = CARD_SLOTS.map((slot, i) => {
    let cumulative = 0;
    const points = result.weeks.map((week) => {
      const slotted = slotTrades(week.trades, biasSource.cardBreakdown);
      const weekReturn = slotted[i].reduce((s, t) => s + t.returnPct, 0);
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
    points: result.weeks.map((week) => {
      totalCum += week.totalReturnPct;
      return {
        ts_utc: week.weekOpenUtc,
        equity_pct: totalCum,
        lock_pct: null,
      };
    }),
  };

  return {
    title: `${biasSource.label} · Weekly Hold`,
    description: `Cumulative equity curves across ${result.weeks.length} weeks.`,
    metrics: {
      returnPct: result.totalReturnPct,
      maxDrawdownPct: result.maxDrawdownPct,
      trades: result.totalTrades,
    },
    series: [totalSeries, ...series],
  };
}

// ─── Sidebar stats (lightweight summary) ────────────────────────

export type EngineSidebarStats = {
  biasSourceId: string;
  biasSourceLabel: string;
  weekOpenUtc: string;
  weekReturnPct: number;
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
  let allTime: EngineSidebarStats["allTime"] = null;
  if (multiWeek && multiWeek.weeks.length > 0) {
    const weeklyReturns = multiWeek.weeks.map((w) => w.totalReturnPct);
    const weeklyWins = multiWeek.weeks.filter((w) => w.totalReturnPct > 0).length;
    allTime = {
      totalReturnPct: multiWeek.totalReturnPct,
      totalTrades: multiWeek.totalTrades,
      weeklyWinRate: (weeklyWins / multiWeek.weeks.length) * 100,
      maxDrawdownPct: multiWeek.maxDrawdownPct,
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
    trades: result.trades.map((t) => ({
      symbol: t.symbol,
      direction: t.direction,
      returnPct: t.returnPct,
      assetClass: t.assetClass,
    })),
  };
}
