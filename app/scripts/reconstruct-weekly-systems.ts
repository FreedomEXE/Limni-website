/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/reconstruct-weekly-systems.ts
 *
 * Description:
 * Reconstructs Universal and Tiered weekly systems from
 * performance_snapshots using clean net-hold logic and persists the
 * results to strategy_backtest_runs / strategy_backtest_weekly.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

function loadEnvFileIntoProcess(filePath: string) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const REPO_ROOT = path.resolve(__dirname, "..");
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env"));
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env.local"));

import type { AssetClass } from "../src/lib/cotMarkets";
import {
  PERFORMANCE_MODELS,
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
} from "../src/lib/performance/modelConfig";
import type { PerformanceModel } from "../src/lib/performanceLab";
import type { PerformanceSnapshot } from "../src/lib/performanceSnapshots";
import { readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { persistStrategyBacktestSnapshot } from "../src/lib/performance/strategyBacktestIngestion";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { computeMaxDrawdownFromPercentReturns, computeMaxDrawdownSimple } from "../src/lib/performance/drawdown";
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult } from "../src/lib/performance/basketPathEngine";
import {
  buildCotGateContext,
  buildGateMap,
  evaluatePairWithGate,
  gateMultiplier,
  type CotGateContext,
  type GateDecision,
  type GateMap,
} from "../src/lib/performance/gateEvaluation";
import { loadPathBars } from "../src/lib/performance/pathBarLoader";
import type { WeekPositionLedger } from "../src/lib/performance/positionLedger";

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type SystemVersion = "v1" | "v2" | "v3" | "standalone";
type SystemFamily = "universal" | "tiered" | "model";
type SystemId = string;

type SnapshotPairDetail = PerformanceSnapshot["pair_details"][number];

type TradeSignal = {
  assetClass: AssetClass;
  symbol: string;
  model: PerformanceModel;
  direction: Exclude<Direction, "NEUTRAL">;
  percent: number;
};

type RawPairSignal = {
  model: PerformanceModel;
  direction: Exclude<Direction, "NEUTRAL">;
  returnPct: number;
};

type WeeklyReturnLookup = Map<string, number>;

type NettedPair = {
  assetClass: AssetClass;
  symbol: string;
  direction: Exclude<Direction, "NEUTRAL">;
  netUnits: number;
  returnPct: number;
  supportingModels: PerformanceModel[];
  opposingModels: PerformanceModel[];
};

type TieredPair = {
  assetClass: AssetClass;
  symbol: string;
  direction: Exclude<Direction, "NEUTRAL">;
  tier: 1 | 2 | 3;
  weight: number;
  returnPct: number;
  supportingModels: PerformanceModel[];
};

type WeekBreakdown = {
  sourceModels: Record<string, { returnPct: number; activePairs: number }>;
  perAsset: Record<AssetClass, { returnPct: number; tradeCount: number }>;
  nettedPairs: Array<{
    symbol: string;
    assetClass: AssetClass;
    direction: "LONG" | "SHORT";
    unitsOrWeight: number;
    netUnits: number;
    tierWeight: number | null;
    returnPct: number;
    positionContributionPct: number;
    support: string[];
    oppose?: string[];
    tier?: 1 | 2 | 3 | null;
  }>;
  skippedDueToNetting: string[];
  rawSignalsByPair: Map<string, RawPairSignal[]>;
};

type WeeklyRow = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  drawdownPct: number;
  grossProfitPct: number;
  grossLossPct: number;
  breakdown: WeekBreakdown;
  gateActivity?: {
    skippedTrades: number;
    passedOrNoDataTrades: number;
    decisionBreakdown: Record<GateDecision, number>;
  };
};

type PersistedTradeRow = {
  weekOpenUtc: string;
  symbol: string;
  direction: Direction;
  pnlPct: number;
  metadata: Record<string, unknown>;
};

type GateComparisonSummary = {
  source: string;
  weeks: number;
  baseline: {
    compoundedReturnPct: number;
    maxDrawdownPct: number;
    avgWeeklyPct: number;
    trades: number;
    winRatePct: number;
  };
  gated: {
    compoundedReturnPct: number;
    maxDrawdownPct: number;
    avgWeeklyPct: number;
    trades: number;
    winRatePct: number;
  };
  delta: {
    compoundedReturnPct: number;
    maxDrawdownPct: number;
    avgWeeklyPct: number;
    trades: number;
    winRatePct: number;
  };
  weekly: Array<{
    weekOpenUtc: string;
    baselineReturnPct: number;
    baselineDrawdownPct: number;
    gatedReturnPct: number;
    gatedDrawdownPct: number;
    baselineTrades: number;
    gatedTrades: number;
  }>;
};

export type ReconstructedSystemReport = {
  system: SystemId;
  family: SystemFamily;
  version: SystemVersion;
  botId: string;
  strategyName: string;
  isGated: boolean;
  weeks: number;
  weeklyReturns: WeeklyRow[];
  simpleReturnPct: number;
  compoundedReturnPct: number;
  maxDrawdownSimplePct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRatePct: number;
  pairsSkippedDueToNetting: number;
  gateActivity?: {
    totalSkipped: number;
    totalPassedOrNoData: number;
    decisionBreakdown: Record<GateDecision, number>;
  };
  config: {
    mode: "net_only";
    carry: "none";
    stops: "none";
    tp: "none";
    hold: "open_to_close";
    weeks: string[];
    models: PerformanceModel[];
    drawdownMode: "fixed_week_start_reset" | "path_true_hourly";
    weighting: "net_units" | "tier_weighted" | "equal";
    gateMode: "ungated" | "reduce_as_skip";
  };
  gateComparison?: GateComparisonSummary | null;
};

type SystemConfig = {
  system: SystemId;
  family: SystemFamily;
  version: SystemVersion;
  botId: string;
  strategyName: string;
  models: PerformanceModel[];
  weighting: "net_units" | "tier_weighted" | "equal";
  persistToDb?: boolean;
};

type ComprehensiveReconstructionReport = {
  generated_utc: string;
  canonical_weeks: string[];
  return_methodology: "simple_sum";
  compounded_also_included: true;
  composite_systems: ReconstructedSystemReport[];
  composite_systems_gated: ReconstructedSystemReport[];
  standalone_models: ReconstructedSystemReport[];
  standalone_models_gated: ReconstructedSystemReport[];
  component_breakdowns: Record<string, Array<{
    model: PerformanceModel;
    baseline: {
      system: string;
      simpleReturnPct: number;
      compoundedReturnPct: number;
      maxDrawdownSimplePct: number;
      maxDrawdownPct: number;
      trades: number;
      winRatePct: number;
    };
    gated: {
      system: string;
      simpleReturnPct: number;
      compoundedReturnPct: number;
      maxDrawdownSimplePct: number;
      maxDrawdownPct: number;
      trades: number;
      winRatePct: number;
      gateSkippedTrades: number;
    } | null;
  }>>;
  summary: Array<{
    system: string;
    family: string;
    simpleReturnPct: number;
    compoundedReturnPct: number;
    maxDrawdownSimplePct: number;
    maxDrawdownPct: number;
    trades: number;
    winRatePct: number;
    weeks: number;
    isGated: boolean;
    gateSkippedTrades?: number;
  }>;
};

type GateComparisonFile = {
  comparisons?: Array<{
    strategy?: string;
    weekly?: Array<{
      weekOpenUtc?: string;
      baselineReturn?: number;
      gatedReturn?: number;
      baselineOpenTrades?: number;
      gatedOpenTrades?: number;
    }>;
  }>;
};

export const CANONICAL_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
  "2026-02-23T00:00:00.000Z",
  "2026-03-02T00:00:00.000Z",
  "2026-03-08T23:00:00.000Z",
  "2026-03-15T23:00:00.000Z",
] as const;

const TIER_SOURCE_MODELS: Record<SystemVersion, PerformanceModel[]> = {
  v1: ["blended", "dealer", "commercial", "sentiment"],
  v2: ["dealer", "sentiment"],
  v3: ["dealer", "commercial", "sentiment"],
};

const COMPOSITE_SYSTEM_CONFIGS: readonly SystemConfig[] = [
  {
    system: "universal_v1",
    family: "universal",
    version: "v1",
    botId: "universal_v1_net_hold",
    strategyName: "Universal V1 Net Hold",
    models: PERFORMANCE_V1_MODELS,
    weighting: "net_units",
    persistToDb: true,
  },
  {
    system: "universal_v2",
    family: "universal",
    version: "v2",
    botId: "universal_v2_net_hold",
    strategyName: "Universal V2 Net Hold",
    models: PERFORMANCE_V2_MODELS,
    weighting: "net_units",
    persistToDb: true,
  },
  {
    system: "universal_v3",
    family: "universal",
    version: "v3",
    botId: "universal_v3_net_hold",
    strategyName: "Universal V3 Net Hold",
    models: PERFORMANCE_V3_MODELS,
    weighting: "net_units",
    persistToDb: true,
  },
  {
    system: "tiered_v1",
    family: "tiered",
    version: "v1",
    botId: "tiered_v1_net_hold",
    strategyName: "Tiered V1 Net Hold",
    models: TIER_SOURCE_MODELS.v1,
    weighting: "tier_weighted",
    persistToDb: true,
  },
  {
    system: "tiered_v2",
    family: "tiered",
    version: "v2",
    botId: "tiered_v2_net_hold",
    strategyName: "Tiered V2 Net Hold",
    models: TIER_SOURCE_MODELS.v2,
    weighting: "tier_weighted",
    persistToDb: true,
  },
  {
    system: "tiered_v3",
    family: "tiered",
    version: "v3",
    botId: "tiered_v3_net_hold",
    strategyName: "Tiered V3 Net Hold",
    models: TIER_SOURCE_MODELS.v3,
    weighting: "tier_weighted",
    persistToDb: true,
  },
] as const;

const MODEL_SYSTEM_CONFIGS: readonly SystemConfig[] = PERFORMANCE_MODELS.map((model) => ({
  system: `model_${model}`,
  family: "model",
  version: "standalone",
  botId: `model_${model}_net_hold`,
  strategyName: `Model ${model} Net Hold`,
  models: [model],
  weighting: "equal",
  persistToDb: false,
}));

const LOCKED_BASELINE_SUMMARIES: Record<SystemId, { compoundedReturnPct: number; maxDrawdownPct: number }> = {
  universal_v1: { compoundedReturnPct: -100.00, maxDrawdownPct: 116.12 },
  universal_v2: { compoundedReturnPct: 297.01, maxDrawdownPct: 75.19 },
  universal_v3: { compoundedReturnPct: -11.43, maxDrawdownPct: 95.05 },
  tiered_v1: { compoundedReturnPct: 248.40, maxDrawdownPct: 72.74 },
  tiered_v2: { compoundedReturnPct: 263.92, maxDrawdownPct: 80.08 },
  tiered_v3: { compoundedReturnPct: 272.40, maxDrawdownPct: 70.19 },
};

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function pairKey(assetClass: AssetClass, symbol: string) {
  return `${assetClass}|${symbol}`;
}

function parsePairKey(key: string): { assetClass: AssetClass; symbol: string } {
  const [assetClass, ...symbolParts] = key.split("|");
  return {
    assetClass: assetClass as AssetClass,
    symbol: symbolParts.join("|"),
  };
}

function buildWeeklyReturnLookup(
  rows: Array<{ symbol: string; assetClass: AssetClass; returnPct: number }>,
): WeeklyReturnLookup {
  return new Map(
    rows.map((row) => [
      pairKey(row.assetClass, row.symbol.trim().toUpperCase()),
      round(row.returnPct, 6),
    ]),
  );
}

function compoundReturns(returns: number[]) {
  let equity = 1;
  for (const value of returns) {
    const multiplier = 1 + value / 100;
    if (!Number.isFinite(multiplier)) continue;
    equity *= multiplier;
  }
  return round((equity - 1) * 100, 4);
}

function sumReturns(returns: number[]) {
  return round(returns.reduce((sum, value) => sum + value, 0), 6);
}

function safeAvg(values: number[]) {
  return values.length > 0
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 6)
    : 0;
}

function classifyTierForVotes(longCount: number, shortCount: number, neutralCount: number, voters: number) {
  if (voters === 2) {
    if (longCount === 2) return { tier: 1 as const, direction: "LONG" as const };
    if (shortCount === 2) return { tier: 1 as const, direction: "SHORT" as const };
    if (longCount === 1 && neutralCount === 1) return { tier: 2 as const, direction: "LONG" as const };
    if (shortCount === 1 && neutralCount === 1) return { tier: 2 as const, direction: "SHORT" as const };
    return null;
  }

  if (longCount === voters) return { tier: 1 as const, direction: "LONG" as const };
  if (shortCount === voters) return { tier: 1 as const, direction: "SHORT" as const };
  const maxDirectional = Math.max(longCount, shortCount);
  if (maxDirectional === voters - 1) {
    return longCount > shortCount
      ? { tier: 2 as const, direction: "LONG" as const }
      : { tier: 2 as const, direction: "SHORT" as const };
  }
  if (longCount > shortCount && longCount > 0) return { tier: 3 as const, direction: "LONG" as const };
  if (shortCount > longCount && shortCount > 0) return { tier: 3 as const, direction: "SHORT" as const };
  return null;
}

function tierWeight(tier: 1 | 2 | 3) {
  if (tier === 1) return 3;
  if (tier === 2) return 1.5;
  return 1;
}

function normalizeDetailPercent(detail: SnapshotPairDetail) {
  return typeof detail.percent === "number" && Number.isFinite(detail.percent) ? detail.percent : null;
}

function normalizeDirection(value: unknown): Direction {
  return value === "LONG" || value === "SHORT" ? value : "NEUTRAL";
}

function deriveAntikytheraV2Rows(rows: PerformanceSnapshot[]) {
  const derived = [...rows];
  const byAsset = new Map<AssetClass, { dealer?: PerformanceSnapshot; sentiment?: PerformanceSnapshot }>();

  for (const row of rows) {
    if (!byAsset.has(row.asset_class)) byAsset.set(row.asset_class, {});
    const slot = byAsset.get(row.asset_class)!;
    if (row.model === "dealer") slot.dealer = row;
    if (row.model === "sentiment") slot.sentiment = row;
  }

  for (const [assetClass, slot] of byAsset) {
    const hasExisting = rows.some((row) => row.asset_class === assetClass && row.model === "antikythera_v2");
    if (hasExisting || !slot.dealer || !slot.sentiment) continue;

    const dealerByPair = new Map(slot.dealer.pair_details.map((detail) => [detail.pair, detail]));
    const pairDetails: SnapshotPairDetail[] = [];
    for (const sentimentDetail of slot.sentiment.pair_details) {
      const direction = normalizeDirection(sentimentDetail.direction);
      if (direction === "NEUTRAL") continue;
      const dealerDetail = dealerByPair.get(sentimentDetail.pair);
      if (!dealerDetail) continue;
      if (normalizeDirection(dealerDetail.direction) !== direction) continue;
      const dealerPct = normalizeDetailPercent(dealerDetail);
      const sentimentPct = normalizeDetailPercent(sentimentDetail);
      pairDetails.push({
        pair: sentimentDetail.pair,
        direction,
        reason: ["Derived antikythera_v2: dealer + sentiment aligned"],
        percent: dealerPct ?? sentimentPct,
      });
    }

    const rowPercent = round(
      pairDetails.reduce((sum, detail) => sum + (typeof detail.percent === "number" ? detail.percent : 0), 0),
    );

    derived.push({
      week_open_utc: slot.dealer.week_open_utc,
      asset_class: assetClass,
      model: "antikythera_v2",
      report_date: slot.dealer.report_date,
      percent: rowPercent,
      priced: pairDetails.filter((detail) => typeof detail.percent === "number").length,
      total: pairDetails.length,
      note: "Derived antikythera_v2 from dealer + sentiment alignment.",
      returns: pairDetails
        .filter((detail): detail is SnapshotPairDetail & { percent: number } => typeof detail.percent === "number")
        .map((detail) => ({ pair: detail.pair, percent: detail.percent })),
      pair_details: pairDetails,
      stats: slot.dealer.stats,
    });
  }

  return derived;
}

function buildSignals(
  rows: PerformanceSnapshot[],
  models: readonly PerformanceModel[],
  weeklyReturnLookup: WeeklyReturnLookup,
) {
  const modelSet = new Set(models);
  const signals = new Map<string, TradeSignal[]>();
  const sourceModels: Record<string, { returnPct: number; activePairs: number }> = {};

  for (const row of rows) {
    if (!modelSet.has(row.model)) continue;
    sourceModels[row.model] ??= {
      returnPct: 0,
      activePairs: 0,
    };
    for (const detail of row.pair_details) {
      const direction = normalizeDirection(detail.direction);
      if (direction === "NEUTRAL") continue;
      const key = pairKey(row.asset_class, detail.pair);
      const canonicalReturnPct = weeklyReturnLookup.get(key);
      if (canonicalReturnPct === undefined) {
        throw new Error(
          `Missing canonical weekly return for ${key} during ${row.model} reconstruction on ${row.week_open_utc}`,
        );
      }
      const returnPct = direction === "SHORT"
        ? round(-canonicalReturnPct, 6)
        : canonicalReturnPct;
      const list = signals.get(key) ?? [];
      list.push({
        assetClass: row.asset_class,
        symbol: detail.pair,
        model: row.model,
        direction,
        percent: returnPct,
      });
      signals.set(key, list);
      sourceModels[row.model]!.returnPct = round(sourceModels[row.model]!.returnPct + returnPct, 6);
      sourceModels[row.model]!.activePairs += 1;
    }
  }

  return { signals, sourceModels };
}

function buildRawSignalsByPair(signals: Map<string, TradeSignal[]>): Map<string, RawPairSignal[]> {
  return new Map(
    [...signals.entries()].map(([key, entries]) => [
      key,
      entries.map((entry) => ({
        model: entry.model,
        direction: entry.direction,
        returnPct: round(entry.percent, 6),
      })),
    ]),
  );
}

function buildModelSignalsMetadata(rawSignals: RawPairSignal[]) {
  return Object.fromEntries(
    rawSignals.map((signal) => [
      signal.model,
      {
        direction: signal.direction,
        returnPct: round(signal.returnPct, 6),
      },
    ]),
  );
}

function reconstructUniversalWeek(
  rows: PerformanceSnapshot[],
  config: SystemConfig,
  weeklyReturnLookup: WeeklyReturnLookup,
): WeeklyRow {
  const { signals, sourceModels } = buildSignals(rows, config.models, weeklyReturnLookup);
  const rawSignalsByPair = buildRawSignalsByPair(signals);
  const perAssetTotals: Record<AssetClass, { weightedReturn: number; tradeCount: number }> = {
    fx: { weightedReturn: 0, tradeCount: 0 },
    indices: { weightedReturn: 0, tradeCount: 0 },
    crypto: { weightedReturn: 0, tradeCount: 0 },
    commodities: { weightedReturn: 0, tradeCount: 0 },
  };

  const nettedPairs: NettedPair[] = [];
  const skippedDueToNetting: string[] = [];
  let weightedReturnSum = 0;
  let grossProfitWeighted = 0;
  let grossLossWeighted = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;

  for (const [key, entries] of signals) {
    const longEntries = entries.filter((entry) => entry.direction === "LONG");
    const shortEntries = entries.filter((entry) => entry.direction === "SHORT");
    const net = longEntries.length - shortEntries.length;
    if (net === 0) {
      skippedDueToNetting.push(key);
      continue;
    }
    const direction: "LONG" | "SHORT" = net > 0 ? "LONG" : "SHORT";
    const supportingEntries = direction === "LONG" ? longEntries : shortEntries;
    const opposingEntries = direction === "LONG" ? shortEntries : longEntries;
    const returnPct = round(
      supportingEntries.reduce((sum, entry) => sum + entry.percent, 0) / supportingEntries.length,
      6,
    );
    const units = Math.abs(net);
    const { assetClass, symbol } = supportingEntries[0]!;
    nettedPairs.push({
      assetClass,
      symbol,
      direction,
      netUnits: units,
      returnPct,
      supportingModels: supportingEntries.map((entry) => entry.model),
      opposingModels: opposingEntries.map((entry) => entry.model),
    });
    weightedReturnSum += returnPct * units;
    if (returnPct > 0) {
      grossProfitWeighted += returnPct * units;
      wins += units;
    } else {
      grossLossWeighted += Math.abs(returnPct) * units;
      losses += units;
    }
    trades += units;
    perAssetTotals[assetClass].weightedReturn += returnPct * units;
    perAssetTotals[assetClass].tradeCount += units;
  }

  const weekReturn = weightedReturnSum;
  const drawdownPct = Math.max(0, -weekReturn);

  return {
    weekOpenUtc: rows[0]?.week_open_utc ?? "",
    returnPct: round(weekReturn, 6),
    trades,
    wins,
    losses,
    drawdownPct: round(drawdownPct, 6),
    grossProfitPct: round(grossProfitWeighted, 6),
    grossLossPct: round(grossLossWeighted, 6),
    breakdown: {
      sourceModels,
      perAsset: {
        fx: {
          returnPct: round(perAssetTotals.fx.weightedReturn, 6),
          tradeCount: perAssetTotals.fx.tradeCount,
        },
        indices: {
          returnPct: round(perAssetTotals.indices.weightedReturn, 6),
          tradeCount: perAssetTotals.indices.tradeCount,
        },
        crypto: {
          returnPct: round(perAssetTotals.crypto.weightedReturn, 6),
          tradeCount: perAssetTotals.crypto.tradeCount,
        },
        commodities: {
          returnPct: round(perAssetTotals.commodities.weightedReturn, 6),
          tradeCount: perAssetTotals.commodities.tradeCount,
        },
      },
      nettedPairs: nettedPairs.map((pair) => ({
        symbol: pair.symbol,
        assetClass: pair.assetClass,
        direction: pair.direction,
        unitsOrWeight: pair.netUnits,
        netUnits: pair.netUnits,
        tierWeight: null,
        returnPct: pair.returnPct,
        positionContributionPct: round(pair.returnPct * pair.netUnits, 6),
        support: pair.supportingModels,
        oppose: pair.opposingModels,
        tier: null,
      })),
      skippedDueToNetting,
      rawSignalsByPair,
    },
  };
}

function reconstructTieredWeek(
  rows: PerformanceSnapshot[],
  config: SystemConfig,
  weeklyReturnLookup: WeeklyReturnLookup,
): WeeklyRow {
  const { signals, sourceModels } = buildSignals(rows, config.models, weeklyReturnLookup);
  const rawSignalsByPair = buildRawSignalsByPair(signals);
  const perAssetTotals: Record<AssetClass, { weightedReturn: number; tradeCount: number }> = {
    fx: { weightedReturn: 0, tradeCount: 0 },
    indices: { weightedReturn: 0, tradeCount: 0 },
    crypto: { weightedReturn: 0, tradeCount: 0 },
    commodities: { weightedReturn: 0, tradeCount: 0 },
  };

  const tieredPairs: TieredPair[] = [];
  const skippedDueToNetting: string[] = [];
  let weightedReturnSum = 0;
  let grossProfitWeighted = 0;
  let grossLossWeighted = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;

  for (const [key, entries] of signals) {
    let longCount = 0;
    let shortCount = 0;
    let neutralCount = 0;
    for (const model of config.models) {
      const entry = entries.find((candidate) => candidate.model === model);
      if (!entry) {
        neutralCount += 1;
        continue;
      }
      if (entry.direction === "LONG") longCount += 1;
      else if (entry.direction === "SHORT") shortCount += 1;
      else neutralCount += 1;
    }

    const classified = classifyTierForVotes(longCount, shortCount, neutralCount, config.models.length);
    if (!classified) {
      skippedDueToNetting.push(key);
      continue;
    }

    const supportingEntries = entries.filter((entry) => entry.direction === classified.direction);
    if (supportingEntries.length === 0) {
      skippedDueToNetting.push(key);
      continue;
    }

    const returnPct = round(
      supportingEntries.reduce((sum, entry) => sum + entry.percent, 0) / supportingEntries.length,
      6,
    );
    const weight = tierWeight(classified.tier);
    const { assetClass, symbol } = supportingEntries[0]!;

    tieredPairs.push({
      assetClass,
      symbol,
      direction: classified.direction,
      tier: classified.tier,
      weight,
      returnPct,
      supportingModels: supportingEntries.map((entry) => entry.model),
    });

    weightedReturnSum += returnPct * weight;
    trades += 1;
    if (returnPct > 0) {
      wins += 1;
      grossProfitWeighted += returnPct * weight;
    } else {
      losses += 1;
      grossLossWeighted += Math.abs(returnPct) * weight;
    }
    perAssetTotals[assetClass].weightedReturn += returnPct * weight;
    perAssetTotals[assetClass].tradeCount += 1;
  }

  const weekReturn = weightedReturnSum;
  const drawdownPct = Math.max(0, -weekReturn);

  return {
    weekOpenUtc: rows[0]?.week_open_utc ?? "",
    returnPct: round(weekReturn, 6),
    trades,
    wins,
    losses,
    drawdownPct: round(drawdownPct, 6),
    grossProfitPct: round(grossProfitWeighted, 6),
    grossLossPct: round(grossLossWeighted, 6),
    breakdown: {
      sourceModels,
      perAsset: {
        fx: {
          returnPct: round(perAssetTotals.fx.weightedReturn, 6),
          tradeCount: perAssetTotals.fx.tradeCount,
        },
        indices: {
          returnPct: round(perAssetTotals.indices.weightedReturn, 6),
          tradeCount: perAssetTotals.indices.tradeCount,
        },
        crypto: {
          returnPct: round(perAssetTotals.crypto.weightedReturn, 6),
          tradeCount: perAssetTotals.crypto.tradeCount,
        },
        commodities: {
          returnPct: round(perAssetTotals.commodities.weightedReturn, 6),
          tradeCount: perAssetTotals.commodities.tradeCount,
        },
      },
      nettedPairs: tieredPairs.map((pair) => ({
        symbol: pair.symbol,
        assetClass: pair.assetClass,
        direction: pair.direction,
        unitsOrWeight: pair.weight,
        netUnits: 1,
        tierWeight: pair.weight,
        returnPct: pair.returnPct,
        positionContributionPct: round(pair.returnPct * pair.weight, 6),
        support: pair.supportingModels,
        tier: pair.tier,
      })),
      skippedDueToNetting,
      rawSignalsByPair,
    },
  };
}

function reconstructModelWeek(
  rows: PerformanceSnapshot[],
  config: SystemConfig,
  weeklyReturnLookup: WeeklyReturnLookup,
): WeeklyRow {
  const { signals, sourceModels } = buildSignals(rows, config.models, weeklyReturnLookup);
  const rawSignalsByPair = buildRawSignalsByPair(signals);
  const perAssetTotals: Record<AssetClass, { weightedReturn: number; tradeCount: number }> = {
    fx: { weightedReturn: 0, tradeCount: 0 },
    indices: { weightedReturn: 0, tradeCount: 0 },
    crypto: { weightedReturn: 0, tradeCount: 0 },
    commodities: { weightedReturn: 0, tradeCount: 0 },
  };

  const modelPairs: NettedPair[] = [];
  let weightedReturnSum = 0;
  let grossProfitWeighted = 0;
  let grossLossWeighted = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;

  for (const entries of signals.values()) {
    const entry = entries[0];
    if (!entry) continue;
    modelPairs.push({
      assetClass: entry.assetClass,
      symbol: entry.symbol,
      direction: entry.direction,
      netUnits: 1,
      returnPct: round(entry.percent, 6),
      supportingModels: [entry.model],
      opposingModels: [],
    });

    weightedReturnSum += entry.percent;
    trades += 1;
    if (entry.percent > 0) {
      wins += 1;
      grossProfitWeighted += entry.percent;
    } else if (entry.percent < 0) {
      losses += 1;
      grossLossWeighted += Math.abs(entry.percent);
    }
    perAssetTotals[entry.assetClass].weightedReturn += entry.percent;
    perAssetTotals[entry.assetClass].tradeCount += 1;
  }

  const weekReturn = weightedReturnSum;
  const drawdownPct = Math.max(0, -weekReturn);

  return {
    weekOpenUtc: rows[0]?.week_open_utc ?? "",
    returnPct: round(weekReturn, 6),
    trades,
    wins,
    losses,
    drawdownPct: round(drawdownPct, 6),
    grossProfitPct: round(grossProfitWeighted, 6),
    grossLossPct: round(grossLossWeighted, 6),
    breakdown: {
      sourceModels,
      perAsset: {
        fx: {
          returnPct: round(perAssetTotals.fx.weightedReturn, 6),
          tradeCount: perAssetTotals.fx.tradeCount,
        },
        indices: {
          returnPct: round(perAssetTotals.indices.weightedReturn, 6),
          tradeCount: perAssetTotals.indices.tradeCount,
        },
        crypto: {
          returnPct: round(perAssetTotals.crypto.weightedReturn, 6),
          tradeCount: perAssetTotals.crypto.tradeCount,
        },
        commodities: {
          returnPct: round(perAssetTotals.commodities.weightedReturn, 6),
          tradeCount: perAssetTotals.commodities.tradeCount,
        },
      },
      nettedPairs: modelPairs.map((pair) => ({
        symbol: pair.symbol,
        assetClass: pair.assetClass,
        direction: pair.direction,
        unitsOrWeight: 1,
        netUnits: 1,
        tierWeight: null,
        returnPct: pair.returnPct,
        positionContributionPct: round(pair.returnPct, 6),
        support: pair.supportingModels,
        oppose: [],
        tier: null,
      })),
      skippedDueToNetting: [],
      rawSignalsByPair,
    },
  };
}

async function loadWeekSnapshots(weekOpenUtc: string, config: SystemConfig) {
  const rows = await readPerformanceSnapshotsByWeek(weekOpenUtc);
  if (config.models.includes("antikythera_v2")) {
    return deriveAntikytheraV2Rows(rows);
  }
  return rows;
}

async function loadWeekReturnLookup(weekOpenUtc: string) {
  const rows = await getWeeklyPairReturns(weekOpenUtc);
  return buildWeeklyReturnLookup(rows);
}

function buildTradeRows(report: ReconstructedSystemReport): PersistedTradeRow[] {
  return report.weeklyReturns.flatMap((week) => {
    const tradedPairsByKey = new Map(
      week.breakdown.nettedPairs.map((pair) => [pairKey(pair.assetClass, pair.symbol), pair]),
    );

    return [...week.breakdown.rawSignalsByPair.entries()].map(([key, rawSignals]) => {
      const tradedPair = tradedPairsByKey.get(key);
      const modelSignals = buildModelSignalsMetadata(rawSignals);

      if (tradedPair) {
        return {
          weekOpenUtc: week.weekOpenUtc,
          symbol: tradedPair.symbol,
          direction: tradedPair.direction,
          pnlPct: round(tradedPair.returnPct, 6),
          metadata: {
            family: report.family,
            version: report.version,
            assetClass: tradedPair.assetClass,
            unitsOrWeight: tradedPair.unitsOrWeight,
            support: tradedPair.support,
            oppose: tradedPair.oppose ?? [],
            tier: tradedPair.tier ?? null,
            weeklySystemReturnPct: week.returnPct,
            netUnits: tradedPair.netUnits,
            tierWeight: tradedPair.tierWeight,
            modelSignals,
            pairReturnPct: round(tradedPair.returnPct, 6),
            positionContributionPct: round(tradedPair.positionContributionPct, 6),
            skippedByNetting: false,
          },
        };
      }

      const { assetClass, symbol } = parsePairKey(key);
      return {
        weekOpenUtc: week.weekOpenUtc,
        symbol,
        direction: "NEUTRAL" as const,
        pnlPct: 0,
        metadata: {
          family: report.family,
          version: report.version,
          assetClass,
          unitsOrWeight: 0,
          support: [],
          oppose: [],
          tier: null,
          weeklySystemReturnPct: week.returnPct,
          netUnits: 0,
          tierWeight: null,
          modelSignals,
          pairReturnPct: null,
          positionContributionPct: 0,
          skippedByNetting: true,
        },
      };
    });
  });
}

function emptyDecisionBreakdown(): Record<GateDecision, number> {
  return {
    PASS: 0,
    REDUCE: 0,
    SKIP: 0,
    NO_DATA: 0,
  };
}

function buildReport(
  config: SystemConfig,
  weeks: WeeklyRow[],
  options?: { isGated?: boolean },
): ReconstructedSystemReport {
  const weeklyReturns = weeks.map((week) => week.returnPct);
  const simpleReturnPct = sumReturns(weeklyReturns);
  const compoundedReturnPct = compoundReturns(weeklyReturns);
  const maxDrawdownSimplePct = round(computeMaxDrawdownSimple(weeklyReturns), 6);
  const maxDrawdownPct = round(computeMaxDrawdownFromPercentReturns(weeklyReturns), 6);
  const totalTrades = weeks.reduce((sum, week) => sum + week.trades, 0);
  const totalWins = weeks.reduce((sum, week) => sum + week.wins, 0);
  const totalLosses = weeks.reduce((sum, week) => sum + week.losses, 0);
  const pairsSkippedDueToNetting = weeks.reduce((sum, week) => sum + week.breakdown.skippedDueToNetting.length, 0);
  const gateActivity = options?.isGated
    ? weeks.reduce((acc, week) => {
        const gateWeek = week.gateActivity;
        if (!gateWeek) return acc;
        acc.totalSkipped += gateWeek.skippedTrades;
        acc.totalPassedOrNoData += gateWeek.passedOrNoDataTrades;
        for (const decision of Object.keys(acc.decisionBreakdown) as GateDecision[]) {
          acc.decisionBreakdown[decision] += gateWeek.decisionBreakdown[decision] ?? 0;
        }
        return acc;
      }, {
        totalSkipped: 0,
        totalPassedOrNoData: 0,
        decisionBreakdown: emptyDecisionBreakdown(),
      })
    : undefined;

  return {
    system: config.system,
    family: config.family,
    version: config.version,
    botId: config.botId,
    strategyName: config.strategyName,
    isGated: options?.isGated === true,
    weeks: weeks.length,
    weeklyReturns: weeks,
    simpleReturnPct,
    compoundedReturnPct,
    maxDrawdownSimplePct,
    maxDrawdownPct,
    totalTrades,
    totalWins,
    totalLosses,
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 4) : 0,
    pairsSkippedDueToNetting,
    gateActivity,
    config: {
      mode: "net_only",
      carry: "none",
      stops: "none",
      tp: "none",
      hold: "open_to_close",
      weeks: [...CANONICAL_WEEKS],
      models: [...config.models],
      drawdownMode: "fixed_week_start_reset",
      weighting: config.weighting,
      gateMode: options?.isGated ? "reduce_as_skip" : "ungated",
    },
    gateComparison: null,
  };
}

async function reconstructSystem(config: SystemConfig): Promise<ReconstructedSystemReport> {
  const weeklyRows: WeeklyRow[] = [];
  for (const weekOpenUtc of CANONICAL_WEEKS) {
    const [rows, weeklyReturnLookup] = await Promise.all([
      loadWeekSnapshots(weekOpenUtc, config),
      loadWeekReturnLookup(weekOpenUtc),
    ]);
    const weekRow = config.family === "universal"
      ? reconstructUniversalWeek(rows, config, weeklyReturnLookup)
      : config.family === "tiered"
        ? reconstructTieredWeek(rows, config, weeklyReturnLookup)
        : reconstructModelWeek(rows, config, weeklyReturnLookup);
    weeklyRows.push(weekRow);
  }
  return buildReport(config, weeklyRows);
}

function applyGateToWeek(
  week: WeeklyRow,
  gateRuntime: {
    gateMap: GateMap;
    cotContext: CotGateContext | null;
    reduceAsSkip: boolean;
  },
): WeeklyRow {
  const perAssetTotals: Record<AssetClass, { weightedReturn: number; tradeCount: number }> = {
    fx: { weightedReturn: 0, tradeCount: 0 },
    indices: { weightedReturn: 0, tradeCount: 0 },
    crypto: { weightedReturn: 0, tradeCount: 0 },
    commodities: { weightedReturn: 0, tradeCount: 0 },
  };
  const decisionBreakdown = emptyDecisionBreakdown();
  const gatedPairs: WeekBreakdown["nettedPairs"] = [];
  let weightedReturnSum = 0;
  let grossProfitWeighted = 0;
  let grossLossWeighted = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let skippedTrades = 0;
  let passedOrNoDataTrades = 0;

  for (const pair of week.breakdown.nettedPairs) {
    const gate = evaluatePairWithGate({
      pair: pair.symbol,
      weekOpenUtc: week.weekOpenUtc,
      direction: pair.direction,
      assetClass: pair.assetClass,
      gateMap: gateRuntime.gateMap,
      cotContext: gateRuntime.cotContext,
      reduceAsSkip: gateRuntime.reduceAsSkip,
    });
    const multiplier = gateMultiplier(gate.decision, gateRuntime.reduceAsSkip);
    decisionBreakdown[gate.decision] += 1;

    if (multiplier === 0) {
      skippedTrades += 1;
      continue;
    }

    passedOrNoDataTrades += 1;
    const scaledNetUnits = round(pair.netUnits * multiplier, 6);
    const scaledTierWeight = pair.tierWeight === null ? null : round(pair.tierWeight * multiplier, 6);
    const scaledUnitsOrWeight = round(pair.unitsOrWeight * multiplier, 6);
    const scaledContribution = round(pair.positionContributionPct * multiplier, 6);

    gatedPairs.push({
      ...pair,
      unitsOrWeight: scaledUnitsOrWeight,
      netUnits: scaledNetUnits,
      tierWeight: scaledTierWeight,
      positionContributionPct: scaledContribution,
    });

    weightedReturnSum += scaledContribution;
    trades += scaledNetUnits;
    if (pair.returnPct > 0) {
      wins += scaledNetUnits;
      grossProfitWeighted += scaledContribution;
    } else if (pair.returnPct < 0) {
      losses += scaledNetUnits;
      grossLossWeighted += Math.abs(scaledContribution);
    }
    perAssetTotals[pair.assetClass].weightedReturn += scaledContribution;
    perAssetTotals[pair.assetClass].tradeCount += scaledNetUnits;
  }

  const weekReturn = round(weightedReturnSum, 6);
  return {
    weekOpenUtc: week.weekOpenUtc,
    returnPct: weekReturn,
    trades: round(trades, 6),
    wins: round(wins, 6),
    losses: round(losses, 6),
    drawdownPct: round(Math.max(0, -weekReturn), 6),
    grossProfitPct: round(grossProfitWeighted, 6),
    grossLossPct: round(grossLossWeighted, 6),
    breakdown: {
      sourceModels: week.breakdown.sourceModels,
      perAsset: {
        fx: {
          returnPct: round(perAssetTotals.fx.weightedReturn, 6),
          tradeCount: round(perAssetTotals.fx.tradeCount, 6),
        },
        indices: {
          returnPct: round(perAssetTotals.indices.weightedReturn, 6),
          tradeCount: round(perAssetTotals.indices.tradeCount, 6),
        },
        crypto: {
          returnPct: round(perAssetTotals.crypto.weightedReturn, 6),
          tradeCount: round(perAssetTotals.crypto.tradeCount, 6),
        },
        commodities: {
          returnPct: round(perAssetTotals.commodities.weightedReturn, 6),
          tradeCount: round(perAssetTotals.commodities.tradeCount, 6),
        },
      },
      nettedPairs: gatedPairs,
      skippedDueToNetting: week.breakdown.skippedDueToNetting,
      rawSignalsByPair: week.breakdown.rawSignalsByPair,
    },
    gateActivity: {
      skippedTrades,
      passedOrNoDataTrades,
      decisionBreakdown,
    },
  };
}

function buildGatedReport(
  report: ReconstructedSystemReport,
  gateRuntime: {
    gateMap: GateMap;
    cotContext: CotGateContext | null;
    reduceAsSkip: boolean;
  },
): ReconstructedSystemReport {
  const gatedWeeks = report.weeklyReturns.map((week) => applyGateToWeek(week, gateRuntime));
  const gatedReport = buildReport({
    system: `${report.system}_gated`,
    family: report.family,
    version: report.version,
    botId: `${report.botId}_gated`,
    strategyName: `${report.strategyName} Gated`,
    models: report.config.models,
    weighting: report.config.weighting,
    persistToDb: false,
  }, gatedWeeks, { isGated: true });
  return gatedReport;
}

async function logBaselineDeltas(reports: ReconstructedSystemReport[]) {
  for (const report of reports) {
    const baseline = LOCKED_BASELINE_SUMMARIES[report.system];
    const returnDeltaPct = round(report.compoundedReturnPct - baseline.compoundedReturnPct, 6);
    const drawdownDeltaPct = round(report.maxDrawdownPct - baseline.maxDrawdownPct, 6);
    const severity = Math.abs(returnDeltaPct) > 1 ? "WARN" : "INFO";
    console.log(
      `[${severity}] ${report.system}: compounded delta=${returnDeltaPct.toFixed(2)} pts, maxDD delta=${drawdownDeltaPct.toFixed(2)} pts vs locked 2026-03-22 baseline`,
    );
  }
}

function buildGateComparisonByStrategy(): Map<string, GateComparisonSummary> {
  const reportPath = path.join(REPO_ROOT, "reports", "bias-gate", "strategy-comparison-reduce-as-skip.json");
  if (!existsSync(reportPath)) return new Map();

  const raw = JSON.parse(readFileSync(reportPath, "utf8")) as GateComparisonFile;
  const comparisons = raw.comparisons ?? [];
  const byStrategy = new Map<string, GateComparisonSummary>();

  for (const comparison of comparisons) {
    const strategy = typeof comparison.strategy === "string" ? comparison.strategy : "";
    if (!strategy || !Array.isArray(comparison.weekly) || comparison.weekly.length === 0) continue;

    const weekly = comparison.weekly.flatMap((row) => {
      if (typeof row.weekOpenUtc !== "string") return [];
      const baselineReturnPct = typeof row.baselineReturn === "number" ? row.baselineReturn : 0;
      const gatedReturnPct = typeof row.gatedReturn === "number" ? row.gatedReturn : 0;
      return [{
        weekOpenUtc: row.weekOpenUtc,
        baselineReturnPct,
        baselineDrawdownPct: round(Math.max(0, -baselineReturnPct), 6),
        gatedReturnPct,
        gatedDrawdownPct: round(Math.max(0, -gatedReturnPct), 6),
        baselineTrades: typeof row.baselineOpenTrades === "number" ? row.baselineOpenTrades : 0,
        gatedTrades: typeof row.gatedOpenTrades === "number" ? row.gatedOpenTrades : 0,
      }];
    });
    if (weekly.length === 0) continue;

    const baselineReturns = weekly.map((row) => row.baselineReturnPct);
    const gatedReturns = weekly.map((row) => row.gatedReturnPct);
    const baselineTrades = weekly.reduce((sum, row) => sum + row.baselineTrades, 0);
    const gatedTrades = weekly.reduce((sum, row) => sum + row.gatedTrades, 0);
    const baselineDrawdown = round(Math.max(...weekly.map((row) => row.baselineDrawdownPct), 0), 6);
    const gatedDrawdown = round(Math.max(...weekly.map((row) => row.gatedDrawdownPct), 0), 6);
    const baselineWinRate = weekly.length > 0
      ? round((weekly.filter((row) => row.baselineReturnPct > 0).length / weekly.length) * 100, 6)
      : 0;
    const gatedWinRate = weekly.length > 0
      ? round((weekly.filter((row) => row.gatedReturnPct > 0).length / weekly.length) * 100, 6)
      : 0;
    const baselineCompounded = compoundReturns(baselineReturns);
    const gatedCompounded = compoundReturns(gatedReturns);

    byStrategy.set(strategy, {
      source: "app/reports/bias-gate/strategy-comparison-reduce-as-skip.json",
      weeks: weekly.length,
      baseline: {
        compoundedReturnPct: baselineCompounded,
        maxDrawdownPct: baselineDrawdown,
        avgWeeklyPct: safeAvg(baselineReturns),
        trades: baselineTrades,
        winRatePct: baselineWinRate,
      },
      gated: {
        compoundedReturnPct: gatedCompounded,
        maxDrawdownPct: gatedDrawdown,
        avgWeeklyPct: safeAvg(gatedReturns),
        trades: gatedTrades,
        winRatePct: gatedWinRate,
      },
      delta: {
        compoundedReturnPct: round(gatedCompounded - baselineCompounded, 6),
        maxDrawdownPct: round(gatedDrawdown - baselineDrawdown, 6),
        avgWeeklyPct: round(safeAvg(gatedReturns) - safeAvg(baselineReturns), 6),
        trades: gatedTrades - baselineTrades,
        winRatePct: round(gatedWinRate - baselineWinRate, 6),
      },
      weekly,
    });
  }

  return byStrategy;
}

export async function reconstructAllSystems() {
  const gateComparisonByStrategy = buildGateComparisonByStrategy();
  const reports: ReconstructedSystemReport[] = [];
  for (const config of COMPOSITE_SYSTEM_CONFIGS) {
    const report = await reconstructSystem(config);
    report.gateComparison = gateComparisonByStrategy.get(config.system) ?? null;
    reports.push(report);
  }
  return reports;
}

async function reconstructModelSystems() {
  const reports: ReconstructedSystemReport[] = [];
  for (const config of MODEL_SYSTEM_CONFIGS) {
    reports.push(await reconstructSystem(config));
  }
  return reports;
}

function summarizeReport(report: ReconstructedSystemReport) {
  return {
    system: report.system,
    family: report.family,
    simpleReturnPct: report.simpleReturnPct,
    compoundedReturnPct: report.compoundedReturnPct,
    maxDrawdownSimplePct: report.maxDrawdownSimplePct,
    maxDrawdownPct: report.maxDrawdownPct,
    trades: report.totalTrades,
    winRatePct: report.winRatePct,
    weeks: report.weeks,
    isGated: report.isGated,
    gateSkippedTrades: report.gateActivity?.totalSkipped,
  };
}

function weekCloseUtc(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return (parsed.isValid ? parsed.plus({ weeks: 1 }).toUTC().toISO() : null) ?? weekOpenUtc;
}

function inferPathLegWeight(pair: WeeklyRow["breakdown"]["nettedPairs"][number]) {
  if (Math.abs(pair.returnPct) > 0.000001) {
    const weight = pair.positionContributionPct / pair.returnPct;
    if (Number.isFinite(weight)) return weight;
  }
  if (Number.isFinite(pair.unitsOrWeight) && pair.unitsOrWeight > 0) return pair.unitsOrWeight;
  if (Number.isFinite(pair.netUnits) && Math.abs(pair.netUnits) > 0) return Math.abs(pair.netUnits);
  if (Number.isFinite(pair.tierWeight ?? Number.NaN) && (pair.tierWeight ?? 0) > 0) {
    return pair.tierWeight ?? 1;
  }
  return 1;
}

async function buildPathLedgerFromReconstructionWeek(
  system: string,
  week: WeeklyRow,
): Promise<WeekPositionLedger> {
  const returns = await getWeeklyPairReturns(week.weekOpenUtc);
  const returnMap = new Map(returns.map((row) => [row.symbol.toUpperCase(), row]));
  const weekClose = weekCloseUtc(week.weekOpenUtc);

  return {
    weekOpenUtc: week.weekOpenUtc,
    weekCloseUtc: weekClose,
    strategyId: system,
    entryStyleId: "weekly_hold",
    legs: week.breakdown.nettedPairs
      .filter((pair) => pair.direction === "LONG" || pair.direction === "SHORT")
      .map((pair) => {
        const price = returnMap.get(pair.symbol.toUpperCase());
        if (!price) return null;
        return {
          symbol: pair.symbol.toUpperCase(),
          assetClass: pair.assetClass,
          direction: pair.direction,
          entryTimeUtc: week.weekOpenUtc,
          exitTimeUtc: weekClose,
          weight: inferPathLegWeight(pair),
          adrMultiplier: 1,
          entryPrice: price.openPrice,
          exitPrice: price.closePrice,
          strategyId: system,
          entryStyleId: "weekly_hold",
          source: system,
          tier: pair.tier ?? null,
        };
      })
      .filter((leg): leg is WeekPositionLedger["legs"][number] => leg !== null),
  };
}

async function computePathMetricsForReport(report: ReconstructedSystemReport) {
  const weekPaths: BasketPathResult[] = [];
  const weeklyReturns: WeeklyRow[] = [];

  for (const week of report.weeklyReturns) {
    const ledger = await buildPathLedgerFromReconstructionWeek(report.system, week);
    const bars = await loadPathBars(
      ledger.legs.map((leg) => leg.symbol),
      ledger.weekOpenUtc,
      ledger.weekCloseUtc,
    );
    const pathResult = computeBasketPath(ledger, bars);
    weekPaths.push(pathResult);
    weeklyReturns.push({
      ...week,
      drawdownPct: round(pathResult.summary.maxDrawdownPct, 6),
    });
  }

  const multiWeekPath = computeMultiWeekBasketPath(weekPaths);
  return {
    ...report,
    weeklyReturns,
    maxDrawdownSimplePct: round(multiWeekPath.summary.maxDrawdownPct, 6),
    maxDrawdownPct: round(multiWeekPath.summary.maxDrawdownPct, 6),
    config: {
      ...report.config,
      drawdownMode: "path_true_hourly" as const,
    },
  };
}

async function applyPathTrueMetrics(reports: ReconstructedSystemReport[]) {
  const enriched: ReconstructedSystemReport[] = [];
  for (const report of reports) {
    enriched.push(await computePathMetricsForReport(report));
  }
  return enriched;
}

function buildComponentBreakdowns(
  compositeReports: ReconstructedSystemReport[],
  standaloneReports: ReconstructedSystemReport[],
  standaloneGatedReports: ReconstructedSystemReport[],
) {
  const standaloneByModel = new Map<string, ReconstructedSystemReport>(
    standaloneReports.flatMap((report) => {
      const model = report.config.models[0];
      return model ? [[model, report] as const] : [];
    }),
  );
  const standaloneGatedByModel = new Map<string, ReconstructedSystemReport>(
    standaloneGatedReports.flatMap((report) => {
      const model = report.config.models[0];
      return model ? [[model, report] as const] : [];
    }),
  );

  return Object.fromEntries(
    compositeReports.map((report) => [
      report.system,
      report.config.models.map((model) => {
        const baseline = standaloneByModel.get(model);
        const gated = standaloneGatedByModel.get(model);
        return {
          model,
          baseline: baseline
            ? {
                system: baseline.system,
                simpleReturnPct: baseline.simpleReturnPct,
                compoundedReturnPct: baseline.compoundedReturnPct,
                maxDrawdownSimplePct: baseline.maxDrawdownSimplePct,
                maxDrawdownPct: baseline.maxDrawdownPct,
                trades: baseline.totalTrades,
                winRatePct: baseline.winRatePct,
              }
            : {
                system: `model_${model}`,
                simpleReturnPct: 0,
                compoundedReturnPct: 0,
                maxDrawdownSimplePct: 0,
                maxDrawdownPct: 0,
                trades: 0,
                winRatePct: 0,
              },
          gated: gated
            ? {
                system: gated.system,
                simpleReturnPct: gated.simpleReturnPct,
                compoundedReturnPct: gated.compoundedReturnPct,
                maxDrawdownSimplePct: gated.maxDrawdownSimplePct,
                maxDrawdownPct: gated.maxDrawdownPct,
                trades: gated.totalTrades,
                winRatePct: gated.winRatePct,
                gateSkippedTrades: gated.gateActivity?.totalSkipped ?? 0,
              }
            : null,
        };
      }),
    ]),
  );
}

async function buildComprehensiveReconstructionReport(): Promise<ComprehensiveReconstructionReport> {
  const [rawCompositeReports, rawStandaloneReports, cotContext] = await Promise.all([
    reconstructAllSystems(),
    reconstructModelSystems(),
    buildCotGateContext(),
  ]);
  const gateMap = buildGateMap();
  const gateRuntime = {
    gateMap,
    cotContext,
    reduceAsSkip: true,
  };
  const compositeReports = await applyPathTrueMetrics(rawCompositeReports);
  const standaloneReports = await applyPathTrueMetrics(rawStandaloneReports);
  const compositeGated = await applyPathTrueMetrics(
    rawCompositeReports.map((report) => buildGatedReport(report, gateRuntime)),
  );
  const standaloneGated = await applyPathTrueMetrics(
    rawStandaloneReports.map((report) => buildGatedReport(report, gateRuntime)),
  );
  const componentBreakdowns = buildComponentBreakdowns(compositeReports, standaloneReports, standaloneGated);

  return {
    generated_utc: new Date().toISOString(),
    canonical_weeks: [...CANONICAL_WEEKS],
    return_methodology: "simple_sum",
    compounded_also_included: true,
    composite_systems: compositeReports,
    composite_systems_gated: compositeGated,
    standalone_models: standaloneReports,
    standalone_models_gated: standaloneGated,
    component_breakdowns: componentBreakdowns,
    summary: [
      ...compositeReports,
      ...compositeGated,
      ...standaloneReports,
      ...standaloneGated,
    ].map((report) => summarizeReport(report)),
  };
}

async function persistReports(reports: ReconstructedSystemReport[]) {
  for (const report of reports) {
    if (report.family === "model" || report.isGated) continue;
    const trades = buildTradeRows(report);
    const result = await persistStrategyBacktestSnapshot({
      context: `reconstruct-weekly-systems:${report.system}`,
      snapshot: {
        run: {
          botId: report.botId,
          variant: report.version,
          market: "multi_asset",
          strategyName: report.strategyName,
          carryMode: "none",
          stopMode: "none",
          universalMode: "net_hold",
          backtestWeeks: report.weeks,
          generatedUtc: new Date().toISOString(),
          configJson: {
            family: report.family,
            version: report.version,
            mode: report.config.mode,
            hold: report.config.hold,
            weighting: report.config.weighting,
            drawdownMode: report.config.drawdownMode,
            weeks: report.config.weeks,
            models: report.config.models,
            preserveBasketBreakdown: true,
            gateComparisonSource: report.gateComparison?.source ?? null,
            returnMethodology: "simple_sum",
            compoundedReturnPct: report.compoundedReturnPct,
            simpleReturnPct: report.simpleReturnPct,
          },
        },
        weekly: report.weeklyReturns.map((week) => ({
          weekOpenUtc: week.weekOpenUtc,
          returnPct: week.returnPct,
          trades: week.trades,
          wins: week.wins,
          losses: week.losses,
          drawdownPct: week.drawdownPct,
          grossProfitPct: week.grossProfitPct,
          grossLossPct: week.grossLossPct,
        })),
        trades,
      },
    });
    if (result.status !== "persisted") {
      throw new Error(`Failed to persist ${report.system}: ${result.reason}`);
    }
  }
}

function writeAuditReport(reports: ReconstructedSystemReport[]) {
  const reportsDir = path.join(REPO_ROOT, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const outputPath = path.join(reportsDir, "weekly-reconstruction-audit.json");
  writeFileSync(
    outputPath,
    `${JSON.stringify({
      generated_utc: new Date().toISOString(),
      canonical_weeks: [...CANONICAL_WEEKS],
      drawdown_rule: "fixed_from_week_start_equity_reset_each_week",
      note:
        "Combined Universal/Tiered system results are netted. Trade rows retain basket metadata so individual basket performance can be surfaced later in UI.",
      systems: reports.map((report) => ({
        ...report,
        weeklyReturns: report.weeklyReturns.map((week) => ({
          ...week,
          breakdown: {
            ...week.breakdown,
            rawSignalsByPair: Object.fromEntries(
              [...week.breakdown.rawSignalsByPair.entries()].map(([key, rawSignals]) => [key, rawSignals]),
            ),
          },
        })),
      })),
    }, null, 2)}\n`,
    "utf8",
  );
  return outputPath;
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type PairUniverseAccumulator = {
  appearances: number;
  traded: number;
  skipped: number;
  totalContributionPct: number;
  totalReturnPct: number;
  tradedReturnCount: number;
  wins: number;
  losses: number;
  bestWeek: { week: string; returnPct: number } | null;
  worstWeek: { week: string; returnPct: number } | null;
  directionBias: {
    longWeeks: number;
    shortWeeks: number;
    skippedWeeks: number;
  };
};

function createPairUniverseAccumulator(): PairUniverseAccumulator {
  return {
    appearances: 0,
    traded: 0,
    skipped: 0,
    totalContributionPct: 0,
    totalReturnPct: 0,
    tradedReturnCount: 0,
    wins: 0,
    losses: 0,
    bestWeek: null,
    worstWeek: null,
    directionBias: {
      longWeeks: 0,
      shortWeeks: 0,
      skippedWeeks: 0,
    },
  };
}

function writePairUniverseAudit(reports: ReconstructedSystemReport[]) {
  const reportsDir = path.join(REPO_ROOT, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const pairIndex = new Map<
    string,
    {
      assetClass: AssetClass;
      systems: Map<SystemId, PairUniverseAccumulator>;
    }
  >();

  for (const report of reports) {
    for (const trade of buildTradeRows(report)) {
      const assetClass = trade.metadata.assetClass;
      if (
        assetClass !== "fx"
        && assetClass !== "indices"
        && assetClass !== "crypto"
        && assetClass !== "commodities"
      ) {
        continue;
      }

      const pairEntry = pairIndex.get(trade.symbol) ?? {
        assetClass,
        systems: new Map<SystemId, PairUniverseAccumulator>(),
      };
      if (!pairIndex.has(trade.symbol)) {
        pairIndex.set(trade.symbol, pairEntry);
      }

      const systemEntry = pairEntry.systems.get(report.system) ?? createPairUniverseAccumulator();
      if (!pairEntry.systems.has(report.system)) {
        pairEntry.systems.set(report.system, systemEntry);
      }

      const skipped = trade.direction === "NEUTRAL" || trade.metadata.skippedByNetting === true;
      const pairReturnPct = toFiniteNumber(trade.metadata.pairReturnPct);
      const positionContributionPct = toFiniteNumber(trade.metadata.positionContributionPct) ?? 0;

      systemEntry.appearances += 1;
      systemEntry.totalContributionPct += positionContributionPct;

      if (skipped) {
        systemEntry.skipped += 1;
        systemEntry.directionBias.skippedWeeks += 1;
        continue;
      }

      systemEntry.traded += 1;
      if (trade.direction === "LONG") systemEntry.directionBias.longWeeks += 1;
      if (trade.direction === "SHORT") systemEntry.directionBias.shortWeeks += 1;

      if (pairReturnPct !== null) {
        systemEntry.totalReturnPct += pairReturnPct;
        systemEntry.tradedReturnCount += 1;
        if (pairReturnPct > 0) systemEntry.wins += 1;
        if (pairReturnPct < 0) systemEntry.losses += 1;
        if (!systemEntry.bestWeek || pairReturnPct > systemEntry.bestWeek.returnPct) {
          systemEntry.bestWeek = {
            week: trade.weekOpenUtc,
            returnPct: round(pairReturnPct, 6),
          };
        }
        if (!systemEntry.worstWeek || pairReturnPct < systemEntry.worstWeek.returnPct) {
          systemEntry.worstWeek = {
            week: trade.weekOpenUtc,
            returnPct: round(pairReturnPct, 6),
          };
        }
      }
    }
  }

  const pairs = Object.fromEntries(
    [...pairIndex.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([symbol, pairEntry]) => [
        symbol,
        {
          assetClass: pairEntry.assetClass,
          systems: Object.fromEntries(
            COMPOSITE_SYSTEM_CONFIGS
              .filter((config) => pairEntry.systems.has(config.system))
              .map((config) => {
                const systemEntry = pairEntry.systems.get(config.system)!;
                const avgReturnWhenTraded = systemEntry.tradedReturnCount > 0
                  ? systemEntry.totalReturnPct / systemEntry.tradedReturnCount
                  : 0;
                const tradeOutcomes = systemEntry.wins + systemEntry.losses;
                const winRate = tradeOutcomes > 0 ? (systemEntry.wins / tradeOutcomes) * 100 : 0;
                return [
                  config.system,
                  {
                    appearances: systemEntry.appearances,
                    traded: systemEntry.traded,
                    skipped: systemEntry.skipped,
                    totalContributionPct: round(systemEntry.totalContributionPct, 6),
                    avgReturnWhenTraded: round(avgReturnWhenTraded, 6),
                    wins: systemEntry.wins,
                    losses: systemEntry.losses,
                    winRate: round(winRate, 6),
                    bestWeek: systemEntry.bestWeek,
                    worstWeek: systemEntry.worstWeek,
                    directionBias: systemEntry.directionBias,
                  },
                ];
              }),
          ),
        },
      ]),
  );

  const outputPath = path.join(reportsDir, "pair-universe-audit.json");
  writeFileSync(
    outputPath,
    `${JSON.stringify({
      generated_utc: new Date().toISOString(),
      systems: COMPOSITE_SYSTEM_CONFIGS.map((config) => config.system),
      weeks: [...CANONICAL_WEEKS],
      pairs,
    }, null, 2)}\n`,
    "utf8",
  );
  return outputPath;
}

function writeComprehensiveReport(report: ComprehensiveReconstructionReport) {
  const reportsDir = path.join(REPO_ROOT, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const outputPath = path.join(reportsDir, "comprehensive-reconstruction.json");
  const embeddedDir = path.join(REPO_ROOT, "src", "lib", "performance", "embedded");
  if (!existsSync(embeddedDir)) {
    mkdirSync(embeddedDir, { recursive: true });
  }
  const embeddedPath = path.join(embeddedDir, "comprehensive-reconstruction.json");

  const serializeReport = (item: ReconstructedSystemReport) => ({
    ...item,
    weeklyReturns: item.weeklyReturns.map((week) => ({
      ...week,
      breakdown: {
        ...week.breakdown,
        rawSignalsByPair: Object.fromEntries(
          [...week.breakdown.rawSignalsByPair.entries()].map(([key, rawSignals]) => [key, rawSignals]),
        ),
      },
    })),
  });

  const payload = `${JSON.stringify({
    ...report,
    composite_systems: report.composite_systems.map(serializeReport),
    composite_systems_gated: report.composite_systems_gated.map(serializeReport),
    standalone_models: report.standalone_models.map(serializeReport),
    standalone_models_gated: report.standalone_models_gated.map(serializeReport),
  }, null, 2)}\n`;

  writeFileSync(`${outputPath}`, payload, "utf8");
  writeFileSync(`${embeddedPath}`, payload, "utf8");
  return outputPath;
}

function logReportGroup(title: string, reports: ReconstructedSystemReport[]) {
  console.log(title);
  for (const report of reports) {
    const skipped = report.gateActivity ? `  skipped=${report.gateActivity.totalSkipped}` : "";
    console.log(
      `  ${report.system}: simple=${report.simpleReturnPct.toFixed(2)}% compound=${report.compoundedReturnPct.toFixed(2)}% simpleDD=${report.maxDrawdownSimplePct.toFixed(2)}% compDD=${report.maxDrawdownPct.toFixed(2)}% trades=${report.totalTrades.toFixed(0)} winRate=${report.winRatePct.toFixed(2)}%${skipped}`,
    );
  }
}

async function main() {
  const comprehensive = await buildComprehensiveReconstructionReport();
  await logBaselineDeltas(comprehensive.composite_systems);
  await persistReports(comprehensive.composite_systems);
  const auditPath = writeAuditReport(comprehensive.composite_systems);
  const pairUniversePath = writePairUniverseAudit(comprehensive.composite_systems);
  const comprehensivePath = writeComprehensiveReport(comprehensive);

  console.log(`Wrote ${auditPath}`);
  console.log(`Wrote ${pairUniversePath}`);
  console.log(`Wrote ${comprehensivePath}`);
  console.log("=== Comprehensive Reconstruction Report ===");
  console.log("Return methodology: Simple Sum (compounded also shown)");
  logReportGroup("COMPOSITE SYSTEMS (BASELINE)", comprehensive.composite_systems);
  logReportGroup("COMPOSITE SYSTEMS (GATED)", comprehensive.composite_systems_gated);
  logReportGroup("STANDALONE MODELS (BASELINE)", comprehensive.standalone_models);
  logReportGroup("STANDALONE MODELS (GATED)", comprehensive.standalone_models_gated);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Weekly reconstruction failed:", error);
    process.exitCode = 1;
  });
}
