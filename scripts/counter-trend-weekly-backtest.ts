
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: counter-trend-weekly-backtest.ts
 *
 * Description:
 * Counter-trend weekly sweep backtest. Detects when price sweeps the PRIOR
 * week's high/low on 1H aggregated candles, waits for rejection + displacement,
 * enters counter-trend. Uses handshake (BTC + ETH) gating, scaling leverage,
 * and weekly force-close. Runs a parameter sensitivity grid across sweep
 * thresholds, displacement thresholds, handshake windows, and stop distances.
 *
 * This script reuses the same Bitget candle API, COT/sentiment bias infra,
 * and week-anchor logic from bitget-v2-backtest.ts.
 *
 * Run: npx tsx scripts/counter-trend-weekly-backtest.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { getPool } from "../src/lib/db";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { derivePairDirectionsByBase } from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { CotSnapshot } from "../src/lib/cotTypes";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

/* ─────────────────────────  Types  ───────────────────────── */

type CoreSymbol = "BTC" | "ETH";
type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = "HIGH" | "MEDIUM" | "NEUTRAL";
type ExitReason =
  | "STOP_LOSS"
  | "TRAILING_STOP"
  | "BREAKEVEN_STOP"
  | "WEEK_CLOSE"
  | "PARTIAL_TP";

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  quoteVolume: number | null;
};

type WeeklyRange = {
  high: number;
  low: number;
  weekOpenUtc: string;
};

type WeeklyBias = {
  tier: Tier;
  bias: Direction;
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  sentimentSource: "aggregate" | "funding_proxy" | "missing";
};

type CounterTrendSignal = {
  symbol: CoreSymbol;
  weekOpenUtc: string;
  direction: "LONG" | "SHORT"; // counter-trend direction
  priorWeekHigh: number;
  priorWeekLow: number;
  sweepPrice: number;
  sweepPct: number;
  sweepCandleTs: number;
  confirmCandleTs: number;
  confirmPrice: number; // entry price (close of confirm candle)
  displacementPct: number;
  weeklyBias: Direction;
  tier: Tier;
  weekMoveFromOpenPct: number; // how far price has moved in bias direction this week
  // ── Entry quality metrics (populated by detection, filtered by param set) ──
  reclaimDepthPct: number; // how far inside the range the confirm candle closed (%)
  wickToBodyRatio: number; // sweep candle wick / body ratio (higher = better rejection)
  multiBarDisplacement: boolean; // true if 2+ consecutive H1 candles displaced in counter direction
  multiBarDisplacementCount: number; // how many consecutive bars displaced
  volumeSpikeRatio: number; // sweep candle volume / rolling 24-bar avg (>1 = above avg)
  sweepRangeProportionPct: number; // sweep depth as % of prior week range width
  sessionAtSweep: "ASIA" | "LONDON" | "NY" | "OTHER"; // session when sweep occurred
};

type ClosedTrade = {
  id: number;
  paramSetId: string;
  symbol: CoreSymbol;
  weekOpenUtc: string;
  direction: "LONG" | "SHORT";
  tier: Tier;
  weeklyBias: Direction;
  priorWeekHigh: number;
  priorWeekLow: number;
  sweepPrice: number;
  sweepPct: number;
  sweepThresholdUsed: number;
  displacementPct: number;
  displacementThresholdUsed: number;
  handshakeWindowMin: number;
  handshakeDelayMinutes: number | null;
  entryTimeUtc: string;
  entryPrice: number;
  stopPrice: number;
  stopDistancePct: number;
  exitTimeUtc: string;
  exitPrice: number;
  exitReason: ExitReason;
  unleveredPnlPct: number;
  initialLeverage: number;
  maxLeverageReached: number;
  breakevenReached: boolean;
  milestonesHit: number[];
  marginUsedUsd: number;
  pnlUsd: number;
  balanceAfterUsd: number;
  weekMoveFromOpenPct: number;
  // ── Entry quality metrics carried through to trade log ──
  reclaimDepthPct: number;
  wickToBodyRatio: number;
  multiBarDisplacement: boolean;
  volumeSpikeRatio: number;
  sweepRangeProportionPct: number;
  sessionAtSweep: "ASIA" | "LONDON" | "NY" | "OTHER";
};

type EntryQualityFilter = "OFF" | "STRICT";

type ParamSet = {
  id: string;
  sweepMinPct: number;
  displacementMinPct: number;
  handshakeWindowMin: number;
  initialStopPct: number;
  biasFilter: "NONE" | "NEUTRAL_ONLY" | "EXTENDED_5PCT";
  partialTp: boolean;
  noStopLoss: boolean;
  singleEntryPerWeek: boolean;
  // ── Entry quality filter thresholds ──
  entryQuality: EntryQualityFilter;
  minReclaimDepthPct: number; // 0 = off, 0.5-1.0 = strict
  minWickToBodyRatio: number; // 0 = off, 2.0 = require hammer/shooting star
  requireMultiBarDisplacement: boolean; // false = off, true = require 2+ consecutive bars
  minVolumeSpikeRatio: number; // 0 = off, 1.5 = require 1.5x avg volume
  minSweepRangeProportionPct: number; // 0 = off, 2-5 = require meaningful sweep depth
};

type ParamSetResult = {
  paramSet: ParamSet;
  trades: ClosedTrade[];
  totalReturnPct: number;
  winRatePct: number;
  avgUnleveredPnlPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  tradesPerWeek: number;
  signalsDetected: number;
  signalsFiltered: number;
  signalsEntered: number;
  directionalFunnel: DirectionalSignalFunnel;
  exitReasonBreakdown: Record<string, number>;
};

type SignalFunnelStage = {
  raw: number;
  afterBias: number;
  afterQuality: number;
  afterHandshake: number;
  entered: number;
};

type DirectionalSignalFunnel = {
  LONG: SignalFunnelStage;
  SHORT: SignalFunnelStage;
};

type WeekData = {
  weekOpenUtc: string;
  weekCloseUtc: string;
  bias: Record<CoreSymbol, WeeklyBias>;
  m1Candles: Record<CoreSymbol, Candle[]>;
  h1Candles: Record<CoreSymbol, Candle[]>;
  priorWeekRange: Record<CoreSymbol, WeeklyRange> | null;
  weekOpenPrice: Record<CoreSymbol, number>;
};

type BacktestOutput = {
  generatedUtc: string;
  testPeriod: { weeks: number; from: string; to: string };
  paramSets: ParamSet[];
  results: ParamSetResult[];
  bestByReturn: ParamSetResult | null;
  bestByWinRate: ParamSetResult | null;
  bestByDrawdown: ParamSetResult | null;
  signalDiagnostics: {
    totalWeeklySweepsDetected: number;
    bySymbol: Record<CoreSymbol, number>;
    byWeek: Array<{ weekOpenUtc: string; sweeps: number }>;
    byDirection: { LONG: number; SHORT: number };
  };
  weeklyBiasSummary: Array<{
    weekOpenUtc: string;
    btcBias: string;
    ethBias: string;
    btcTier: Tier;
    ethTier: Tier;
  }>;
  recommendations: string[];
};

/* ─────────────────────────  Constants  ───────────────────────── */

const CORE_SYMBOLS: CoreSymbol[] = ["BTC", "ETH"];
const WEEKS_TO_BACKTEST = Number(process.env.CT_WEEKS ?? "26"); // default 6 months
const STARTING_BALANCE_USD = 1000;

// Bias mode:
//   FULL     = COT + sentiment (requires DB, limited to sentiment data availability)
//   COT_ONLY = COT positioning only, no sentiment (goes back years)
//   NONE     = skip bias entirely, set all weeks to NEUTRAL (no DB needed)
const CT_BIAS_MODE = (process.env.CT_BIAS_MODE ?? "NONE") as
  | "FULL"
  | "COT_ONLY"
  | "NONE";

const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
const BITGET_FETCH_MAX_ATTEMPTS = 5;
const BITGET_FETCH_BASE_RETRY_MS = 750;
const CT_NO_STOP_TEST_MODE = (process.env.CT_NO_STOP_TEST ?? "0") === "1";
const CT_SINGLE_ENTRY_PER_WEEK =
  (process.env.CT_SINGLE_ENTRY_PER_WEEK ??
    (CT_NO_STOP_TEST_MODE ? "1" : "0")) === "1";

// ── Candle Cache ──
// Caches M1 candles per symbol/week to avoid re-fetching on subsequent runs.
// Delete .cache/counter-trend/ to force a fresh fetch.
const CANDLE_CACHE_DIR = path.join(process.cwd(), ".cache", "counter-trend");

// ── Parameter Grid ──
// Start wide (riskier), tighten later based on results.
const SWEEP_THRESHOLDS = [0.3, 0.5, 0.75, 1.0];
const DISPLACEMENT_THRESHOLDS = [0.1, 0.2, 0.3];
const HANDSHAKE_WINDOWS_MIN = [60, 240, 480, 1440];
const INITIAL_STOP_PCTS = [8, 10, 15];
// When bias mode is NONE or COT_ONLY, only BIAS_FILTER=NONE makes sense
// (NEUTRAL_ONLY and EXTENDED_5PCT depend on tier/move data that's meaningless without real bias).
const BIAS_FILTERS: Array<"NONE" | "NEUTRAL_ONLY" | "EXTENDED_5PCT"> =
  CT_BIAS_MODE === "FULL"
    ? ["NONE", "NEUTRAL_ONLY", "EXTENDED_5PCT"]
    : ["NONE"];
const PARTIAL_TP_OPTIONS = [false, true]; // 50% at +3%

// ── Entry Quality Filters ──
// These are the strict thresholds. "OFF" uses 0 for all, "STRICT" uses the values below.
const EQ_RECLAIM_DEPTH_PCTS = [0, 0.5, 1.0]; // % inside the range the confirm candle must close
const EQ_WICK_TO_BODY_RATIOS = [0, 2.0]; // minimum wick/body ratio on sweep candle
const EQ_MULTI_BAR_DISPLACEMENT = [false, true]; // require 2+ consecutive H1 displacement bars
const EQ_VOLUME_SPIKE_RATIOS = [0, 1.5]; // minimum volume vs 24-bar rolling avg
const EQ_SWEEP_RANGE_PROPORTION_PCTS = [0, 2, 5]; // sweep depth as % of weekly range width

// Prebuilt quality profiles to keep grid manageable
// Instead of full combinatorial (3*2*2*2*3 = 72 more combos per existing set),
// we test discrete profiles:
type QualityProfile = {
  label: string;
  minReclaimDepthPct: number;
  minWickToBodyRatio: number;
  requireMultiBarDisplacement: boolean;
  minVolumeSpikeRatio: number;
  minSweepRangeProportionPct: number;
};

const QUALITY_PROFILES: QualityProfile[] = [
  // Raw — no entry quality filtering (baseline)
  {
    label: "RAW",
    minReclaimDepthPct: 0,
    minWickToBodyRatio: 0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 0,
    minSweepRangeProportionPct: 0,
  },
  // Reclaim only — must close 0.5% inside range
  {
    label: "RECLAIM05",
    minReclaimDepthPct: 0.5,
    minWickToBodyRatio: 0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 0,
    minSweepRangeProportionPct: 0,
  },
  // Reclaim 1% — must close 1% inside range
  {
    label: "RECLAIM1",
    minReclaimDepthPct: 1.0,
    minWickToBodyRatio: 0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 0,
    minSweepRangeProportionPct: 0,
  },
  // Hammer — require wick >= 2x body on sweep candle
  {
    label: "HAMMER",
    minReclaimDepthPct: 0,
    minWickToBodyRatio: 2.0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 0,
    minSweepRangeProportionPct: 0,
  },
  // Multi-bar — require 2+ consecutive displacement candles
  {
    label: "MULTIBAR",
    minReclaimDepthPct: 0,
    minWickToBodyRatio: 0,
    requireMultiBarDisplacement: true,
    minVolumeSpikeRatio: 0,
    minSweepRangeProportionPct: 0,
  },
  // Volume — require 1.5x avg volume on sweep candle
  {
    label: "VOLSPIKE",
    minReclaimDepthPct: 0,
    minWickToBodyRatio: 0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 1.5,
    minSweepRangeProportionPct: 0,
  },
  // Range prop — sweep must be >= 2% of weekly range width
  {
    label: "RANGEPROP2",
    minReclaimDepthPct: 0,
    minWickToBodyRatio: 0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 0,
    minSweepRangeProportionPct: 2,
  },
  // Range prop strict — sweep must be >= 5% of weekly range width
  {
    label: "RANGEPROP5",
    minReclaimDepthPct: 0,
    minWickToBodyRatio: 0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 0,
    minSweepRangeProportionPct: 5,
  },
  // Moderate — reclaim 0.5% + hammer + volume spike
  {
    label: "MODERATE",
    minReclaimDepthPct: 0.5,
    minWickToBodyRatio: 2.0,
    requireMultiBarDisplacement: false,
    minVolumeSpikeRatio: 1.5,
    minSweepRangeProportionPct: 0,
  },
  // Strict — all filters on at once
  {
    label: "STRICT",
    minReclaimDepthPct: 1.0,
    minWickToBodyRatio: 2.0,
    requireMultiBarDisplacement: true,
    minVolumeSpikeRatio: 1.5,
    minSweepRangeProportionPct: 2,
  },
];

// ── Counter-Trend Scaling Ladder ──
// More conservative than the bias system (lower leverage cap).
const CT_INITIAL_LEVERAGE = 3;
const CT_MILESTONES = [2, 4, 6] as const;
const CT_LEVERAGE_BY_MILESTONE: Record<(typeof CT_MILESTONES)[number], number> =
  {
    2: 5,
    4: 10,
    6: 15,
  };
const CT_TRAIL_OFFSET_BY_MILESTONE: Record<
  (typeof CT_MILESTONES)[number],
  number
> = {
  2: 0, // breakeven, no trail yet
  4: 2.0, // 2% trailing offset
  6: 1.5, // tighter 1.5% trailing offset
};

/* ─────────────────────────  Utility functions  ───────────────────────── */

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}
function createEmptyDirectionalFunnel(): DirectionalSignalFunnel {
  return {
    LONG: {
      raw: 0,
      afterBias: 0,
      afterQuality: 0,
      afterHandshake: 0,
      entered: 0,
    },
    SHORT: {
      raw: 0,
      afterBias: 0,
      afterQuality: 0,
      afterHandshake: 0,
      entered: 0,
    },
  };
}
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
function toUtcIso(ts: number) {
  return (
    DateTime.fromMillis(ts, { zone: "utc" }).toISO() ??
    new Date(ts).toISOString()
  );
}
function getUtcDateKey(ts: number) {
  return DateTime.fromMillis(ts, { zone: "utc" }).toISODate() ?? "";
}
function pctMove(
  entry: number,
  exit: number,
  direction: "LONG" | "SHORT",
): number {
  if (!(entry > 0) || !Number.isFinite(exit)) return 0;
  const raw = ((exit - entry) / entry) * 100;
  return direction === "LONG" ? raw : -raw;
}

function loadEnvFromFile() {
  for (const filename of [".env.local", ".env"]) {
    try {
      const text = readFileSync(path.join(process.cwd(), filename), "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        if (!key || process.env[key]) continue;
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        )
          value = value.slice(1, -1);
        process.env[key] = value;
      }
    } catch {
      // ignore
    }
  }
}

function getLastCompletedWeekOpens(count: number) {
  const currentWeekOpen = DateTime.fromISO(getCanonicalWeekOpenUtc(), {
    zone: "utc",
  });
  if (!currentWeekOpen.isValid)
    throw new Error("Failed to resolve canonical week anchor.");
  const out: string[] = [];
  for (let i = count; i >= 1; i -= 1)
    out.push(currentWeekOpen.minus({ weeks: i }).toUTC().toISO() ?? "");
  return out.filter(Boolean);
}

function selectCotSnapshotForWeek(
  history: CotSnapshot[],
  weekOpenUtc: string,
) {
  const weekDate = weekOpenUtc.slice(0, 10);
  const sorted = [...history].sort((a, b) =>
    b.report_date.localeCompare(a.report_date),
  );
  return (
    sorted.find((snap) => snap.report_date <= weekDate) ??
    sorted.at(-1) ??
    null
  );
}

function directionFromSentimentAggregate(
  agg?: SentimentAggregate,
): Direction {
  if (!agg) return "NEUTRAL";
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return "NEUTRAL";
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return "NEUTRAL";
}

function classifyTier(
  dealer: Direction,
  commercial: Direction,
  sentiment: Direction,
) {
  const dirs = [dealer, commercial, sentiment];
  const long = dirs.filter((d) => d === "LONG").length;
  const short = dirs.filter((d) => d === "SHORT").length;
  const neutral = dirs.length - long - short;
  if (long === 3)
    return {
      tier: "HIGH" as Tier,
      bias: "LONG" as Direction,
      votes: { long, short, neutral },
    };
  if (short === 3)
    return {
      tier: "HIGH" as Tier,
      bias: "SHORT" as Direction,
      votes: { long, short, neutral },
    };
  if (long >= 2)
    return {
      tier: "MEDIUM" as Tier,
      bias: "LONG" as Direction,
      votes: { long, short, neutral },
    };
  if (short >= 2)
    return {
      tier: "MEDIUM" as Tier,
      bias: "SHORT" as Direction,
      votes: { long, short, neutral },
    };
  return {
    tier: "NEUTRAL" as Tier,
    bias: "NEUTRAL" as Direction,
    votes: { long, short, neutral },
  };
}

/* ─────────────────────────  Candle Fetching  ───────────────────────── */

async function fetchRawM1Candles(
  symbol: string,
  openUtc: DateTime,
  closeUtc: DateTime,
): Promise<Candle[]> {
  const out = new Map<number, Candle>();
  let cursor = openUtc.toMillis();
  const closeMs = closeUtc.toMillis();
  const windowMs = 200 * 60_000;

  while (cursor < closeMs) {
    const windowEnd = Math.min(cursor + windowMs, closeMs);
    const url = new URL(
      `${BITGET_BASE_URL}/api/v2/mix/market/history-candles`,
    );
    url.searchParams.set("symbol", `${symbol}USDT`);
    url.searchParams.set("productType", BITGET_PRODUCT_TYPE);
    url.searchParams.set("granularity", "1m");
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(windowEnd));
    url.searchParams.set("limit", "200");
    let rows: Candle[] | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= BITGET_FETCH_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) {
            throw new Error(`M1 fetch retryable (${response.status}) ${symbol}`);
          }
          throw new Error(`M1 fetch failed (${response.status}) ${symbol}`);
        }
        const body = (await response.json()) as {
          code?: string;
          data?: string[][];
        };
        if (body.code && body.code !== "00000") {
          const retryableCode =
            body.code.startsWith("429") || body.code.startsWith("5");
          if (retryableCode)
            throw new Error(`M1 API retryable ${symbol}: ${body.code}`);
          throw new Error(`M1 API error ${symbol}: ${body.code}`);
        }
        rows = (body.data ?? [])
          .map((r) => {
            const quote = Number(r[6] ?? r[5]);
            return {
              ts: Number(r[0]),
              open: Number(r[1]),
              high: Number(r[2]),
              low: Number(r[3]),
              close: Number(r[4]),
              quoteVolume: Number.isFinite(quote) ? quote : null,
            };
          })
          .filter(
            (r) =>
              Number.isFinite(r.ts) &&
              Number.isFinite(r.open) &&
              Number.isFinite(r.high) &&
              Number.isFinite(r.low) &&
              Number.isFinite(r.close),
          )
          .filter((r) => r.ts >= cursor && r.ts < windowEnd)
          .sort((a, b) => a.ts - b.ts);
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= BITGET_FETCH_MAX_ATTEMPTS) break;
        const waitMs = BITGET_FETCH_BASE_RETRY_MS * 2 ** (attempt - 1);
        const message =
          error instanceof Error ? error.message : "unknown fetch error";
        console.warn(
          `    Retry ${attempt}/${BITGET_FETCH_MAX_ATTEMPTS - 1} ${symbol} M1 window ${toUtcIso(cursor)} -> ${toUtcIso(windowEnd)}: ${message}; waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
      }
    }
    if (!rows) {
      const message =
        lastError instanceof Error ? lastError.message : "unknown fetch error";
      throw new Error(`M1 fetch exhausted retries ${symbol}: ${message}`);
    }
    if (!rows.length) {
      cursor = windowEnd;
      continue;
    }
    for (const row of rows) out.set(row.ts, row);
    cursor = windowEnd;
  }

  return Array.from(out.values()).sort((a, b) => a.ts - b.ts);
}

function aggregateToH1(m1: Candle[]): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const c of m1) {
    const bucket = Math.floor(c.ts / 3_600_000) * 3_600_000;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)?.push(c);
  }
  return Array.from(groups.keys())
    .sort((a, b) => a - b)
    .map((bucket) => {
      const rows = (groups.get(bucket) ?? []).sort((a, b) => a.ts - b.ts);
      return {
        ts: bucket,
        open: rows[0].open,
        high: Math.max(...rows.map((r) => r.high)),
        low: Math.min(...rows.map((r) => r.low)),
        close: rows[rows.length - 1].close,
        quoteVolume: rows.reduce((s, r) => s + (r.quoteVolume ?? 0), 0),
      };
    });
}

/* ─────────────────────────  Candle Cache  ───────────────────────── */

function getCandleCachePath(symbol: string, weekOpenUtc: string): string {
  const weekKey = weekOpenUtc.slice(0, 10);
  return path.join(CANDLE_CACHE_DIR, `${symbol}-${weekKey}-m1.json`);
}

async function fetchOrCacheM1Candles(
  symbol: string,
  weekOpen: DateTime,
  weekClose: DateTime,
  weekOpenUtc: string,
): Promise<Candle[]> {
  const cachePath = getCandleCachePath(symbol, weekOpenUtc);
  try {
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as Candle[];
    if (Array.isArray(cached) && cached.length > 0) {
      console.log(`    ${symbol}: loaded ${cached.length} M1 from cache`);
      return cached;
    }
  } catch {
    // cache miss — fetch from API
  }

  const candles = await fetchRawM1Candles(symbol, weekOpen, weekClose);
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(candles));
  console.log(`    ${symbol}: cached ${candles.length} M1 candles`);
  return candles;
}

/* ─────────────────────────  Weekly Range  ───────────────────────── */

/**
 * Builds the weekly range from all 1-min candles within the canonical week.
 * This becomes the reference for the NEXT week's counter-trend detection.
 */
function buildWeeklyRange(
  m1Candles: Candle[],
  weekOpenUtc: string,
): WeeklyRange {
  if (!m1Candles.length)
    return { high: 0, low: 0, weekOpenUtc };
  return {
    high: Math.max(...m1Candles.map((c) => c.high)),
    low: Math.min(...m1Candles.map((c) => c.low)),
    weekOpenUtc,
  };
}

/* ─────────────────────────  Signal Detection  ───────────────────────── */

/**
 * Classifies the trading session from a UTC timestamp.
 */
function classifySession(ts: number): "ASIA" | "LONDON" | "NY" | "OTHER" {
  const hour = DateTime.fromMillis(ts, { zone: "utc" }).hour;
  if (hour >= 0 && hour < 8) return "ASIA";
  if (hour >= 8 && hour < 13) return "LONDON";
  if (hour >= 13 && hour < 21) return "NY";
  return "OTHER";
}

/**
 * Computes rolling average volume over the prior `lookback` H1 candles.
 */
function rollingAvgVolume(h1Candles: Candle[], currentIdx: number, lookback: number): number {
  let sum = 0;
  let count = 0;
  const start = Math.max(0, currentIdx - lookback);
  for (let i = start; i < currentIdx; i++) {
    const vol = h1Candles[i].quoteVolume;
    if (vol !== null && vol > 0) {
      sum += vol;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Computes wick-to-body ratio for a candle in a given sweep direction.
 * For a downside sweep (LONG counter-trend): lower wick / body.
 * For an upside sweep (SHORT counter-trend): upper wick / body.
 * Returns Infinity if body is zero (doji = perfect rejection).
 */
function wickToBodyRatio(candle: Candle, sweepDir: "LONG" | "SHORT"): number {
  const body = Math.abs(candle.close - candle.open);
  if (body < 1e-10) return 100; // doji — treat as very high ratio (capped)
  if (sweepDir === "LONG") {
    // Downside sweep → lower wick matters
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    return lowerWick / body;
  }
  // Upside sweep → upper wick matters
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  return upperWick / body;
}

/**
 * Counts consecutive H1 candles after confirmIdx that have bodies
 * in the counter-trend direction.
 */
function countMultiBarDisplacement(
  h1Candles: Candle[],
  confirmIdx: number,
  direction: "LONG" | "SHORT",
): number {
  let count = 0;
  // The confirm candle itself counts as bar 1
  for (let i = confirmIdx; i < h1Candles.length; i++) {
    const c = h1Candles[i];
    const bullBody = c.close > c.open;
    const bearBody = c.close < c.open;
    if (direction === "LONG" && bullBody) {
      count++;
    } else if (direction === "SHORT" && bearBody) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Detects counter-trend weekly sweep signals on 1H candles.
 *
 * A signal fires when:
 * 1. An H1 candle wick breaches the prior week's high/low by >= sweepMinPct
 * 2. That same candle (or the next one) closes back inside the prior week range (rejection)
 * 3. The rejection candle body shows displacement >= displacementMinPct in counter direction
 *
 * Each signal is enriched with entry quality metrics so the param-level filter
 * can accept/reject based on quality profiles.
 *
 * Returns ALL signals found (not just the first), so the caller can apply
 * handshake, bias, and quality filters.
 */
function detectCounterTrendSignals(params: {
  symbol: CoreSymbol;
  weekOpenUtc: string;
  h1Candles: Candle[];
  priorWeekRange: WeeklyRange;
  sweepMinPct: number;
  displacementMinPct: number;
  weeklyBias: Direction;
  tier: Tier;
  weekOpenPrice: number;
}): { signals: CounterTrendSignal[]; diagnostics: CounterTrendDiagnostics } {
  const {
    symbol,
    weekOpenUtc,
    h1Candles,
    priorWeekRange,
    sweepMinPct,
    displacementMinPct,
    weeklyBias,
    tier,
    weekOpenPrice,
  } = params;

  const rangeWidth = priorWeekRange.high - priorWeekRange.low;

  const diagnostics: CounterTrendDiagnostics = {
    totalSweepEvents: 0,
    skippedSameAsBias: 0,
    skippedNoRejection: 0,
    skippedNoDisplacement: 0,
    skippedReclaimTooShallow: 0,
    skippedWickToBodyTooLow: 0,
    skippedNoMultiBarDisplacement: 0,
    skippedVolumeTooLow: 0,
    skippedSweepRangeTooSmall: 0,
    qualified: 0,
  };

  const signals: CounterTrendSignal[] = [];

  for (let i = 0; i < h1Candles.length; i++) {
    const candle = h1Candles[i];
    const nextCandle = i + 1 < h1Candles.length ? h1Candles[i + 1] : null;

    // Check for upside sweep (price breaches prior week high -> SHORT counter-trend)
    const upSweepPct =
      ((candle.high - priorWeekRange.high) / priorWeekRange.high) * 100;
    // Check for downside sweep (price breaches prior week low -> LONG counter-trend)
    const downSweepPct =
      ((priorWeekRange.low - candle.low) / priorWeekRange.low) * 100;

    const candidates: Array<{
      dir: "LONG" | "SHORT";
      sweepPct: number;
      sweepPrice: number;
    }> = [];

    if (upSweepPct >= sweepMinPct) {
      candidates.push({
        dir: "SHORT",
        sweepPct: upSweepPct,
        sweepPrice: candle.high,
      });
    }
    if (downSweepPct >= sweepMinPct) {
      candidates.push({
        dir: "LONG",
        sweepPct: downSweepPct,
        sweepPrice: candle.low,
      });
    }

    diagnostics.totalSweepEvents += candidates.length;

    for (const candidate of candidates) {
      // Check rejection: close must be back inside prior week range
      const confirmChoices: Array<{ candle: Candle; idx: number }> = [
        { candle, idx: i },
      ];
      if (nextCandle) confirmChoices.push({ candle: nextCandle, idx: i + 1 });

      let rejectionCandle: Candle | null = null;
      let rejectionIdx = -1;
      for (const check of confirmChoices) {
        if (
          candidate.dir === "SHORT" &&
          check.candle.close < priorWeekRange.high
        ) {
          rejectionCandle = check.candle;
          rejectionIdx = check.idx;
          break;
        }
        if (
          candidate.dir === "LONG" &&
          check.candle.close > priorWeekRange.low
        ) {
          rejectionCandle = check.candle;
          rejectionIdx = check.idx;
          break;
        }
      }

      if (!rejectionCandle) {
        diagnostics.skippedNoRejection++;
        continue;
      }

      // Check displacement: body must show counter-trend strength
      const bodyPct =
        candidate.dir === "SHORT"
          ? ((rejectionCandle.open - rejectionCandle.close) /
              rejectionCandle.open) *
            100
          : ((rejectionCandle.close - rejectionCandle.open) /
              rejectionCandle.open) *
            100;

      if (bodyPct < displacementMinPct) {
        diagnostics.skippedNoDisplacement++;
        continue;
      }

      // ── Compute entry quality metrics ──

      // 1. Reclaim depth: how far inside the range did the confirm candle close?
      let reclaimDepthPct = 0;
      if (candidate.dir === "LONG" && priorWeekRange.low > 0) {
        // LONG: close should be above the prior week low — higher = better
        reclaimDepthPct =
          ((rejectionCandle.close - priorWeekRange.low) / priorWeekRange.low) *
          100;
      } else if (candidate.dir === "SHORT" && priorWeekRange.high > 0) {
        // SHORT: close should be below the prior week high — further below = better
        reclaimDepthPct =
          ((priorWeekRange.high - rejectionCandle.close) /
            priorWeekRange.high) *
          100;
      }

      // 2. Wick-to-body ratio on the sweep candle
      const wbRatio = wickToBodyRatio(candle, candidate.dir);

      // 3. Multi-bar displacement: count consecutive H1 bars in counter direction
      const multiBarCount = countMultiBarDisplacement(
        h1Candles,
        rejectionIdx,
        candidate.dir,
      );

      // 4. Volume spike ratio: sweep candle volume vs rolling 24-bar average
      const avgVol = rollingAvgVolume(h1Candles, i, 24);
      const sweepVol = candle.quoteVolume ?? 0;
      const volSpikeRatio = avgVol > 0 ? sweepVol / avgVol : 0;

      // 5. Sweep-to-range proportionality: sweep depth as % of range width
      let sweepRangeProportionPct = 0;
      if (rangeWidth > 0) {
        const sweepDepthAbs =
          candidate.dir === "LONG"
            ? priorWeekRange.low - candle.low
            : candle.high - priorWeekRange.high;
        sweepRangeProportionPct = (sweepDepthAbs / rangeWidth) * 100;
      }

      // 6. Session at sweep
      const sessionAtSweep = classifySession(candle.ts);

      // Calculate how far price has moved from week open in bias direction
      const currentPrice = rejectionCandle.close;
      let weekMoveFromOpenPct = 0;
      if (weekOpenPrice > 0) {
        weekMoveFromOpenPct =
          ((currentPrice - weekOpenPrice) / weekOpenPrice) * 100;
        // Normalize: positive = moved in bias direction
        if (weeklyBias === "SHORT") weekMoveFromOpenPct = -weekMoveFromOpenPct;
      }

      diagnostics.qualified++;
      signals.push({
        symbol,
        weekOpenUtc,
        direction: candidate.dir,
        priorWeekHigh: priorWeekRange.high,
        priorWeekLow: priorWeekRange.low,
        sweepPrice: candidate.sweepPrice,
        sweepPct: candidate.sweepPct,
        sweepCandleTs: candle.ts,
        confirmCandleTs: rejectionCandle.ts,
        confirmPrice: rejectionCandle.close,
        displacementPct: bodyPct,
        weeklyBias,
        tier,
        weekMoveFromOpenPct,
        reclaimDepthPct,
        wickToBodyRatio: wbRatio,
        multiBarDisplacement: multiBarCount >= 2,
        multiBarDisplacementCount: multiBarCount,
        volumeSpikeRatio: volSpikeRatio,
        sweepRangeProportionPct,
        sessionAtSweep,
      });
    }
  }

  return { signals, diagnostics };
}

type CounterTrendDiagnostics = {
  totalSweepEvents: number;
  skippedSameAsBias: number;
  skippedNoRejection: number;
  skippedNoDisplacement: number;
  skippedReclaimTooShallow: number;
  skippedWickToBodyTooLow: number;
  skippedNoMultiBarDisplacement: number;
  skippedVolumeTooLow: number;
  skippedSweepRangeTooSmall: number;
  qualified: number;
};

/* ─────────────────────────  Bias Filter  ───────────────────────── */

/**
 * Applies the bias filter to a counter-trend signal.
 *
 * NONE: All counter-trend signals pass (rawest test).
 * NEUTRAL_ONLY: Only allow counter-trend when bias is NEUTRAL.
 * EXTENDED_5PCT: Allow counter-trend when bias is NEUTRAL, OR when price
 *   has already moved >= 5% in the bias direction this week (exhaustion).
 */
function passesCounterTrendBiasFilter(
  signal: CounterTrendSignal,
  filter: ParamSet["biasFilter"],
): boolean {
  // Counter-trend means we're trading AGAINST the bias direction.
  // If bias is SHORT and signal is LONG, that's counter-trend. Good.
  // If bias is SHORT and signal is SHORT, that's WITH the bias. Skip for this system.
  if (signal.weeklyBias === signal.direction) return false; // not counter-trend

  switch (filter) {
    case "NONE":
      return true;
    case "NEUTRAL_ONLY":
      return signal.tier === "NEUTRAL";
    case "EXTENDED_5PCT":
      if (signal.tier === "NEUTRAL") return true;
      return signal.weekMoveFromOpenPct >= 5; // price has extended 5%+ in bias direction
    default:
      return true;
  }
}

/* ─────────────────────────  Entry Quality Filter  ───────────────────────── */

/**
 * Applies entry quality filters to a signal based on the param set thresholds.
 * Returns true if the signal passes all quality gates.
 */
function passesEntryQualityFilter(
  signal: CounterTrendSignal,
  ps: ParamSet,
): boolean {
  if (ps.minReclaimDepthPct > 0 && signal.reclaimDepthPct < ps.minReclaimDepthPct) {
    return false;
  }
  if (ps.minWickToBodyRatio > 0 && signal.wickToBodyRatio < ps.minWickToBodyRatio) {
    return false;
  }
  if (ps.requireMultiBarDisplacement && !signal.multiBarDisplacement) {
    return false;
  }
  if (ps.minVolumeSpikeRatio > 0 && signal.volumeSpikeRatio < ps.minVolumeSpikeRatio) {
    return false;
  }
  if (ps.minSweepRangeProportionPct > 0 && signal.sweepRangeProportionPct < ps.minSweepRangeProportionPct) {
    return false;
  }
  return true;
}

/* ─────────────────────────  Handshake Evaluation  ───────────────────────── */

/**
 * Evaluates handshake between BTC and ETH counter-trend signals.
 * Both must produce signals within the handshake window.
 * Returns matched pairs with the later timestamp as entry time.
 */
function evaluateCounterTrendHandshake(
  btcSignals: CounterTrendSignal[],
  ethSignals: CounterTrendSignal[],
  handshakeWindowMin: number,
): Array<{
  btc: CounterTrendSignal;
  eth: CounterTrendSignal;
  entryTs: number;
  delayMinutes: number;
}> {
  const windowMs = handshakeWindowMin * 60_000;
  const matched: Array<{
    btc: CounterTrendSignal;
    eth: CounterTrendSignal;
    entryTs: number;
    delayMinutes: number;
  }> = [];

  const usedBtc = new Set<number>();
  const usedEth = new Set<number>();

  for (const btcSig of btcSignals) {
    for (const ethSig of ethSignals) {
      if (usedBtc.has(btcSig.confirmCandleTs)) continue;
      if (usedEth.has(ethSig.confirmCandleTs)) continue;
      // Handshake must confirm the same sweep direction across BTC/ETH.
      if (btcSig.direction !== ethSig.direction) continue;

      const delay = Math.abs(btcSig.confirmCandleTs - ethSig.confirmCandleTs);
      if (delay <= windowMs) {
        const entryTs = Math.max(
          btcSig.confirmCandleTs,
          ethSig.confirmCandleTs,
        );
        matched.push({
          btc: btcSig,
          eth: ethSig,
          entryTs,
          delayMinutes: delay / 60_000,
        });
        usedBtc.add(btcSig.confirmCandleTs);
        usedEth.add(ethSig.confirmCandleTs);
      }
    }
  }

  return matched;
}

/* ─────────────────────────  Risk Simulation  ───────────────────────── */

/**
 * Simulates the counter-trend scaling risk model on M1 candles.
 *
 * Uses M1 candles (not H1) for exit simulation to capture intrabar stop hits.
 * The scaling ladder is more conservative than the bias system.
 */
function simulateCounterTrendExit(params: {
  m1Candles: Candle[];
  entryTs: number;
  entryPrice: number;
  direction: "LONG" | "SHORT";
  initialStopPct: number;
  weekCloseTs: number;
  partialTp: boolean;
  disableStops: boolean;
}): {
  exitTs: number;
  exitPrice: number;
  exitReason: ExitReason;
  maxLeverageReached: number;
  breakevenReached: boolean;
  milestonesHit: number[];
  unleveredPnlPct: number;
} {
  const {
    m1Candles,
    entryTs,
    entryPrice,
    direction,
    initialStopPct,
    weekCloseTs,
    partialTp,
    disableStops,
  } = params;

  // Find entry index in M1 candles
  let entryIdx = -1;
  for (let i = 0; i < m1Candles.length; i++) {
    if (m1Candles[i].ts >= entryTs) {
      entryIdx = i;
      break;
    }
  }
  if (entryIdx < 0) {
    return {
      exitTs: entryTs,
      exitPrice: entryPrice,
      exitReason: "WEEK_CLOSE",
      maxLeverageReached: CT_INITIAL_LEVERAGE,
      breakevenReached: false,
      milestonesHit: [],
      unleveredPnlPct: 0,
    };
  }

  let stopPrice =
    direction === "LONG"
      ? entryPrice * (1 - initialStopPct / 100)
      : entryPrice * (1 + initialStopPct / 100);

  let maxLev = CT_INITIAL_LEVERAGE;
  let breakevenReached = false;
  let trailingOffsetPct: number | null = null;
  let peakFavorable = entryPrice;
  const milestonesHit: number[] = [];
  let partialTaken = false;

  function favorableMovePct() {
    return direction === "LONG"
      ? ((peakFavorable - entryPrice) / entryPrice) * 100
      : ((entryPrice - peakFavorable) / entryPrice) * 100;
  }

  for (let i = entryIdx + 1; i < m1Candles.length; i++) {
    const candle = m1Candles[i];

    // Force close at week boundary
    if (candle.ts >= weekCloseTs) {
      const unlev = pctMove(entryPrice, candle.close, direction);
      return {
        exitTs: candle.ts,
        exitPrice: candle.close,
        exitReason: "WEEK_CLOSE",
        maxLeverageReached: maxLev,
        breakevenReached,
        milestonesHit: [...milestonesHit].sort((a, b) => a - b),
        unleveredPnlPct: unlev,
      };
    }
    if (disableStops) continue;

    // Update peak
    if (direction === "LONG") {
      if (candle.high > peakFavorable) peakFavorable = candle.high;
    } else {
      if (candle.low < peakFavorable) peakFavorable = candle.low;
    }

    const move = favorableMovePct();

    // Check partial TP at +3%
    if (partialTp && !partialTaken && move >= 3) {
      partialTaken = true;
      // Note: In a real sim we'd reduce position size by 50%.
      // For backtest purposes, we log it but continue with full position
      // and note the partial TP in results. The P&L is approximate.
    }

    // Check milestones
    for (const milestone of CT_MILESTONES) {
      if (move < milestone) continue;
      if (milestonesHit.includes(milestone)) continue;
      milestonesHit.push(milestone);
      maxLev = Math.max(maxLev, CT_LEVERAGE_BY_MILESTONE[milestone]);

      if (milestone >= 2) {
        stopPrice = entryPrice;
        breakevenReached = true;
      }
      if (milestone >= 4) {
        trailingOffsetPct = CT_TRAIL_OFFSET_BY_MILESTONE[milestone];
      }
      if (milestone >= 6) {
        trailingOffsetPct = CT_TRAIL_OFFSET_BY_MILESTONE[milestone];
      }
    }

    // Compute trailing stop
    let trailPrice: number | null = null;
    if (trailingOffsetPct !== null) {
      trailPrice =
        direction === "LONG"
          ? peakFavorable * (1 - trailingOffsetPct / 100)
          : peakFavorable * (1 + trailingOffsetPct / 100);
    }

    // Check stop hit
    if (direction === "LONG") {
      const stopHit = candle.low <= stopPrice;
      const trailHit = trailPrice !== null && candle.low <= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice =
          stopHit && trailHit
            ? Math.max(stopPrice, trailPrice as number)
            : stopHit
              ? stopPrice
              : (trailPrice as number);
        const exitReason = trailHit
          ? "TRAILING_STOP"
          : breakevenReached &&
              Math.abs(stopPrice - entryPrice) / entryPrice < 1e-9
            ? "BREAKEVEN_STOP"
            : "STOP_LOSS";
        return {
          exitTs: candle.ts,
          exitPrice,
          exitReason,
          maxLeverageReached: maxLev,
          breakevenReached,
          milestonesHit: [...milestonesHit].sort((a, b) => a - b),
          unleveredPnlPct: pctMove(entryPrice, exitPrice, direction),
        };
      }
    } else {
      const stopHit = candle.high >= stopPrice;
      const trailHit = trailPrice !== null && candle.high >= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice =
          stopHit && trailHit
            ? Math.min(stopPrice, trailPrice as number)
            : stopHit
              ? stopPrice
              : (trailPrice as number);
        const exitReason = trailHit
          ? "TRAILING_STOP"
          : breakevenReached &&
              Math.abs(stopPrice - entryPrice) / entryPrice < 1e-9
            ? "BREAKEVEN_STOP"
            : "STOP_LOSS";
        return {
          exitTs: candle.ts,
          exitPrice,
          exitReason,
          maxLeverageReached: maxLev,
          breakevenReached,
          milestonesHit: [...milestonesHit].sort((a, b) => a - b),
          unleveredPnlPct: pctMove(entryPrice, exitPrice, direction),
        };
      }
    }
  }

  // If we get here, end of candle data = week close
  const lastCandle = m1Candles[m1Candles.length - 1];
  return {
    exitTs: lastCandle.ts,
    exitPrice: lastCandle.close,
    exitReason: "WEEK_CLOSE",
    maxLeverageReached: maxLev,
    breakevenReached,
    milestonesHit: [...milestonesHit].sort((a, b) => a - b),
    unleveredPnlPct: pctMove(entryPrice, lastCandle.close, direction),
  };
}

/* ─────────────────────────  Bias Computation  ───────────────────────── */

const NEUTRAL_BIAS: WeeklyBias = {
  tier: "NEUTRAL",
  bias: "NEUTRAL",
  dealer: "NEUTRAL",
  commercial: "NEUTRAL",
  sentiment: "NEUTRAL",
  sentimentSource: "missing",
};

function neutralBiasForAll(): Record<CoreSymbol, WeeklyBias> {
  return { BTC: { ...NEUTRAL_BIAS }, ETH: { ...NEUTRAL_BIAS } };
}

/**
 * COT-only bias: uses dealer + commercial positioning, sets sentiment to NEUTRAL.
 * No DB connection needed — COT snapshots are loaded from the file-based store.
 */
function computeWeeklyBiasCotOnly(
  weekOpenUtc: string,
  cotHistory: CotSnapshot[],
): Record<CoreSymbol, WeeklyBias> {
  const cotSnapshot = selectCotSnapshotForWeek(cotHistory, weekOpenUtc);
  if (!cotSnapshot) {
    console.warn(`  No COT snapshot for week ${weekOpenUtc}, defaulting to NEUTRAL`);
    return neutralBiasForAll();
  }

  const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
  const dealerPairs = derivePairDirectionsByBase(
    cotSnapshot.currencies,
    pairDefs,
    "dealer",
  );
  const commercialPairs = derivePairDirectionsByBase(
    cotSnapshot.currencies,
    pairDefs,
    "commercial",
  );

  const result = {} as Record<CoreSymbol, WeeklyBias>;
  for (const base of CORE_SYMBOLS) {
    const pair = `${base}USD`;
    const dealer = (dealerPairs[pair]?.direction ?? "NEUTRAL") as Direction;
    const commercial = (commercialPairs[pair]?.direction ??
      "NEUTRAL") as Direction;
    // COT-only: 2 votes. Tie → NEUTRAL.
    const classified = classifyTier(dealer, commercial, "NEUTRAL");

    result[base] = {
      tier: classified.tier,
      bias: classified.bias,
      dealer,
      commercial,
      sentiment: "NEUTRAL",
      sentimentSource: "missing",
    };
  }

  return result;
}

/**
 * Full bias: COT + sentiment (requires DB for sentiment aggregates).
 */
async function computeWeeklyBiasFull(
  weekOpenUtc: string,
  weekCloseUtc: string,
  cotHistory: CotSnapshot[],
): Promise<Record<CoreSymbol, WeeklyBias>> {
  const cotSnapshot = selectCotSnapshotForWeek(cotHistory, weekOpenUtc);
  if (!cotSnapshot) throw new Error(`No COT snapshot for week ${weekOpenUtc}`);

  const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
  const dealerPairs = derivePairDirectionsByBase(
    cotSnapshot.currencies,
    pairDefs,
    "dealer",
  );
  const commercialPairs = derivePairDirectionsByBase(
    cotSnapshot.currencies,
    pairDefs,
    "commercial",
  );

  const sentiment = await getAggregatesForWeekStartWithBackfill(
    weekOpenUtc,
    weekCloseUtc,
  );
  const sentimentMap = new Map(
    sentiment.map((row) => [row.symbol.toUpperCase(), row]),
  );

  const result = {} as Record<CoreSymbol, WeeklyBias>;
  for (const base of CORE_SYMBOLS) {
    const pair = `${base}USD`;
    const dealer = (dealerPairs[pair]?.direction ?? "NEUTRAL") as Direction;
    const commercial = (commercialPairs[pair]?.direction ??
      "NEUTRAL") as Direction;
    const agg =
      sentimentMap.get(pair) ??
      sentimentMap.get(base) ??
      sentimentMap.get(`${base}USDT`);
    const sentimentDirection = directionFromSentimentAggregate(agg);
    const classified = classifyTier(dealer, commercial, sentimentDirection);

    result[base] = {
      tier: classified.tier,
      bias: classified.bias,
      dealer,
      commercial,
      sentiment: sentimentDirection,
      sentimentSource: agg ? "aggregate" : "missing",
    };
  }

  return result;
}

/* ─────────────────────────  Main Backtest  ───────────────────────── */

async function main() {
  loadEnvFromFile();
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  COUNTER-TREND WEEKLY SWEEP BACKTEST                ║");
  console.log("║  Freedom_EXE — Limni Intelligence Platform          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`Test period: ${WEEKS_TO_BACKTEST} weeks`);
  console.log(`Bias mode: ${CT_BIAS_MODE}`);
  console.log(
    `Mode: ${CT_NO_STOP_TEST_MODE ? "NO-STOP (week close exit only)" : "STANDARD (stops enabled)"}`,
  );
  console.log(
    `Entry policy: ${CT_SINGLE_ENTRY_PER_WEEK ? "single BTC+ETH handshake per week" : "multiple handshakes per week"}`,
  );
  console.log("Handshake: BTC+ETH required, same-direction sweep only\n");

  // We need an extra prior week for the range reference, so fetch WEEKS_TO_BACKTEST + 1
  const allWeekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST + 1);
  const priorWeekOpen = allWeekOpens[0]; // used only for range building
  const tradingWeekOpens = allWeekOpens.slice(1);

  console.log(`Prior week (range source): ${priorWeekOpen}`);
  console.log(
    `Trading weeks: ${tradingWeekOpens[0]} to ${tradingWeekOpens[tradingWeekOpens.length - 1]} (${tradingWeekOpens.length} weeks)\n`,
  );

  // ── Fetch COT history (skip when BIAS_MODE=NONE) ──
  let cotHistory: CotSnapshot[] = [];
  if (CT_BIAS_MODE !== "NONE") {
    console.log("Loading COT history...");
    cotHistory = await readSnapshotHistory("crypto", 520); // ~10 years
    if (!cotHistory.length) throw new Error("No COT history available.");
    console.log(`  COT snapshots loaded: ${cotHistory.length}\n`);
  } else {
    console.log("Bias mode: NONE — skipping COT/sentiment load\n");
  }

  // ── Fetch candle data for all weeks (prior + trading) ──
  const weekDataMap = new Map<string, WeekData>();

  for (let w = 0; w < allWeekOpens.length; w++) {
    const weekOpenUtc = allWeekOpens[w];
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekCloseUtc = weekClose.toISO() ?? "";
    const isTradingWeek = w > 0;

    console.log(
      `Week ${w + 1}/${allWeekOpens.length}: ${weekOpenUtc} ${isTradingWeek ? "(TRADING)" : "(RANGE ONLY)"}`,
    );

    // ── Compute bias based on mode ──
    let bias: Record<CoreSymbol, WeeklyBias>;
    if (!isTradingWeek || CT_BIAS_MODE === "NONE") {
      bias = neutralBiasForAll();
    } else if (CT_BIAS_MODE === "COT_ONLY") {
      bias = computeWeeklyBiasCotOnly(weekOpenUtc, cotHistory);
    } else {
      bias = await computeWeeklyBiasFull(weekOpenUtc, weekCloseUtc, cotHistory);
    }

    const m1Candles = {} as Record<CoreSymbol, Candle[]>;
    const h1Candles = {} as Record<CoreSymbol, Candle[]>;
    const weekOpenPrice = {} as Record<CoreSymbol, number>;

    for (const symbol of CORE_SYMBOLS) {
      console.log(`  ${symbol} M1 candles...`);
      m1Candles[symbol] = await fetchOrCacheM1Candles(
        symbol,
        weekOpen,
        weekClose,
        weekOpenUtc,
      );
      h1Candles[symbol] = aggregateToH1(m1Candles[symbol]);
      weekOpenPrice[symbol] = m1Candles[symbol][0]?.open ?? 0;
      console.log(
        `    ${symbol}: ${m1Candles[symbol].length} M1 -> ${h1Candles[symbol].length} H1`,
      );
    }

    weekDataMap.set(weekOpenUtc, {
      weekOpenUtc,
      weekCloseUtc,
      bias,
      m1Candles,
      h1Candles,
      priorWeekRange: null, // will be filled below
      weekOpenPrice,
    });
  }

  // ── Build prior week ranges and link to trading weeks ──
  for (let w = 1; w < allWeekOpens.length; w++) {
    const priorWeek = weekDataMap.get(allWeekOpens[w - 1]);
    const currentWeek = weekDataMap.get(allWeekOpens[w]);
    if (!priorWeek || !currentWeek) continue;

    const priorRanges = {} as Record<CoreSymbol, WeeklyRange>;
    for (const symbol of CORE_SYMBOLS) {
      priorRanges[symbol] = buildWeeklyRange(
        priorWeek.m1Candles[symbol],
        priorWeek.weekOpenUtc,
      );
      console.log(
        `  ${symbol} prior week range: ${priorRanges[symbol].low.toFixed(2)} - ${priorRanges[symbol].high.toFixed(2)}`,
      );
    }
    currentWeek.priorWeekRange = priorRanges;
  }

  // ── Build parameter grid ──
  // Now includes quality profiles. To keep grid manageable, we use a reduced
  // set of base params when quality profiles are active.
  const paramSets: ParamSet[] = [];
  const stopOptions = CT_NO_STOP_TEST_MODE ? [0] : INITIAL_STOP_PCTS;
  const partialTpOptions = CT_NO_STOP_TEST_MODE ? [false] : PARTIAL_TP_OPTIONS;
  for (const sweepMinPct of SWEEP_THRESHOLDS) {
    for (const displacementMinPct of DISPLACEMENT_THRESHOLDS) {
      for (const handshakeWindowMin of HANDSHAKE_WINDOWS_MIN) {
        for (const initialStopPct of stopOptions) {
          for (const biasFilter of BIAS_FILTERS) {
            for (const partialTp of partialTpOptions) {
              for (const qp of QUALITY_PROFILES) {
                const stopLabel = CT_NO_STOP_TEST_MODE
                  ? "STNONE"
                  : `ST${initialStopPct}`;
                paramSets.push({
                  id: `S${sweepMinPct}_D${displacementMinPct}_H${handshakeWindowMin}_${stopLabel}_${biasFilter}_TP${partialTp ? "ON" : "OFF"}_Q${qp.label}${CT_SINGLE_ENTRY_PER_WEEK ? "_FIRST" : ""}`,
                  sweepMinPct,
                  displacementMinPct,
                  handshakeWindowMin,
                  initialStopPct,
                  biasFilter,
                  partialTp,
                  noStopLoss: CT_NO_STOP_TEST_MODE,
                  singleEntryPerWeek: CT_SINGLE_ENTRY_PER_WEEK,
                  entryQuality: qp.label === "RAW" ? "OFF" : "STRICT",
                  minReclaimDepthPct: qp.minReclaimDepthPct,
                  minWickToBodyRatio: qp.minWickToBodyRatio,
                  requireMultiBarDisplacement: qp.requireMultiBarDisplacement,
                  minVolumeSpikeRatio: qp.minVolumeSpikeRatio,
                  minSweepRangeProportionPct: qp.minSweepRangeProportionPct,
                });
              }
            }
          }
        }
      }
    }
  }
  console.log(`\nParameter grid: ${paramSets.length} combinations (${QUALITY_PROFILES.length} quality profiles x ${paramSets.length / QUALITY_PROFILES.length} base combos)\n`);

  // ── Aggregate signal diagnostics ──
  const globalSignalDiag = {
    totalWeeklySweepsDetected: 0,
    bySymbol: { BTC: 0, ETH: 0 } as Record<CoreSymbol, number>,
    byWeek: [] as Array<{ weekOpenUtc: string; sweeps: number }>,
    byDirection: { LONG: 0, SHORT: 0 },
  };

  // ── Pre-detect all signals for each param combination ──
  // We detect signals per (week, symbol, sweep threshold, displacement threshold)
  // then apply bias filter and handshake per param set.
  type SignalCacheKey = string;
  const signalCache = new Map<
    SignalCacheKey,
    {
      signals: CounterTrendSignal[];
      diagnostics: CounterTrendDiagnostics;
    }
  >();

  for (const weekOpenUtc of tradingWeekOpens) {
    const week = weekDataMap.get(weekOpenUtc);
    if (!week || !week.priorWeekRange) continue;

    let weekSweepTotal = 0;

    for (const symbol of CORE_SYMBOLS) {
      for (const sweepMinPct of SWEEP_THRESHOLDS) {
        for (const displacementMinPct of DISPLACEMENT_THRESHOLDS) {
          const key = `${weekOpenUtc}:${symbol}:${sweepMinPct}:${displacementMinPct}`;

          const result = detectCounterTrendSignals({
            symbol,
            weekOpenUtc,
            h1Candles: week.h1Candles[symbol],
            priorWeekRange: week.priorWeekRange[symbol],
            sweepMinPct,
            displacementMinPct,
            weeklyBias: week.bias[symbol].bias,
            tier: week.bias[symbol].tier,
            weekOpenPrice: week.weekOpenPrice[symbol],
          });

          signalCache.set(key, result);

          // Only count diagnostics for the widest (0.3) sweep to avoid double-counting
          if (
            sweepMinPct === SWEEP_THRESHOLDS[0] &&
            displacementMinPct === DISPLACEMENT_THRESHOLDS[0]
          ) {
            weekSweepTotal += result.diagnostics.totalSweepEvents;
            globalSignalDiag.bySymbol[symbol] +=
              result.diagnostics.totalSweepEvents;
            for (const sig of result.signals) {
              globalSignalDiag.byDirection[sig.direction]++;
            }
          }
        }
      }
    }

    globalSignalDiag.totalWeeklySweepsDetected += weekSweepTotal;
    globalSignalDiag.byWeek.push({
      weekOpenUtc,
      sweeps: weekSweepTotal,
    });
  }

  console.log(
    `Total weekly sweep events detected (at lowest thresholds): ${globalSignalDiag.totalWeeklySweepsDetected}`,
  );
  console.log(
    `  By direction: LONG=${globalSignalDiag.byDirection.LONG} SHORT=${globalSignalDiag.byDirection.SHORT}\n`,
  );

  // ── Run parameter sweep ──
  const results: ParamSetResult[] = [];
  let tradeIdCounter = 1;

  for (const ps of paramSets) {
    let balance = STARTING_BALANCE_USD;
    let peakBalance = balance;
    let maxDrawdownPct = 0;
    const trades: ClosedTrade[] = [];
    let signalsDetected = 0;
    let signalsFiltered = 0;
    let signalsEntered = 0;
    const directionalFunnel = createEmptyDirectionalFunnel();
    const exitReasonBreakdown: Record<string, number> = {};

    for (const weekOpenUtc of tradingWeekOpens) {
      const week = weekDataMap.get(weekOpenUtc);
      if (!week || !week.priorWeekRange) continue;

      const weekClose = DateTime.fromISO(week.weekCloseUtc, { zone: "utc" });
      const weekCloseTs = weekClose.toMillis();

      // Get cached signals for this param combo
      const btcKey = `${weekOpenUtc}:BTC:${ps.sweepMinPct}:${ps.displacementMinPct}`;
      const ethKey = `${weekOpenUtc}:ETH:${ps.sweepMinPct}:${ps.displacementMinPct}`;
      const btcResult = signalCache.get(btcKey);
      const ethResult = signalCache.get(ethKey);

      if (!btcResult || !ethResult) continue;

      const allBtcSignals = btcResult.signals;
      const allEthSignals = ethResult.signals;
      signalsDetected += allBtcSignals.length + allEthSignals.length;
      for (const s of allBtcSignals) directionalFunnel[s.direction].raw++;
      for (const s of allEthSignals) directionalFunnel[s.direction].raw++;

      // Apply bias filter, then entry quality filter
      const btcAfterBias = allBtcSignals.filter((s) =>
        passesCounterTrendBiasFilter(s, ps.biasFilter),
      );
      const ethAfterBias = allEthSignals.filter((s) =>
        passesCounterTrendBiasFilter(s, ps.biasFilter),
      );
      for (const s of btcAfterBias) directionalFunnel[s.direction].afterBias++;
      for (const s of ethAfterBias) directionalFunnel[s.direction].afterBias++;

      const filteredBtc = btcAfterBias.filter((s) =>
        passesEntryQualityFilter(s, ps),
      );
      const filteredEth = ethAfterBias.filter((s) =>
        passesEntryQualityFilter(s, ps),
      );
      for (const s of filteredBtc)
        directionalFunnel[s.direction].afterQuality++;
      for (const s of filteredEth)
        directionalFunnel[s.direction].afterQuality++;
      signalsFiltered +=
        allBtcSignals.length -
        filteredBtc.length +
        (allEthSignals.length - filteredEth.length);

      // Evaluate handshake
      const handshakes = evaluateCounterTrendHandshake(
        filteredBtc,
        filteredEth,
        ps.handshakeWindowMin,
      );
      const selectedHandshakes = ps.singleEntryPerWeek
        ? [...handshakes].sort((a, b) => a.entryTs - b.entryTs).slice(0, 1)
        : handshakes;
      for (const hs of handshakes) {
        directionalFunnel[hs.btc.direction].afterHandshake += 2;
      }
      for (const hs of selectedHandshakes) {
        directionalFunnel[hs.btc.direction].entered += 2;
      }

      // Process each handshake entry
      for (const hs of selectedHandshakes) {
        signalsEntered += 2; // BTC + ETH

        const marginPerSymbol = balance * 0.5;

        // Simulate BTC trade
        for (const { signal, sym } of [
          { signal: hs.btc, sym: "BTC" as CoreSymbol },
          { signal: hs.eth, sym: "ETH" as CoreSymbol },
        ]) {
          const exit = simulateCounterTrendExit({
            m1Candles: week.m1Candles[sym],
            entryTs: hs.entryTs,
            entryPrice: signal.confirmPrice,
            direction: signal.direction,
            initialStopPct: ps.initialStopPct,
            weekCloseTs,
            partialTp: ps.partialTp,
            disableStops: ps.noStopLoss,
          });

          const leveragedPnlPct =
            exit.unleveredPnlPct * CT_INITIAL_LEVERAGE;
          const pnlUsd = marginPerSymbol * (leveragedPnlPct / 100);
          balance += pnlUsd;
          if (balance > peakBalance) peakBalance = balance;
          const drawdown =
            peakBalance > 0
              ? ((peakBalance - balance) / peakBalance) * 100
              : 0;
          if (drawdown > maxDrawdownPct) maxDrawdownPct = drawdown;

          exitReasonBreakdown[exit.exitReason] =
            (exitReasonBreakdown[exit.exitReason] ?? 0) + 1;

          trades.push({
            id: tradeIdCounter++,
            paramSetId: ps.id,
            symbol: sym,
            weekOpenUtc,
            direction: signal.direction,
            tier: signal.tier,
            weeklyBias: signal.weeklyBias,
            priorWeekHigh: signal.priorWeekHigh,
            priorWeekLow: signal.priorWeekLow,
            sweepPrice: signal.sweepPrice,
            sweepPct: round(signal.sweepPct),
            sweepThresholdUsed: ps.sweepMinPct,
            displacementPct: round(signal.displacementPct),
            displacementThresholdUsed: ps.displacementMinPct,
            handshakeWindowMin: ps.handshakeWindowMin,
            handshakeDelayMinutes: round(hs.delayMinutes, 1),
            entryTimeUtc: toUtcIso(hs.entryTs),
            entryPrice: round(signal.confirmPrice, 2),
            stopPrice: ps.noStopLoss
              ? 0
              : round(
                  signal.direction === "LONG"
                    ? signal.confirmPrice * (1 - ps.initialStopPct / 100)
                    : signal.confirmPrice * (1 + ps.initialStopPct / 100),
                  2,
                ),
            stopDistancePct: ps.noStopLoss ? 0 : ps.initialStopPct,
            exitTimeUtc: toUtcIso(exit.exitTs),
            exitPrice: round(exit.exitPrice, 2),
            exitReason: exit.exitReason,
            unleveredPnlPct: round(exit.unleveredPnlPct),
            initialLeverage: CT_INITIAL_LEVERAGE,
            maxLeverageReached: exit.maxLeverageReached,
            breakevenReached: exit.breakevenReached,
            milestonesHit: exit.milestonesHit,
            marginUsedUsd: round(marginPerSymbol, 2),
            pnlUsd: round(pnlUsd, 2),
            balanceAfterUsd: round(balance, 2),
            weekMoveFromOpenPct: round(signal.weekMoveFromOpenPct),
            // ── Entry quality metrics ──
            reclaimDepthPct: round(signal.reclaimDepthPct),
            wickToBodyRatio: round(signal.wickToBodyRatio, 2),
            multiBarDisplacement: signal.multiBarDisplacement,
            volumeSpikeRatio: round(signal.volumeSpikeRatio, 2),
            sweepRangeProportionPct: round(signal.sweepRangeProportionPct),
            sessionAtSweep: signal.sessionAtSweep,
          });
        }
      }
    }

    const wins = trades.filter((t) => t.unleveredPnlPct > 0).length;
    const totalReturn = ((balance - STARTING_BALANCE_USD) / STARTING_BALANCE_USD) * 100;

    results.push({
      paramSet: ps,
      trades,
      totalReturnPct: round(totalReturn),
      winRatePct: trades.length > 0 ? round((wins / trades.length) * 100, 1) : 0,
      avgUnleveredPnlPct:
        trades.length > 0
          ? round(
              trades.reduce((s, t) => s + t.unleveredPnlPct, 0) /
                trades.length,
            )
          : 0,
      maxDrawdownPct: round(maxDrawdownPct),
      tradeCount: trades.length,
      tradesPerWeek: round(trades.length / tradingWeekOpens.length, 1),
      signalsDetected,
      signalsFiltered,
      signalsEntered,
      directionalFunnel,
      exitReasonBreakdown,
    });
  }

  // ── Find best results ──
  const withTrades = results.filter((r) => r.tradeCount > 0);
  const bestByReturn = withTrades.length
    ? withTrades.reduce((a, b) =>
        a.totalReturnPct > b.totalReturnPct ? a : b,
      )
    : null;
  const bestByWinRate = withTrades.length
    ? withTrades.reduce((a, b) =>
        a.winRatePct > b.winRatePct ? a : b,
      )
    : null;
  const bestByDrawdown = withTrades.length
    ? withTrades.reduce((a, b) =>
        a.maxDrawdownPct < b.maxDrawdownPct ? a : b,
      )
    : null;

  // ── Weekly bias summary ──
  const weeklyBiasSummary = tradingWeekOpens.map((w) => {
    const week = weekDataMap.get(w);
    return {
      weekOpenUtc: w,
      btcBias: `${week?.bias.BTC.tier} ${week?.bias.BTC.bias}`,
      ethBias: `${week?.bias.ETH.tier} ${week?.bias.ETH.bias}`,
      btcTier: (week?.bias.BTC.tier ?? "NEUTRAL") as Tier,
      ethTier: (week?.bias.ETH.tier ?? "NEUTRAL") as Tier,
    };
  });

  // ── Build recommendations ──
  const recommendations: string[] = [];
  const highShortWeeks = weeklyBiasSummary.filter(
    (w) => w.btcBias === "HIGH SHORT" && w.ethBias === "HIGH SHORT",
  ).length;
  if (
    globalSignalDiag.totalWeeklySweepsDetected === 0
  ) {
    recommendations.push(
      "ZERO weekly sweeps detected at the lowest thresholds. The prior week range may not be breached in these market conditions. Consider lowering sweep thresholds further or using session ranges instead.",
    );
  }
  if (withTrades.length === 0) {
    if (
      CT_BIAS_MODE === "FULL" &&
      highShortWeeks === tradingWeekOpens.length
    ) {
      recommendations.push(
        `No parameter combination produced any trades. All ${tradingWeekOpens.length} weeks were HIGH SHORT on both BTC and ETH, so counter-trend LONGs were likely suppressed by regime and/or filters.`,
      );
    } else {
      recommendations.push(
        `No parameter combination produced any trades across ${tradingWeekOpens.length} weeks in ${CT_BIAS_MODE} bias mode. Filters and handshake constraints may be too restrictive for this sample.`,
      );
    }
  }
  if (bestByReturn && bestByReturn.totalReturnPct < 0) {
    recommendations.push(
      "Best return is negative. Counter-trend was fighting the trend across all tested weeks.",
    );
  }
  if (bestByReturn && bestByReturn.tradeCount < 10) {
    recommendations.push(
      `Best variant only had ${bestByReturn.tradeCount} trades. Sample too small for statistical significance. Need more data.`,
    );
  }
  recommendations.push(
    `This is a FEASIBILITY STUDY across ${tradingWeekOpens.length} weeks (${CT_BIAS_MODE} bias mode). Treat results as directional; validate on a longer out-of-sample window before deploying capital.`,
  );

  // ── Output ──
  const output: BacktestOutput = {
    generatedUtc: DateTime.utc().toISO() ?? new Date().toISOString(),
    testPeriod: {
      weeks: tradingWeekOpens.length,
      from: tradingWeekOpens[0],
      to: tradingWeekOpens[tradingWeekOpens.length - 1],
    },
    paramSets,
    results: results
      .filter((r) => r.tradeCount > 0)
      .sort((a, b) => b.totalReturnPct - a.totalReturnPct),
    bestByReturn: bestByReturn
      ? { ...bestByReturn, trades: [] }
      : null, // omit trades for summary
    bestByWinRate: bestByWinRate
      ? { ...bestByWinRate, trades: [] }
      : null,
    bestByDrawdown: bestByDrawdown
      ? { ...bestByDrawdown, trades: [] }
      : null,
    signalDiagnostics: globalSignalDiag,
    weeklyBiasSummary,
    recommendations,
  };

  // Write results
  const reportsDir = path.join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });

  const timestamp = DateTime.utc().toFormat("yyyy-MM-dd-HHmmss");
  const jsonPath = path.join(
    reportsDir,
    `counter-trend-weekly-backtest-${timestamp}.json`,
  );
  writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  console.log(`\nResults written to: ${jsonPath}`);

  // Write full trade log separately (can be large)
  const allTrades = results.flatMap((r) => r.trades);
  if (allTrades.length > 0) {
    const tradeLogPath = path.join(
      reportsDir,
      `counter-trend-trade-log-${timestamp}.json`,
    );
    writeFileSync(tradeLogPath, JSON.stringify(allTrades, null, 2));
    console.log(`Trade log written to: ${tradeLogPath}`);
  }

  // Write markdown summary
  const md = buildMarkdownSummary(output, allTrades);
  const mdPath = path.join(
    reportsDir,
    `counter-trend-weekly-backtest-${timestamp}.md`,
  );
  writeFileSync(mdPath, md);
  console.log(`Summary written to: ${mdPath}`);

  // ── Console summary ──
  console.log("\n═══════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════");
  console.log(`Total parameter combos: ${paramSets.length}`);
  console.log(
    `Combos with trades: ${results.filter((r) => r.tradeCount > 0).length}`,
  );
  console.log(
    `Total signals detected (widest thresholds): ${globalSignalDiag.totalWeeklySweepsDetected}`,
  );

  if (bestByReturn) {
    console.log(`\nBest by Return: ${bestByReturn.paramSet.id}`);
    console.log(
      `  Return: ${bestByReturn.totalReturnPct}% | WR: ${bestByReturn.winRatePct}% | DD: ${bestByReturn.maxDrawdownPct}% | Trades: ${bestByReturn.tradeCount}`,
    );
    const shortFunnel = bestByReturn.directionalFunnel.SHORT;
    console.log(
      `  SHORT funnel: raw=${shortFunnel.raw} -> bias=${shortFunnel.afterBias} -> quality=${shortFunnel.afterQuality} -> handshake=${shortFunnel.afterHandshake} -> entered=${shortFunnel.entered}`,
    );
  }
  if (bestByWinRate) {
    console.log(`\nBest by Win Rate: ${bestByWinRate.paramSet.id}`);
    console.log(
      `  Return: ${bestByWinRate.totalReturnPct}% | WR: ${bestByWinRate.winRatePct}% | DD: ${bestByWinRate.maxDrawdownPct}% | Trades: ${bestByWinRate.tradeCount}`,
    );
  }

  console.log("\nRecommendations:");
  for (const rec of recommendations) {
    console.log(`  • ${rec}`);
  }

  // Cleanup — only close DB pool if we opened one
  if (CT_BIAS_MODE === "FULL") {
    const pool = getPool();
    await pool.end();
  }
}

/* ─────────────────────────  Markdown Report  ───────────────────────── */

function buildMarkdownSummary(
  output: BacktestOutput,
  allTrades: ClosedTrade[],
): string {
  const lines: string[] = [];
  lines.push("# Counter-Trend Weekly Sweep Backtest Results\n");
  lines.push(`Generated: ${output.generatedUtc}\n`);
  lines.push(
    `Test Period: ${output.testPeriod.weeks} weeks (${output.testPeriod.from} to ${output.testPeriod.to})\n`,
  );
  lines.push(`Bias Mode: ${CT_BIAS_MODE} | Grid: ${output.paramSets.length} combos\n`);

  lines.push("## Weekly Bias Summary\n");
  lines.push("| Week | BTC Bias | ETH Bias |");
  lines.push("|------|----------|----------|");
  for (const w of output.weeklyBiasSummary) {
    lines.push(`| ${w.weekOpenUtc.slice(0, 10)} | ${w.btcBias} | ${w.ethBias} |`);
  }

  lines.push("\n## Signal Diagnostics\n");
  lines.push(
    `- Total weekly sweep events detected (lowest thresholds): **${output.signalDiagnostics.totalWeeklySweepsDetected}**`,
  );
  lines.push(
    `- By symbol: BTC=${output.signalDiagnostics.bySymbol.BTC}, ETH=${output.signalDiagnostics.bySymbol.ETH}`,
  );
  lines.push(
    `- By direction: LONG=${output.signalDiagnostics.byDirection.LONG}, SHORT=${output.signalDiagnostics.byDirection.SHORT}`,
  );

  if (output.bestByReturn) {
    lines.push("\n## Best by Total Return\n");
    lines.push(`**${output.bestByReturn.paramSet.id}**\n`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Return | ${output.bestByReturn.totalReturnPct}% |`);
    lines.push(`| Win Rate | ${output.bestByReturn.winRatePct}% |`);
    lines.push(`| Max Drawdown | ${output.bestByReturn.maxDrawdownPct}% |`);
    lines.push(`| Trades | ${output.bestByReturn.tradeCount} |`);
    lines.push(`| Trades/Week | ${output.bestByReturn.tradesPerWeek} |`);
    lines.push(
      `| Avg Unlevered PnL | ${output.bestByReturn.avgUnleveredPnlPct}% |`,
    );

    const shortFunnel = output.bestByReturn.directionalFunnel.SHORT;
    const longFunnel = output.bestByReturn.directionalFunnel.LONG;
    lines.push("\n### Directional Signal Funnel (Best by Return)\n");
    lines.push("| Direction | Raw | After Bias | After Quality | After Handshake | Entered |");
    lines.push("|-----------|-----|------------|---------------|-----------------|---------|");
    lines.push(
      `| LONG | ${longFunnel.raw} | ${longFunnel.afterBias} | ${longFunnel.afterQuality} | ${longFunnel.afterHandshake} | ${longFunnel.entered} |`,
    );
    lines.push(
      `| SHORT | ${shortFunnel.raw} | ${shortFunnel.afterBias} | ${shortFunnel.afterQuality} | ${shortFunnel.afterHandshake} | ${shortFunnel.entered} |`,
    );
  }

  if (output.bestByWinRate && output.bestByWinRate.paramSet.id !== output.bestByReturn?.paramSet.id) {
    lines.push("\n## Best by Win Rate\n");
    lines.push(`**${output.bestByWinRate.paramSet.id}**\n`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Return | ${output.bestByWinRate.totalReturnPct}% |`);
    lines.push(`| Win Rate | ${output.bestByWinRate.winRatePct}% |`);
    lines.push(`| Max Drawdown | ${output.bestByWinRate.maxDrawdownPct}% |`);
    lines.push(`| Trades | ${output.bestByWinRate.tradeCount} |`);
  }

  lines.push("\n## Top 10 Parameter Sets by Return\n");
  lines.push(
    "| Rank | Params | Return | WR | DD | Trades | Signals |",
  );
  lines.push(
    "|------|--------|--------|----|----|--------|---------|",
  );
  const top10 = output.results.slice(0, 10);
  for (let i = 0; i < top10.length; i++) {
    const r = top10[i];
    lines.push(
      `| ${i + 1} | ${r.paramSet.id} | ${r.totalReturnPct}% | ${r.winRatePct}% | ${r.maxDrawdownPct}% | ${r.tradeCount} | ${r.signalsDetected} |`,
    );
  }

  // ── Quality Profile Comparison ──
  // Show all quality profiles (including zero-trade ones) so we can see which filters kill all signals
  const allResults = output.results; // only combos with trades
  const profileLabels = QUALITY_PROFILES.map((qp) => qp.label);
  lines.push("\n## Quality Profile Comparison\n");
  lines.push("| Profile | Best Return | Best WR | Trades (best) | Combos w/ Trades |");
  lines.push("|---------|------------|---------|---------------|-----------------|");
  for (const label of profileLabels) {
    const group = allResults.filter((r) => {
      const qMatch = r.paramSet.id.match(/Q([A-Z0-9]+)/);
      return (qMatch ? qMatch[1] : "RAW") === label;
    });
    if (group.length === 0) {
      lines.push(`| ${label} | — | — | 0 | 0 |`);
      continue;
    }
    const bestRet = group.reduce((a, b) =>
      a.totalReturnPct > b.totalReturnPct ? a : b,
    );
    const bestWr = group.reduce((a, b) =>
      a.winRatePct > b.winRatePct ? a : b,
    );
    const combosWithTrades = group.filter((r) => r.tradeCount > 0).length;
    lines.push(
      `| ${label} | ${bestRet.totalReturnPct}% | ${bestWr.winRatePct}% | ${bestRet.tradeCount} | ${combosWithTrades} |`,
    );
  }

  if (allTrades.length > 0) {
    lines.push("\n## Sample Trade Log (First 20)\n");
    lines.push(
      "| # | Symbol | Dir | Entry | Exit | Unlev PnL | Exit Reason | Milestones |",
    );
    lines.push(
      "|---|--------|-----|-------|------|-----------|-------------|------------|",
    );
    for (const t of allTrades.slice(0, 20)) {
      lines.push(
        `| ${t.id} | ${t.symbol} | ${t.direction} | ${t.entryPrice} | ${t.exitPrice} | ${t.unleveredPnlPct}% | ${t.exitReason} | ${t.milestonesHit.join(",")} |`,
      );
    }
  }

  lines.push("\n## Recommendations\n");
  for (const rec of output.recommendations) {
    lines.push(`- ${rec}`);
  }

  lines.push(
    "\n---\n*Counter-Trend Weekly Sweep Backtest — Freedom_EXE / Limni Intelligence Platform*\n",
  );

  return lines.join("\n");
}

/* ─────────────────────────  Entry Point  ───────────────────────── */

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
