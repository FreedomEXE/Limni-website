/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/backtest-manual-session-matrix.ts
 *
 * Description:
 * Session-level manual trigger backtest for the Flagship 36-instrument matrix.
 * Reconstructs weekly matrix direction from stored performance snapshots,
 * fetches OANDA M5 OHLC, aggregates H4/H1/M15, computes the RRanjanFX
 * black-line slow stochastic %D (21,3,13), and tests manual trigger
 * variants against frozen/live/ungated
 * gate modes. Emits session-close and week-close excursion metrics so stop
 * sizing can be designed from observed drawdown.
 *
 * Run:
 *   npx tsx scripts/backtest-manual-session-matrix.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { query } from "../src/lib/db";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getOandaInstrument } from "../src/lib/oandaPrices";
import { buildDailySentimentLock, type DailySentimentDirection } from "../src/lib/sentiment/daily";
import {
  SESSION_ELIGIBILITY,
  SESSION_WINDOWS_UTC,
  type SessionName,
} from "../src/lib/flagship/sessionConfig";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type GateMode = "UNGATED" | "FROZEN" | "LIVE";
type TimePolicy = "FIRST_TIMEFRAME_WINS" | "LOWER_TIMEFRAME_REPLACE";
type TimeframeId = "H4" | "H1" | "M15" | "M5";
type ExitHorizon = "SESSION_CLOSE" | "WEEK_CLOSE";
type ExitReason = "STOP_LOSS" | "TAKE_PROFIT" | "TIME_EXIT";
type StrengthMode = "BASELINE" | "FILTER_24H";
type SwingTpLockMode = "PAIR" | "PAIR_SESSION";

type PairInfo = {
  assetClass: AssetClass;
  pair: string;
  base: string;
  quote: string;
};

type SnapshotRow = {
  week_open_utc: Date;
  asset_class: AssetClass;
  model: "dealer" | "commercial" | "sentiment";
  pair_details:
    | Array<{
      pair?: string;
      direction?: Direction | null;
    }>
    | string
    | null;
};

type OhlcCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type TimeframeDataset = {
  timeframe: TimeframeId;
  minutes: number;
  candles: OhlcCandle[];
  triggerLine: Array<number | null>;
};

type WeeklyMatrixRow = {
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  weeklyDirection: Direction;
  weeklyTier: "HIGH" | "MEDIUM" | "NEUTRAL";
  weeklyGate: "PASS" | "SKIP";
};

type CandidateEntry = {
  timeframe: TimeframeId;
  activeFromTs: number;
  signalCandleTs: number;
  entryTs: number;
  entryPrice: number;
  signalValue: number;
};

type TradeMetrics = {
  exitPrice: number | null;
  returnPct: number | null;
  maePct: number | null;
  mfePct: number | null;
};

type ManualTrade = {
  variantId: string;
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  assetClass: AssetClass;
  session: SessionName;
  sessionDateUtc: string;
  gateMode: GateMode;
  timePolicy: TimePolicy;
  strengthMode: StrengthMode;
  strengthThreshold: number | null;
  strengthSupported: boolean;
  strengthDecisionTimeUtc: string | null;
  strengthSnapshotTimeUtc: string | null;
  strengthDirectionAtDecision: Direction | null;
  weeklyDirection: Exclude<Direction, "NEUTRAL">;
  frozenGateDirection: Direction | null;
  liveGateDirectionAtEntry: Direction | null;
  triggerTimeframe: TimeframeId;
  signalValue: number;
  entryTimeUtc: string;
  entryPrice: number;
  sessionStartUtc: string;
  sessionEndUtc: string;
  weekEndUtc: string;
  sessionMetrics: TradeMetrics;
  weekMetrics: TradeMetrics;
};

type VariantSummary = {
  id: string;
  gateMode: GateMode;
  timePolicy: TimePolicy;
  strengthMode: StrengthMode;
  strengthThreshold: number | null;
  trades: number;
  winRateSessionClosePct: number;
  avgSessionReturnPct: number;
  medianSessionReturnPct: number;
  avgWeekReturnPct: number;
  medianWeekReturnPct: number;
  avgSessionMaePct: number;
  p95SessionMaePct: number;
  avgSessionMfePct: number;
  p95SessionMfePct: number;
  avgWeekMaePct: number;
  p95WeekMaePct: number;
  avgWeekMfePct: number;
  p95WeekMfePct: number;
  worstWeekMaePct: number;
  byTimeframe: Array<{ timeframe: TimeframeId; trades: number; avgSessionReturnPct: number; avgWeekMaePct: number }>;
  bySession: Array<{ session: SessionName; trades: number; avgSessionReturnPct: number; avgWeekMaePct: number }>;
  byPair: Array<{ pair: string; trades: number; avgSessionReturnPct: number; avgWeekMaePct: number }>;
};

type FixedExitTradeMetrics = TradeMetrics & {
  exitReason: ExitReason | null;
  exitTimeUtc: string | null;
  stopLossPct: number;
  takeProfitPct: number;
};

type ExitSweepSummary = {
  variantId: string;
  gateMode: GateMode;
  timePolicy: TimePolicy;
  strengthMode: StrengthMode;
  strengthThreshold: number | null;
  horizon: ExitHorizon;
  stopLossPct: number;
  takeProfitPct: number;
  trades: number;
  winRatePct: number;
  avgReturnPct: number;
  medianReturnPct: number;
  avgMaePct: number;
  p95MaePct: number;
  avgMfePct: number;
  p95MfePct: number;
  stopHitPct: number;
  takeProfitHitPct: number;
  timeExitPct: number;
  expectancyPct: number;
  profitFactor: number;
};

type SwingPoint = {
  level: number;
  swingTs: number;
  confirmedTs: number;
};

type SwingTpTradeResult = TradeMetrics & {
  variantId: string;
  pair: string;
  gateMode: GateMode;
  timePolicy: TimePolicy;
  entryTimeUtc: string;
  exitTimeUtc: string | null;
  exitReason: "SWING_TP" | "WEEK_CLOSE" | "NO_TARGET_WEEK_CLOSE";
  targetPrice: number | null;
  targetDistancePct: number | null;
  skippedDueToOpenTrade: boolean;
};

type SwingTpSummary = {
  variantId: string;
  gateMode: GateMode;
  timePolicy: TimePolicy;
  lockMode: SwingTpLockMode;
  tradesConsidered: number;
  tradesTaken: number;
  tradesSkippedDueToOpenTrade: number;
  swingTargetHitPct: number;
  noTargetPct: number;
  weekCloseFallbackPct: number;
  avgReturnPct: number;
  medianReturnPct: number;
  avgMaePct: number;
  p95MaePct: number;
  avgMfePct: number;
  p95MfePct: number;
  avgTargetDistancePct: number;
  p95TargetDistancePct: number;
  winRatePct: number;
  profitFactor: number;
};

type SwingTpExecution = {
  variantId: string;
  lockMode: SwingTpLockMode;
  pair: string;
  assetClass: AssetClass;
  session: SessionName;
  weekLabel: string;
  base: string;
  quote: string;
  direction: Exclude<Direction, "NEUTRAL">;
  entryTs: number;
  exitTs: number;
  entryPrice: number;
  exitPrice: number;
  exitReason: "SWING_TP" | "WEEK_CLOSE" | "NO_TARGET_WEEK_CLOSE";
  targetPrice: number | null;
  targetDistancePct: number | null;
  returnPct: number;
  maePct: number;
  mfePct: number;
  atr14Pct: number | null;
};

type PairRiskProfile = {
  pair: string;
  trades: number;
  avgReturnPct: number;
  medianReturnPct: number;
  avgMaePct: number;
  p95MaePct: number;
  maxMaePct: number;
  avgAtr14Pct: number;
  p95Atr14Pct: number;
  noTargetRatePct: number;
  worstLossPct: number;
  recommendedLotsPer100k: Array<{
    riskBudgetPct: number;
    atrOnly: number;
    conservative: number;
  }>;
};

type PortfolioSimulationSummary = {
  modelId: string;
  label: string;
  sizingBasis: string;
  riskBudgetPct: number | null;
  maxDrawdownPct: number;
  finalEquity: number;
  totalReturnPct: number;
  worstWeekPnlPct: number;
  maxConcurrentTrades: number;
  maxConcurrentNotionalMultiple: number;
  avgLotMultiple: number;
  medianLotMultiple: number;
  maxLotMultiple: number;
};

type ConcurrentExposureSnapshot = {
  timestampUtc: string;
  openTrades: number;
  totalNotionalMultiple: number;
  openPairs: string[];
  currencyHeat: Array<{ currency: string; netNotionalMultiple: number }>;
};

type ConcurrentExposureSummary = {
  maxConcurrentTrades: number;
  maxConcurrentNotionalMultiple: number;
  worstSessionDrawdownPct: number;
  worstWeekDrawdownPct: number;
  peakExposureDetails: ConcurrentExposureSnapshot[];
};

type CatastrophicStopSummary = {
  stopLossPct: number;
  trades: number;
  stoppedWinners: number;
  winRatePct: number;
  avgReturnPct: number;
  profitFactor: number;
  maxDrawdownPctFixed1x: number;
};

type PositionSizingResearch = {
  enabled: boolean;
  targetVariantId: string;
  lockMode: SwingTpLockMode;
  fxOnly: boolean;
  accountSizeUsd: number;
  riskBudgetsPct: number[];
  catastrophicStopPcts: number[];
  pairRiskProfiles: PairRiskProfile[];
  sizingModels: PortfolioSimulationSummary[];
  concurrentExposure: ConcurrentExposureSummary;
  catastrophicStopAnalysis: CatastrophicStopSummary[];
  recommendation: {
    bestModelByReturn: string | null;
    bestModelUnder10PctDrawdown: string | null;
    bestModelUnder5PctDrawdown: string | null;
  };
};

type BacktestOutput = {
  generatedUtc: string;
  config: {
    targetWeeks: string[];
    targetWeekLabels: string[];
    pairUniverseCount: number;
    sessionWindowsUtc: typeof SESSION_WINDOWS_UTC;
    timeframeOrder: TimeframeId[];
    gateModes: GateMode[];
    timePolicies: TimePolicy[];
    strengthFilterExperiment: {
      window: "24h";
      thresholds: number[];
      supportedAssetClasses: AssetClass[];
      unsupportedAssetClasses: AssetClass[];
      timing: {
        FROZEN: "session_open";
        LIVE: "entry_time";
        UNGATED: "entry_time";
      };
    };
    indicator: {
      name: "RRanjanFX Slow Stochastic D";
      stochasticKLength: number;
      stochasticDSmoothing: number;
      stochasticKSmoothing: number;
      rsiLength: number;
      oversold: number;
      overbought: number;
      source: "close/high/low";
      triggerLine: "%D (black line)";
    };
    assumptions: string[];
    fetchWindowUtc: {
      from: string;
      to: string;
    };
    cacheDir: string;
  };
  dataQuality: {
    missingPairs: string[];
    missingStrengthLookups: string[];
  };
  benchmark: {
    sourcePath: string | null;
    weeks: string[];
    phase1BaselineHeadline: {
      id: string;
      returnPct: number;
      maxDrawdownPct: number;
      winRatePct: number;
      trades: number;
    } | null;
    note: string | null;
  };
  exitResearch: {
    stopLossPcts: number[];
    takeProfitPcts: number[];
    intrabarTieBreak: string;
    summaries: ExitSweepSummary[];
  };
  swingTpResearch: {
    enabled: boolean;
    baselineOnly: boolean;
    swingDefinition: string;
    targetRule: string;
    noStopLoss: boolean;
    oneTradePerPairAtATime: boolean;
    lockModes: Array<"PAIR" | "PAIR_SESSION">;
    summaries: SwingTpSummary[];
  };
  positionSizingResearch: PositionSizingResearch;
  summaries: VariantSummary[];
  trades: ManualTrade[];
};

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";
const CACHE_DIR = path.join(process.cwd(), "Local Environment", ".cache", "manual-session-matrix");
const REPORTS_DIR = path.join(process.cwd(), "app", "reports");

const TIMEFRAMES: Array<{ id: TimeframeId; minutes: number }> = [
  { id: "H4", minutes: 240 },
  { id: "H1", minutes: 60 },
  { id: "M15", minutes: 15 },
  { id: "M5", minutes: 5 },
];

const STOCHASTIC_K_LENGTH = 21;
const STOCHASTIC_D_SMOOTHING = 13;
const STOCHASTIC_K_SMOOTHING = 3;
const RSI_LENGTH = 3;
const OVERSOLD_LEVEL = 20;
const OVERBOUGHT_LEVEL = 80;
const FETCH_CONCURRENCY = Number(process.env.MANUAL_MATRIX_FETCH_CONCURRENCY ?? "4");
const WARMUP_DAYS = Number(process.env.MANUAL_MATRIX_WARMUP_DAYS ?? "28");
const TARGET_WEEKS_COUNT = 8;
const KATARAKTI_REPORT_PATH = path.join(process.cwd(), "app", "reports", "katarakti-phase1-backtest-latest.json");
const FIXED_STOP_LOSS_PCTS = [0.5, 1, 1.5, 2, 3];
const FIXED_TAKE_PROFIT_PCTS = [0.5, 1, 1.5, 2, 3];
const STRENGTH_FILTER_THRESHOLDS = [10, 15, 20, 25];
const STRENGTH_FILTER_WINDOW = "24h" as const;
const POSITION_SIZING_TARGET_VARIANT = "live__lower_timeframe_replace";
const POSITION_SIZING_LOCK_MODE: SwingTpLockMode = "PAIR_SESSION";
const POSITION_SIZING_ACCOUNT_USD = 100_000;
const POSITION_SIZING_RISK_BUDGETS = [0.25, 0.5, 0.75, 1.0];
const CATASTROPHIC_STOP_PCTS = [3, 5, 8];
const PAIR_FILTER = new Set(
  (process.env.MANUAL_MATRIX_PAIR_FILTER ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

type CurrencyStrengthHistoryRow = {
  snapshot_time_utc: string;
  currency: string;
  normalized_strength: string | number;
};

type AssetStrengthHistoryRow = {
  snapshot_time_utc: string;
  asset_class: "crypto" | "commodities";
  asset: string;
  normalized_strength: string | number;
};

type StrengthSnapshot = {
  ts: number;
  snapshotTimeUtc: string;
  values: Map<string, number>;
};

function pairKey(assetClass: AssetClass, pair: string) {
  return `${assetClass}|${pair}`;
}

function variantId(
  gateMode: GateMode,
  timePolicy: TimePolicy,
  strengthMode: StrengthMode = "BASELINE",
  strengthThreshold: number | null = null,
) {
  const base = `${gateMode}__${timePolicy}`.toLowerCase();
  if (strengthMode === "BASELINE" || strengthThreshold === null) return base;
  return `${base}__strength24_t${strengthThreshold}`;
}

function tradeVariantId(trade: Pick<ManualTrade, "gateMode" | "timePolicy" | "strengthMode" | "strengthThreshold">) {
  return variantId(trade.gateMode, trade.timePolicy, trade.strengthMode, trade.strengthThreshold);
}

function timeframeMinutes(timeframe: TimeframeId) {
  return TIMEFRAMES.find((row) => row.id === timeframe)?.minutes ?? 5;
}

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getOandaAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OANDA_API_KEY is not configured.");
  }
  return { Authorization: `Bearer ${apiKey}` };
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function safeAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weekLabelFromOpen(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ hours: 12 }).toISODate() ?? weekOpenUtc.slice(0, 10);
}

function parsePairDetails(value: SnapshotRow["pair_details"]) {
  if (!value) return [] as Array<{ pair: string; direction: Direction }>;
  if (Array.isArray(value)) {
    return value
      .map((row) => ({
        pair: String(row?.pair ?? "").trim().toUpperCase(),
        direction:
          row?.direction === "LONG" || row?.direction === "SHORT" || row?.direction === "NEUTRAL"
            ? row.direction
            : "NEUTRAL",
      }))
      .filter((row) => row.pair.length > 0);
  }
  if (typeof value === "string") {
    try {
      return parsePairDetails(JSON.parse(value) as SnapshotRow["pair_details"]);
    } catch {
      return [];
    }
  }
  return [];
}

function classifyVotes(votes: Direction[]) {
  const longVotes = votes.filter((vote) => vote === "LONG").length;
  const shortVotes = votes.filter((vote) => vote === "SHORT").length;

  if (longVotes >= 2 && longVotes > shortVotes) {
    return {
      direction: "LONG" as const,
      tier: longVotes === 3 ? "HIGH" as const : "MEDIUM" as const,
      gate: "PASS" as const,
    };
  }
  if (shortVotes >= 2 && shortVotes > longVotes) {
    return {
      direction: "SHORT" as const,
      tier: shortVotes === 3 ? "HIGH" as const : "MEDIUM" as const,
      gate: "PASS" as const,
    };
  }
  return {
    direction: "NEUTRAL" as const,
    tier: "NEUTRAL" as const,
    gate: "SKIP" as const,
  };
}

function buildPairUniverse() {
  const out: PairInfo[] = [];
  (Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, Array<{ pair: string; base: string; quote: string }>]>).forEach(
    ([assetClass, defs]) => {
      for (const def of defs) {
        out.push({
          assetClass,
          pair: def.pair.toUpperCase(),
          base: def.base.toUpperCase(),
          quote: def.quote.toUpperCase(),
        });
      }
    },
  );
  return out.sort((a, b) => pairKey(a.assetClass, a.pair).localeCompare(pairKey(b.assetClass, b.pair)));
}

async function getTargetWeeks(now = DateTime.utc()) {
  const currentWeekLabel = weekLabelFromOpen(getCanonicalWeekOpenUtc(now));
  const rows = await query<{ week_open_utc: Date }>(
    `SELECT DISTINCT week_open_utc
     FROM performance_snapshots
     ORDER BY week_open_utc DESC
     LIMIT 32`,
  );

  const filtered = rows
    .map((row) => row.week_open_utc.toISOString())
    .filter((weekOpenUtc) => weekLabelFromOpen(weekOpenUtc) < currentWeekLabel)
    .slice(0, TARGET_WEEKS_COUNT)
    .reverse();

  if (filtered.length < TARGET_WEEKS_COUNT) {
    throw new Error(
      `Expected ${TARGET_WEEKS_COUNT} completed weeks in performance_snapshots, found ${filtered.length}.`,
    );
  }

  return filtered;
}

async function loadWeeklyMatrixMap(
  targetWeeks: readonly string[],
  pairUniverse: readonly PairInfo[],
): Promise<Map<string, Map<string, WeeklyMatrixRow>>> {
  const rows = await query<SnapshotRow>(
    `SELECT week_open_utc, asset_class, model, pair_details
     FROM performance_snapshots
     WHERE week_open_utc = ANY($1::timestamptz[])
       AND model = ANY($2::text[])`,
    [targetWeeks, ["dealer", "commercial", "sentiment"]],
  );

  const rawByWeek = new Map<string, Map<string, Direction>>();
  for (const week of targetWeeks) rawByWeek.set(week, new Map<string, Direction>());

  for (const row of rows) {
    const weekOpenUtc = row.week_open_utc.toISOString();
    const weekBucket = rawByWeek.get(weekOpenUtc);
    if (!weekBucket) continue;
    for (const detail of parsePairDetails(row.pair_details)) {
      weekBucket.set(`${row.asset_class}|${detail.pair}|${row.model}`, detail.direction);
    }
  }

  const out = new Map<string, Map<string, WeeklyMatrixRow>>();
  for (const week of targetWeeks) {
    const bucket = new Map<string, WeeklyMatrixRow>();
    const raw = rawByWeek.get(week) ?? new Map<string, Direction>();
    for (const pair of pairUniverse) {
      const dealer = raw.get(`${pair.assetClass}|${pair.pair}|dealer`) ?? "NEUTRAL";
      const commercial = raw.get(`${pair.assetClass}|${pair.pair}|commercial`) ?? "NEUTRAL";
      const sentiment = raw.get(`${pair.assetClass}|${pair.pair}|sentiment`) ?? "NEUTRAL";
      const classified = classifyVotes([dealer, commercial, sentiment]);
      bucket.set(pair.pair, {
        dealer,
        commercial,
        sentiment,
        weeklyDirection: classified.direction,
        weeklyTier: classified.tier,
        weeklyGate: classified.gate,
      });
    }
    out.set(week, bucket);
  }

  return out;
}

async function loadStrengthHistory(fromUtc: DateTime, toUtc: DateTime) {
  const [currencyRows, assetRows] = await Promise.all([
    query<CurrencyStrengthHistoryRow>(
      `SELECT to_char(snapshot_time_utc, 'YYYY-MM-DD"T"HH24:MI:SS') || 'Z' AS snapshot_time_utc, currency, normalized_strength
       FROM currency_strength_snapshots
       WHERE "window" = $1
         AND snapshot_time_utc >= $2::timestamp
         AND snapshot_time_utc < $3::timestamp
       ORDER BY snapshot_time_utc ASC, currency ASC`,
      [STRENGTH_FILTER_WINDOW, fromUtc.toISO(), toUtc.toISO()],
    ),
    query<AssetStrengthHistoryRow>(
      `SELECT to_char(snapshot_time_utc, 'YYYY-MM-DD"T"HH24:MI:SS') || 'Z' AS snapshot_time_utc, asset_class, asset, normalized_strength
       FROM asset_strength_snapshots
       WHERE "window" = $1
         AND snapshot_time_utc >= $2::timestamp
         AND snapshot_time_utc < $3::timestamp
       ORDER BY snapshot_time_utc ASC, asset_class ASC, asset ASC`,
      [STRENGTH_FILTER_WINDOW, fromUtc.toISO(), toUtc.toISO()],
    ),
  ]);

  const groupSnapshots = <T extends { snapshot_time_utc: string }>(
    rows: readonly T[],
    keyFn: (row: T) => string,
  ) => {
    const grouped = new Map<number, StrengthSnapshot>();
    for (const row of rows) {
      const parsed = DateTime.fromISO(row.snapshot_time_utc, { zone: "utc" });
      if (!parsed.isValid) continue;
      const ts = parsed.toMillis();
      const existing = grouped.get(ts) ?? {
        ts,
        snapshotTimeUtc: parsed.toISO() ?? row.snapshot_time_utc,
        values: new Map<string, number>(),
      };
      existing.values.set(keyFn(row), Number((row as { normalized_strength: string | number }).normalized_strength));
      grouped.set(ts, existing);
    }
    return Array.from(grouped.values()).sort((a, b) => a.ts - b.ts);
  };

  return {
    currency24h: groupSnapshots(currencyRows, (row) => row.currency.trim().toUpperCase()),
    asset24hByClass: {
      crypto: groupSnapshots(
        assetRows.filter((row) => row.asset_class === "crypto"),
        (row) => row.asset.trim().toUpperCase(),
      ),
      commodities: groupSnapshots(
        assetRows.filter((row) => row.asset_class === "commodities"),
        (row) => row.asset.trim().toUpperCase(),
      ),
    },
  };
}

function findLatestStrengthSnapshotAt(snapshots: readonly StrengthSnapshot[], asOfTs: number) {
  if (snapshots.length === 0) return null;
  let low = 0;
  let high = snapshots.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (snapshots[mid].ts <= asOfTs) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best >= 0 ? snapshots[best] : null;
}

type StrengthDecision = {
  supported: boolean;
  available: boolean;
  direction: Direction | null;
  snapshotTimeUtc: string | null;
};

function resolveStrengthDirection(params: {
  pairInfo: PairInfo;
  asOfTs: number;
  threshold: number;
  strengthHistory: Awaited<ReturnType<typeof loadStrengthHistory>>;
}): StrengthDecision {
  const { pairInfo, asOfTs, threshold, strengthHistory } = params;

  if (pairInfo.assetClass === "indices") {
    return {
      supported: false,
      available: false,
      direction: null,
      snapshotTimeUtc: null,
    };
  }

  if (pairInfo.assetClass === "fx") {
    const snapshot = findLatestStrengthSnapshotAt(strengthHistory.currency24h, asOfTs);
    if (!snapshot) {
      return { supported: true, available: false, direction: null, snapshotTimeUtc: null };
    }
    const baseStrength = snapshot.values.get(pairInfo.base);
    const quoteStrength = snapshot.values.get(pairInfo.quote);
    if (baseStrength === undefined || quoteStrength === undefined) {
      return { supported: true, available: false, direction: null, snapshotTimeUtc: snapshot.snapshotTimeUtc };
    }
    const diff = baseStrength - quoteStrength;
    const direction = diff >= threshold
      ? "LONG"
      : diff <= -threshold
        ? "SHORT"
        : "NEUTRAL";
    return {
      supported: true,
      available: true,
      direction,
      snapshotTimeUtc: snapshot.snapshotTimeUtc,
    };
  }

  const classSnapshots = pairInfo.assetClass === "crypto"
    ? strengthHistory.asset24hByClass.crypto
    : strengthHistory.asset24hByClass.commodities;
  const snapshot = findLatestStrengthSnapshotAt(classSnapshots, asOfTs);
  if (!snapshot) {
    return { supported: true, available: false, direction: null, snapshotTimeUtc: null };
  }
  const assetStrength = snapshot.values.get(pairInfo.base);
  if (assetStrength === undefined) {
    return { supported: true, available: false, direction: null, snapshotTimeUtc: snapshot.snapshotTimeUtc };
  }
  const direction = assetStrength >= 50 + threshold
    ? "LONG"
    : assetStrength <= 50 - threshold
      ? "SHORT"
      : "NEUTRAL";
  return {
    supported: true,
    available: true,
    direction,
    snapshotTimeUtc: snapshot.snapshotTimeUtc,
  };
}

type GateSnapshot = {
  asOfUtc: string;
  byPair: Map<string, Direction>;
};

const gateSnapshotCache = new Map<string, GateSnapshot>();

async function loadGateSnapshotAt(asOfUtc: string, weekMap: Map<string, WeeklyMatrixRow>) {
  const cached = gateSnapshotCache.get(asOfUtc);
  if (cached) return cached;

  const sentimentLock = await buildDailySentimentLock(asOfUtc);
  const dailySentimentByPair = new Map<string, DailySentimentDirection>(
    sentimentLock.rows.map((row) => [row.symbol.trim().toUpperCase(), row.sentimentDirection]),
  );

  const byPair = new Map<string, Direction>();
  for (const [pair, row] of Array.from(weekMap.entries())) {
    const dailySentiment = dailySentimentByPair.get(pair) ?? "NEUTRAL";
    const classified = classifyVotes([row.dealer, row.commercial, dailySentiment]);
    byPair.set(pair, classified.direction);
  }

  const snapshot = {
    asOfUtc,
    byPair,
  };
  gateSnapshotCache.set(asOfUtc, snapshot);
  return snapshot;
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
) {
  const out: R[] = [];
  const safeLimit = Math.max(1, limit);
  for (let i = 0; i < items.length; i += safeLimit) {
    const chunk = items.slice(i, i + safeLimit);
    out.push(...await Promise.all(chunk.map((item) => task(item))));
  }
  return out;
}

function candleCachePath(symbol: string, fromUtc: string, toUtc: string) {
  const safeSymbol = symbol.replace(/[^\w]+/g, "_");
  return path.join(CACHE_DIR, `${safeSymbol}__${fromUtc.replace(/[:.]/g, "-")}__${toUtc.replace(/[:.]/g, "-")}.json`);
}

async function fetchOandaM5Series(symbol: string, fromUtc: DateTime, toUtc: DateTime): Promise<OhlcCandle[]> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = candleCachePath(symbol, fromUtc.toUTC().toISO() ?? "", toUtc.toUTC().toISO() ?? "");
  if (existsSync(cachePath)) {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as { candles?: OhlcCandle[] };
    if (Array.isArray(parsed.candles)) {
      return parsed.candles;
    }
  }

  const instrument = getOandaInstrument(symbol);
  const stepMs = 5 * 60 * 1000;
  const maxBarsPerRequest = 4000;
  const all = new Map<number, OhlcCandle>();
  let cursor = fromUtc;
  let page = 0;

  while (cursor.toMillis() < toUtc.toMillis() && page < 120) {
    page += 1;
    const requestTo = DateTime.fromMillis(
      Math.min(toUtc.toMillis(), cursor.toMillis() + stepMs * maxBarsPerRequest),
      { zone: "utc" },
    );
    const url = new URL(`${getOandaBaseUrl()}/v3/instruments/${instrument}/candles`);
    url.searchParams.set("price", "M");
    url.searchParams.set("granularity", "M5");
    url.searchParams.set("from", cursor.toISO() ?? "");
    url.searchParams.set("to", requestTo.toISO() ?? "");

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(url.toString(), { headers: getOandaAuthHeaders() });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`OANDA ${instrument} [${response.status}] ${body}`);
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      }
    }

    if (!response || lastError) {
      throw lastError ?? new Error(`Failed to fetch OANDA candles for ${instrument}`);
    }

    const data = (await response.json()) as {
      candles?: Array<{
        time: string;
        complete: boolean;
        mid?: { o?: string; h?: string; l?: string; c?: string };
      }>;
    };

    const candles = (data.candles ?? [])
      .filter((row) => row.complete && row.mid)
      .map((row) => ({
        ts: DateTime.fromISO(row.time, { zone: "utc" }).toMillis(),
        open: Number(row.mid?.o ?? NaN),
        high: Number(row.mid?.h ?? NaN),
        low: Number(row.mid?.l ?? NaN),
        close: Number(row.mid?.c ?? NaN),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.ts) &&
          Number.isFinite(row.open) &&
          Number.isFinite(row.high) &&
          Number.isFinite(row.low) &&
          Number.isFinite(row.close),
      )
      .sort((a, b) => a.ts - b.ts);

    if (candles.length === 0) break;

    for (const candle of candles) {
      if (candle.ts >= fromUtc.toMillis() && candle.ts < toUtc.toMillis()) {
        all.set(candle.ts, candle);
      }
    }

    const lastTs = candles[candles.length - 1]!.ts;
    const nextTs = lastTs + stepMs;
    if (nextTs <= cursor.toMillis()) break;
    cursor = DateTime.fromMillis(nextTs, { zone: "utc" });
  }

  const out = Array.from(all.values()).sort((a, b) => a.ts - b.ts);
  writeFileSync(cachePath, JSON.stringify({ candles: out }));
  return out;
}

function aggregateCandles(m5Candles: OhlcCandle[], bucketMinutes: number): OhlcCandle[] {
  if (bucketMinutes === 5) return m5Candles;
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, OhlcCandle>();
  for (const candle of m5Candles) {
    const bucketTs = Math.floor(candle.ts / bucketMs) * bucketMs;
    const existing = buckets.get(bucketTs);
    if (!existing) {
      buckets.set(bucketTs, {
        ts: bucketTs,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

function computeRsi(closes: number[], length: number) {
  const out: Array<number | null> = Array.from({ length: closes.length }, () => null);
  if (closes.length <= length) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= length; i += 1) {
    const change = closes[i] - closes[i - 1];
    gainSum += Math.max(change, 0);
    lossSum += Math.max(-change, 0);
  }

  let avgGain = gainSum / length;
  let avgLoss = lossSum / length;
  out[length] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = length + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = ((avgGain * (length - 1)) + gain) / length;
    avgLoss = ((avgLoss * (length - 1)) + loss) / length;
    out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  return out;
}

function computeSma(values: Array<number | null>, length: number) {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i += 1) {
    const current = values[i];
    if (current !== null) {
      sum += current;
      count += 1;
    }
    const remove = i >= length ? values[i - length] : null;
    if (remove !== null) {
      sum -= remove;
      count -= 1;
    }
    if (i >= length - 1 && count === length) {
      out[i] = sum / length;
    }
  }

  return out;
}

function computeSlowStochasticD(candles: OhlcCandle[]) {
  const stochRaw: Array<number | null> = Array.from({ length: candles.length }, () => null);

  for (let i = 0; i < candles.length; i += 1) {
    if (i < STOCHASTIC_K_LENGTH - 1) continue;
    const window = candles.slice(i - STOCHASTIC_K_LENGTH + 1, i + 1);
    const lowestLow = Math.min(...window.map((candle) => candle.low));
    const highestHigh = Math.max(...window.map((candle) => candle.high));
    const range = highestHigh - lowestLow;
    stochRaw[i] = range === 0 ? 0 : ((candles[i].close - lowestLow) / range) * 100;
  }

  const slowK = computeSma(stochRaw, STOCHASTIC_K_SMOOTHING);
  return computeSma(slowK, STOCHASTIC_D_SMOOTHING);
}

function buildTimeframeData(m5Candles: OhlcCandle[]): TimeframeDataset[] {
  return TIMEFRAMES.map((row) => {
    const candles = aggregateCandles(m5Candles, row.minutes);
    return {
      timeframe: row.id,
      minutes: row.minutes,
      candles,
      triggerLine: computeSlowStochasticD(candles),
    };
  });
}

function isOversold(direction: Exclude<Direction, "NEUTRAL">, value: number | null) {
  if (value === null) return false;
  return direction === "LONG" ? value < OVERSOLD_LEVEL : value > OVERBOUGHT_LEVEL;
}

function isEngulfing(
  direction: Exclude<Direction, "NEUTRAL">,
  previous: OhlcCandle | undefined,
  current: OhlcCandle | undefined,
) {
  if (!previous || !current) return false;
  return direction === "LONG"
    ? current.close > previous.high
    : current.close < previous.low;
}

function searchCandidatesOnTimeframe(
  dataset: TimeframeDataset,
  direction: Exclude<Direction, "NEUTRAL">,
  sessionStartMs: number,
  sessionEndMs: number,
) {
  const candidates: CandidateEntry[] = [];
  const tfMs = dataset.minutes * 60 * 1000;

  let armed = false;
  let activeFromTs = sessionStartMs;
  let activeSignalValue: number | null = null;
  for (let index = 0; index < dataset.candles.length; index += 1) {
    const candle = dataset.candles[index];
    const closeTs = candle.ts + tfMs;
    if (closeTs > sessionStartMs) {
      const previousValue = index > 0 ? dataset.triggerLine[index - 1] : null;
      armed = isOversold(direction, previousValue);
      if (armed) {
        activeFromTs = sessionStartMs;
        activeSignalValue = previousValue;
      }
      break;
    }
    armed = isOversold(direction, dataset.triggerLine[index]);
    if (armed) {
      activeFromTs = closeTs;
      activeSignalValue = dataset.triggerLine[index];
    }
  }

  for (let index = 0; index < dataset.candles.length; index += 1) {
    const candle = dataset.candles[index];
    const closeTs = candle.ts + tfMs;
    if (closeTs < sessionStartMs) continue;
    if (closeTs >= sessionEndMs) break;

    const currentValue = dataset.triggerLine[index];
    if (armed && isEngulfing(direction, dataset.candles[index - 1], candle)) {
      candidates.push({
        timeframe: dataset.timeframe,
        activeFromTs,
        signalCandleTs: dataset.candles[index - 1]?.ts ?? candle.ts,
        entryTs: closeTs,
        entryPrice: candle.close,
        signalValue: round(activeSignalValue ?? currentValue ?? Number.NaN, 4),
      });
      armed = false;
      activeSignalValue = null;
      continue;
    }

    if (isOversold(direction, currentValue)) {
      armed = true;
      activeFromTs = closeTs;
      activeSignalValue = currentValue;
    }
  }

  return candidates;
}

function candidateSort(a: CandidateEntry, b: CandidateEntry) {
  if (a.entryTs !== b.entryTs) return a.entryTs - b.entryTs;
  return timeframeMinutes(a.timeframe) - timeframeMinutes(b.timeframe);
}

async function resolveCandidateForSession(params: {
  datasets: TimeframeDataset[];
  direction: Exclude<Direction, "NEUTRAL">;
  sessionStartMs: number;
  sessionEndMs: number;
  sessionStartUtc: string;
  gateMode: GateMode;
  weekMap: Map<string, WeeklyMatrixRow>;
  pair: string;
  timePolicy: TimePolicy;
}) {
  const {
    datasets,
    direction,
    sessionStartMs,
    sessionEndMs,
    sessionStartUtc,
    gateMode,
    weekMap,
    pair,
    timePolicy,
  } = params;

  const passesGate = async (candidate: CandidateEntry) => {
    if (gateMode === "UNGATED") {
      return {
        allowed: true,
        frozenDirection: null,
        liveDirection: null,
      };
    }

    if (gateMode === "FROZEN") {
      const snapshot = await loadGateSnapshotAt(sessionStartUtc, weekMap);
      const frozenDirection = snapshot.byPair.get(pair) ?? "NEUTRAL";
      return {
        allowed: frozenDirection === direction,
        frozenDirection,
        liveDirection: null,
      };
    }

    const snapshot = await loadGateSnapshotAt(
      DateTime.fromMillis(candidate.entryTs, { zone: "utc" }).toISO() ?? sessionStartUtc,
      weekMap,
    );
    const liveDirection = snapshot.byPair.get(pair) ?? "NEUTRAL";
    return {
      allowed: liveDirection === direction,
      frozenDirection: null,
      liveDirection,
    };
  };

  const allCandidates = datasets
    .flatMap((dataset) => searchCandidatesOnTimeframe(dataset, direction, sessionStartMs, sessionEndMs))
    .sort(candidateSort);

  let selected: CandidateEntry | null = null;
  if (timePolicy === "LOWER_TIMEFRAME_REPLACE") {
    selected = allCandidates[0] ?? null;
  } else {
    for (const candidate of allCandidates) {
      const hasHigherTimeframeBlock = allCandidates.some((other) =>
        timeframeMinutes(other.timeframe) > timeframeMinutes(candidate.timeframe) &&
        other.activeFromTs <= candidate.entryTs,
      );
      if (!hasHigherTimeframeBlock) {
        selected = candidate;
        break;
      }
    }
  }

  if (!selected) return null;

  const gate = await passesGate(selected);
  if (!gate.allowed) return null;

  return {
    candidate: selected,
    frozenGateDirection: gate.frozenDirection,
    liveGateDirection: gate.liveDirection,
  };
}

function lastCloseBefore(candles: OhlcCandle[], exitTs: number) {
  let last: OhlcCandle | null = null;
  for (const candle of candles) {
    const closeTs = candle.ts + (5 * 60 * 1000);
    if (closeTs > exitTs) break;
    last = candle;
  }
  return last;
}

function computeTradeMetrics(
  direction: Exclude<Direction, "NEUTRAL">,
  m5Candles: OhlcCandle[],
  entryTs: number,
  entryPrice: number,
  exitTs: number,
): TradeMetrics {
  const pathCandles = m5Candles.filter((candle) => {
    const closeTs = candle.ts + (5 * 60 * 1000);
    return closeTs > entryTs && closeTs <= exitTs;
  });

  const exitCandle = lastCloseBefore(m5Candles, exitTs);
  if (!exitCandle) {
    return {
      exitPrice: null,
      returnPct: null,
      maePct: null,
      mfePct: null,
    };
  }

  const exitPrice = exitCandle.close;
  let maePct = 0;
  let mfePct = 0;

  for (const candle of pathCandles) {
    if (direction === "LONG") {
      maePct = Math.max(maePct, ((entryPrice - candle.low) / entryPrice) * 100);
      mfePct = Math.max(mfePct, ((candle.high - entryPrice) / entryPrice) * 100);
    } else {
      maePct = Math.max(maePct, ((candle.high - entryPrice) / entryPrice) * 100);
      mfePct = Math.max(mfePct, ((entryPrice - candle.low) / entryPrice) * 100);
    }
  }

  const returnPct = direction === "LONG"
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;

  return {
    exitPrice: round(exitPrice),
    returnPct: round(returnPct, 4),
    maePct: round(Math.max(maePct, 0), 4),
    mfePct: round(Math.max(mfePct, 0), 4),
  };
}

function buildConfirmedH4Swings(h4Candles: OhlcCandle[]) {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  const tfMs = 4 * 60 * 60 * 1000;

  for (let i = 2; i < h4Candles.length - 2; i += 1) {
    const current = h4Candles[i];
    const isHigh =
      current.high > h4Candles[i - 1].high &&
      current.high > h4Candles[i - 2].high &&
      current.high > h4Candles[i + 1].high &&
      current.high > h4Candles[i + 2].high;
    const isLow =
      current.low < h4Candles[i - 1].low &&
      current.low < h4Candles[i - 2].low &&
      current.low < h4Candles[i + 1].low &&
      current.low < h4Candles[i + 2].low;
    const confirmedTs = h4Candles[i + 2].ts + tfMs;

    if (isHigh) {
      highs.push({
        level: current.high,
        swingTs: current.ts,
        confirmedTs,
      });
    }
    if (isLow) {
      lows.push({
        level: current.low,
        swingTs: current.ts,
        confirmedTs,
      });
    }
  }

  return { highs, lows };
}

function resolveSwingTarget(params: {
  direction: Exclude<Direction, "NEUTRAL">;
  entryTs: number;
  entryPrice: number;
  swings: ReturnType<typeof buildConfirmedH4Swings>;
}) {
  const { direction, entryTs, entryPrice, swings } = params;
  if (direction === "LONG") {
    const candidates = swings.highs
      .filter((swing) => swing.confirmedTs <= entryTs && swing.level > entryPrice)
      .sort((a, b) => a.level - b.level);
    return candidates[0] ?? null;
  }
  const candidates = swings.lows
    .filter((swing) => swing.confirmedTs <= entryTs && swing.level < entryPrice)
    .sort((a, b) => b.level - a.level);
  return candidates[0] ?? null;
}

function simulateSwingTpNoSlTrade(params: {
  trade: ManualTrade;
  m5Candles: OhlcCandle[];
  h4Candles: OhlcCandle[];
}): SwingTpTradeResult {
  const { trade, m5Candles, h4Candles } = params;
  const entryTs = DateTime.fromISO(trade.entryTimeUtc, { zone: "utc" }).toMillis();
  const weekEndTs = DateTime.fromISO(trade.weekEndUtc, { zone: "utc" }).toMillis();
  const swings = buildConfirmedH4Swings(h4Candles);
  const target = resolveSwingTarget({
    direction: trade.weeklyDirection,
    entryTs,
    entryPrice: trade.entryPrice,
    swings,
  });

  const pathCandles = m5Candles.filter((candle) => {
    const closeTs = candle.ts + (5 * 60 * 1000);
    return closeTs > entryTs && closeTs <= weekEndTs;
  });

  let exitReason: "SWING_TP" | "WEEK_CLOSE" | "NO_TARGET_WEEK_CLOSE" = target ? "WEEK_CLOSE" : "NO_TARGET_WEEK_CLOSE";
  let exitPrice: number | null = null;
  let exitTs: number | null = null;
  let maePct = 0;
  let mfePct = 0;

  for (const candle of pathCandles) {
    const closeTs = candle.ts + (5 * 60 * 1000);
    if (trade.weeklyDirection === "LONG") {
      maePct = Math.max(maePct, ((trade.entryPrice - candle.low) / trade.entryPrice) * 100);
      mfePct = Math.max(mfePct, ((candle.high - trade.entryPrice) / trade.entryPrice) * 100);
    } else {
      maePct = Math.max(maePct, ((candle.high - trade.entryPrice) / trade.entryPrice) * 100);
      mfePct = Math.max(mfePct, ((trade.entryPrice - candle.low) / trade.entryPrice) * 100);
    }

    if (!target) continue;

    const targetTouched = trade.weeklyDirection === "LONG"
      ? candle.high >= target.level
      : candle.low <= target.level;
    if (targetTouched) {
      exitReason = "SWING_TP";
      exitPrice = target.level;
      exitTs = closeTs;
      break;
    }
  }

  if (exitPrice === null) {
    const exitCandle = lastCloseBefore(m5Candles, weekEndTs);
    if (!exitCandle) {
      return {
        variantId: trade.variantId,
        pair: trade.pair,
        gateMode: trade.gateMode,
        timePolicy: trade.timePolicy,
        entryTimeUtc: trade.entryTimeUtc,
        exitTimeUtc: null,
        exitReason,
        targetPrice: target ? round(target.level) : null,
        targetDistancePct: target ? round(Math.abs((target.level - trade.entryPrice) / trade.entryPrice * 100), 4) : null,
        skippedDueToOpenTrade: false,
        exitPrice: null,
        returnPct: null,
        maePct: null,
        mfePct: null,
      };
    }
    exitPrice = exitCandle.close;
    exitTs = exitCandle.ts + (5 * 60 * 1000);
  }

  const returnPct = trade.weeklyDirection === "LONG"
    ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
    : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;

  return {
    variantId: trade.variantId,
    pair: trade.pair,
    gateMode: trade.gateMode,
    timePolicy: trade.timePolicy,
    entryTimeUtc: trade.entryTimeUtc,
    exitTimeUtc: exitTs ? DateTime.fromMillis(exitTs, { zone: "utc" }).toISO() ?? null : null,
    exitReason,
    targetPrice: target ? round(target.level) : null,
    targetDistancePct: target ? round(Math.abs((target.level - trade.entryPrice) / trade.entryPrice * 100), 4) : null,
    skippedDueToOpenTrade: false,
    exitPrice: round(exitPrice),
    returnPct: round(returnPct, 4),
    maePct: round(Math.max(maePct, 0), 4),
    mfePct: round(Math.max(mfePct, 0), 4),
  };
}

function simulateFixedExitTrade(
  direction: Exclude<Direction, "NEUTRAL">,
  m5Candles: OhlcCandle[],
  entryTs: number,
  entryPrice: number,
  horizonTs: number,
  stopLossPct: number,
  takeProfitPct: number,
): FixedExitTradeMetrics {
  const pathCandles = m5Candles.filter((candle) => {
    const closeTs = candle.ts + (5 * 60 * 1000);
    return closeTs > entryTs && closeTs <= horizonTs;
  });

  const stopPrice = direction === "LONG"
    ? entryPrice * (1 - stopLossPct / 100)
    : entryPrice * (1 + stopLossPct / 100);
  const takeProfitPrice = direction === "LONG"
    ? entryPrice * (1 + takeProfitPct / 100)
    : entryPrice * (1 - takeProfitPct / 100);

  let exitPrice: number | null = null;
  let exitTs: number | null = null;
  let exitReason: ExitReason | null = null;
  let maePct = 0;
  let mfePct = 0;

  for (const candle of pathCandles) {
    const closeTs = candle.ts + (5 * 60 * 1000);
    if (direction === "LONG") {
      maePct = Math.max(maePct, ((entryPrice - candle.low) / entryPrice) * 100);
      mfePct = Math.max(mfePct, ((candle.high - entryPrice) / entryPrice) * 100);
    } else {
      maePct = Math.max(maePct, ((candle.high - entryPrice) / entryPrice) * 100);
      mfePct = Math.max(mfePct, ((entryPrice - candle.low) / entryPrice) * 100);
    }

    const stopTouched = direction === "LONG"
      ? candle.low <= stopPrice
      : candle.high >= stopPrice;
    const targetTouched = direction === "LONG"
      ? candle.high >= takeProfitPrice
      : candle.low <= takeProfitPrice;

    // Conservative tie-break: if both levels are touched inside the same bar,
    // assume the stop is filled first.
    if (stopTouched) {
      exitPrice = stopPrice;
      exitTs = closeTs;
      exitReason = "STOP_LOSS";
      break;
    }
    if (targetTouched) {
      exitPrice = takeProfitPrice;
      exitTs = closeTs;
      exitReason = "TAKE_PROFIT";
      break;
    }
  }

  if (exitPrice === null) {
    const exitCandle = lastCloseBefore(m5Candles, horizonTs);
    if (!exitCandle) {
      return {
        exitPrice: null,
        returnPct: null,
        maePct: null,
        mfePct: null,
        exitReason: null,
        exitTimeUtc: null,
        stopLossPct,
        takeProfitPct,
      };
    }
    exitPrice = exitCandle.close;
    exitTs = exitCandle.ts + (5 * 60 * 1000);
    exitReason = "TIME_EXIT";
  }

  const returnPct = direction === "LONG"
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;

  return {
    exitPrice: round(exitPrice),
    returnPct: round(returnPct, 4),
    maePct: round(Math.max(maePct, 0), 4),
    mfePct: round(Math.max(mfePct, 0), 4),
    exitReason,
    exitTimeUtc: exitTs ? DateTime.fromMillis(exitTs, { zone: "utc" }).toISO() ?? null : null,
    stopLossPct,
    takeProfitPct,
  };
}

function buildSessionWindowsForWeek(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekEnd = weekOpen.plus({ weeks: 1 });
  const windows: Array<{
    session: SessionName;
    sessionStart: DateTime;
    sessionEnd: DateTime;
  }> = [];

  let cursor = weekOpen.startOf("day");
  while (cursor < weekEnd) {
    for (const session of Object.keys(SESSION_WINDOWS_UTC) as SessionName[]) {
      const config = SESSION_WINDOWS_UTC[session];
      const rawStart = cursor.set({
        hour: config.startHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      const rawEnd = cursor.set({
        hour: config.endHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      const sessionStart = rawStart < weekOpen ? weekOpen : rawStart;
      const sessionEnd = rawEnd > weekEnd ? weekEnd : rawEnd;
      if (sessionEnd > sessionStart && sessionEnd > weekOpen && sessionStart < weekEnd) {
        windows.push({ session, sessionStart, sessionEnd });
      }
    }
    cursor = cursor.plus({ days: 1 });
  }

  return windows.sort((a, b) => a.sessionStart.toMillis() - b.sessionStart.toMillis());
}

function summarizeVariant(trades: ManualTrade[]): VariantSummary {
  const sample = trades[0];
  if (!sample) {
    throw new Error("summarizeVariant requires at least one trade.");
  }
  const sessionReturns = trades
    .map((trade) => trade.sessionMetrics.returnPct)
    .filter((value): value is number => value !== null);
  const weekReturns = trades
    .map((trade) => trade.weekMetrics.returnPct)
    .filter((value): value is number => value !== null);
  const sessionMaes = trades
    .map((trade) => trade.sessionMetrics.maePct)
    .filter((value): value is number => value !== null);
  const sessionMfes = trades
    .map((trade) => trade.sessionMetrics.mfePct)
    .filter((value): value is number => value !== null);
  const weekMaes = trades
    .map((trade) => trade.weekMetrics.maePct)
    .filter((value): value is number => value !== null);
  const weekMfes = trades
    .map((trade) => trade.weekMetrics.mfePct)
    .filter((value): value is number => value !== null);

  const aggregate = <T extends string>(
    items: ManualTrade[],
    keyFn: (trade: ManualTrade) => T,
  ) => {
    const map = new Map<T, ManualTrade[]>();
    for (const trade of items) {
      const key = keyFn(trade);
      const bucket = map.get(key) ?? [];
      bucket.push(trade);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([key, bucket]) => ({
      key,
      trades: bucket.length,
      avgSessionReturnPct: round(
        safeAverage(
          bucket
            .map((trade) => trade.sessionMetrics.returnPct)
            .filter((value): value is number => value !== null),
        ),
        4,
      ),
      avgWeekMaePct: round(
        safeAverage(
          bucket
            .map((trade) => trade.weekMetrics.maePct)
            .filter((value): value is number => value !== null),
        ),
        4,
      ),
    }));
  };

  return {
    id: sample.variantId,
    gateMode: sample.gateMode,
    timePolicy: sample.timePolicy,
    strengthMode: sample.strengthMode,
    strengthThreshold: sample.strengthThreshold,
    trades: trades.length,
    winRateSessionClosePct: round(
      sessionReturns.length === 0
        ? 0
        : (sessionReturns.filter((value) => value > 0).length / sessionReturns.length) * 100,
      2,
    ),
    avgSessionReturnPct: round(safeAverage(sessionReturns), 4),
    medianSessionReturnPct: round(median(sessionReturns), 4),
    avgWeekReturnPct: round(safeAverage(weekReturns), 4),
    medianWeekReturnPct: round(median(weekReturns), 4),
    avgSessionMaePct: round(safeAverage(sessionMaes), 4),
    p95SessionMaePct: round(percentile(sessionMaes, 95), 4),
    avgSessionMfePct: round(safeAverage(sessionMfes), 4),
    p95SessionMfePct: round(percentile(sessionMfes, 95), 4),
    avgWeekMaePct: round(safeAverage(weekMaes), 4),
    p95WeekMaePct: round(percentile(weekMaes, 95), 4),
    avgWeekMfePct: round(safeAverage(weekMfes), 4),
    p95WeekMfePct: round(percentile(weekMfes, 95), 4),
    worstWeekMaePct: round(weekMaes.length === 0 ? 0 : Math.max(...weekMaes), 4),
    byTimeframe: aggregate(trades, (trade) => trade.triggerTimeframe)
      .sort((a, b) => timeframeMinutes(b.key) - timeframeMinutes(a.key))
      .map((row) => ({
        timeframe: row.key as TimeframeId,
        trades: row.trades,
        avgSessionReturnPct: row.avgSessionReturnPct,
        avgWeekMaePct: row.avgWeekMaePct,
      })),
    bySession: aggregate(trades, (trade) => trade.session)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((row) => ({
        session: row.key as SessionName,
        trades: row.trades,
        avgSessionReturnPct: row.avgSessionReturnPct,
        avgWeekMaePct: row.avgWeekMaePct,
      })),
    byPair: aggregate(trades, (trade) => trade.pair)
      .sort((a, b) => {
        if (b.trades !== a.trades) return b.trades - a.trades;
        return a.key.localeCompare(b.key);
      })
      .map((row) => ({
        pair: row.key,
        trades: row.trades,
        avgSessionReturnPct: row.avgSessionReturnPct,
        avgWeekMaePct: row.avgWeekMaePct,
      })),
  };
}

function summarizeExitSweeps(
  trades: ManualTrade[],
  rawM5ByPair: Map<string, OhlcCandle[]>,
): ExitSweepSummary[] {
  const grouped = new Map<string, ManualTrade[]>();
  for (const trade of trades) {
    const id = trade.variantId;
    const bucket = grouped.get(id) ?? [];
    bucket.push(trade);
    grouped.set(id, bucket);
  }

  const out: ExitSweepSummary[] = [];
  for (const [id, variantTrades] of grouped.entries()) {
    const sample = variantTrades[0];
    const gateMode = sample?.gateMode;
    const timePolicy = sample?.timePolicy;
    if (!sample || !gateMode || !timePolicy) continue;

    for (const horizon of ["SESSION_CLOSE", "WEEK_CLOSE"] as ExitHorizon[]) {
      for (const stopLossPct of FIXED_STOP_LOSS_PCTS) {
        for (const takeProfitPct of FIXED_TAKE_PROFIT_PCTS) {
          const metrics = variantTrades
            .map((trade) => {
              const candles = rawM5ByPair.get(pairKey(trade.assetClass, trade.pair));
              if (!candles) return null;
              const entryTs = DateTime.fromISO(trade.entryTimeUtc, { zone: "utc" }).toMillis();
              const horizonTs = DateTime.fromISO(
                horizon === "SESSION_CLOSE" ? trade.sessionEndUtc : trade.weekEndUtc,
                { zone: "utc" },
              ).toMillis();
              return simulateFixedExitTrade(
                trade.weeklyDirection,
                candles,
                entryTs,
                trade.entryPrice,
                horizonTs,
                stopLossPct,
                takeProfitPct,
              );
            })
            .filter((value): value is FixedExitTradeMetrics => value !== null && value.returnPct !== null);

          const returns = metrics.map((row) => row.returnPct as number);
          const maes = metrics.map((row) => row.maePct).filter((value): value is number => value !== null);
          const mfes = metrics.map((row) => row.mfePct).filter((value): value is number => value !== null);
          const stopHits = metrics.filter((row) => row.exitReason === "STOP_LOSS").length;
          const takeProfitHits = metrics.filter((row) => row.exitReason === "TAKE_PROFIT").length;
          const timeExits = metrics.filter((row) => row.exitReason === "TIME_EXIT").length;
          const grossWins = returns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
          const grossLosses = Math.abs(returns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));

          out.push({
            variantId: id,
            gateMode,
            timePolicy,
            strengthMode: sample.strengthMode,
            strengthThreshold: sample.strengthThreshold,
            horizon,
            stopLossPct,
            takeProfitPct,
            trades: metrics.length,
            winRatePct: round(
              metrics.length === 0 ? 0 : (returns.filter((value) => value > 0).length / metrics.length) * 100,
              2,
            ),
            avgReturnPct: round(safeAverage(returns), 4),
            medianReturnPct: round(median(returns), 4),
            avgMaePct: round(safeAverage(maes), 4),
            p95MaePct: round(percentile(maes, 95), 4),
            avgMfePct: round(safeAverage(mfes), 4),
            p95MfePct: round(percentile(mfes, 95), 4),
            stopHitPct: round(metrics.length === 0 ? 0 : (stopHits / metrics.length) * 100, 2),
            takeProfitHitPct: round(metrics.length === 0 ? 0 : (takeProfitHits / metrics.length) * 100, 2),
            timeExitPct: round(metrics.length === 0 ? 0 : (timeExits / metrics.length) * 100, 2),
            expectancyPct: round(safeAverage(returns), 4),
            profitFactor: round(grossLosses === 0 ? grossWins : grossWins / grossLosses, 4),
          });
        }
      }
    }
  }

  return out.sort((a, b) => {
    if (a.variantId !== b.variantId) return a.variantId.localeCompare(b.variantId);
    if (a.horizon !== b.horizon) return a.horizon.localeCompare(b.horizon);
    if (a.avgReturnPct !== b.avgReturnPct) return b.avgReturnPct - a.avgReturnPct;
    if (a.stopLossPct !== b.stopLossPct) return a.stopLossPct - b.stopLossPct;
    return a.takeProfitPct - b.takeProfitPct;
  });
}

function summarizeSwingTpResearch(
  trades: ManualTrade[],
  rawM5ByPair: Map<string, OhlcCandle[]>,
  datasetsByPair: Map<string, TimeframeDataset[]>,
): SwingTpSummary[] {
  const lockModes = ["PAIR", "PAIR_SESSION"] as const;
  const baselineTrades = trades.filter((trade) => trade.strengthMode === "BASELINE");
  const grouped = new Map<string, ManualTrade[]>();
  for (const trade of baselineTrades) {
    const bucket = grouped.get(trade.variantId) ?? [];
    bucket.push(trade);
    grouped.set(trade.variantId, bucket);
  }

  const summaries: SwingTpSummary[] = [];
  for (const [variantIdValue, variantTrades] of grouped.entries()) {
    const sample = variantTrades[0];
    if (!sample) continue;

    for (const lockMode of lockModes) {
      const simulated: SwingTpTradeResult[] = [];
      let skipped = 0;

      const groupedTrades = new Map<string, ManualTrade[]>();
      for (const trade of variantTrades) {
        const key = lockMode === "PAIR"
          ? trade.pair
          : `${trade.pair}|${trade.session}`;
        const bucket = groupedTrades.get(key) ?? [];
        bucket.push(trade);
        groupedTrades.set(key, bucket);
      }

      for (const [, lockGroupTrades] of groupedTrades.entries()) {
        const sortedTrades = [...lockGroupTrades].sort((a, b) => a.entryTimeUtc.localeCompare(b.entryTimeUtc));
        let nextAvailableTs = Number.NEGATIVE_INFINITY;

        for (const trade of sortedTrades) {
          const entryTs = DateTime.fromISO(trade.entryTimeUtc, { zone: "utc" }).toMillis();
          if (entryTs < nextAvailableTs) {
            skipped += 1;
            continue;
          }

          const key = pairKey(trade.assetClass, trade.pair);
          const m5Candles = rawM5ByPair.get(key);
          const h4Candles = datasetsByPair.get(key)?.find((dataset) => dataset.timeframe === "H4")?.candles;
          if (!m5Candles || !h4Candles) continue;

          const result = simulateSwingTpNoSlTrade({
            trade,
            m5Candles,
            h4Candles,
          });
          simulated.push(result);

          const exitTs = result.exitTimeUtc
            ? DateTime.fromISO(result.exitTimeUtc, { zone: "utc" }).toMillis()
            : Number.POSITIVE_INFINITY;
          nextAvailableTs = exitTs;
        }
      }

      const returns = simulated.map((row) => row.returnPct).filter((value): value is number => value !== null);
      const maes = simulated.map((row) => row.maePct).filter((value): value is number => value !== null);
      const mfes = simulated.map((row) => row.mfePct).filter((value): value is number => value !== null);
      const targetDistances = simulated
        .map((row) => row.targetDistancePct)
        .filter((value): value is number => value !== null);
      const swingHits = simulated.filter((row) => row.exitReason === "SWING_TP").length;
      const noTarget = simulated.filter((row) => row.exitReason === "NO_TARGET_WEEK_CLOSE").length;
      const weekFallback = simulated.filter((row) => row.exitReason === "WEEK_CLOSE").length;
      const grossWins = returns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
      const grossLosses = Math.abs(returns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));

      summaries.push({
        variantId: variantIdValue,
        gateMode: sample.gateMode,
        timePolicy: sample.timePolicy,
        lockMode,
        tradesConsidered: variantTrades.length,
        tradesTaken: simulated.length,
        tradesSkippedDueToOpenTrade: skipped,
        swingTargetHitPct: round(simulated.length === 0 ? 0 : (swingHits / simulated.length) * 100, 2),
        noTargetPct: round(simulated.length === 0 ? 0 : (noTarget / simulated.length) * 100, 2),
        weekCloseFallbackPct: round(simulated.length === 0 ? 0 : (weekFallback / simulated.length) * 100, 2),
        avgReturnPct: round(safeAverage(returns), 4),
        medianReturnPct: round(median(returns), 4),
        avgMaePct: round(safeAverage(maes), 4),
        p95MaePct: round(percentile(maes, 95), 4),
        avgMfePct: round(safeAverage(mfes), 4),
        p95MfePct: round(percentile(mfes, 95), 4),
        avgTargetDistancePct: round(safeAverage(targetDistances), 4),
        p95TargetDistancePct: round(percentile(targetDistances, 95), 4),
        winRatePct: round(simulated.length === 0 ? 0 : (returns.filter((value) => value > 0).length / simulated.length) * 100, 2),
        profitFactor: round(grossLosses === 0 ? grossWins : grossWins / grossLosses, 4),
      });
    }
  }

  return summaries.sort((a, b) => {
    if (a.variantId !== b.variantId) return a.variantId.localeCompare(b.variantId);
    return a.lockMode.localeCompare(b.lockMode);
  });
}

function buildPairInfoLookup() {
  const map = new Map<string, PairInfo>();
  for (const [assetClass, pairs] of Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, typeof PAIRS_BY_ASSET_CLASS[AssetClass]]>) {
    for (const def of pairs) {
      map.set(pairKey(assetClass, def.pair), {
        assetClass,
        pair: def.pair,
        base: def.base,
        quote: def.quote,
      });
    }
  }
  return map;
}

function computeAtr14PctAtEntry(h4Candles: OhlcCandle[], entryTs: number, entryPrice: number) {
  const completed = h4Candles.filter((candle) => candle.ts + (4 * 60 * 60 * 1000) <= entryTs);
  if (completed.length < 15 || entryPrice <= 0) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < completed.length; i += 1) {
    const current = completed[i];
    const prevClose = completed[i - 1].close;
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - prevClose),
        Math.abs(current.low - prevClose),
      ),
    );
  }

  if (trueRanges.length < 14) return null;
  const atr = safeAverage(trueRanges.slice(-14));
  return round((atr / entryPrice) * 100, 4);
}

function buildSwingTpExecutions(params: {
  trades: ManualTrade[];
  rawM5ByPair: Map<string, OhlcCandle[]>;
  datasetsByPair: Map<string, TimeframeDataset[]>;
  pairInfoLookup: Map<string, PairInfo>;
  variantId: string;
  lockMode: SwingTpLockMode;
  assetClass?: AssetClass;
}): SwingTpExecution[] {
  const {
    trades,
    rawM5ByPair,
    datasetsByPair,
    pairInfoLookup,
    variantId,
    lockMode,
    assetClass,
  } = params;

  const baselineTrades = trades.filter((trade) =>
    trade.strengthMode === "BASELINE" &&
    trade.variantId === variantId &&
    (assetClass ? trade.assetClass === assetClass : true));

  const groupedTrades = new Map<string, ManualTrade[]>();
  for (const trade of baselineTrades) {
    const key = lockMode === "PAIR" ? trade.pair : `${trade.pair}|${trade.session}`;
    const bucket = groupedTrades.get(key) ?? [];
    bucket.push(trade);
    groupedTrades.set(key, bucket);
  }

  const executions: SwingTpExecution[] = [];
  for (const lockGroupTrades of groupedTrades.values()) {
    const sortedTrades = [...lockGroupTrades].sort((a, b) => a.entryTimeUtc.localeCompare(b.entryTimeUtc));
    let nextAvailableTs = Number.NEGATIVE_INFINITY;

    for (const trade of sortedTrades) {
      const entryTs = DateTime.fromISO(trade.entryTimeUtc, { zone: "utc" }).toMillis();
      if (entryTs < nextAvailableTs) continue;

      const key = pairKey(trade.assetClass, trade.pair);
      const m5Candles = rawM5ByPair.get(key);
      const h4Candles = datasetsByPair.get(key)?.find((dataset) => dataset.timeframe === "H4")?.candles;
      const pairInfo = pairInfoLookup.get(key);
      if (!m5Candles || !h4Candles || !pairInfo) continue;

      const result = simulateSwingTpNoSlTrade({ trade, m5Candles, h4Candles });
      if (
        result.returnPct === null ||
        result.maePct === null ||
        result.mfePct === null ||
        result.exitPrice === null ||
        result.exitTimeUtc === null
      ) {
        continue;
      }

      const exitTs = DateTime.fromISO(result.exitTimeUtc, { zone: "utc" }).toMillis();
      const atr14Pct = computeAtr14PctAtEntry(h4Candles, entryTs, trade.entryPrice);

      executions.push({
        variantId,
        lockMode,
        pair: trade.pair,
        assetClass: trade.assetClass,
        session: trade.session,
        weekLabel: trade.weekLabel,
        base: pairInfo.base,
        quote: pairInfo.quote,
        direction: trade.weeklyDirection,
        entryTs,
        exitTs,
        entryPrice: trade.entryPrice,
        exitPrice: result.exitPrice,
        exitReason: result.exitReason,
        targetPrice: result.targetPrice,
        targetDistancePct: result.targetDistancePct,
        returnPct: result.returnPct,
        maePct: result.maePct,
        mfePct: result.mfePct,
        atr14Pct,
      });

      nextAvailableTs = exitTs;
    }
  }

  return executions.sort((a, b) => a.entryTs - b.entryTs);
}

function simulateSwingTpWithCatastrophicStop(params: {
  execution: SwingTpExecution;
  m5Candles: OhlcCandle[];
  stopLossPct: number;
}): SwingTpExecution | null {
  const { execution, m5Candles, stopLossPct } = params;
  const pathCandles = m5Candles.filter((candle) => {
    const closeTs = candle.ts + (5 * 60 * 1000);
    return closeTs > execution.entryTs && closeTs <= execution.exitTs;
  });

  const stopPrice = execution.direction === "LONG"
    ? execution.entryPrice * (1 - stopLossPct / 100)
    : execution.entryPrice * (1 + stopLossPct / 100);

  let exitPrice = execution.exitPrice;
  let exitTs = execution.exitTs;
  let exitReason = execution.exitReason;
  let maePct = 0;
  let mfePct = 0;

  for (const candle of pathCandles) {
    const closeTs = candle.ts + (5 * 60 * 1000);
    if (execution.direction === "LONG") {
      maePct = Math.max(maePct, ((execution.entryPrice - candle.low) / execution.entryPrice) * 100);
      mfePct = Math.max(mfePct, ((candle.high - execution.entryPrice) / execution.entryPrice) * 100);
    } else {
      maePct = Math.max(maePct, ((candle.high - execution.entryPrice) / execution.entryPrice) * 100);
      mfePct = Math.max(mfePct, ((execution.entryPrice - candle.low) / execution.entryPrice) * 100);
    }

    const stopTouched = execution.direction === "LONG"
      ? candle.low <= stopPrice
      : candle.high >= stopPrice;
    const targetTouched = execution.targetPrice === null
      ? false
      : execution.direction === "LONG"
        ? candle.high >= execution.targetPrice
        : candle.low <= execution.targetPrice;

    if (stopTouched) {
      exitPrice = stopPrice;
      exitTs = closeTs;
      exitReason = "WEEK_CLOSE";
      break;
    }

    if (targetTouched) {
      exitPrice = execution.targetPrice ?? exitPrice;
      exitTs = closeTs;
      exitReason = "SWING_TP";
      break;
    }
  }

  const returnPct = execution.direction === "LONG"
    ? ((exitPrice - execution.entryPrice) / execution.entryPrice) * 100
    : ((execution.entryPrice - exitPrice) / execution.entryPrice) * 100;

  return {
    ...execution,
    exitTs,
    exitPrice: round(exitPrice),
    exitReason,
    returnPct: round(returnPct, 4),
    maePct: round(Math.max(maePct, execution.maePct), 4),
    mfePct: round(Math.max(mfePct, execution.mfePct), 4),
  };
}

function currentReturnPctForTrade(execution: SwingTpExecution, currentClose: number) {
  return execution.direction === "LONG"
    ? ((currentClose - execution.entryPrice) / execution.entryPrice) * 100
    : ((execution.entryPrice - currentClose) / execution.entryPrice) * 100;
}

function buildCloseMap(m5Candles: OhlcCandle[]) {
  const map = new Map<number, number>();
  for (const candle of m5Candles) {
    map.set(candle.ts + (5 * 60 * 1000), candle.close);
  }
  return map;
}

function resolveSessionBucket(ts: number) {
  const dt = DateTime.fromMillis(ts, { zone: "utc" });
  for (const session of Object.keys(SESSION_WINDOWS_UTC) as SessionName[]) {
    const config = SESSION_WINDOWS_UTC[session];
    const start = dt.startOf("day").set({ hour: config.startHour, minute: 0, second: 0, millisecond: 0 });
    const end = dt.startOf("day").set({ hour: config.endHour, minute: 0, second: 0, millisecond: 0 });
    if (dt >= start && dt < end) {
      return `${dt.toISODate()}|${session}`;
    }
  }
  return `${dt.toISODate()}|OUTSIDE`;
}

function buildCurrencyHeat(executions: SwingTpExecution[], sizeByTrade: Map<string, number>) {
  const heat = new Map<string, number>();
  for (const execution of executions) {
    const key = `${execution.pair}|${execution.entryTs}`;
    const size = sizeByTrade.get(key) ?? 0;
    const signed = execution.direction === "LONG" ? size : -size;
    heat.set(execution.base, (heat.get(execution.base) ?? 0) + signed);
    heat.set(execution.quote, (heat.get(execution.quote) ?? 0) - signed);
  }
  return Array.from(heat.entries())
    .map(([currency, netNotionalMultiple]) => ({
      currency,
      netNotionalMultiple: round(netNotionalMultiple, 4),
    }))
    .sort((a, b) => Math.abs(b.netNotionalMultiple) - Math.abs(a.netNotionalMultiple));
}

function simulatePortfolioModel(params: {
  executions: SwingTpExecution[];
  rawM5ByPair: Map<string, OhlcCandle[]>;
  sizeFn: (execution: SwingTpExecution) => number;
  modelId: string;
  label: string;
  sizingBasis: string;
  riskBudgetPct: number | null;
}): PortfolioSimulationSummary & ConcurrentExposureSummary {
  const { executions, rawM5ByPair, sizeFn, modelId, label, sizingBasis, riskBudgetPct } = params;
  if (executions.length === 0) {
    return {
      modelId,
      label,
      sizingBasis,
      riskBudgetPct,
      maxDrawdownPct: 0,
      finalEquity: POSITION_SIZING_ACCOUNT_USD,
      totalReturnPct: 0,
      worstWeekPnlPct: 0,
      maxConcurrentTrades: 0,
      maxConcurrentNotionalMultiple: 0,
      avgLotMultiple: 0,
      medianLotMultiple: 0,
      maxLotMultiple: 0,
      worstSessionDrawdownPct: 0,
      worstWeekDrawdownPct: 0,
      peakExposureDetails: [],
    };
  }

  const sizeByTrade = new Map<string, number>();
  const lotMultiples = executions.map((execution) => {
    const size = Math.max(sizeFn(execution), 0);
    sizeByTrade.set(`${execution.pair}|${execution.entryTs}`, size);
    return size;
  });

  const pairCloseMaps = new Map<string, Map<number, number>>();
  for (const execution of executions) {
    const key = pairKey(execution.assetClass, execution.pair);
    if (!pairCloseMaps.has(key)) {
      const candles = rawM5ByPair.get(key) ?? [];
      pairCloseMaps.set(key, buildCloseMap(candles));
    }
  }

  const startTs = Math.min(...executions.map((execution) => execution.entryTs));
  const endTs = Math.max(...executions.map((execution) => execution.exitTs));
  const stepMs = 5 * 60 * 1000;
  const realizedByExitTs = new Map<number, number[]>();
  for (const execution of executions) {
    const size = sizeByTrade.get(`${execution.pair}|${execution.entryTs}`) ?? 0;
    const pnlUsd = POSITION_SIZING_ACCOUNT_USD * size * (execution.returnPct / 100);
    const bucket = realizedByExitTs.get(execution.exitTs) ?? [];
    bucket.push(pnlUsd);
    realizedByExitTs.set(execution.exitTs, bucket);
  }

  let realizedPnlUsd = 0;
  let peakEquity = POSITION_SIZING_ACCOUNT_USD;
  let maxDrawdownPct = 0;
  let maxConcurrentTrades = 0;
  let maxConcurrentNotionalMultiple = 0;
  const sessionWorst = new Map<string, number>();
  const weekWorst = new Map<string, number>();
  const peakExposureDetails: ConcurrentExposureSnapshot[] = [];

  for (let ts = startTs; ts <= endTs; ts += stepMs) {
    const realizedAtTs = realizedByExitTs.get(ts) ?? [];
    if (realizedAtTs.length > 0) {
      realizedPnlUsd += realizedAtTs.reduce((sum, value) => sum + value, 0);
    }

    const openExecutions = executions.filter((execution) => execution.entryTs <= ts && execution.exitTs > ts);
    let unrealizedPnlUsd = 0;
    let totalNotionalMultiple = 0;
    const tradableOpenExecutions: SwingTpExecution[] = [];

    for (const execution of openExecutions) {
      const key = pairKey(execution.assetClass, execution.pair);
      const closeMap = pairCloseMaps.get(key);
      const currentClose = closeMap?.get(ts);
      if (currentClose === undefined) continue;
      tradableOpenExecutions.push(execution);
      const size = sizeByTrade.get(`${execution.pair}|${execution.entryTs}`) ?? 0;
      totalNotionalMultiple += size;
      unrealizedPnlUsd += POSITION_SIZING_ACCOUNT_USD * size * (currentReturnPctForTrade(execution, currentClose) / 100);
    }

    const equity = POSITION_SIZING_ACCOUNT_USD + realizedPnlUsd + unrealizedPnlUsd;
    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct = peakEquity <= 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct);
    maxConcurrentTrades = Math.max(maxConcurrentTrades, tradableOpenExecutions.length);
    maxConcurrentNotionalMultiple = Math.max(maxConcurrentNotionalMultiple, totalNotionalMultiple);

    const unrealizedPct = (realizedPnlUsd + unrealizedPnlUsd) / POSITION_SIZING_ACCOUNT_USD * 100;
    const sessionBucket = resolveSessionBucket(ts);
    sessionWorst.set(sessionBucket, Math.min(sessionWorst.get(sessionBucket) ?? 0, unrealizedPct));
    const weekBucket = DateTime.fromMillis(ts, { zone: "utc" }).startOf("week").toISODate() ?? "unknown";
    weekWorst.set(weekBucket, Math.min(weekWorst.get(weekBucket) ?? 0, unrealizedPct));

    if (peakExposureDetails.length < 10 || totalNotionalMultiple > (peakExposureDetails[peakExposureDetails.length - 1]?.totalNotionalMultiple ?? -Infinity)) {
      peakExposureDetails.push({
        timestampUtc: DateTime.fromMillis(ts, { zone: "utc" }).toISO() ?? "",
        openTrades: tradableOpenExecutions.length,
        totalNotionalMultiple: round(totalNotionalMultiple, 4),
        openPairs: tradableOpenExecutions.map((execution) => execution.pair),
        currencyHeat: buildCurrencyHeat(tradableOpenExecutions, sizeByTrade).slice(0, 6),
      });
      peakExposureDetails.sort((a, b) => b.totalNotionalMultiple - a.totalNotionalMultiple);
      if (peakExposureDetails.length > 10) {
        peakExposureDetails.length = 10;
      }
    }
  }

  const finalPnlUsd = executions.reduce((sum, execution) => {
    const size = sizeByTrade.get(`${execution.pair}|${execution.entryTs}`) ?? 0;
    return sum + (POSITION_SIZING_ACCOUNT_USD * size * (execution.returnPct / 100));
  }, 0);

  return {
    modelId,
    label,
    sizingBasis,
    riskBudgetPct,
    maxDrawdownPct: round(maxDrawdownPct, 4),
    finalEquity: round(POSITION_SIZING_ACCOUNT_USD + finalPnlUsd, 2),
    totalReturnPct: round((finalPnlUsd / POSITION_SIZING_ACCOUNT_USD) * 100, 4),
    worstWeekPnlPct: round(Math.abs(Math.min(...weekWorst.values(), 0)), 4),
    maxConcurrentTrades,
    maxConcurrentNotionalMultiple: round(maxConcurrentNotionalMultiple, 4),
    avgLotMultiple: round(safeAverage(lotMultiples), 4),
    medianLotMultiple: round(median(lotMultiples), 4),
    maxLotMultiple: round(lotMultiples.length === 0 ? 0 : Math.max(...lotMultiples), 4),
    worstSessionDrawdownPct: round(Math.abs(Math.min(...sessionWorst.values(), 0)), 4),
    worstWeekDrawdownPct: round(Math.abs(Math.min(...weekWorst.values(), 0)), 4),
    peakExposureDetails,
  };
}

function summarizePositionSizingResearch(params: {
  trades: ManualTrade[];
  rawM5ByPair: Map<string, OhlcCandle[]>;
  datasetsByPair: Map<string, TimeframeDataset[]>;
}): PositionSizingResearch {
  const { trades, rawM5ByPair, datasetsByPair } = params;
  const pairInfoLookup = buildPairInfoLookup();
  const executions = buildSwingTpExecutions({
    trades,
    rawM5ByPair,
    datasetsByPair,
    pairInfoLookup,
    variantId: POSITION_SIZING_TARGET_VARIANT,
    lockMode: POSITION_SIZING_LOCK_MODE,
    assetClass: "fx",
  });

  const pairP95MaeMap = new Map<string, number>();
  const pairRiskProfiles = Array.from(
    executions.reduce((map, execution) => {
      const bucket = map.get(execution.pair) ?? [];
      bucket.push(execution);
      map.set(execution.pair, bucket);
      return map;
    }, new Map<string, SwingTpExecution[]>()),
  )
    .map(([pair, bucket]) => {
      const maes = bucket.map((execution) => execution.maePct);
      const returns = bucket.map((execution) => execution.returnPct);
      const atrs = bucket.map((execution) => execution.atr14Pct).filter((value): value is number => value !== null);
      const p95Mae = percentile(maes, 95);
      pairP95MaeMap.set(pair, p95Mae);
      return {
        pair,
        trades: bucket.length,
        avgReturnPct: round(safeAverage(returns), 4),
        medianReturnPct: round(median(returns), 4),
        avgMaePct: round(safeAverage(maes), 4),
        p95MaePct: round(p95Mae, 4),
        maxMaePct: round(maes.length === 0 ? 0 : Math.max(...maes), 4),
        avgAtr14Pct: round(safeAverage(atrs), 4),
        p95Atr14Pct: round(percentile(atrs, 95), 4),
        noTargetRatePct: round((bucket.filter((execution) => execution.exitReason === "NO_TARGET_WEEK_CLOSE").length / bucket.length) * 100, 2),
        worstLossPct: round(returns.length === 0 ? 0 : Math.min(...returns), 4),
        recommendedLotsPer100k: POSITION_SIZING_RISK_BUDGETS.map((riskBudgetPct) => ({
          riskBudgetPct,
          atrOnly: round(
            riskBudgetPct / Math.max(safeAverage(atrs), 0.0001),
            4,
          ),
          conservative: round(
            riskBudgetPct / Math.max(Math.max(safeAverage(atrs), 0), p95Mae, 0.0001),
            4,
          ),
        })),
      } satisfies PairRiskProfile;
    })
    .sort((a, b) => a.pair.localeCompare(b.pair));

  const sizingModels: PortfolioSimulationSummary[] = [];
  let concurrentExposure: ConcurrentExposureSummary | null = null;

  const fixedModel = simulatePortfolioModel({
    executions,
    rawM5ByPair,
    sizeFn: () => 1,
    modelId: "fixed_1x",
    label: "Fixed 1 standard lot per 100k account",
    sizingBasis: "fixed_notional",
    riskBudgetPct: null,
  });
  sizingModels.push(fixedModel);
  concurrentExposure = {
    maxConcurrentTrades: fixedModel.maxConcurrentTrades,
    maxConcurrentNotionalMultiple: fixedModel.maxConcurrentNotionalMultiple,
    worstSessionDrawdownPct: fixedModel.worstSessionDrawdownPct,
    worstWeekDrawdownPct: fixedModel.worstWeekDrawdownPct,
    peakExposureDetails: fixedModel.peakExposureDetails,
  };

  for (const riskBudgetPct of POSITION_SIZING_RISK_BUDGETS) {
    sizingModels.push(simulatePortfolioModel({
      executions,
      rawM5ByPair,
      sizeFn: (execution) => riskBudgetPct / Math.max(execution.atr14Pct ?? 0.0001, 0.0001),
      modelId: `atr14_${String(riskBudgetPct).replace(".", "")}`,
      label: `ATR14 sizing at ${riskBudgetPct}% risk budget`,
      sizingBasis: "atr14_pct",
      riskBudgetPct,
    }));

    sizingModels.push(simulatePortfolioModel({
      executions,
      rawM5ByPair,
      sizeFn: (execution) => {
        const pairP95Mae = pairP95MaeMap.get(execution.pair) ?? execution.maePct;
        const basis = Math.max(execution.atr14Pct ?? 0, pairP95Mae, 0.0001);
        return riskBudgetPct / basis;
      },
      modelId: `conservative_${String(riskBudgetPct).replace(".", "")}`,
      label: `Conservative sizing at ${riskBudgetPct}% risk budget`,
      sizingBasis: "max(atr14_pct,pair_p95_mae_pct)",
      riskBudgetPct,
    }));
  }

  const catastrophicStopAnalysis = CATASTROPHIC_STOP_PCTS.map((stopLossPct) => {
    const stoppedExecutions = executions
      .map((execution) => {
        const candles = rawM5ByPair.get(pairKey(execution.assetClass, execution.pair));
        if (!candles) return null;
        return simulateSwingTpWithCatastrophicStop({ execution, m5Candles: candles, stopLossPct });
      })
      .filter((value): value is SwingTpExecution => value !== null);
    const returns = stoppedExecutions.map((execution) => execution.returnPct);
    const grossWins = returns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLosses = Math.abs(returns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    const stoppedWinners = stoppedExecutions.filter((execution, index) =>
      execution.returnPct < 0 && (executions[index]?.returnPct ?? 0) > 0).length;
    const portfolio = simulatePortfolioModel({
      executions: stoppedExecutions,
      rawM5ByPair,
      sizeFn: () => 1,
      modelId: `cat_stop_${stopLossPct}`,
      label: `Catastrophic ${stopLossPct}% stop`,
      sizingBasis: "fixed_notional",
      riskBudgetPct: null,
    });

    return {
      stopLossPct,
      trades: stoppedExecutions.length,
      stoppedWinners,
      winRatePct: round((returns.filter((value) => value > 0).length / Math.max(returns.length, 1)) * 100, 2),
      avgReturnPct: round(safeAverage(returns), 4),
      profitFactor: round(grossLosses === 0 ? grossWins : grossWins / grossLosses, 4),
      maxDrawdownPctFixed1x: portfolio.maxDrawdownPct,
    } satisfies CatastrophicStopSummary;
  });

  const bestModelByReturn = [...sizingModels].sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0]?.modelId ?? null;
  const bestModelUnder10PctDrawdown = [...sizingModels]
    .filter((model) => model.maxDrawdownPct <= 10)
    .sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0]?.modelId ?? null;
  const bestModelUnder5PctDrawdown = [...sizingModels]
    .filter((model) => model.maxDrawdownPct <= 5)
    .sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0]?.modelId ?? null;

  return {
    enabled: true,
    targetVariantId: POSITION_SIZING_TARGET_VARIANT,
    lockMode: POSITION_SIZING_LOCK_MODE,
    fxOnly: true,
    accountSizeUsd: POSITION_SIZING_ACCOUNT_USD,
    riskBudgetsPct: POSITION_SIZING_RISK_BUDGETS,
    catastrophicStopPcts: CATASTROPHIC_STOP_PCTS,
    pairRiskProfiles,
    sizingModels: sizingModels.sort((a, b) => a.modelId.localeCompare(b.modelId)),
    concurrentExposure: concurrentExposure ?? {
      maxConcurrentTrades: 0,
      maxConcurrentNotionalMultiple: 0,
      worstSessionDrawdownPct: 0,
      worstWeekDrawdownPct: 0,
      peakExposureDetails: [],
    },
    catastrophicStopAnalysis,
    recommendation: {
      bestModelByReturn,
      bestModelUnder10PctDrawdown,
      bestModelUnder5PctDrawdown,
    },
  };
}

function readKataraktiBenchmark(targetWeeks: readonly string[]) {
  if (!existsSync(KATARAKTI_REPORT_PATH)) {
    return {
      sourcePath: null,
      weeks: [] as string[],
      phase1BaselineHeadline: null,
      note: "Existing Katarakti benchmark report was not found.",
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(KATARAKTI_REPORT_PATH, "utf8")) as {
      config?: { weeks?: string[] };
      phase1_baseline_headline?: {
        id?: string;
        return_pct?: number;
        max_drawdown_pct?: number;
        win_rate_pct?: number;
        trades?: number;
      };
    };

    const weeks = parsed.config?.weeks ?? [];
    const targetLabels = targetWeeks.map((week) => weekLabelFromOpen(week));
    const benchmarkLabels = weeks.map((week) => weekLabelFromOpen(week));
    const matchesWeeks =
      benchmarkLabels.length === targetLabels.length &&
      benchmarkLabels.every((week, index) => week === targetLabels[index]);

    return {
      sourcePath: KATARAKTI_REPORT_PATH,
      weeks,
      phase1BaselineHeadline: parsed.phase1_baseline_headline
        ? {
          id: String(parsed.phase1_baseline_headline.id ?? ""),
          returnPct: Number(parsed.phase1_baseline_headline.return_pct ?? 0),
          maxDrawdownPct: Number(parsed.phase1_baseline_headline.max_drawdown_pct ?? 0),
          winRatePct: Number(parsed.phase1_baseline_headline.win_rate_pct ?? 0),
          trades: Number(parsed.phase1_baseline_headline.trades ?? 0),
        }
        : null,
      note: matchesWeeks ? null : "Existing Katarakti benchmark weeks do not match this 8-week run.",
    };
  } catch (error) {
    return {
      sourcePath: KATARAKTI_REPORT_PATH,
      weeks: [] as string[],
      phase1BaselineHeadline: null,
      note: `Failed to parse Katarakti benchmark: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function main() {
  const pairUniverse = buildPairUniverse().filter((pair) => PAIR_FILTER.size === 0 || PAIR_FILTER.has(pair.pair));
  const targetWeeks = await getTargetWeeks(DateTime.utc(2026, 3, 19, 12, 0, 0));
  const firstWeek = DateTime.fromISO(targetWeeks[0] ?? "", { zone: "utc" });
  const lastWeek = DateTime.fromISO(targetWeeks[targetWeeks.length - 1] ?? "", { zone: "utc" });
  if (!firstWeek.isValid || !lastWeek.isValid) {
    throw new Error("Failed to derive target week range.");
  }

  const fetchFrom = firstWeek.minus({ days: WARMUP_DAYS }).startOf("day");
  const fetchTo = lastWeek.plus({ weeks: 1, days: 1 }).startOf("day");
  const weeklyMatrixMap = await loadWeeklyMatrixMap(targetWeeks, pairUniverse);
  const strengthHistory = await loadStrengthHistory(fetchFrom, fetchTo);

  const rawM5ByPair = new Map<string, OhlcCandle[]>();
  const datasetsByPair = new Map<string, TimeframeDataset[]>();
  const missingPairs: string[] = [];
  const missingStrengthLookups = new Set<string>();

  await runWithConcurrency(pairUniverse, FETCH_CONCURRENCY, async (pairInfo) => {
    const key = pairKey(pairInfo.assetClass, pairInfo.pair);
    try {
      const candles = await fetchOandaM5Series(pairInfo.pair, fetchFrom, fetchTo);
      if (candles.length === 0) {
        missingPairs.push(key);
        return;
      }
      rawM5ByPair.set(key, candles);
      datasetsByPair.set(key, buildTimeframeData(candles));
    } catch (error) {
      missingPairs.push(`${key} (${error instanceof Error ? error.message : String(error)})`);
    }
  });

  const gateModes: GateMode[] = ["UNGATED", "FROZEN", "LIVE"];
  const timePolicies: TimePolicy[] = ["FIRST_TIMEFRAME_WINS", "LOWER_TIMEFRAME_REPLACE"];
  const trades: ManualTrade[] = [];

  const pushTrade = (params: {
    pairInfo: PairInfo;
    weekOpenUtc: string;
    sessionWindow: { session: SessionName; sessionStart: DateTime; sessionEnd: DateTime };
    gateMode: GateMode;
    timePolicy: TimePolicy;
    direction: Exclude<Direction, "NEUTRAL">;
    resolved: NonNullable<Awaited<ReturnType<typeof resolveCandidateForSession>>>;
    sessionMetrics: TradeMetrics;
    weekMetrics: TradeMetrics;
    strengthMode: StrengthMode;
    strengthThreshold: number | null;
    strengthSupported: boolean;
    strengthDecisionTimeUtc: string | null;
    strengthSnapshotTimeUtc: string | null;
    strengthDirectionAtDecision: Direction | null;
    weekEndUtc: string;
  }) => {
    const {
      pairInfo,
      weekOpenUtc,
      sessionWindow,
      gateMode,
      timePolicy,
      direction,
      resolved,
      sessionMetrics,
      weekMetrics,
      strengthMode,
      strengthThreshold,
      strengthSupported,
      strengthDecisionTimeUtc,
      strengthSnapshotTimeUtc,
      strengthDirectionAtDecision,
      weekEndUtc,
    } = params;

    trades.push({
      variantId: variantId(gateMode, timePolicy, strengthMode, strengthThreshold),
      weekOpenUtc,
      weekLabel: weekLabelFromOpen(weekOpenUtc),
      pair: pairInfo.pair,
      assetClass: pairInfo.assetClass,
      session: sessionWindow.session,
      sessionDateUtc: sessionWindow.sessionStart.toISODate() ?? weekLabelFromOpen(weekOpenUtc),
      gateMode,
      timePolicy,
      strengthMode,
      strengthThreshold,
      strengthSupported,
      strengthDecisionTimeUtc,
      strengthSnapshotTimeUtc,
      strengthDirectionAtDecision,
      weeklyDirection: direction,
      frozenGateDirection: resolved.frozenGateDirection,
      liveGateDirectionAtEntry: resolved.liveGateDirection,
      triggerTimeframe: resolved.candidate.timeframe,
      signalValue: resolved.candidate.signalValue,
      entryTimeUtc: DateTime.fromMillis(resolved.candidate.entryTs, { zone: "utc" }).toISO() ?? "",
      entryPrice: round(resolved.candidate.entryPrice),
      sessionStartUtc: sessionWindow.sessionStart.toISO() ?? "",
      sessionEndUtc: sessionWindow.sessionEnd.toISO() ?? "",
      weekEndUtc,
      sessionMetrics,
      weekMetrics,
    });
  };

  for (const weekOpenUtc of targetWeeks) {
    const weekMap = weeklyMatrixMap.get(weekOpenUtc);
    if (!weekMap) continue;
    const sessionWindows = buildSessionWindowsForWeek(weekOpenUtc);
    const weekEndUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ weeks: 1 }).toISO() ?? weekOpenUtc;

    for (const pairInfo of pairUniverse) {
      const row = weekMap.get(pairInfo.pair);
      if (!row || row.weeklyDirection === "NEUTRAL") continue;

      const direction = row.weeklyDirection;
      const key = pairKey(pairInfo.assetClass, pairInfo.pair);
      const datasets = datasetsByPair.get(key);
      const m5Candles = rawM5ByPair.get(key);
      if (!datasets || !m5Candles) continue;

      const eligibleSessions = new Set(SESSION_ELIGIBILITY.get(pairInfo.pair) ?? ["LONDON"]);
      for (const window of sessionWindows) {
        if (!eligibleSessions.has(window.session)) continue;

        for (const gateMode of gateModes) {
          for (const timePolicy of timePolicies) {
            const resolved = await resolveCandidateForSession({
              datasets,
              direction,
              sessionStartMs: window.sessionStart.toMillis(),
              sessionEndMs: window.sessionEnd.toMillis(),
              sessionStartUtc: window.sessionStart.toISO() ?? weekOpenUtc,
              gateMode,
              weekMap,
              pair: pairInfo.pair,
              timePolicy,
            });
            if (!resolved) continue;

            const sessionMetrics = computeTradeMetrics(
              direction,
              m5Candles,
              resolved.candidate.entryTs,
              resolved.candidate.entryPrice,
              window.sessionEnd.toMillis(),
            );
            const weekMetrics = computeTradeMetrics(
              direction,
              m5Candles,
              resolved.candidate.entryTs,
              resolved.candidate.entryPrice,
              DateTime.fromISO(weekEndUtc, { zone: "utc" }).toMillis(),
            );

            pushTrade({
              pairInfo,
              weekOpenUtc,
              sessionWindow: window,
              gateMode,
              timePolicy,
              direction,
              resolved,
              sessionMetrics,
              weekMetrics,
              strengthMode: "BASELINE",
              strengthThreshold: null,
              strengthSupported: false,
              strengthDecisionTimeUtc: null,
              strengthSnapshotTimeUtc: null,
              strengthDirectionAtDecision: null,
              weekEndUtc,
            });

            const strengthDecisionTs = gateMode === "FROZEN"
              ? window.sessionStart.toMillis()
              : resolved.candidate.entryTs;
            const strengthDecisionTimeUtc =
              DateTime.fromMillis(strengthDecisionTs, { zone: "utc" }).toISO() ?? null;

            for (const threshold of STRENGTH_FILTER_THRESHOLDS) {
              const strengthDecision = resolveStrengthDirection({
                pairInfo,
                asOfTs: strengthDecisionTs,
                threshold,
                strengthHistory,
              });

              if (!strengthDecision.supported) {
                pushTrade({
                  pairInfo,
                  weekOpenUtc,
                  sessionWindow: window,
                  gateMode,
                  timePolicy,
                  direction,
                  resolved,
                  sessionMetrics,
                  weekMetrics,
                  strengthMode: "FILTER_24H",
                  strengthThreshold: threshold,
                  strengthSupported: false,
                  strengthDecisionTimeUtc,
                  strengthSnapshotTimeUtc: null,
                  strengthDirectionAtDecision: null,
                  weekEndUtc,
                });
                continue;
              }

              if (!strengthDecision.available) {
                missingStrengthLookups.add(
                  `${pairInfo.pair}|${gateMode}|${timePolicy}|t${threshold}|${strengthDecisionTimeUtc ?? "unknown"}`,
                );
                continue;
              }

              if (strengthDecision.direction !== direction) {
                continue;
              }

              pushTrade({
                pairInfo,
                weekOpenUtc,
                sessionWindow: window,
                gateMode,
                timePolicy,
                direction,
                resolved,
                sessionMetrics,
                weekMetrics,
                strengthMode: "FILTER_24H",
                strengthThreshold: threshold,
                strengthSupported: true,
                strengthDecisionTimeUtc,
                strengthSnapshotTimeUtc: strengthDecision.snapshotTimeUtc,
                strengthDirectionAtDecision: strengthDecision.direction,
                weekEndUtc,
              });
            }
          }
        }
      }
    }
  }

  trades.sort((a, b) => {
    if (a.weekOpenUtc !== b.weekOpenUtc) return a.weekOpenUtc.localeCompare(b.weekOpenUtc);
    if (a.pair !== b.pair) return a.pair.localeCompare(b.pair);
    if (a.session !== b.session) return a.session.localeCompare(b.session);
    if (a.gateMode !== b.gateMode) return a.gateMode.localeCompare(b.gateMode);
    if (a.timePolicy !== b.timePolicy) return a.timePolicy.localeCompare(b.timePolicy);
    if (a.strengthMode !== b.strengthMode) return a.strengthMode.localeCompare(b.strengthMode);
    if ((a.strengthThreshold ?? -1) !== (b.strengthThreshold ?? -1)) {
      return (a.strengthThreshold ?? -1) - (b.strengthThreshold ?? -1);
    }
    return a.entryTimeUtc.localeCompare(b.entryTimeUtc);
  });

  const tradesByVariant = new Map<string, ManualTrade[]>();
  for (const trade of trades) {
    const bucket = tradesByVariant.get(trade.variantId) ?? [];
    bucket.push(trade);
    tradesByVariant.set(trade.variantId, bucket);
  }
  const summaries = Array.from(tradesByVariant.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, variantTrades]) => summarizeVariant(variantTrades));

  const benchmark = readKataraktiBenchmark(targetWeeks);
  const exitResearch = summarizeExitSweeps(trades, rawM5ByPair);
  const swingTpResearch = summarizeSwingTpResearch(trades, rawM5ByPair, datasetsByPair);
  const positionSizingResearch = summarizePositionSizingResearch({ trades, rawM5ByPair, datasetsByPair });
  const output: BacktestOutput = {
    generatedUtc: DateTime.utc().toISO() ?? new Date().toISOString(),
    config: {
      targetWeeks,
      targetWeekLabels: targetWeeks.map((week) => weekLabelFromOpen(week)),
      pairUniverseCount: pairUniverse.length,
      sessionWindowsUtc: SESSION_WINDOWS_UTC,
      timeframeOrder: TIMEFRAMES.map((row) => row.id),
      gateModes,
      timePolicies,
      strengthFilterExperiment: {
        window: STRENGTH_FILTER_WINDOW,
        thresholds: STRENGTH_FILTER_THRESHOLDS,
        supportedAssetClasses: ["fx", "crypto", "commodities"],
        unsupportedAssetClasses: ["indices"],
        timing: {
          FROZEN: "session_open",
          LIVE: "entry_time",
          UNGATED: "entry_time",
        },
      },
      indicator: {
        name: "RRanjanFX Slow Stochastic D",
        stochasticKLength: STOCHASTIC_K_LENGTH,
        stochasticDSmoothing: STOCHASTIC_D_SMOOTHING,
        stochasticKSmoothing: STOCHASTIC_K_SMOOTHING,
        rsiLength: RSI_LENGTH,
        oversold: OVERSOLD_LEVEL,
        overbought: OVERBOUGHT_LEVEL,
        source: "close/high/low",
        triggerLine: "%D (black line)",
      },
      assumptions: [
        "Weekly matrix direction is reconstructed from performance_snapshots dealer/commercial/sentiment majority vote.",
        "Frozen/live gate modes use dealer and commercial weekly votes plus historical sentiment aggregate as of session open or candidate entry.",
        "Manual trigger uses the RRanjanFX black line only: sma(sma(stoch(close, high, low, 21), 3), 13).",
        "The standalone RSI(3) from the RRanjanFX script is not used for entry logic.",
        "If the black-line %D is already below 20 or above 80 at session start, that timeframe is treated as active and waits for the next engulfing close.",
        "Same-candle oversold/overbought and engulfing does not count; engulfing must occur on a later candle.",
        "Strength filter uses 24h snapshots only and tests thresholds 10, 15, 20, and 25.",
        "FX strength direction is base normalized strength minus quote normalized strength; crypto and commodities compare the asset normalized strength to 50.",
        "Indices have no strength source in the current system, so strength-filter variants pass them through unchanged.",
        "Strength timing follows the gate decision: FROZEN uses session-open strength, LIVE and UNGATED use entry-time strength.",
        "Manual trigger exits were not specified, so both session-close and week-close metrics are reported.",
        "Drawdown and excursion are measured from post-entry M5 highs/lows on a 1:1 percent basis.",
        "Lower-timeframe-replace selects the earliest valid entry across all trigger timeframes, breaking ties toward the lower timeframe.",
        "Fixed SL/TP sweep uses a conservative intrabar tie-break: if stop and target are both touched in the same M5 candle, the stop is assumed to fill first.",
        "Swing TP research uses the nearest confirmed 4H swing high above entry for longs or swing low below entry for shorts; if no qualifying target exists, the trade holds to week close.",
        "A confirmed 4H swing is defined with a 2-left / 2-right fractal, and only swings confirmed by the entry time are eligible.",
        "Swing TP research allows only one active trade per pair at a time; later entries are skipped until the prior trade exits.",
      ],
      fetchWindowUtc: {
        from: fetchFrom.toISO() ?? "",
        to: fetchTo.toISO() ?? "",
      },
      cacheDir: CACHE_DIR,
    },
    dataQuality: {
      missingPairs: [...missingPairs].sort(),
      missingStrengthLookups: [...missingStrengthLookups].sort(),
    },
    benchmark,
    exitResearch: {
      stopLossPcts: FIXED_STOP_LOSS_PCTS,
      takeProfitPcts: FIXED_TAKE_PROFIT_PCTS,
      intrabarTieBreak: "stop_first_if_stop_and_target_touch_same_m5_bar",
      summaries: exitResearch,
    },
    swingTpResearch: {
      enabled: true,
      baselineOnly: true,
      swingDefinition: "4H fractal swing with 2 candles left and 2 candles right",
      targetRule: "nearest confirmed swing high above entry for longs / swing low below entry for shorts",
      noStopLoss: true,
      oneTradePerPairAtATime: true,
      lockModes: ["PAIR", "PAIR_SESSION"],
      summaries: swingTpResearch,
    },
    positionSizingResearch,
    summaries,
    trades,
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = DateTime.utc().toFormat("yyyyMMdd-HHmmss");
  const reportPath = path.join(REPORTS_DIR, `manual-session-matrix-backtest-${timestamp}.json`);
  const latestPath = path.join(REPORTS_DIR, "manual-session-matrix-backtest-latest.json");
  writeFileSync(reportPath, JSON.stringify(output, null, 2));
  writeFileSync(latestPath, JSON.stringify(output, null, 2));

  console.log(`Manual session matrix backtest complete.`);
  console.log(`Report: ${reportPath}`);
  console.log(`Trades: ${trades.length}`);
  console.log(`Missing pairs: ${missingPairs.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
