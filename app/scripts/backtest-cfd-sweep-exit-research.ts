/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-cfd-sweep-exit-research.ts
 *
 * Description:
 * Exit research on the two most interesting unified sweep-entry
 * candidates:
 * - sweep_010__w60
 * - sweep_010__w60__bb_confirm
 *
 * Entry detection matches the unified sweep. This pass compares
 * passive closes, wick-stop exits, and Katarakti-style milestone
 * locking/trailing.
 *
 * Run:
 *   npx tsx scripts/backtest-cfd-sweep-exit-research.ts
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
import { SESSION_ELIGIBILITY } from "../src/lib/flagship/sessionConfig";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type GateMode = "UNGATED" | "FROZEN" | "LIVE";
type CurrencyState = "STRONG" | "WEAK" | "NEUTRAL";
type StrategyKind = "SWEEP" | "MA_BB_CONTROL";
type WindowSession = "NY" | "ASIA_LONDON";

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

type WeeklyMatrixRow = {
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  weeklyDirection: Direction;
  weeklyTier: "HIGH" | "MEDIUM" | "NEUTRAL";
};

type DirectionalRow = {
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  direction: Direction;
  tier: "HIGH" | "MEDIUM" | "NEUTRAL";
};

type GateSnapshot = {
  asOfUtc: string;
  byPair: Map<string, DirectionalRow>;
};

type TradeMetrics = {
  exitPrice: number | null;
  returnPct: number | null;
  maePct: number | null;
  mfePct: number | null;
};

type IndicatorPack = {
  sma200: Array<number | null>;
  bbMid: Array<number | null>;
  bbUpper: Array<number | null>;
  bbLower: Array<number | null>;
  atr14: Array<number | null>;
};

type EntryWindow = {
  id: string;
  session: WindowSession;
  rangeStart: DateTime;
  rangeEnd: DateTime;
  entryStart: DateTime;
  entryEnd: DateTime;
};

type BaseVariant = {
  id: string;
  strategy: StrategyKind;
  sweepThresholdPct: number | null;
  handshakeThresholdPct: number | null;
  displacementBodyMinOverridePct?: number | null;
  closeZoneOverridePct?: number | null;
  requireBbConfirm?: boolean;
  requireSmaFilter?: boolean;
};

type VariantConfig = BaseVariant & {
  gateMode: GateMode;
  variantId: string;
};

type HandshakeDetail = {
  bucketType: "FX" | "INDICES" | "CRYPTO" | "NONE";
  weakCurrency: string | null;
  strongCurrency: string | null;
  weakAgreementPct: number | null;
  strongAgreementPct: number | null;
  agreementPct: number | null;
  passed: boolean;
};

type TriggerCandidate = {
  direction: Exclude<Direction, "NEUTRAL">;
  entryTs: number;
  entryPrice: number;
  signalCandleIdx: number;
  signalCandleTs: number;
  ma200: number | null;
  bollingerMid: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  sweepPct: number | null;
  displacementBodyPct: number | null;
  sweepToEntryBars: number | null;
  signalForm: "1_BAR" | "2_BAR" | null;
  wickStopPrice: number | null;
  wickStopDistancePct: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  atr14: number | null;
  rejectionIdx: number | null;
  displacementIdx: number | null;
};

type TriggerTrade = {
  variantId: string;
  baseVariantId: string;
  strategy: StrategyKind;
  gateMode: GateMode;
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  assetClass: AssetClass;
  session: WindowSession;
  direction: Exclude<Direction, "NEUTRAL">;
  tier: "HIGH" | "MEDIUM";
  entryTimeUtc: string;
  entryPrice: number;
  handshake: HandshakeDetail;
  sweepPct: number | null;
  displacementBodyPct: number | null;
  signalForm: "1_BAR" | "2_BAR" | null;
  wickStopPrice: number | null;
  wickStopDistancePct: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  atr14: number | null;
  sessionEndUtc: string;
  weekEndUtc: string;
  sessionMetrics: TradeMetrics;
  weekMetrics: TradeMetrics;
};

type SummaryRow = {
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
  drawdownAdjustedWeekScore: number;
};

type ExitModeId =
  | "SESSION_CLOSE"
  | "WEEK_CLOSE"
  | "RANGE_STOP_WEEK_CLOSE"
  | "ATR_1_5_WEEK_CLOSE"
  | "ATR_2_0_WEEK_CLOSE"
  | "PARTIAL_50_SESSION_WEEK"
  | "TIME_STOP_2SESS";

type ExitReason = "TIME_EXIT" | "STOP_LOSS" | "BREAKEVEN" | "LOCK_015" | "LOCK_035" | "LOCK_055" | "TRAILING";

type ExitSimulation = {
  exitMode: ExitModeId;
  exitReason: ExitReason;
  exitTs: number;
  exitPrice: number;
  returnPct: number;
  maePct: number;
  mfePct: number;
  peakProfitPct: number;
};

type ExitSummaryRow = {
  trades: number;
  winRatePct: number;
  avgReturnPct: number;
  medianReturnPct: number;
  avgMaePct: number;
  p95MaePct: number;
  avgMfePct: number;
  p95MfePct: number;
  profitFactor: number;
};

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

const CACHE_DIR = path.join(process.cwd(), "Local Environment", ".cache", "cfd-ma-bb-trigger");
const REPORTS_DIR = path.join(process.cwd(), "app", "reports");
const TARGET_WEEKS_COUNT = Number(process.env.CFD_SWEEP_EXIT_RESEARCH_WEEKS ?? "8");
const WARMUP_DAYS = Number(process.env.CFD_SWEEP_EXIT_RESEARCH_WARMUP_DAYS ?? "14");
const FETCH_CONCURRENCY = Number(process.env.CFD_SWEEP_EXIT_RESEARCH_FETCH_CONCURRENCY ?? "4");
const MA_LENGTH = Number(process.env.CFD_SWEEP_EXIT_RESEARCH_MA_LENGTH ?? "200");
const BB_LENGTH = Number(process.env.CFD_SWEEP_EXIT_RESEARCH_BB_LENGTH ?? "20");
const PAIR_FILTER = new Set(
  (process.env.CFD_SWEEP_EXIT_RESEARCH_PAIR_FILTER ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

const GATE_MODES: GateMode[] = ["LIVE"];

const BASE_VARIANTS: BaseVariant[] = [
  { id: "sweep_010__w60", strategy: "SWEEP", sweepThresholdPct: 0.1, handshakeThresholdPct: 60 },
  {
    id: "sweep_010__w60__bb_confirm",
    strategy: "SWEEP",
    sweepThresholdPct: 0.1,
    handshakeThresholdPct: 60,
    requireBbConfirm: true,
  },
];

const BREAKEVEN_TRIGGER_PCT = 0.25;
const LOCK_015_TRIGGER_PCT = 0.50;
const LOCK_035_TRIGGER_PCT = 0.75;
const LOCK_055_TRIGGER_PCT = 1.0;
const TRAIL_ACTIVE_ABOVE_PCT = 1.0;
const TRAIL_OFFSET_PCT = 0.45;

function buildVariantConfigs() {
  return BASE_VARIANTS.flatMap((base) =>
    GATE_MODES.map((gateMode) => ({
      ...base,
      gateMode,
      variantId: `${base.id}__${gateMode.toLowerCase()}`,
    })),
  );
}

const VARIANT_CONFIGS = buildVariantConfigs();

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function safeAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function weekLabelFromOpen(weekOpenUtc: string) {
  return (
    DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ hours: 12 }).toISODate() ??
    weekOpenUtc.slice(0, 10)
  );
}

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getOandaAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) throw new Error("OANDA_API_KEY is not configured.");
  return { Authorization: `Bearer ${apiKey}` };
}

function pairKey(assetClass: AssetClass, pair: string) {
  return `${assetClass}|${pair}`;
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
    return { direction: "LONG" as const, tier: longVotes === 3 ? "HIGH" as const : "MEDIUM" as const };
  }
  if (shortVotes >= 2 && shortVotes > longVotes) {
    return { direction: "SHORT" as const, tier: shortVotes === 3 ? "HIGH" as const : "MEDIUM" as const };
  }
  return { direction: "NEUTRAL" as const, tier: "NEUTRAL" as const };
}

function buildPairUniverse() {
  const out: PairInfo[] = [];
  (Object.entries(PAIRS_BY_ASSET_CLASS) as Array<
    [AssetClass, Array<{ pair: string; base: string; quote: string }>]
  >).forEach(([assetClass, defs]) => {
    for (const def of defs) {
      const pair = def.pair.toUpperCase();
      if (PAIR_FILTER.size > 0 && !PAIR_FILTER.has(pair)) continue;
      out.push({
        assetClass,
        pair,
        base: def.base.toUpperCase(),
        quote: def.quote.toUpperCase(),
      });
    }
  });
  return out.sort((a, b) => pairKey(a.assetClass, a.pair).localeCompare(pairKey(b.assetClass, b.pair)));
}

async function getTargetWeeks(now = DateTime.utc()) {
  const currentWeekLabel = weekLabelFromOpen(getCanonicalWeekOpenUtc(now));
  const rows = await query<{ week_open_utc: Date }>(
    `SELECT DISTINCT week_open_utc
       FROM performance_snapshots
      ORDER BY week_open_utc DESC
      LIMIT 40`,
  );

  const filtered = rows
    .map((row) => row.week_open_utc.toISOString())
    .filter((weekOpenUtc) => weekLabelFromOpen(weekOpenUtc) < currentWeekLabel)
    .slice(0, TARGET_WEEKS_COUNT)
    .reverse();

  if (filtered.length === 0) throw new Error("No completed weeks found in performance_snapshots.");
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
    const week = row.week_open_utc.toISOString();
    const target = rawByWeek.get(week);
    if (!target) continue;
    for (const detail of parsePairDetails(row.pair_details)) {
      target.set(`${detail.pair}|${row.model}`, detail.direction);
    }
  }

  const byWeek = new Map<string, Map<string, WeeklyMatrixRow>>();
  for (const week of targetWeeks) {
    const map = new Map<string, WeeklyMatrixRow>();
    const source = rawByWeek.get(week) ?? new Map<string, Direction>();
    for (const pairInfo of pairUniverse) {
      const dealer = source.get(`${pairInfo.pair}|dealer`) ?? "NEUTRAL";
      const commercial = source.get(`${pairInfo.pair}|commercial`) ?? "NEUTRAL";
      const sentiment = source.get(`${pairInfo.pair}|sentiment`) ?? "NEUTRAL";
      const classified = classifyVotes([dealer, commercial, sentiment]);
      map.set(pairInfo.pair, {
        dealer,
        commercial,
        sentiment,
        weeklyDirection: classified.direction,
        weeklyTier: classified.tier,
      });
    }
    byWeek.set(week, map);
  }
  return byWeek;
}

function buildDirectionalMap(weekMap: Map<string, WeeklyMatrixRow>) {
  const out = new Map<string, DirectionalRow>();
  for (const [pair, row] of weekMap.entries()) {
    out.set(pair, {
      dealer: row.dealer,
      commercial: row.commercial,
      sentiment: row.sentiment,
      direction: row.weeklyDirection,
      tier: row.weeklyTier,
    });
  }
  return out;
}

const gateSnapshotCache = new Map<string, GateSnapshot>();

async function loadGateSnapshotAt(asOfUtc: string, weekMap: Map<string, WeeklyMatrixRow>) {
  const cached = gateSnapshotCache.get(asOfUtc);
  if (cached) return cached;

  const sentimentLock = await buildDailySentimentLock(asOfUtc);
  const dailySentimentByPair = new Map<string, DailySentimentDirection>(
    sentimentLock.rows.map((row) => [row.symbol.trim().toUpperCase(), row.sentimentDirection]),
  );

  const byPair = new Map<string, DirectionalRow>();
  for (const [pair, row] of Array.from(weekMap.entries())) {
    const dailySentiment = dailySentimentByPair.get(pair) ?? "NEUTRAL";
    const classified = classifyVotes([row.dealer, row.commercial, dailySentiment]);
    byPair.set(pair, {
      dealer: row.dealer,
      commercial: row.commercial,
      sentiment: dailySentiment,
      direction: classified.direction,
      tier: classified.tier,
    });
  }

  const snapshot = { asOfUtc, byPair };
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
    if (Array.isArray(parsed.candles)) return parsed.candles;
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
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
    if (!response || lastError) throw lastError ?? new Error(`Failed to fetch OANDA candles for ${instrument}`);

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
      if (candle.ts >= fromUtc.toMillis() && candle.ts < toUtc.toMillis()) all.set(candle.ts, candle);
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

function computeSma(values: number[], length: number) {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

function computeStdDev(values: number[], length: number, sma: Array<number | null>) {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  for (let i = length - 1; i < values.length; i += 1) {
    const mean = sma[i];
    if (mean === null) continue;
    let varianceSum = 0;
    for (let j = i - length + 1; j <= i; j += 1) {
      const diff = values[j] - mean;
      varianceSum += diff * diff;
    }
    out[i] = Math.sqrt(varianceSum / length);
  }
  return out;
}

function computeAtr(candles: OhlcCandle[], length: number) {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const prevClose = candles[index - 1]!.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose),
    );
  });
  return computeSma(trueRanges, length);
}

function buildIndicatorPack(candles: OhlcCandle[], bbStdDev: number): IndicatorPack {
  const closes = candles.map((candle) => candle.close);
  const sma200 = computeSma(closes, MA_LENGTH);
  const bbMid = computeSma(closes, BB_LENGTH);
  const bbStd = computeStdDev(closes, BB_LENGTH, bbMid);
  const bbUpper = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid + bbStdDev * (bbStd[index] ?? 0)));
  const bbLower = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid - bbStdDev * (bbStd[index] ?? 0)));
  const atr14 = computeAtr(candles, 14);
  return { sma200, bbMid, bbUpper, bbLower, atr14 };
}

function buildEntryWindowsForWeek(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekEnd = weekOpen.plus({ weeks: 1 });
  const windows: EntryWindow[] = [];
  let day = weekOpen.startOf("day");
  while (day < weekEnd) {
    const rangeAStart = day.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    const rangeAEnd = day.set({ hour: 13, minute: 0, second: 0, millisecond: 0 });
    const entryAStart = rangeAEnd;
    const entryAEnd = day.set({ hour: 21, minute: 0, second: 0, millisecond: 0 });
    if (entryAEnd > weekOpen && entryAStart < weekEnd) {
      windows.push({
        id: `ny|${entryAStart.toISODate()}`,
        session: "NY",
        rangeStart: rangeAStart < weekOpen ? weekOpen : rangeAStart,
        rangeEnd: rangeAEnd > weekEnd ? weekEnd : rangeAEnd,
        entryStart: entryAStart < weekOpen ? weekOpen : entryAStart,
        entryEnd: entryAEnd > weekEnd ? weekEnd : entryAEnd,
      });
    }

    const rangeBStart = day.set({ hour: 13, minute: 0, second: 0, millisecond: 0 });
    const rangeBEnd = day.set({ hour: 21, minute: 0, second: 0, millisecond: 0 });
    const entryBStart = day.plus({ days: 1 }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    const entryBEnd = day.plus({ days: 1 }).set({ hour: 13, minute: 0, second: 0, millisecond: 0 });
    if (entryBEnd > weekOpen && entryBStart < weekEnd) {
      windows.push({
        id: `asia_london|${entryBStart.toISODate()}`,
        session: "ASIA_LONDON",
        rangeStart: rangeBStart < weekOpen ? weekOpen : rangeBStart,
        rangeEnd: rangeBEnd > weekEnd ? weekEnd : rangeBEnd,
        entryStart: entryBStart < weekOpen ? weekOpen : entryBStart,
        entryEnd: entryBEnd > weekEnd ? weekEnd : entryBEnd,
      });
    }
    day = day.plus({ days: 1 });
  }
  return windows.filter((window) => window.entryEnd > window.entryStart);
}

function isPairEligibleForWindow(pair: string, session: WindowSession) {
  const eligible = SESSION_ELIGIBILITY.get(pair);
  if (!eligible || eligible.length === 0) return true;
  if (session === "NY") return eligible.includes("NY");
  return eligible.includes("ASIA") || eligible.includes("LONDON");
}

function findCandleIndicesBetween(candles: OhlcCandle[], startMs: number, endMs: number) {
  const indices: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const closeTs = candles[i].ts + 5 * 60 * 1000;
    if (closeTs <= startMs) continue;
    if (closeTs > endMs) break;
    indices.push(i);
  }
  return indices;
}

function computeRange(candles: OhlcCandle[], startMs: number, endMs: number) {
  const inRange = candles.filter((candle) => candle.ts >= startMs && candle.ts < endMs);
  if (inRange.length === 0) return null;
  return {
    high: Math.max(...inRange.map((candle) => candle.high)),
    low: Math.min(...inRange.map((candle) => candle.low)),
  };
}

function getAdaptiveParams(
  assetClass: AssetClass,
  variant: VariantConfig,
) {
  if (variant.strategy !== "SWEEP") {
    return {
      sweepThresholdPct: 0,
      displacementBodyMinPct: 0,
      closeZonePct: 1.0,
    };
  }

  const sweepThresholdPct = variant.sweepThresholdPct ?? 0.1;
  let displacementBodyMinPct: number;
  let closeZonePct: number;

  if (variant.displacementBodyMinOverridePct !== undefined && variant.displacementBodyMinOverridePct !== null) {
    displacementBodyMinPct = variant.displacementBodyMinOverridePct;
  } else {
    displacementBodyMinPct = assetClass === "crypto" || assetClass === "commodities" ? 0.10 : 0.05;
  }

  if (variant.closeZoneOverridePct !== undefined && variant.closeZoneOverridePct !== null) {
    closeZonePct = variant.closeZoneOverridePct;
  } else {
    closeZonePct = assetClass === "crypto" || assetClass === "commodities" ? 1.0 : 0.30;
  }

  return { sweepThresholdPct, displacementBodyMinPct, closeZonePct };
}

function displacementQualifies(
  direction: Exclude<Direction, "NEUTRAL">,
  candle: OhlcCandle,
  bodyMinPct: number,
  closeZonePct: number,
) {
  const bodyPct = direction === "SHORT"
    ? ((candle.open - candle.close) / candle.open) * 100
    : ((candle.close - candle.open) / candle.open) * 100;
  if (bodyPct < bodyMinPct) return { ok: false, bodyPct };

  const correctDirection = direction === "SHORT" ? candle.close < candle.open : candle.close > candle.open;
  if (!correctDirection) return { ok: false, bodyPct };

  const range = candle.high - candle.low;
  if (range <= 0) return { ok: false, bodyPct };
  const closeZone = direction === "SHORT"
    ? (candle.close - candle.low) / range
    : (candle.high - candle.close) / range;
  if (closeZone > closeZonePct) return { ok: false, bodyPct };

  return { ok: true, bodyPct };
}

function detectSweepCandidates(
  pairInfo: PairInfo,
  candles: OhlcCandle[],
  indicators: IndicatorPack,
  entryWindow: EntryWindow,
  variant: VariantConfig,
) {
  const range = computeRange(candles, entryWindow.rangeStart.toMillis(), entryWindow.rangeEnd.toMillis());
  if (!range) return [] as TriggerCandidate[];

  const entryIndices = findCandleIndicesBetween(candles, entryWindow.entryStart.toMillis(), entryWindow.entryEnd.toMillis());
  if (entryIndices.length === 0) return [] as TriggerCandidate[];

  const adaptive = getAdaptiveParams(pairInfo.assetClass, variant);
  const candidates: TriggerCandidate[] = [];

  for (let pos = 0; pos < entryIndices.length; pos += 1) {
    const sweepIdx = entryIndices[pos];
    const nextIdx = pos + 1 < entryIndices.length ? entryIndices[pos + 1] : null;
    const sweepCandle = candles[sweepIdx];
    const upSweepPct = ((sweepCandle.high - range.high) / range.high) * 100;
    const downSweepPct = ((range.low - sweepCandle.low) / range.low) * 100;

    const directionalCandidates: Array<{ direction: Exclude<Direction, "NEUTRAL">; sweepPct: number; wickStopPrice: number }> = [];
    if (upSweepPct >= adaptive.sweepThresholdPct) {
      directionalCandidates.push({ direction: "SHORT", sweepPct: upSweepPct, wickStopPrice: sweepCandle.high });
    }
    if (downSweepPct >= adaptive.sweepThresholdPct) {
      directionalCandidates.push({ direction: "LONG", sweepPct: downSweepPct, wickStopPrice: sweepCandle.low });
    }

    for (const sweep of directionalCandidates) {
      const rejectionChoices = [sweepIdx, nextIdx].filter((value): value is number => value !== null);
      let rejectionIdx: number | null = null;
      for (const idx of rejectionChoices) {
        const rejectionCandle = candles[idx];
        const rejected = sweep.direction === "SHORT"
          ? rejectionCandle.close < range.high
          : rejectionCandle.close > range.low;
        if (rejected) {
          rejectionIdx = idx;
          break;
        }
      }
      if (rejectionIdx === null) continue;

      const displacementChoices = [rejectionIdx, rejectionIdx + 1].filter((idx) => {
        if (idx < 0 || idx >= candles.length) return false;
        const closeTs = candles[idx].ts + 5 * 60 * 1000;
        return closeTs > entryWindow.entryStart.toMillis() && closeTs <= entryWindow.entryEnd.toMillis();
      });

      let displacementIdx: number | null = null;
      let bodyPct: number | null = null;
      for (const idx of displacementChoices) {
        const displacement = displacementQualifies(
          sweep.direction,
          candles[idx],
          adaptive.displacementBodyMinPct,
          adaptive.closeZonePct,
        );
        if (displacement.ok) {
          displacementIdx = idx;
          bodyPct = displacement.bodyPct;
          break;
        }
      }
      if (displacementIdx === null) continue;

      const displacementCandle = candles[displacementIdx];
      const displacementCloseTs = displacementCandle.ts + 5 * 60 * 1000;
      const ma200 = indicators.sma200[displacementIdx];
      const bbMid = indicators.bbMid[displacementIdx];
      const bbUpper = indicators.bbUpper[displacementIdx];
      const bbLower = indicators.bbLower[displacementIdx];

      if (variant.requireSmaFilter) {
        if (ma200 === null) continue;
        const smaPass = sweep.direction === "LONG"
          ? displacementCandle.close > ma200
          : displacementCandle.close < ma200;
        if (!smaPass) continue;
      }

      if (variant.requireBbConfirm) {
        const sweepBbUpper = indicators.bbUpper[sweepIdx];
        const sweepBbLower = indicators.bbLower[sweepIdx];
        const bbPass = sweep.direction === "LONG"
          ? sweepBbLower !== null && sweepCandle.low <= sweepBbLower
          : sweepBbUpper !== null && sweepCandle.high >= sweepBbUpper;
        if (!bbPass) continue;
      }

      const wickStopDistancePct = sweep.direction === "LONG"
        ? ((displacementCandle.close - sweep.wickStopPrice) / displacementCandle.close) * 100
        : ((sweep.wickStopPrice - displacementCandle.close) / displacementCandle.close) * 100;

      candidates.push({
        direction: sweep.direction,
        entryTs: displacementCloseTs,
        entryPrice: displacementCandle.close,
        signalCandleIdx: sweepIdx,
        signalCandleTs: sweepCandle.ts,
        ma200,
        bollingerMid: bbMid,
        bollingerUpper: bbUpper,
        bollingerLower: bbLower,
        sweepPct: round(sweep.sweepPct, 4),
        displacementBodyPct: bodyPct === null ? null : round(bodyPct, 4),
        sweepToEntryBars: displacementIdx - sweepIdx,
        signalForm: rejectionIdx === sweepIdx ? "1_BAR" : "2_BAR",
        wickStopPrice: round(sweep.wickStopPrice),
        wickStopDistancePct: round(Math.max(wickStopDistancePct, 0), 4),
        rangeHigh: round(range.high),
        rangeLow: round(range.low),
        atr14: indicators.atr14[displacementIdx] === null ? null : round(indicators.atr14[displacementIdx] ?? 0, 6),
        rejectionIdx,
        displacementIdx,
      });
    }
  }

  return candidates.sort((a, b) => a.entryTs - b.entryTs);
}

function detectMaBbCandidates(
  candles: OhlcCandle[],
  indicators: IndicatorPack,
  entryWindow: EntryWindow,
) {
  const candidates: TriggerCandidate[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const closeTs = candle.ts + 5 * 60 * 1000;
    if (closeTs <= entryWindow.entryStart.toMillis()) continue;
    if (closeTs > entryWindow.entryEnd.toMillis()) break;

    const ma = indicators.sma200[i];
    const bbMid = indicators.bbMid[i];
    const bbUpper = indicators.bbUpper[i];
    const bbLower = indicators.bbLower[i];
    if (ma === null || bbMid === null || bbUpper === null || bbLower === null) continue;

    const longQualifies = candle.close > ma && candle.low <= bbLower && candle.close > candle.open;
    const shortQualifies = candle.close < ma && candle.high >= bbUpper && candle.close < candle.open;

    if (longQualifies) {
      candidates.push({
        direction: "LONG",
        entryTs: closeTs,
        entryPrice: candle.close,
        signalCandleIdx: i,
        signalCandleTs: candle.ts,
        ma200: ma,
        bollingerMid: bbMid,
        bollingerUpper: bbUpper,
        bollingerLower: bbLower,
        sweepPct: null,
        displacementBodyPct: null,
        sweepToEntryBars: null,
        signalForm: null,
        wickStopPrice: null,
        wickStopDistancePct: null,
        rangeHigh: null,
        rangeLow: null,
        atr14: indicators.atr14[i] === null ? null : round(indicators.atr14[i] ?? 0, 6),
        rejectionIdx: null,
        displacementIdx: null,
      });
    }

    if (shortQualifies) {
      candidates.push({
        direction: "SHORT",
        entryTs: closeTs,
        entryPrice: candle.close,
        signalCandleIdx: i,
        signalCandleTs: candle.ts,
        ma200: ma,
        bollingerMid: bbMid,
        bollingerUpper: bbUpper,
        bollingerLower: bbLower,
        sweepPct: null,
        displacementBodyPct: null,
        sweepToEntryBars: null,
        signalForm: null,
        wickStopPrice: null,
        wickStopDistancePct: null,
        rangeHigh: null,
        rangeLow: null,
        atr14: indicators.atr14[i] === null ? null : round(indicators.atr14[i] ?? 0, 6),
        rejectionIdx: null,
        displacementIdx: null,
      });
    }
  }
  return candidates.sort((a, b) => a.entryTs - b.entryTs);
}

function inferCurrencyState(pair: PairInfo, sharedCurrency: string, pairDirection: Direction): CurrencyState {
  if (pairDirection === "NEUTRAL") return "NEUTRAL";
  if (pair.base === sharedCurrency) return pairDirection === "LONG" ? "STRONG" : "WEAK";
  if (pair.quote === sharedCurrency) return pairDirection === "LONG" ? "WEAK" : "STRONG";
  return "NEUTRAL";
}

function buildFxCurrencyBuckets(pairUniverse: readonly PairInfo[]) {
  const buckets = new Map<string, PairInfo[]>();
  for (const pairInfo of pairUniverse.filter((row) => row.assetClass === "fx")) {
    const baseBucket = buckets.get(pairInfo.base) ?? [];
    baseBucket.push(pairInfo);
    buckets.set(pairInfo.base, baseBucket);

    const quoteBucket = buckets.get(pairInfo.quote) ?? [];
    quoteBucket.push(pairInfo);
    buckets.set(pairInfo.quote, quoteBucket);
  }
  return buckets;
}

function computeBucketAgreementPct(
  sharedCurrency: string,
  desiredState: CurrencyState,
  bucketPairs: readonly PairInfo[],
  currentPair: PairInfo,
  directionalMap: Map<string, DirectionalRow>,
) {
  let eligible = 0;
  let agreeing = 0;
  for (const pairInfo of bucketPairs) {
    if (pairInfo.pair === currentPair.pair) continue;
    const row = directionalMap.get(pairInfo.pair);
    if (!row || row.direction === "NEUTRAL") continue;
    const inferred = inferCurrencyState(pairInfo, sharedCurrency, row.direction);
    if (inferred === "NEUTRAL") continue;
    eligible += 1;
    if (inferred === desiredState) agreeing += 1;
  }
  return eligible === 0 ? null : round((agreeing / eligible) * 100, 2);
}

function computeHandshakeDetail(
  pairInfo: PairInfo,
  direction: Exclude<Direction, "NEUTRAL">,
  directionalMap: Map<string, DirectionalRow>,
  fxBuckets: Map<string, PairInfo[]>,
  thresholdPct: number | null,
): HandshakeDetail {
  if (pairInfo.assetClass === "indices") {
    const indices = (PAIRS_BY_ASSET_CLASS.indices ?? []).map((row) => row.pair);
    const passed = indices.every((pair) => directionalMap.get(pair)?.direction === direction);
    return {
      bucketType: "INDICES",
      weakCurrency: null,
      strongCurrency: null,
      weakAgreementPct: null,
      strongAgreementPct: null,
      agreementPct: passed ? 100 : 0,
      passed: thresholdPct === null ? true : passed,
    };
  }

  if (pairInfo.assetClass === "crypto") {
    const crypto = (PAIRS_BY_ASSET_CLASS.crypto ?? []).map((row) => row.pair);
    const passed = crypto.every((pair) => directionalMap.get(pair)?.direction === direction);
    return {
      bucketType: "CRYPTO",
      weakCurrency: null,
      strongCurrency: null,
      weakAgreementPct: null,
      strongAgreementPct: null,
      agreementPct: passed ? 100 : 0,
      passed: thresholdPct === null ? true : passed,
    };
  }

  if (pairInfo.assetClass !== "fx") {
    return {
      bucketType: "NONE",
      weakCurrency: null,
      strongCurrency: null,
      weakAgreementPct: null,
      strongAgreementPct: null,
      agreementPct: null,
      passed: true,
    };
  }

  const strongCurrency = direction === "LONG" ? pairInfo.base : pairInfo.quote;
  const weakCurrency = direction === "LONG" ? pairInfo.quote : pairInfo.base;
  const strongBucket = fxBuckets.get(strongCurrency) ?? [];
  const weakBucket = fxBuckets.get(weakCurrency) ?? [];
  const strongAgreementPct = computeBucketAgreementPct(strongCurrency, "STRONG", strongBucket, pairInfo, directionalMap);
  const weakAgreementPct = computeBucketAgreementPct(weakCurrency, "WEAK", weakBucket, pairInfo, directionalMap);
  const available = [strongAgreementPct, weakAgreementPct].filter((value): value is number => value !== null);
  const agreementPct = available.length === 0 ? 0 : round(safeAverage(available), 2);
  const passed = thresholdPct === null ? true : agreementPct >= thresholdPct;
  return {
    bucketType: "FX",
    weakCurrency,
    strongCurrency,
    weakAgreementPct,
    strongAgreementPct,
    agreementPct,
    passed,
  };
}

function lastCloseBefore(candles: OhlcCandle[], exitTs: number) {
  let last: OhlcCandle | null = null;
  for (const candle of candles) {
    const closeTs = candle.ts + 5 * 60 * 1000;
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
    const closeTs = candle.ts + 5 * 60 * 1000;
    return closeTs > entryTs && closeTs <= exitTs;
  });

  const exitCandle = lastCloseBefore(m5Candles, exitTs);
  if (!exitCandle) return { exitPrice: null, returnPct: null, maePct: null, mfePct: null };

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

function computeWickStopResult(
  direction: Exclude<Direction, "NEUTRAL">,
  candles: OhlcCandle[],
  entryTs: number,
  entryPrice: number,
  stopPrice: number | null,
  exitTs: number,
) {
  if (stopPrice === null) {
    return { hit: false, returnPct: null };
  }

  for (const candle of candles) {
    const closeTs = candle.ts + 5 * 60 * 1000;
    if (closeTs <= entryTs) continue;
    if (closeTs > exitTs) break;
    const hit = direction === "LONG" ? candle.low <= stopPrice : candle.high >= stopPrice;
    if (!hit) continue;
    const returnPct = direction === "LONG"
      ? ((stopPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - stopPrice) / entryPrice) * 100;
    return { hit: true, returnPct: round(returnPct, 4) };
  }

  return { hit: false, returnPct: null };
}

function summarizeTrades(trades: TriggerTrade[]): SummaryRow {
  const sessionReturns = trades.map((trade) => trade.sessionMetrics.returnPct).filter((value): value is number => value !== null);
  const weekReturns = trades.map((trade) => trade.weekMetrics.returnPct).filter((value): value is number => value !== null);
  const sessionMaes = trades.map((trade) => trade.sessionMetrics.maePct).filter((value): value is number => value !== null);
  const weekMaes = trades.map((trade) => trade.weekMetrics.maePct).filter((value): value is number => value !== null);
  const sessionMfes = trades.map((trade) => trade.sessionMetrics.mfePct).filter((value): value is number => value !== null);
  const weekMfes = trades.map((trade) => trade.weekMetrics.mfePct).filter((value): value is number => value !== null);
  const avgWeekMaePct = round(safeAverage(weekMaes), 4);
  return {
    trades: trades.length,
    winRateSessionClosePct:
      sessionReturns.length === 0
        ? 0
        : round((sessionReturns.filter((value) => value > 0).length / sessionReturns.length) * 100, 2),
    avgSessionReturnPct: round(safeAverage(sessionReturns), 4),
    medianSessionReturnPct: round(median(sessionReturns), 4),
    avgWeekReturnPct: round(safeAverage(weekReturns), 4),
    medianWeekReturnPct: round(median(weekReturns), 4),
    avgSessionMaePct: round(safeAverage(sessionMaes), 4),
    p95SessionMaePct: round(percentile(sessionMaes, 95), 4),
    avgSessionMfePct: round(safeAverage(sessionMfes), 4),
    p95SessionMfePct: round(percentile(sessionMfes, 95), 4),
    avgWeekMaePct,
    p95WeekMaePct: round(percentile(weekMaes, 95), 4),
    avgWeekMfePct: round(safeAverage(weekMfes), 4),
    p95WeekMfePct: round(percentile(weekMfes, 95), 4),
    drawdownAdjustedWeekScore: avgWeekMaePct === 0 ? 0 : round(safeAverage(weekReturns) / avgWeekMaePct, 4),
  };
}

function aggregateBy<T extends string>(trades: TriggerTrade[], keyFn: (trade: TriggerTrade) => T) {
  const grouped = new Map<T, TriggerTrade[]>();
  for (const trade of trades) {
    const key = keyFn(trade);
    const bucket = grouped.get(key) ?? [];
    bucket.push(trade);
    grouped.set(key, bucket);
  }
  return Array.from(grouped.entries()).map(([key, bucket]) => ({ key, ...summarizeTrades(bucket) }));
}

function buildTradeWarnings(trades: TriggerTrade[]) {
  const warnings: string[] = [];
  if (trades.length < 150) warnings.push("low_sample_total");
  const byAsset = aggregateBy(trades, (trade) => trade.assetClass);
  for (const row of byAsset) {
    if (row.trades > 0 && row.trades < 50) warnings.push(`low_sample_${row.key}`);
  }
  return warnings;
}

function profitPctForPrice(entryPrice: number, price: number, direction: Exclude<Direction, "NEUTRAL">) {
  const longPct = ((price - entryPrice) / entryPrice) * 100;
  return direction === "LONG" ? longPct : -longPct;
}

function stopPriceForLockedPct(entryPrice: number, direction: Exclude<Direction, "NEUTRAL">, lockedPct: number) {
  if (direction === "LONG") return entryPrice * (1 + lockedPct / 100);
  return entryPrice * (1 - lockedPct / 100);
}

function lockStateFromPeak(peakProfitPct: number): { lockedPct: number; exitReason: ExitReason } {
  if (peakProfitPct > TRAIL_ACTIVE_ABOVE_PCT) {
    return {
      lockedPct: Math.max(0.55, peakProfitPct - TRAIL_OFFSET_PCT),
      exitReason: "TRAILING",
    };
  }
  if (peakProfitPct >= LOCK_055_TRIGGER_PCT) return { lockedPct: 0.55, exitReason: "LOCK_055" };
  if (peakProfitPct >= LOCK_035_TRIGGER_PCT) return { lockedPct: 0.35, exitReason: "LOCK_035" };
  if (peakProfitPct >= LOCK_015_TRIGGER_PCT) return { lockedPct: 0.15, exitReason: "LOCK_015" };
  if (peakProfitPct >= BREAKEVEN_TRIGGER_PCT) return { lockedPct: 0.0, exitReason: "BREAKEVEN" };
  return { lockedPct: Number.NEGATIVE_INFINITY, exitReason: "TIME_EXIT" };
}

function summarizeExitSimulations(sims: ExitSimulation[]): ExitSummaryRow {
  const returns = sims.map((sim) => sim.returnPct);
  const maes = sims.map((sim) => sim.maePct);
  const mfes = sims.map((sim) => sim.mfePct);
  const grossProfits = returns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLossesAbs = Math.abs(returns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return {
    trades: sims.length,
    winRatePct: sims.length === 0 ? 0 : round((sims.filter((sim) => sim.returnPct > 0).length / sims.length) * 100, 2),
    avgReturnPct: round(safeAverage(returns), 4),
    medianReturnPct: round(median(returns), 4),
    avgMaePct: round(safeAverage(maes), 4),
    p95MaePct: round(percentile(maes, 95), 4),
    avgMfePct: round(safeAverage(mfes), 4),
    p95MfePct: round(percentile(mfes, 95), 4),
    profitFactor: grossLossesAbs === 0 ? 0 : round(grossProfits / grossLossesAbs, 4),
  };
}

function simulateExitPath(params: {
  exitMode: ExitModeId;
  direction: Exclude<Direction, "NEUTRAL">;
  candles: OhlcCandle[];
  entryTs: number;
  entryPrice: number;
  wickStopPrice: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  atr14: number | null;
  sessionEndTs: number;
  horizonTs: number;
}) {
  const { exitMode, direction, candles, entryTs, entryPrice, wickStopPrice, rangeHigh, rangeLow, atr14, sessionEndTs, horizonTs } = params;
  const pathCandles = candles.filter((candle) => {
    const closeTs = candle.ts + 5 * 60 * 1000;
    return closeTs > entryTs && closeTs <= horizonTs;
  });

  let maePct = 0;
  let mfePct = 0;
  let peakProfitPct = 0;
  let lockedPct = Number.NEGATIVE_INFINITY;
  let lockedReason: ExitReason = "TIME_EXIT";
  const rangeHeight = rangeHigh !== null && rangeLow !== null ? rangeHigh - rangeLow : null;
  const rangeStopPrice =
    rangeHeight !== null && rangeHeight > 0
      ? direction === "LONG"
        ? rangeLow! - (0.25 * rangeHeight)
        : rangeHigh! + (0.25 * rangeHeight)
      : null;
  const atr15StopPrice =
    atr14 !== null
      ? direction === "LONG"
        ? entryPrice - (1.5 * atr14)
        : entryPrice + (1.5 * atr14)
      : null;
  const atr20StopPrice =
    atr14 !== null
      ? direction === "LONG"
        ? entryPrice - (2.0 * atr14)
        : entryPrice + (2.0 * atr14)
      : null;
  const timeStopReviewTs = Math.min(horizonTs, entryTs + (24 * 60 * 60 * 1000));
  let realizedReturnPct = 0;
  let positionSize = 1;
  let sessionPartialDone = false;
  let reviewMfePct = 0;

  for (const candle of pathCandles) {
    const favorablePrice = direction === "LONG" ? candle.high : candle.low;
    const adversePrice = direction === "LONG" ? candle.low : candle.high;
    const favorablePct = profitPctForPrice(entryPrice, favorablePrice, direction);
    const adversePct = -profitPctForPrice(entryPrice, adversePrice, direction);

    const weightedFavorablePct = realizedReturnPct + (positionSize * favorablePct);
    const weightedAdversePct = realizedReturnPct - (positionSize * adversePct);
    mfePct = Math.max(mfePct, weightedFavorablePct);
    maePct = Math.max(maePct, Math.max(0, -weightedAdversePct));
    peakProfitPct = Math.max(peakProfitPct, favorablePct);
    if (candle.ts + 5 * 60 * 1000 <= timeStopReviewTs) {
      reviewMfePct = Math.max(reviewMfePct, favorablePct);
    }

    if (exitMode === "PARTIAL_50_SESSION_WEEK" && !sessionPartialDone && candle.ts + 5 * 60 * 1000 >= sessionEndTs) {
      const sessionMark = profitPctForPrice(entryPrice, candle.close, direction);
      realizedReturnPct += 0.5 * sessionMark;
      positionSize = 0.5;
      sessionPartialDone = true;
    }

    if (exitMode === "TIME_STOP_2SESS" && candle.ts + 5 * 60 * 1000 >= timeStopReviewTs && reviewMfePct < 0.5) {
      const currentReturnPct = realizedReturnPct + (positionSize * profitPctForPrice(entryPrice, candle.close, direction));
      return {
        exitMode,
        exitReason: "TIME_EXIT",
        exitTs: candle.ts,
        exitPrice: round(candle.close),
        returnPct: round(currentReturnPct, 4),
        maePct: round(maePct, 4),
        mfePct: round(mfePct, 4),
        peakProfitPct: round(peakProfitPct, 4),
      } satisfies ExitSimulation;
    }

    if (exitMode === "PARTIAL_50_SESSION_WEEK") {
      continue;
    }

    if (exitMode === "WICK_STOP_MILESTONE") {
      const state = lockStateFromPeak(peakProfitPct);
      if (state.lockedPct > lockedPct) {
        lockedPct = state.lockedPct;
        lockedReason = state.exitReason;
      }
    }

    if (
      exitMode === "RANGE_STOP_WEEK_CLOSE" ||
      exitMode === "ATR_1_5_WEEK_CLOSE" ||
      exitMode === "ATR_2_0_WEEK_CLOSE"
    ) {
      const activeStopPrice =
        exitMode === "RANGE_STOP_WEEK_CLOSE" ? rangeStopPrice :
          exitMode === "ATR_1_5_WEEK_CLOSE" ? atr15StopPrice :
            atr20StopPrice;
      if (activeStopPrice !== null && Number.isFinite(activeStopPrice)) {
        const hit = direction === "LONG" ? candle.low <= activeStopPrice : candle.high >= activeStopPrice;
        if (hit) {
          const returnPct = profitPctForPrice(entryPrice, activeStopPrice, direction);
          return {
            exitMode,
            exitReason: "STOP_LOSS",
            exitTs: candle.ts,
            exitPrice: round(activeStopPrice),
            returnPct: round(returnPct, 4),
            maePct: round(maePct, 4),
            mfePct: round(mfePct, 4),
            peakProfitPct: round(peakProfitPct, 4),
          } satisfies ExitSimulation;
        }
      }
    }

    if (exitMode === "WICK_STOP_MILESTONE") {
      const activeStopPrice =
        Number.isFinite(lockedPct)
          ? stopPriceForLockedPct(entryPrice, direction, lockedPct)
          : wickStopPrice;
      if (activeStopPrice !== null && Number.isFinite(activeStopPrice)) {
        const hit = direction === "LONG" ? candle.low <= activeStopPrice : candle.high >= activeStopPrice;
        if (hit) {
          const returnPct = profitPctForPrice(entryPrice, activeStopPrice, direction);
          return {
            exitMode,
            exitReason: exitMode === "WICK_STOP_MILESTONE" ? lockedReason : "STOP_LOSS",
            exitTs: candle.ts,
            exitPrice: round(activeStopPrice),
            returnPct: round(returnPct, 4),
            maePct: round(maePct, 4),
            mfePct: round(mfePct, 4),
            peakProfitPct: round(peakProfitPct, 4),
          } satisfies ExitSimulation;
        }
      }
    }
  }

  const exitCandle = lastCloseBefore(candles, horizonTs);
  const exitPrice = exitCandle?.close ?? entryPrice;
  return {
    exitMode,
    exitReason: "TIME_EXIT",
    exitTs: exitCandle?.ts ?? horizonTs,
    exitPrice: round(exitPrice),
    returnPct: round(realizedReturnPct + (positionSize * profitPctForPrice(entryPrice, exitPrice, direction)), 4),
    maePct: round(maePct, 4),
    mfePct: round(mfePct, 4),
    peakProfitPct: round(peakProfitPct, 4),
  } satisfies ExitSimulation;
}

async function main() {
  const pairUniverse = buildPairUniverse();
  const targetWeeks = await getTargetWeeks();
  const weeklyMatrixMap = await loadWeeklyMatrixMap(targetWeeks, pairUniverse);
  const baseDirectionalByWeek = new Map<string, Map<string, DirectionalRow>>();
  for (const [week, weekMap] of weeklyMatrixMap.entries()) {
    baseDirectionalByWeek.set(week, buildDirectionalMap(weekMap));
  }

  const fxBuckets = buildFxCurrencyBuckets(pairUniverse);
  const fetchFrom = DateTime.fromISO(targetWeeks[0], { zone: "utc" }).minus({ days: WARMUP_DAYS });
  const fetchTo = DateTime.fromISO(targetWeeks[targetWeeks.length - 1], { zone: "utc" }).plus({ weeks: 1 });

  const rawM5ByPair = new Map<string, OhlcCandle[]>();
  const indicatorsByPair = new Map<string, IndicatorPack>();
  const missingPairs: string[] = [];

  await runWithConcurrency(pairUniverse, FETCH_CONCURRENCY, async (pairInfo) => {
    const key = pairKey(pairInfo.assetClass, pairInfo.pair);
    try {
      const candles = await fetchOandaM5Series(pairInfo.pair, fetchFrom, fetchTo);
      if (candles.length === 0) {
        missingPairs.push(key);
        return;
      }
      rawM5ByPair.set(key, candles);
      indicatorsByPair.set(key, buildIndicatorPack(candles, 2.0));
    } catch (error) {
      missingPairs.push(`${key} (${error instanceof Error ? error.message : String(error)})`);
    }
  });

  const variantOutputs: Array<Record<string, unknown>> = [];

  for (const config of VARIANT_CONFIGS) {
    const trades: TriggerTrade[] = [];
    console.log(`Running variant ${config.variantId} ...`);

    for (const weekOpenUtc of targetWeeks) {
      const weekMap = weeklyMatrixMap.get(weekOpenUtc);
      const baseDirectionalMap = baseDirectionalByWeek.get(weekOpenUtc);
      if (!weekMap || !baseDirectionalMap) continue;
      const weekEnd = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ weeks: 1 });
      const entryWindows = buildEntryWindowsForWeek(weekOpenUtc);

      for (const pairInfo of pairUniverse) {
        const key = pairKey(pairInfo.assetClass, pairInfo.pair);
        const candles = rawM5ByPair.get(key);
        const indicators = indicatorsByPair.get(key);
        if (!candles || !indicators) continue;

        for (const window of entryWindows) {
          if (!isPairEligibleForWindow(pairInfo.pair, window.session)) continue;

          const candidates = config.strategy === "SWEEP"
            ? detectSweepCandidates(pairInfo, candles, indicators, window, config)
            : detectMaBbCandidates(candles, indicators, window);
          if (candidates.length === 0) continue;

          let selected: {
            candidate: TriggerCandidate;
            pairRow: DirectionalRow;
            handshake: HandshakeDetail;
          } | null = null;

          let frozenDirectionalMap: Map<string, DirectionalRow> | null = null;
          if (config.gateMode === "FROZEN") {
            const frozenSnapshot = await loadGateSnapshotAt(window.entryStart.toISO() ?? weekOpenUtc, weekMap);
            frozenDirectionalMap = frozenSnapshot.byPair;
          }

          for (const candidate of candidates) {
            const liveDirectionalMap =
              config.gateMode === "LIVE"
                ? (await loadGateSnapshotAt(
                  DateTime.fromMillis(candidate.entryTs, { zone: "utc" }).toISO() ?? weekOpenUtc,
                  weekMap,
                )).byPair
                : null;

            const directionalMap =
              config.gateMode === "UNGATED"
                ? baseDirectionalMap
                : config.gateMode === "FROZEN"
                  ? (frozenDirectionalMap ?? baseDirectionalMap)
                  : (liveDirectionalMap ?? baseDirectionalMap);

            const pairRow = directionalMap.get(pairInfo.pair);
            if (!pairRow || pairRow.direction !== candidate.direction || pairRow.direction === "NEUTRAL") continue;

            const handshake = computeHandshakeDetail(
              pairInfo,
              candidate.direction,
              directionalMap,
              fxBuckets,
              config.handshakeThresholdPct,
            );
            if (!handshake.passed) continue;

            selected = { candidate, pairRow, handshake };
            break;
          }

          if (!selected) continue;

          const sessionMetrics = computeTradeMetrics(
            selected.candidate.direction,
            candles,
            selected.candidate.entryTs,
            selected.candidate.entryPrice,
            window.entryEnd.toMillis(),
          );
          const weekMetrics = computeTradeMetrics(
            selected.candidate.direction,
            candles,
            selected.candidate.entryTs,
            selected.candidate.entryPrice,
            weekEnd.toMillis(),
          );

          trades.push({
            variantId: config.variantId,
            baseVariantId: config.id,
            strategy: config.strategy,
            gateMode: config.gateMode,
            weekOpenUtc,
            weekLabel: weekLabelFromOpen(weekOpenUtc),
            pair: pairInfo.pair,
            assetClass: pairInfo.assetClass,
            session: window.session,
            direction: selected.candidate.direction,
            tier: selected.pairRow.tier === "NEUTRAL" ? "MEDIUM" : selected.pairRow.tier,
            entryTimeUtc: DateTime.fromMillis(selected.candidate.entryTs, { zone: "utc" }).toISO() ?? "",
            entryPrice: round(selected.candidate.entryPrice),
            handshake: selected.handshake,
            sweepPct: selected.candidate.sweepPct,
            displacementBodyPct: selected.candidate.displacementBodyPct,
            signalForm: selected.candidate.signalForm,
            wickStopPrice: selected.candidate.wickStopPrice,
            wickStopDistancePct: selected.candidate.wickStopDistancePct,
            rangeHigh: selected.candidate.rangeHigh,
            rangeLow: selected.candidate.rangeLow,
            atr14: selected.candidate.atr14,
            sessionEndUtc: window.entryEnd.toISO() ?? "",
            weekEndUtc: weekEnd.toISO() ?? "",
            sessionMetrics,
            weekMetrics,
          });
        }
      }
    }

    const agreementValues = trades
      .map((trade) => trade.handshake.agreementPct)
      .filter((value): value is number => value !== null);
    const fxCryptoOnly = trades.filter((trade) => trade.assetClass === "fx" || trade.assetClass === "crypto");

    const exitModes: ExitModeId[] = [
      "SESSION_CLOSE",
      "WEEK_CLOSE",
      "RANGE_STOP_WEEK_CLOSE",
      "ATR_1_5_WEEK_CLOSE",
      "ATR_2_0_WEEK_CLOSE",
      "PARTIAL_50_SESSION_WEEK",
      "TIME_STOP_2SESS",
    ];

    const exitResults = exitModes.map((exitMode) => {
      const sims = trades.map((trade) => {
        const key = pairKey(trade.assetClass, trade.pair);
        const candles = rawM5ByPair.get(key) ?? [];
        const effectiveHorizonTs =
          exitMode === "SESSION_CLOSE"
            ? DateTime.fromISO(trade.sessionEndUtc, { zone: "utc" }).toMillis()
            : DateTime.fromISO(trade.weekEndUtc, { zone: "utc" }).toMillis();
        return simulateExitPath({
          exitMode,
          direction: trade.direction,
          candles,
          entryTs: DateTime.fromISO(trade.entryTimeUtc, { zone: "utc" }).toMillis(),
          entryPrice: trade.entryPrice,
          wickStopPrice: trade.wickStopPrice,
          rangeHigh: trade.rangeHigh,
          rangeLow: trade.rangeLow,
          atr14: trade.atr14,
          sessionEndTs: DateTime.fromISO(trade.sessionEndUtc, { zone: "utc" }).toMillis(),
          horizonTs: effectiveHorizonTs,
        });
      });

      return {
        exitMode,
        summary: summarizeExitSimulations(sims),
        reasonCounts: sims.reduce<Record<string, number>>((acc, sim) => {
          acc[sim.exitReason] = (acc[sim.exitReason] ?? 0) + 1;
          return acc;
        }, {}),
      };
    });

    const sweepStats = {
      averageSweepBreachPct: round(safeAverage(trades.map((trade) => trade.sweepPct).filter((value): value is number => value !== null)), 4),
      averageDisplacementBodyPct: round(safeAverage(trades.map((trade) => trade.displacementBodyPct).filter((value): value is number => value !== null)), 4),
      signalFormCounts: {
        oneBar: trades.filter((trade) => trade.signalForm === "1_BAR").length,
        twoBar: trades.filter((trade) => trade.signalForm === "2_BAR").length,
      },
      averageWickStopDistancePct: round(safeAverage(trades.map((trade) => trade.wickStopDistancePct).filter((value): value is number => value !== null)), 4),
    };

    variantOutputs.push({
      variantId: config.variantId,
      baseVariantId: config.id,
      strategy: config.strategy,
      gateMode: config.gateMode,
      entryOverall: summarizeTrades(trades),
      entryOverallFxCryptoOnly: summarizeTrades(fxCryptoOnly),
      warnings: buildTradeWarnings(trades),
      sweepStats,
      handshakeStats: {
        averageAgreementPct: round(safeAverage(agreementValues), 2),
        medianAgreementPct: round(median(agreementValues), 2),
      },
      exitResults,
      byAssetClass: aggregateBy(trades, (trade) => trade.assetClass)
        .sort((a, b) => b.trades - a.trades)
        .map((row) => ({ assetClass: row.key as AssetClass, ...row })),
      sampleTrades: trades.slice(0, 25),
    });

    console.log(JSON.stringify({ variantId: config.variantId, trades: trades.length }, null, 2));
  }

  const comparison = variantOutputs.map((row) => {
    const weekClose = (row.exitResults as Array<{ exitMode: ExitModeId; summary: ExitSummaryRow }>).find((result) => result.exitMode === "WEEK_CLOSE");
    const rangeStop = (row.exitResults as Array<{ exitMode: ExitModeId; summary: ExitSummaryRow }>).find((result) => result.exitMode === "RANGE_STOP_WEEK_CLOSE");
    const atr15 = (row.exitResults as Array<{ exitMode: ExitModeId; summary: ExitSummaryRow }>).find((result) => result.exitMode === "ATR_1_5_WEEK_CLOSE");
    const atr20 = (row.exitResults as Array<{ exitMode: ExitModeId; summary: ExitSummaryRow }>).find((result) => result.exitMode === "ATR_2_0_WEEK_CLOSE");
    const partial50 = (row.exitResults as Array<{ exitMode: ExitModeId; summary: ExitSummaryRow }>).find((result) => result.exitMode === "PARTIAL_50_SESSION_WEEK");
    const timeStop = (row.exitResults as Array<{ exitMode: ExitModeId; summary: ExitSummaryRow }>).find((result) => result.exitMode === "TIME_STOP_2SESS");
    return {
      variantId: row.variantId,
      baseVariantId: row.baseVariantId,
      entryTrades: (row.entryOverall as SummaryRow).trades,
      weekClose: weekClose?.summary,
      rangeStopWeekClose: rangeStop?.summary,
      atr15WeekClose: atr15?.summary,
      atr20WeekClose: atr20?.summary,
      partial50SessionWeek: partial50?.summary,
      timeStop2Sess: timeStop?.summary,
      warnings: row.warnings,
    };
  });

  const report = {
    generatedUtc: new Date().toISOString(),
    config: {
      weeks: targetWeeks,
      pairCount: pairUniverse.length,
      warmupDays: WARMUP_DAYS,
      fetchConcurrency: FETCH_CONCURRENCY,
      maLength: MA_LENGTH,
      bbLength: BB_LENGTH,
      variants: VARIANT_CONFIGS,
      gateModes: GATE_MODES,
      handshakeScoring: "average of strong/weak FX bucket agreement with current pair excluded; crypto and indices require full directional agreement",
      entryWindowsUtc: {
        rangeA: "00:00-13:00 UTC -> NY entry 13:00-21:00 UTC",
        rangeB: "13:00-21:00 UTC -> next-day Asia+London entry 00:00-13:00 UTC",
      },
      exitsCompared: [
        "SESSION_CLOSE",
        "WEEK_CLOSE",
        "RANGE_STOP_WEEK_CLOSE",
        "ATR_1_5_WEEK_CLOSE",
        "ATR_2_0_WEEK_CLOSE",
        "PARTIAL_50_SESSION_WEEK",
        "TIME_STOP_2SESS",
      ],
      exitAssumptions: {
        rangeStopBufferMultiple: 0.25,
        atrSource: "M5 ATR(14)",
        partialSessionFractionClosed: 0.5,
        timeStopReviewHours: 24,
        timeStopRequiredMfePct: 0.5,
      },
    },
    comparison,
    variants: variantOutputs,
    missingPairs,
    notes: [
      "This pass focuses only on the two sweep-entry candidates worth carrying forward from the unified sweep.",
      "LIVE gating is used as the representative gated mode because gate timing was not the main differentiator for sweep entries.",
      "Range stop uses the opposite range boundary plus 0.25x range-height buffer.",
      "ATR stop uses M5 ATR(14) at entry as the first volatility-normalized approximation.",
    ],
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const reportPath = path.join(REPORTS_DIR, `cfd-sweep-exit-research-${timestamp}.json`);
  const latestPath = path.join(REPORTS_DIR, "cfd-sweep-exit-research-latest.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(latestPath, JSON.stringify(report, null, 2), "utf8");

  console.log("CFD sweep exit research complete.");
  console.log(JSON.stringify({ comparison, reportPath, latestPath, missingPairs: missingPairs.length }, null, 2));
}
main().catch((error) => {
  console.error("backtest-cfd-unified-katarakti-sweep failed:", error);
  process.exitCode = 1;
});
