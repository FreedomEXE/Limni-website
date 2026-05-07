/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Performance page using the restored shell, now split into Flagship
 * and Legacy modes and backed by canonical reconstruction data.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import PerformanceStrategyViewSection from "@/components/performance/PerformanceStrategyViewSection";
import type { PerformanceSimulationGroup } from "@/components/performance/PerformanceSimulationSection";
import { getCanonicalWeeklyBasket, type CanonicalWeeklySignal, type CanonicalWeeklyTier } from "@/lib/flagship/canonicalWeeklyBasket";
import { buildWeeklyForwardSummary } from "@/lib/flagship/weeklyForwardSummary";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";
import {
  getCanonicalPerformanceApiModel,
  type CanonicalPerformanceApiModel,
  type CanonicalPerformanceSystem,
  type CanonicalPerformanceWeeklyNettedPair,
  type CanonicalPerformanceWeeklyRow,
} from "@/lib/performance/canonicalPerformanceReport";
import {
  PERFORMANCE_MODEL_LABELS,
  resolvePerformanceSystem,
  type PerformanceSystem,
} from "@/lib/performance/modelConfig";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { resolvePerformanceView, resolveSelectedPerformanceWeek } from "@/lib/performance/pageState";
import { computeReturnStats, type ModelPerformance, type PerformanceModel } from "@/lib/performanceLab";
import type { PerformanceStrategyFamily } from "@/lib/performance/strategyRegistry";
import { DateTime } from "luxon";
import {
  getEntryStyle,
  getStrengthGate,
  getStrategy,
  normalizeFilterSelection,
  resolveBiasSourceId,
} from "@/lib/performance/strategyConfig";
import {
  buildStrategySelectionKey,
  toRuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import { readStrategyArtifactEntry } from "@/lib/performance/strategyArtifactCache";
import { buildStrategyArtifactEngineVersion } from "@/lib/performance/strategyArtifactVersions";
import { loadStrategyPageData } from "@/lib/performance/strategyPageData";
import { toPerformanceClientPayload } from "@/lib/performance/strategyClientPayload";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PerformancePageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

type WeeklyPerformanceFamily = Exclude<PerformanceStrategyFamily, "katarakti">;
type TierPerformanceModel = Extract<PerformanceModel, "dealer" | "commercial" | "sentiment">;
type SelectedPerformanceWeek = string | "all";
type CanonicalOrLiveSignalTier = CanonicalWeeklyTier | "NEUTRAL";

type GridProps = {
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
  labels: typeof PERFORMANCE_MODEL_LABELS;
  allTime: {
    combined: Array<{
      model: PerformanceModel;
      totalPercent: number;
      weeks: number;
      winRate: number;
      avgWeekly: number;
    }>;
    perAsset: Record<string, Array<{
      model: PerformanceModel;
      totalPercent: number;
      weeks: number;
      winRate: number;
      avgWeekly: number;
    }>>;
  };
  showAllTime: boolean;
  comparisonOverlay?: {
    mode: "standard" | "gated";
    standard: {
      totalReturn: number;
      winRate: number;
      sharpe: number;
      maxDrawdown: number | null;
      profitFactor: number | null;
      tradeWinRate: number;
      avgWeekly: number;
      trades: number;
    };
    gated: {
      totalReturn: number;
      winRate: number;
      sharpe: number;
      maxDrawdown: number | null;
      profitFactor: number | null;
      tradeWinRate: number;
      avgWeekly: number;
      trades: number;
    } | null;
    gateAvailable: boolean;
    delta: {
      totalReturnPct: number;
      maxDrawdownPct: number;
      winRatePct: number;
      tradeWinRatePct: number;
      trades: number;
    } | null;
    gateActivity: {
      skippedTrades: number;
      reducedTrades: number;
      passedOrNoDataTrades: number;
    } | null;
  };
};

const ASSET_LABELS: Record<string, string> = {
  fx: "FX",
  indices: "Indices",
  commodities: "Commodities",
  crypto: "Crypto",
};

const SERIES_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a78bfa", "#f43f5e", "#ef4444"];
const TIER_MODELS: TierPerformanceModel[] = ["dealer", "commercial", "sentiment"];
const TIER_NUMBER_BY_MODEL: Record<TierPerformanceModel, 1 | 2 | 3> = {
  dealer: 1,
  commercial: 2,
  sentiment: 3,
};
const TIER_LABELS: Record<TierPerformanceModel, string> = {
  dealer: "Tier 1",
  commercial: "Tier 2",
  sentiment: "Tier 3",
};
const ASSET_SECTION_IDS = ["fx", "indices", "commodities", "crypto"] as const;
const UNIVERSAL_MODELS_BY_VERSION: Record<PerformanceSystem, readonly PerformanceModel[]> = {
  v1: ["antikythera", "blended", "dealer", "commercial", "sentiment"],
  v2: ["dealer", "sentiment", "antikythera_v2"],
  v3: ["antikythera_v3", "dealer", "commercial", "sentiment"],
};
const STANDALONE_MODEL_SYSTEM_ID: Record<PerformanceModel, string> = {
  antikythera: "model_antikythera",
  antikythera_v2: "model_antikythera_v2",
  antikythera_v3: "model_antikythera_v3",
  blended: "model_blended",
  dealer: "model_dealer",
  commercial: "model_commercial",
  sentiment: "model_sentiment",
  strength: "model_strength",
};

const TIERED_GRID_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "Tier 1",
  commercial: "Tier 2",
  sentiment: "Tier 3",
};

function parseFamily(value: string | null | undefined): PerformanceStrategyFamily {
  return value === "universal" ? "universal" : value === "katarakti" ? "katarakti" : "tiered";
}

function parseMode(value: string | null | undefined) {
  return value === "legacy" ? "legacy" : "flagship";
}

function weekLabel(weekOpenUtc: string) {
  const [datePart] = weekOpenUtc.split("T");
  if (!datePart) return weekOpenUtc;
  const [year, month, day] = datePart.split("-").map((value) => Number.parseInt(value, 10));
  if (!year || !month || !day) return weekOpenUtc;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).replace(",", "");
}

function toDirection(value: number | null | undefined): "LONG" | "SHORT" | "NEUTRAL" {
  if ((value ?? 0) > 0) return "LONG";
  if ((value ?? 0) < 0) return "SHORT";
  return "NEUTRAL";
}

function weekDisplayLabel(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!parsed.isValid) return weekOpenUtc;
  const start = parsed.plus({ days: 1 }).startOf("day");
  const end = start.plus({ days: 4 });
  return `${start.toFormat("MMM dd")} - ${end.toFormat("MMM dd, yyyy")}`;
}

function assetLabelForClass(assetClass: string) {
  return ASSET_LABELS[assetClass] ?? assetClass.toUpperCase();
}

function buildReasonsForHistoricalTrade(trade: CanonicalPerformanceWeeklyNettedPair) {
  const reasons = [
    `${assetLabelForClass(trade.assetClass)} basket`,
    `Raw move ${trade.returnPct.toFixed(2)}%`,
    `Normalized 1x contribution ${trade.positionContributionPct.toFixed(2)}%`,
  ];
  if (trade.support.length > 0) {
    reasons.push(`Support: ${trade.support.join(" / ")}`);
  }
  return reasons;
}

function buildHistoricalTierChildren(
  row: CanonicalPerformanceWeeklyRow,
  model: TierPerformanceModel,
  assetFilter?: string,
) {
  const tierNumber = TIER_NUMBER_BY_MODEL[model];
  return row.breakdown.nettedPairs
    .filter((trade) => trade.tier === tierNumber && (!assetFilter || trade.assetClass === assetFilter))
    .map((trade) => ({
      pair: trade.symbol,
      direction: trade.direction,
      reason: buildReasonsForHistoricalTrade(trade),
      percent: trade.positionContributionPct,
    }));
}

function buildTierModelPerformanceFromHistorical(options: {
  model: TierPerformanceModel;
  system: CanonicalPerformanceSystem;
  selectedWeek: SelectedPerformanceWeek;
  assetFilter?: string;
}) {
  const { model, system, selectedWeek, assetFilter } = options;
  if (selectedWeek !== "all") {
    const row = system.weeklyReturns.find((entry) => entry.weekOpenUtc === selectedWeek);
    const children = row ? buildHistoricalTierChildren(row, model, assetFilter) : [];
    const returns = children.map((child) => ({ pair: child.pair, percent: child.percent }));
    const totalPercent = returns.reduce((sum, item) => sum + item.percent, 0);
    return {
      model,
      percent: totalPercent,
      priced: returns.length,
      total: Math.max(returns.length, children.length),
      note: row
        ? `Tier contribution for the week of ${weekDisplayLabel(row.weekOpenUtc)}.`
        : `No ${TIER_LABELS[model]} trades for the selected week.`,
      returns,
      pair_details: children,
      stats: computeReturnStats(returns),
      diagnostics: {
        max_drawdown: null,
        profit_factor: null,
      },
    } satisfies ModelPerformance;
  }

  const weeklyReturns = system.weeklyReturns.map((row) => {
    const children = buildHistoricalTierChildren(row, model, assetFilter);
    const weekPercent = children.reduce((sum, child) => sum + (child.percent ?? 0), 0);
    return {
      row,
      weekPercent,
      children,
    };
  });
  const returns = weeklyReturns.map(({ row, weekPercent }) => ({
    pair: `Week of ${weekLabel(row.weekOpenUtc)}`,
    percent: weekPercent,
  }));
  const pairDetails = weeklyReturns.map(({ row, weekPercent, children }) => ({
    pair: `Week of ${weekLabel(row.weekOpenUtc)}`,
    direction: toDirection(weekPercent),
    reason: [
      `${children.length} trades`,
      `Weekly drawdown ${row.drawdownPct.toFixed(2)}%`,
    ],
    percent: weekPercent,
    children,
  }));
  const totalPercent = returns.reduce((sum, item) => sum + item.percent, 0);

  return {
    model,
    percent: totalPercent,
    priced: returns.length,
    total: returns.length,
    note: `${TIER_LABELS[model]} contribution across the canonical weekly reconstruction.`,
    returns,
    pair_details: pairDetails,
    stats: computeReturnStats(returns),
    diagnostics: {
      max_drawdown: null,
      profit_factor: null,
    },
  } satisfies ModelPerformance;
}

function buildTierGridPropsFromHistorical(options: {
  system: CanonicalPerformanceSystem;
  selectedWeek: SelectedPerformanceWeek;
}) {
  const models = TIER_MODELS.map((model) =>
    buildTierModelPerformanceFromHistorical({
      model,
      system: options.system,
      selectedWeek: options.selectedWeek,
    }),
  );
  const perAsset = ASSET_SECTION_IDS.map((assetId) => ({
    id: assetId,
    label: assetLabelForClass(assetId),
    description: `${assetLabelForClass(assetId)} contribution`,
    models: TIER_MODELS.map((model) =>
      buildTierModelPerformanceFromHistorical({
        model,
        system: options.system,
        selectedWeek: options.selectedWeek,
        assetFilter: assetId,
      })
    ),
  }));
  const selectedLabel =
    options.selectedWeek === "all"
      ? "All Weeks"
      : `Week of ${weekDisplayLabel(options.selectedWeek)}`;
  const allTimeCombined = TIER_MODELS.map((model) =>
    buildTierModelPerformanceFromHistorical({
      model,
      system: options.system,
      selectedWeek: "all",
    })
  ).map((performance) => ({
    model: performance.model,
    totalPercent: performance.percent,
    weeks: performance.returns.length,
    winRate: performance.stats.win_rate,
    avgWeekly: performance.stats.avg_return,
  }));
  const allTimePerAsset = Object.fromEntries(
    ASSET_SECTION_IDS.map((assetId) => [
      assetId,
      TIER_MODELS.map((model) =>
        buildTierModelPerformanceFromHistorical({
          model,
          system: options.system,
          selectedWeek: "all",
          assetFilter: assetId,
        })
      ).map((performance) => ({
        model: performance.model,
        totalPercent: performance.percent,
        weeks: performance.returns.length,
        winRate: performance.stats.win_rate,
        avgWeekly: performance.stats.avg_return,
      })),
    ]),
  );
  return {
    combined: {
      id: "combined",
      label: "All",
      description: `${options.system.strategyName} · ${selectedLabel}`,
      models,
    },
    perAsset,
    labels: TIERED_GRID_LABELS,
    allTime: { combined: allTimeCombined, perAsset: allTimePerAsset },
    showAllTime: true,
  } satisfies GridProps;
}

function buildTierSimulationGroupFromHistorical(options: {
  system: CanonicalPerformanceSystem;
  selectedWeek: SelectedPerformanceWeek;
  title?: string;
}) {
  const rows =
    options.selectedWeek === "all"
      ? options.system.weeklyReturns
      : options.system.weeklyReturns.filter((row) => row.weekOpenUtc === options.selectedWeek);
  if (rows.length === 0) return null;

  const series = TIER_MODELS.map((model, index) => {
    let running = 0;
    const points = rows.flatMap((row) => {
      const value = buildHistoricalTierChildren(row, model).reduce((sum, child) => sum + (child.percent ?? 0), 0);
      if (options.selectedWeek === "all") {
        running += value;
        return [{
          ts_utc: row.weekOpenUtc,
          equity_pct: running,
          lock_pct: null,
        }];
      }
      const weekStart = DateTime.fromISO(row.weekOpenUtc, { zone: "utc" });
      const weekEnd = weekStart.plus({ days: 5 });
      return [
        {
          ts_utc: weekStart.toISO() ?? row.weekOpenUtc,
          equity_pct: 0,
          lock_pct: null,
        },
        {
          ts_utc: weekEnd.toISO() ?? row.weekOpenUtc,
          equity_pct: value,
          lock_pct: null,
        },
      ];
    });
    return {
      id: model,
      label: TIER_LABELS[model],
      color: SERIES_COLORS[index],
      points,
    };
  });

  const activeMetricsRows = rows;
  const totalReturn = TIER_MODELS.reduce(
    (sum, model) =>
      sum
      + activeMetricsRows.reduce(
        (tierSum, row) =>
          tierSum + buildHistoricalTierChildren(row, model).reduce((childSum, child) => childSum + (child.percent ?? 0), 0),
        0,
      ),
    0,
  );

  return {
    title: options.title ?? options.system.strategyName,
    description:
      options.selectedWeek === "all"
        ? "Tier contribution curves across the canonical weekly reconstruction."
        : `Tier contribution curves for the week of ${weekDisplayLabel(options.selectedWeek)}.`,
    metrics: {
      returnPct: totalReturn,
      maxDrawdownPct:
        options.selectedWeek === "all"
          ? options.system.maxDrawdownSimplePct
          : rows[0]?.drawdownPct ?? null,
      trades: rows.reduce((sum, row) => sum + row.trades, 0),
    },
    series,
  } satisfies PerformanceSimulationGroup;
}

function tierFromWeeklySignalTier(value: CanonicalOrLiveSignalTier): TierPerformanceModel | null {
  if (value === "HIGH") return "dealer";
  if (value === "MEDIUM") return "commercial";
  if (value === "LOW") return "sentiment";
  return null;
}

function buildTierChildrenFromCurrentWeek(options: {
  signals: CanonicalWeeklySignal[];
  liveRowsByPair: Map<string, { liveDriftPct: number | null }>;
  model: TierPerformanceModel;
  assetFilter?: string;
}) {
  return options.signals
    .filter((signal) =>
      tierFromWeeklySignalTier(signal.tier) === options.model
      && (!options.assetFilter || signal.assetClass === options.assetFilter)
    )
    .map((signal) => {
      const liveDriftPct = options.liveRowsByPair.get(signal.pair)?.liveDriftPct ?? null;
      return {
        pair: signal.pair,
        direction: signal.direction,
        reason: [
          `${assetLabelForClass(signal.assetClass)} basket`,
          `Current drift ${liveDriftPct === null ? "—" : `${liveDriftPct.toFixed(2)}%`}`,
          "Normalized 1.0x sizing",
          ...signal.gateReasons,
        ],
        percent: liveDriftPct,
      };
    });
}

function buildTierGridPropsFromCurrentWeek(options: {
  strategyName: string;
  currentWeekOpenUtc: string;
  signals: CanonicalWeeklySignal[];
  liveRowsByPair: Map<string, { liveDriftPct: number | null }>;
}) {
  const models = TIER_MODELS.map((model) => {
    const children = buildTierChildrenFromCurrentWeek({
      signals: options.signals,
      liveRowsByPair: options.liveRowsByPair,
      model,
    });
    const returns = children.flatMap((child) =>
      child.percent === null ? [] : [{ pair: child.pair, percent: child.percent }],
    );
    const totalPercent = returns.reduce((sum, item) => sum + item.percent, 0);
    return {
      model,
      percent: totalPercent,
      priced: returns.length,
      total: children.length,
      note: `${TIER_LABELS[model]} contribution for the live current week forward test.`,
      returns,
      pair_details: children,
      stats: computeReturnStats(returns),
      diagnostics: {
        max_drawdown: null,
        profit_factor: null,
      },
    } satisfies ModelPerformance;
  });
  const perAsset = ASSET_SECTION_IDS.map((assetId) => ({
    id: assetId,
    label: assetLabelForClass(assetId),
    description: `${assetLabelForClass(assetId)} contribution`,
    models: TIER_MODELS.map((model) => {
      const children = buildTierChildrenFromCurrentWeek({
        signals: options.signals,
        liveRowsByPair: options.liveRowsByPair,
        model,
        assetFilter: assetId,
      });
      const returns = children.flatMap((child) =>
        child.percent === null ? [] : [{ pair: child.pair, percent: child.percent }],
      );
      return {
        model,
        percent: returns.reduce((sum, item) => sum + item.percent, 0),
        priced: returns.length,
        total: children.length,
        note: `${TIER_LABELS[model]} contribution for the live current week forward test.`,
        returns,
        pair_details: children,
        stats: computeReturnStats(returns),
        diagnostics: {
          max_drawdown: null,
          profit_factor: null,
        },
      } satisfies ModelPerformance;
    }),
  }));

  return {
    combined: {
      id: "combined",
      label: "All",
      description: `${options.strategyName} · Current week ${weekDisplayLabel(options.currentWeekOpenUtc)}`,
      models,
    },
    perAsset,
    labels: TIERED_GRID_LABELS,
    allTime: { combined: [], perAsset: {} },
    showAllTime: false,
  } satisfies GridProps;
}

function buildTierSimulationGroupFromCurrentWeek(options: {
  title: string;
  currentWeekOpenUtc: string;
  signals: CanonicalWeeklySignal[];
  pairSeries: Record<string, Array<{ ts: number; driftPct: number }>>;
  liveRowsByPair: Map<string, { liveDriftPct: number | null }>;
}) {
  const buildTierSeries = (model: TierPerformanceModel, color: string) => {
    const signals = options.signals.filter((signal) => tierFromWeeklySignalTier(signal.tier) === model);
    const pairIds = signals.map((signal) => signal.pair);
    const timestamps = Array.from(
      new Set(
        pairIds.flatMap((pair) => (options.pairSeries[pair] ?? []).map((point) => point.ts)),
      ),
    ).sort((left, right) => left - right);

    if (timestamps.length === 0) {
      const totalReturn = signals.reduce((sum, signal) => {
        const drift = options.liveRowsByPair.get(signal.pair)?.liveDriftPct ?? 0;
        return sum + drift;
      }, 0);
      const weekStart = DateTime.fromISO(options.currentWeekOpenUtc, { zone: "utc" });
      return {
        id: model,
        label: TIER_LABELS[model],
        color,
        points: [
          {
            ts_utc: weekStart.toISO() ?? options.currentWeekOpenUtc,
            equity_pct: 0,
            lock_pct: null,
          },
          {
            ts_utc: DateTime.utc().toISO() ?? options.currentWeekOpenUtc,
            equity_pct: totalReturn,
            lock_pct: null,
          },
        ],
      };
    }

    const latestByPair = new Map<string, number>();
    const cursorByPair = new Map<string, number>();
    const points = timestamps.map((timestamp) => {
      for (const pair of pairIds) {
        const series = options.pairSeries[pair] ?? [];
        let index = cursorByPair.get(pair) ?? 0;
        while (index < series.length && series[index]!.ts <= timestamp) {
          latestByPair.set(pair, series[index]!.driftPct);
          index += 1;
        }
        cursorByPair.set(pair, index);
      }
      const equityPct = Array.from(latestByPair.values()).reduce((sum, driftPct) => sum + driftPct, 0);
      return {
        ts_utc: DateTime.fromMillis(timestamp, { zone: "utc" }).toISO() ?? options.currentWeekOpenUtc,
        equity_pct: equityPct,
        lock_pct: null,
      };
    });

    return {
      id: model,
      label: TIER_LABELS[model],
      color,
      points,
    };
  };

  const series = TIER_MODELS.map((model, index) => buildTierSeries(model, SERIES_COLORS[index]));
  const totalReturn = TIER_MODELS.reduce((sum, model) => {
    const children = buildTierChildrenFromCurrentWeek({
      signals: options.signals,
      liveRowsByPair: options.liveRowsByPair,
      model,
    });
    return sum + children.reduce((childSum, child) => childSum + (child.percent ?? 0), 0);
  }, 0);

  return {
    title: options.title,
    description: `Live current-week tier contribution curves for ${weekDisplayLabel(options.currentWeekOpenUtc)}.`,
    metrics: {
      returnPct: totalReturn,
      maxDrawdownPct: null,
      trades: options.signals.length,
    },
    series,
  } satisfies PerformanceSimulationGroup;
}

function toSharpeProxy(weeklyRows: CanonicalPerformanceWeeklyRow[]) {
  if (weeklyRows.length <= 1) return 0;
  const values = weeklyRows.map((row) => row.returnPct);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  const deviation = Math.sqrt(variance);
  return deviation > 0 ? average / deviation : 0;
}

function toProfitFactor(weeklyRows: CanonicalPerformanceWeeklyRow[]) {
  const grossProfit = weeklyRows.reduce((sum, row) => sum + Math.max(0, row.grossProfitPct), 0);
  const grossLoss = Math.abs(weeklyRows.reduce((sum, row) => sum + Math.min(0, row.grossLossPct), 0));
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function toTradeWinRate(system: CanonicalPerformanceSystem) {
  return system.totalTrades > 0 ? (system.totalWins / system.totalTrades) * 100 : 0;
}

function buildStandaloneTradeChildren(options: {
  row: CanonicalPerformanceWeeklyRow;
  assetFilter?: string;
}) {
  return options.row.breakdown.nettedPairs
    .filter((trade) => !options.assetFilter || trade.assetClass === options.assetFilter)
    .map((trade) => ({
      pair: trade.symbol,
      direction: trade.direction,
      reason: buildReasonsForHistoricalTrade(trade),
      percent: trade.positionContributionPct,
    }));
}

function buildStandaloneModelPerformance(options: {
  model: PerformanceModel;
  system: CanonicalPerformanceSystem | null;
  selectedWeek: SelectedPerformanceWeek;
  assetFilter?: string;
}) {
  if (!options.system) {
    return {
      model: options.model,
      percent: 0,
      priced: 0,
      total: 0,
      note: "Canonical model data unavailable.",
      returns: [],
      pair_details: [],
      stats: computeReturnStats([]),
      diagnostics: {
        max_drawdown: null,
        profit_factor: null,
      },
    } satisfies ModelPerformance;
  }

  if (options.selectedWeek !== "all") {
    const row = options.system.weeklyReturns.find((entry) => entry.weekOpenUtc === options.selectedWeek);
    const children = row ? buildStandaloneTradeChildren({ row, assetFilter: options.assetFilter }) : [];
    const returns = children.flatMap((child) =>
      child.percent === null ? [] : [{ pair: child.pair, percent: child.percent }],
    );
    return {
      model: options.model,
      percent: returns.reduce((sum, item) => sum + item.percent, 0),
      priced: returns.length,
      total: children.length,
      note: row
        ? `${PERFORMANCE_MODEL_LABELS[options.model]} normalized 1x return for the selected week.`
        : `No ${PERFORMANCE_MODEL_LABELS[options.model]} trades for the selected week.`,
      returns,
      pair_details: children,
      stats: computeReturnStats(returns),
      diagnostics: {
        max_drawdown: null,
        profit_factor: null,
      },
    } satisfies ModelPerformance;
  }

  const weeklyRows = options.system.weeklyReturns.map((row) => {
    const children = buildStandaloneTradeChildren({ row, assetFilter: options.assetFilter });
    const weekPercent = children.reduce((sum, child) => sum + (child.percent ?? 0), 0);
    return { row, weekPercent, children };
  });
  const returns = weeklyRows.map(({ row, weekPercent }) => ({
    pair: `Week of ${weekLabel(row.weekOpenUtc)}`,
    percent: weekPercent,
  }));
  const strategyDescription = getStrategy(options.model)?.description;
  return {
    model: options.model,
    percent: returns.reduce((sum, item) => sum + item.percent, 0),
    priced: returns.length,
    total: returns.length,
    note: strategyDescription
      ?? `${PERFORMANCE_MODEL_LABELS[options.model]} normalized 1x return across the canonical weekly reconstruction.`,
    returns,
    pair_details: weeklyRows.map(({ row, weekPercent, children }) => ({
      pair: `Week of ${weekLabel(row.weekOpenUtc)}`,
      direction: toDirection(weekPercent),
      reason: [
        `${children.length} trades`,
        `Weekly drawdown ${row.drawdownPct.toFixed(2)}%`,
      ],
      percent: weekPercent,
      children,
    })),
    stats: computeReturnStats(returns),
    diagnostics: {
      max_drawdown: null,
      profit_factor: null,
    },
  } satisfies ModelPerformance;
}

function summarizePerformance(performance: ModelPerformance) {
  return {
    model: performance.model,
    totalPercent: performance.percent,
    weeks: performance.returns.length,
    winRate: performance.stats.win_rate,
    avgWeekly: performance.stats.avg_return,
  };
}

function resolveStandaloneSystem(
  report: CanonicalPerformanceApiModel,
  model: PerformanceModel,
  gated: boolean,
) {
  const systemId = `${STANDALONE_MODEL_SYSTEM_ID[model]}${gated ? "_gated" : ""}`;
  const source = gated ? report.collections.models.gated : report.collections.models.baseline;
  return source.find((entry) => entry.system === systemId) ?? null;
}

function buildOverlay(system: CanonicalPerformanceSystem, gated: CanonicalPerformanceSystem | null) {
  const standardAvgWeekly = system.weeks > 0 ? system.simpleReturnPct / system.weeks : 0;
  const gatedAvgWeekly = gated && gated.weeks > 0 ? gated.simpleReturnPct / gated.weeks : 0;
  const standardTradeWinRate = toTradeWinRate(system);
  const gatedTradeWinRate = gated ? toTradeWinRate(gated) : 0;

  return {
    mode: gated ? "gated" : "standard",
    standard: {
      totalReturn: system.simpleReturnPct,
      winRate: system.winRatePct,
      sharpe: toSharpeProxy(system.weeklyReturns),
      maxDrawdown: system.maxDrawdownSimplePct,
      profitFactor: toProfitFactor(system.weeklyReturns),
      tradeWinRate: standardTradeWinRate,
      avgWeekly: standardAvgWeekly,
      trades: system.totalTrades,
    },
    gated: gated
      ? {
          totalReturn: gated.simpleReturnPct,
          winRate: gated.winRatePct,
          sharpe: toSharpeProxy(gated.weeklyReturns),
          maxDrawdown: gated.maxDrawdownSimplePct,
          profitFactor: toProfitFactor(gated.weeklyReturns),
          tradeWinRate: gatedTradeWinRate,
          avgWeekly: gatedAvgWeekly,
          trades: gated.totalTrades,
        }
      : null,
    gateAvailable: Boolean(gated),
    delta: gated
      ? {
          totalReturnPct: gated.simpleReturnPct - system.simpleReturnPct,
          maxDrawdownPct: gated.maxDrawdownSimplePct - system.maxDrawdownSimplePct,
          winRatePct: gated.winRatePct - system.winRatePct,
          tradeWinRatePct: gatedTradeWinRate - standardTradeWinRate,
          trades: gated.totalTrades - system.totalTrades,
        }
      : null,
    gateActivity: gated
      ? {
          skippedTrades: gated.gateSkippedTrades ?? 0,
          reducedTrades: 0,
          passedOrNoDataTrades: Math.max(0, system.totalTrades - (gated.gateSkippedTrades ?? 0)),
        }
      : null,
  } satisfies GridProps["comparisonOverlay"];
}

function buildGridPropsForSystem(options: {
  report: CanonicalPerformanceApiModel;
  version: PerformanceSystem;
  baseline: CanonicalPerformanceSystem | null;
  gated: CanonicalPerformanceSystem | null;
  includeComparisonOverlay?: boolean;
}) {
  const baseline = options.baseline;
  const gated = options.gated;
  const activeSystem = gated ?? baseline;
  if (!activeSystem || !baseline) {
    return null;
  }

  const displayModels = UNIVERSAL_MODELS_BY_VERSION[options.version];
  const models = displayModels.map((model) =>
    buildStandaloneModelPerformance({
      model,
      system: resolveStandaloneSystem(options.report, model, Boolean(gated)),
      selectedWeek: "all",
    }),
  );
  const perAsset = ASSET_SECTION_IDS.map((assetId) => ({
    id: assetId,
    label: assetLabelForClass(assetId),
    description: `${assetLabelForClass(assetId)} contribution`,
    models: displayModels.map((model) =>
      buildStandaloneModelPerformance({
        model,
        system: resolveStandaloneSystem(options.report, model, Boolean(gated)),
        selectedWeek: "all",
        assetFilter: assetId,
      }),
    ),
  }));

  return {
    combined: {
      id: "combined",
      label: "Combined Basket",
      description: `${activeSystem.strategyName} · normalized 1x weekly reconstruction.`,
      models,
    },
    perAsset,
    labels: PERFORMANCE_MODEL_LABELS,
    allTime: {
      combined: models.map((performance) => summarizePerformance(performance)),
      perAsset: Object.fromEntries(
        perAsset.map((section) => [
          section.id,
          section.models.map((performance) => summarizePerformance(performance)),
        ]),
      ),
    },
    showAllTime: true,
    comparisonOverlay: options.includeComparisonOverlay === false ? undefined : buildOverlay(baseline, gated),
  } satisfies GridProps;
}

function buildSeriesFromWeeklyReturns(options: {
  id: string;
  label: string;
  rows: CanonicalPerformanceWeeklyRow[];
  color?: string;
  metric: (row: CanonicalPerformanceWeeklyRow) => number;
}) {
  let running = 0;
  return {
    id: options.id,
    label: options.label,
    color: options.color,
    points: options.rows.map((row) => {
      running += options.metric(row);
      return {
        ts_utc: row.weekOpenUtc,
        equity_pct: running,
        lock_pct: null,
      };
    }),
  };
}

function buildSimulationGroupForSystem(options: {
  report: CanonicalPerformanceApiModel;
  version: PerformanceSystem;
  title: string;
  baseline: CanonicalPerformanceSystem | null;
  gated: CanonicalPerformanceSystem | null;
}) {
  const active = options.gated ?? options.baseline;
  const baseline = options.baseline;
  if (!active || !baseline) {
    return null;
  }

  const series: PerformanceSimulationGroup["series"] = [];
  if (options.gated) {
    series.push(
      buildSeriesFromWeeklyReturns({
        id: "gated",
        label: `${options.title} Gated`,
        rows: options.gated.weeklyReturns,
        color: SERIES_COLORS[0],
        metric: (row) => row.returnPct,
      }),
    );
  }
  series.push(
    buildSeriesFromWeeklyReturns({
      id: "baseline",
      label: `${options.title} Baseline`,
      rows: baseline.weeklyReturns,
      color: SERIES_COLORS[1],
      metric: (row) => row.returnPct,
    }),
  );

  UNIVERSAL_MODELS_BY_VERSION[options.version].forEach((model, index) => {
    const modelSystem = resolveStandaloneSystem(options.report, model, Boolean(options.gated));
    if (!modelSystem) return;
    series.push(
      buildSeriesFromWeeklyReturns({
        id: model,
        label: PERFORMANCE_MODEL_LABELS[model],
        rows: modelSystem.weeklyReturns,
        color: SERIES_COLORS[(index + 2) % SERIES_COLORS.length],
        metric: (weekRow) => weekRow.returnPct,
      }),
    );
  });

  return {
    title: options.title,
    description:
      "Simulation compares the normalized 1x composite basket against the same model set shown in the performance cards.",
    metrics: {
      returnPct: active.simpleReturnPct,
      maxDrawdownPct: active.maxDrawdownSimplePct,
      trades: active.totalTrades,
    },
    series,
  } satisfies PerformanceSimulationGroup;
}

function buildSystemMaps(options: {
  family: "universal" | "tiered";
  report: CanonicalPerformanceApiModel;
  selectedWeek: SelectedPerformanceWeek;
}) {
  const gridMap: Partial<Record<PerformanceSystem, GridProps>> = {};
  const simulationMap: Partial<Record<PerformanceSystem, PerformanceSimulationGroup>> = {};

  (["v1", "v2", "v3"] as const).forEach((version) => {
    const systemId = `${options.family}_${version}`;
    const baseline = options.report.collections.composites.baseline.find((entry) => entry.system === systemId) ?? null;
    const gated = options.report.collections.composites.gated.find((entry) => entry.system === `${systemId}_gated`) ?? null;

    const grid =
      options.family === "tiered"
        ? (gated ?? baseline)
          ? buildTierGridPropsFromHistorical({
              system: (gated ?? baseline)!,
              selectedWeek: options.selectedWeek,
            })
          : null
        : buildGridPropsForSystem({
            report: options.report,
            version,
            baseline,
            gated,
          });
    if (grid) {
      gridMap[version] = grid;
    }

    const simulation =
      options.family === "tiered"
        ? (gated ?? baseline)
          ? buildTierSimulationGroupFromHistorical({
              system: (gated ?? baseline)!,
              selectedWeek: options.selectedWeek,
              title: (gated ?? baseline)?.strategyName ?? systemId,
            })
          : null
        : buildSimulationGroupForSystem({
            report: options.report,
            version,
            title: (gated ?? baseline)?.strategyName ?? systemId,
            baseline,
            gated,
          });
    if (simulation) {
      simulationMap[version] = simulation;
    }
  });

  return { gridMap, simulationMap };
}

export default async function PerformancePage({ searchParams }: PerformancePageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const styleParam = resolvedSearchParams?.style;
  const styleParamValue = Array.isArray(styleParam) ? styleParam[0] : styleParam;
  const systemParam = resolvedSearchParams?.system;
  const systemParamValue = Array.isArray(systemParam) ? systemParam[0] : systemParam;
  const viewParam = resolvedSearchParams?.view;
  const viewParamValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const modeParam = resolvedSearchParams?.mode;
  const modeParamValue = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const weekParam = resolvedSearchParams?.week;
  const weekParamValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;
  const strategyParam = resolvedSearchParams?.strategy ?? resolvedSearchParams?.bias;
  const biasParamValue = Array.isArray(strategyParam) ? strategyParam[0] : strategyParam;
  const f1Param = resolvedSearchParams?.f1 ?? resolvedSearchParams?.filter;
  const f1Value = Array.isArray(f1Param) ? f1Param[0] : f1Param;
  const f2Param = resolvedSearchParams?.f2;
  const f2Value = Array.isArray(f2Param) ? f2Param[0] : f2Param;
  const normalizedFilters = normalizeFilterSelection({
    f1: f1Value,
    f2: f2Value,
  });
  const resolvedFamily = parseFamily(styleParamValue);
  const initialStyle: WeeklyPerformanceFamily = resolvedFamily === "universal" ? "universal" : "tiered";
  const initialSystem = resolvePerformanceSystem(systemParamValue);
  const initialView = resolvePerformanceView(viewParamValue);
  const initialMode = parseMode(modeParamValue);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const [report, flagships, currentWeekBasket] = await Promise.all([
    getCanonicalPerformanceApiModel({ normalizePositionSizing: true }),
    resolveCanonicalFlagships(),
    getCanonicalWeeklyBasket({ weekOpenUtc: currentWeekOpenUtc }),
  ]);

  if (!report) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
          Canonical performance report is not available in this environment yet.
        </div>
      </DashboardLayout>
    );
  }

  // Use same week logic as Data section — includes current/upcoming week
  const dataSectionWeeks = await listDataSectionWeeks();
  const historicalWeeks = [
    ...report.meta.canonicalWeeks,
    ...dataSectionWeeks.filter((w) => !report.meta.canonicalWeeks.includes(w)),
  ];
  const weekOptions = buildDataWeekOptions({
    historicalWeeks,
    currentWeekOpenUtc,
  }) as string[];
  // Add "all" option for Performance (not in Data section)
  const weekOptionsWithAll = ["all", ...weekOptions];
  const selectedWeek =
    resolveSelectedPerformanceWeek({
      weekParamValue,
      weekOptions: weekOptionsWithAll,
      currentWeekOpenUtc,
    }) ?? "all";
  const weekSelectorOptions = weekOptions; // for ScrollableWeekStrip (no "all")

  // ─── Engine-driven computation (shared canonical loader) ────────
  // Uses the same loader as Matrix — compute once, show everywhere.
  const biasSourceId = resolveBiasSourceId(biasParamValue);
  const initialStrategySelection = {
    strategyId: biasSourceId,
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };
  const initialEntryStyle = getEntryStyle(initialStrategySelection.f1);
  const initialRiskOverlay = getStrengthGate(initialStrategySelection.f2);
  const initialSelectionKey = buildStrategySelectionKey(initialStrategySelection);
  const initialExpectedEngineVersion = buildStrategyArtifactEngineVersion({
    entryStyle: initialEntryStyle,
    riskOverlay: initialRiskOverlay,
  });
  const initialAdrGridArtifact = initialEntryStyle?.plModel === "adr_grid"
    ? await readStrategyArtifactEntry(initialSelectionKey)
    : true;
  const initialCanLoadStrategyData = initialEntryStyle?.plModel !== "adr_grid"
    || (initialAdrGridArtifact !== true
      && initialAdrGridArtifact?.fingerprint.engineVersion === initialExpectedEngineVersion);
  const initialStrategyData = initialCanLoadStrategyData
    ? await loadStrategyPageData(initialStrategySelection)
    : null;

  const universal = buildSystemMaps({
    family: "universal",
    report,
    selectedWeek,
  });
  const tiered = buildSystemMaps({
    family: "tiered",
    report,
    selectedWeek,
  });

  const weeklyFlagshipId = flagships.weekly.systemId ?? "tiered_v3_gated";
  const flagshipBaselineId = weeklyFlagshipId.endsWith("_gated")
    ? weeklyFlagshipId.slice(0, -"_gated".length)
    : weeklyFlagshipId;
  const flagshipBaseline =
    report.collections.composites.baseline.find((entry) => entry.system === flagshipBaselineId) ?? null;
  const flagshipGated =
    report.collections.composites.gated.find((entry) => entry.system === weeklyFlagshipId) ?? null;
  const flagshipTitle = flagshipGated?.strategyName ?? flagshipBaseline?.strategyName ?? "Weekly Flagship";

  const currentWeekForwardSummary =
    selectedWeek === currentWeekBasket.currentWeekOpenUtc
      ? await buildWeeklyForwardSummary({
          currentWeekOpenUtc: currentWeekBasket.currentWeekOpenUtc,
          signals: currentWeekBasket.signals.map((signal) => ({
            pair: signal.pair,
            direction: signal.direction,
            tier: signal.tier,
            gateReasons: signal.gateReasons,
          })),
        })
      : null;
  const liveRowsByPair = new Map(
    (currentWeekForwardSummary?.rows ?? []).map((row) => [row.pair, row]),
  );

  const flagshipGridProps =
    selectedWeek === currentWeekBasket.currentWeekOpenUtc
      ? buildTierGridPropsFromCurrentWeek({
          strategyName: currentWeekBasket.strategyName,
          currentWeekOpenUtc: currentWeekBasket.currentWeekOpenUtc,
          signals: currentWeekBasket.signals,
          liveRowsByPair,
        })
      : flagshipGated
        ? buildTierGridPropsFromHistorical({
            system: flagshipGated,
            selectedWeek,
          })
        : null;

  const flagshipSimulation =
    selectedWeek === currentWeekBasket.currentWeekOpenUtc && currentWeekForwardSummary
      ? buildTierSimulationGroupFromCurrentWeek({
          title: currentWeekBasket.strategyName,
          currentWeekOpenUtc: currentWeekBasket.currentWeekOpenUtc,
          signals: currentWeekBasket.signals,
          pairSeries: currentWeekForwardSummary.pairSeries,
          liveRowsByPair,
        })
      : flagshipGated
        ? buildTierSimulationGroupFromHistorical({
            system: flagshipGated,
            selectedWeek,
            title: flagshipTitle,
          })
        : null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PerformanceStrategyViewSection
          initialMode={initialMode}
          initialView={initialView}
          initialSystem={initialMode === "flagship" ? "v3" : initialSystem}
          initialStyle={initialMode === "flagship" ? "tiered" : initialStyle}
          universalGridPropsBySystem={universal.gridMap}
          tieredGridPropsBySystem={tiered.gridMap}
          universalSimulationBySystem={universal.simulationMap}
          tieredSimulationBySystem={tiered.simulationMap}
          flagshipGridProps={flagshipGridProps}
          flagshipSimulation={flagshipSimulation}
          initialSelection={toRuntimeStrategySelection(initialStrategySelection)}
          initialEntry={
            initialStrategyData
              ? toPerformanceClientPayload(initialStrategyData)
              : null
          }
          weekOptions={["all", ...weekSelectorOptions]}
          currentWeek={currentWeekOpenUtc}
          initialWeek={selectedWeek}
        />
      </div>
    </DashboardLayout>
  );
}
