/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-cfd-portfolio-exit-research.ts
 *
 * Run:
 *   npx tsx scripts/backtest-cfd-portfolio-exit-research.ts
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
import {
  SESSION_ELIGIBILITY,
  SESSION_WINDOWS_UTC,
  type SessionName,
} from "../src/lib/flagship/sessionConfig";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type CurrencyState = "STRONG" | "WEAK" | "NEUTRAL";
type ExitPolicyId =
  | "session_close"
  | "week_close"
  | "opp_band_week_close"
  | "opp_band_mid_trail_week_close"
  | "stop3d_week_close"
  | "stop3d_opp_band_week_close";
type ExitReason = "session_close" | "week_close" | "opp_band" | "mid_trail" | "stop_3d";

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

type IndicatorPack = {
  sma200: Array<number | null>;
  bbMid: Array<number | null>;
  bbUpper: Array<number | null>;
  bbLower: Array<number | null>;
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

type EntryTrade = {
  entryId: string;
  pairKey: string;
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  assetClass: AssetClass;
  session: SessionName;
  sessionDateUtc: string;
  weeklyDirection: Exclude<Direction, "NEUTRAL">;
  weeklyTier: "HIGH" | "MEDIUM";
  entryTs: number;
  entryIndex: number;
  entryTimeUtc: string;
  entryPrice: number;
  ma200: number;
  bollingerMid: number;
  bollingerUpper: number;
  bollingerLower: number;
  sessionEndTs: number;
  weekEndTs: number;
  stop3dPrice: number;
  stop3dDistancePct: number;
  handshake: HandshakeDetail;
};

type ExecutedTrade = EntryTrade & {
  exitPolicyId: ExitPolicyId;
  exitTs: number;
  exitTimeUtc: string;
  exitPrice: number;
  exitReason: ExitReason;
  returnPct: number;
  maePct: number;
  mfePct: number;
  holdingBars: number;
};

type TradeSummary = {
  trades: number;
  winRatePct: number;
  avgReturnPct: number;
  medianReturnPct: number;
  avgMaePct: number;
  p95MaePct: number;
  avgMfePct: number;
  p95MfePct: number;
  avgHoldingBars: number;
  drawdownAdjustedScore: number;
};

type BookSummary = {
  finalRealizedPctPoints: number;
  maxDrawdownPctPoints: number;
  drawdownAdjustedBookScore: number;
  maxConcurrentTrades: number;
  avgConcurrentTrades: number;
  maxSamePairOverlap: number;
  worstOpenBookMtmPctPoints: number;
  worstWeekRealizedPctPoints: number;
  bestWeekRealizedPctPoints: number;
};

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

const CACHE_DIR = path.join(process.cwd(), ".cache", "cfd-ma-bb-trigger");
const REPORTS_DIR = path.join(process.cwd(), "reports");
const TARGET_WEEKS_COUNT = Number(process.env.CFD_MA_BB_BACKTEST_WEEKS ?? "8");
const WARMUP_DAYS = Number(process.env.CFD_MA_BB_WARMUP_DAYS ?? "14");
const FETCH_CONCURRENCY = Number(process.env.CFD_MA_BB_FETCH_CONCURRENCY ?? "4");
const MA_LENGTH = Number(process.env.CFD_MA_BB_MA_LENGTH ?? "200");
const BB_LENGTH = Number(process.env.CFD_MA_BB_BB_LENGTH ?? "20");
const BB_STD_DEV = 2.0;
const WEEKLY_HANDSHAKE_THRESHOLD = 60;
const STOP_LOOKBACK_DAYS = 3;
const STEP_MS = 5 * 60 * 1000;
const PAIR_FILTER = new Set(
  (process.env.CFD_MA_BB_PAIR_FILTER ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

const EXIT_POLICIES: Array<{ id: ExitPolicyId; label: string }> = [
  { id: "session_close", label: "Session Close" },
  { id: "week_close", label: "Week Close" },
  { id: "opp_band_week_close", label: "Opposite Band / Week Close" },
  { id: "opp_band_mid_trail_week_close", label: "Opposite Band Then Midline Trail / Week Close" },
  { id: "stop3d_week_close", label: "3-Day Stop / Week Close" },
  { id: "stop3d_opp_band_week_close", label: "3-Day Stop or Opposite Band / Week Close" },
];

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

function candleCloseTs(candle: OhlcCandle) {
  return candle.ts + STEP_MS;
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

async function runWithConcurrency<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>) {
  const out: R[] = [];
  const safeLimit = Math.max(1, limit);
  for (let i = 0; i < items.length; i += safeLimit) {
    const chunk = items.slice(i, i + safeLimit);
    out.push(...(await Promise.all(chunk.map((item) => task(item)))));
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
  const maxBarsPerRequest = 4000;
  const all = new Map<number, OhlcCandle>();
  let cursor = fromUtc;
  let page = 0;

  while (cursor.toMillis() < toUtc.toMillis() && page < 120) {
    page += 1;
    const requestTo = DateTime.fromMillis(
      Math.min(toUtc.toMillis(), cursor.toMillis() + STEP_MS * maxBarsPerRequest),
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
      .filter((row) => Number.isFinite(row.ts) && Number.isFinite(row.open) && Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close))
      .sort((a, b) => a.ts - b.ts);

    if (candles.length === 0) break;
    for (const candle of candles) {
      if (candle.ts >= fromUtc.toMillis() && candle.ts < toUtc.toMillis()) all.set(candle.ts, candle);
    }

    const lastTs = candles[candles.length - 1]!.ts;
    const nextTs = lastTs + STEP_MS;
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

function buildIndicatorPack(candles: OhlcCandle[]): IndicatorPack {
  const closes = candles.map((candle) => candle.close);
  const sma200 = computeSma(closes, MA_LENGTH);
  const bbMid = computeSma(closes, BB_LENGTH);
  const bbStd = computeStdDev(closes, BB_LENGTH, bbMid);
  const bbUpper = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid + BB_STD_DEV * (bbStd[index] ?? 0)));
  const bbLower = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid - BB_STD_DEV * (bbStd[index] ?? 0)));
  return { sma200, bbMid, bbUpper, bbLower };
}

function lastCloseBefore(candles: OhlcCandle[], exitTs: number) {
  let last: OhlcCandle | null = null;
  for (const candle of candles) {
    if (candleCloseTs(candle) > exitTs) break;
    last = candle;
  }
  return last;
}

function buildSessionWindowsForWeek(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekEnd = weekOpen.plus({ weeks: 1 });
  const windows: Array<{ session: SessionName; sessionStart: DateTime; sessionEnd: DateTime }> = [];
  let cursor = weekOpen.startOf("day");
  while (cursor < weekEnd) {
    for (const session of Object.keys(SESSION_WINDOWS_UTC) as SessionName[]) {
      const config = SESSION_WINDOWS_UTC[session];
      const rawStart = cursor.set({ hour: config.startHour, minute: 0, second: 0, millisecond: 0 });
      const rawEnd = cursor.set({ hour: config.endHour, minute: 0, second: 0, millisecond: 0 });
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

function findTriggerEntry(
  direction: Exclude<Direction, "NEUTRAL">,
  candles: OhlcCandle[],
  indicators: IndicatorPack,
  sessionStartMs: number,
  sessionEndMs: number,
) {
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const closeTs = candleCloseTs(candle);
    if (closeTs < sessionStartMs) continue;
    if (closeTs >= sessionEndMs) break;

    const ma = indicators.sma200[i];
    const bbMid = indicators.bbMid[i];
    const bbUpper = indicators.bbUpper[i];
    const bbLower = indicators.bbLower[i];
    if (ma === null || bbMid === null || bbUpper === null || bbLower === null) continue;

    const qualifies =
      direction === "LONG"
        ? candle.close > ma && candle.low <= bbLower && candle.close > candle.open
        : candle.close < ma && candle.high >= bbUpper && candle.close < candle.open;
    if (!qualifies) continue;

    return {
      index: i,
      entryTs: closeTs,
      entryPrice: candle.close,
      ma200: ma,
      bollingerMid: bbMid,
      bollingerUpper: bbUpper,
      bollingerLower: bbLower,
    };
  }
  return null;
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
  weekMap: Map<string, WeeklyMatrixRow>,
) {
  let eligible = 0;
  let agreeing = 0;
  for (const pairInfo of bucketPairs) {
    if (pairInfo.pair === currentPair.pair) continue;
    const weekly = weekMap.get(pairInfo.pair);
    if (!weekly || weekly.weeklyDirection === "NEUTRAL") continue;
    const inferred = inferCurrencyState(pairInfo, sharedCurrency, weekly.weeklyDirection);
    if (inferred === "NEUTRAL") continue;
    eligible += 1;
    if (inferred === desiredState) agreeing += 1;
  }
  return eligible === 0 ? null : round((agreeing / eligible) * 100, 2);
}

function computeHandshakeDetail(
  pairInfo: PairInfo,
  direction: Exclude<Direction, "NEUTRAL">,
  weekMap: Map<string, WeeklyMatrixRow>,
  fxBuckets: Map<string, PairInfo[]>,
) {
  if (pairInfo.assetClass === "indices") {
    const indices = (PAIRS_BY_ASSET_CLASS.indices ?? []).map((row) => row.pair);
    const passed = indices.every((pair) => weekMap.get(pair)?.weeklyDirection === direction);
    return {
      bucketType: "INDICES" as const,
      weakCurrency: null,
      strongCurrency: null,
      weakAgreementPct: null,
      strongAgreementPct: null,
      agreementPct: passed ? 100 : 0,
      passed,
    };
  }

  if (pairInfo.assetClass === "crypto") {
    const crypto = (PAIRS_BY_ASSET_CLASS.crypto ?? []).map((row) => row.pair);
    const passed = crypto.every((pair) => weekMap.get(pair)?.weeklyDirection === direction);
    return {
      bucketType: "CRYPTO" as const,
      weakCurrency: null,
      strongCurrency: null,
      weakAgreementPct: null,
      strongAgreementPct: null,
      agreementPct: passed ? 100 : 0,
      passed,
    };
  }

  if (pairInfo.assetClass !== "fx") {
    return {
      bucketType: "NONE" as const,
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
  const strongAgreementPct = computeBucketAgreementPct(strongCurrency, "STRONG", strongBucket, pairInfo, weekMap);
  const weakAgreementPct = computeBucketAgreementPct(weakCurrency, "WEAK", weakBucket, pairInfo, weekMap);
  const available = [strongAgreementPct, weakAgreementPct].filter((value): value is number => value !== null);
  const agreementPct = available.length === 0 ? 0 : round(safeAverage(available), 2);
  return {
    bucketType: "FX" as const,
    weakCurrency,
    strongCurrency,
    weakAgreementPct,
    strongAgreementPct,
    agreementPct,
    passed: agreementPct >= WEEKLY_HANDSHAKE_THRESHOLD,
  };
}

function computeThreeDayStopPrice(
  direction: Exclude<Direction, "NEUTRAL">,
  candles: OhlcCandle[],
  entryIndex: number,
) {
  const entryCandle = candles[entryIndex];
  const startTs = entryCandle.ts - STOP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const window = candles.filter((candle, index) => index < entryIndex && candle.ts >= startTs);
  const fallback = entryIndex > 0 ? candles.slice(Math.max(0, entryIndex - 12), entryIndex) : [];
  const source = window.length > 0 ? window : fallback;
  if (source.length === 0) {
    return direction === "LONG" ? entryCandle.low : entryCandle.high;
  }
  return direction === "LONG"
    ? Math.min(...source.map((candle) => candle.low))
    : Math.max(...source.map((candle) => candle.high));
}

function simulateExit(
  policyId: ExitPolicyId,
  entry: EntryTrade,
  candles: OhlcCandle[],
  indicators: IndicatorPack,
): ExecutedTrade {
  const hardEndTs = policyId === "session_close" ? entry.sessionEndTs : entry.weekEndTs;
  const fallbackCandle = lastCloseBefore(candles, hardEndTs);
  if (!fallbackCandle) throw new Error(`Missing fallback exit candle for ${entry.pair} at ${entry.entryTimeUtc}`);

  let exitTs = candleCloseTs(fallbackCandle);
  let exitPrice = fallbackCandle.close;
  let exitReason: ExitReason = policyId === "session_close" ? "session_close" : "week_close";
  let armedTrail = false;

  for (let i = entry.entryIndex + 1; i < candles.length; i += 1) {
    const candle = candles[i];
    const closeTs = candleCloseTs(candle);
    if (closeTs > hardEndTs) break;

    const bbUpper = indicators.bbUpper[i];
    const bbLower = indicators.bbLower[i];
    const bbMid = indicators.bbMid[i];
    const stopHit =
      policyId === "stop3d_week_close" || policyId === "stop3d_opp_band_week_close"
        ? entry.weeklyDirection === "LONG"
          ? candle.low <= entry.stop3dPrice
          : candle.high >= entry.stop3dPrice
        : false;

    if (stopHit) {
      exitTs = closeTs;
      exitPrice = entry.stop3dPrice;
      exitReason = "stop_3d";
      break;
    }

    const oppositeBandTouched =
      entry.weeklyDirection === "LONG"
        ? bbUpper !== null && candle.high >= bbUpper
        : bbLower !== null && candle.low <= bbLower;

    if (policyId === "opp_band_week_close" || policyId === "stop3d_opp_band_week_close") {
      if (oppositeBandTouched) {
        exitTs = closeTs;
        exitPrice = entry.weeklyDirection === "LONG" ? (bbUpper as number) : (bbLower as number);
        exitReason = "opp_band";
        break;
      }
    }

    if (policyId === "opp_band_mid_trail_week_close") {
      if (!armedTrail && oppositeBandTouched) {
        armedTrail = true;
        continue;
      }
      if (
        armedTrail &&
        bbMid !== null &&
        ((entry.weeklyDirection === "LONG" && candle.close < bbMid) ||
          (entry.weeklyDirection === "SHORT" && candle.close > bbMid))
      ) {
        exitTs = closeTs;
        exitPrice = candle.close;
        exitReason = "mid_trail";
        break;
      }
    }
  }

  const pathCandles = candles.filter((candle) => {
    const closeTs = candleCloseTs(candle);
    return closeTs > entry.entryTs && closeTs <= exitTs;
  });

  let maePct = 0;
  let mfePct = 0;
  for (const candle of pathCandles) {
    if (entry.weeklyDirection === "LONG") {
      maePct = Math.max(maePct, ((entry.entryPrice - candle.low) / entry.entryPrice) * 100);
      mfePct = Math.max(mfePct, ((candle.high - entry.entryPrice) / entry.entryPrice) * 100);
    } else {
      maePct = Math.max(maePct, ((candle.high - entry.entryPrice) / entry.entryPrice) * 100);
      mfePct = Math.max(mfePct, ((entry.entryPrice - candle.low) / entry.entryPrice) * 100);
    }
  }

  const returnPct =
    entry.weeklyDirection === "LONG"
      ? ((exitPrice - entry.entryPrice) / entry.entryPrice) * 100
      : ((entry.entryPrice - exitPrice) / entry.entryPrice) * 100;

  return {
    ...entry,
    exitPolicyId: policyId,
    exitTs,
    exitTimeUtc: DateTime.fromMillis(exitTs, { zone: "utc" }).toISO() ?? "",
    exitPrice: round(exitPrice),
    exitReason,
    returnPct: round(returnPct, 4),
    maePct: round(maePct, 4),
    mfePct: round(mfePct, 4),
    holdingBars: Math.max(0, Math.round((exitTs - entry.entryTs) / STEP_MS)),
  };
}

function summarizeExecutedTrades(trades: ExecutedTrade[]): TradeSummary {
  const returns = trades.map((trade) => trade.returnPct);
  const maes = trades.map((trade) => trade.maePct);
  const mfes = trades.map((trade) => trade.mfePct);
  const holdingBars = trades.map((trade) => trade.holdingBars);
  const avgMaePct = round(safeAverage(maes), 4);
  return {
    trades: trades.length,
    winRatePct: trades.length === 0 ? 0 : round((trades.filter((trade) => trade.returnPct > 0).length / trades.length) * 100, 2),
    avgReturnPct: round(safeAverage(returns), 4),
    medianReturnPct: round(median(returns), 4),
    avgMaePct,
    p95MaePct: round(percentile(maes, 95), 4),
    avgMfePct: round(safeAverage(mfes), 4),
    p95MfePct: round(percentile(mfes, 95), 4),
    avgHoldingBars: round(safeAverage(holdingBars), 2),
    drawdownAdjustedScore: avgMaePct === 0 ? 0 : round(safeAverage(returns) / avgMaePct, 4),
  };
}

function aggregateExecutedBy<T extends string>(trades: ExecutedTrade[], keyFn: (trade: ExecutedTrade) => T) {
  const grouped = new Map<T, ExecutedTrade[]>();
  for (const trade of trades) {
    const key = keyFn(trade);
    const bucket = grouped.get(key) ?? [];
    bucket.push(trade);
    grouped.set(key, bucket);
  }
  return Array.from(grouped.entries()).map(([key, bucket]) => ({ key, ...summarizeExecutedTrades(bucket) }));
}

function simulateBook(
  trades: ExecutedTrade[],
  rawM5ByPair: Map<string, OhlcCandle[]>,
): BookSummary {
  const closeEvents = new Map<number, Array<{ pairKey: string; close: number }>>();
  for (const [key, candles] of rawM5ByPair.entries()) {
    for (const candle of candles) {
      const ts = candleCloseTs(candle);
      const bucket = closeEvents.get(ts) ?? [];
      bucket.push({ pairKey: key, close: candle.close });
      closeEvents.set(ts, bucket);
    }
  }

  const timestamps = Array.from(closeEvents.keys()).sort((a, b) => a - b);
  const minEntryTs = Math.min(...trades.map((trade) => trade.entryTs));
  const maxExitTs = Math.max(...trades.map((trade) => trade.exitTs));
  const entriesByTs = new Map<number, ExecutedTrade[]>();
  const exitsByTs = new Map<number, ExecutedTrade[]>();

  for (const trade of trades) {
    const entryBucket = entriesByTs.get(trade.entryTs) ?? [];
    entryBucket.push(trade);
    entriesByTs.set(trade.entryTs, entryBucket);
    const exitBucket = exitsByTs.get(trade.exitTs) ?? [];
    exitBucket.push(trade);
    exitsByTs.set(trade.exitTs, exitBucket);
  }

  const lastCloseByPair = new Map<string, number>();
  const openTrades = new Map<string, ExecutedTrade>();
  const weeklyRealized = new Map<string, number>();
  let realized = 0;
  let peakEquity = 0;
  let maxDrawdown = 0;
  let maxConcurrentTrades = 0;
  let maxSamePairOverlap = 0;
  let concurrentSum = 0;
  let concurrentCount = 0;
  let worstOpenBookMtm = 0;

  for (const ts of timestamps) {
    if (ts < minEntryTs || ts > maxExitTs) continue;
    for (const event of closeEvents.get(ts) ?? []) {
      lastCloseByPair.set(event.pairKey, event.close);
    }

    for (const trade of exitsByTs.get(ts) ?? []) {
      realized += trade.returnPct;
      openTrades.delete(trade.entryId);
      weeklyRealized.set(trade.weekLabel, round((weeklyRealized.get(trade.weekLabel) ?? 0) + trade.returnPct, 4));
    }
    for (const trade of entriesByTs.get(ts) ?? []) {
      openTrades.set(trade.entryId, trade);
    }

    let openMtm = 0;
    const pairCounts = new Map<string, number>();
    for (const trade of openTrades.values()) {
      const currentPrice = lastCloseByPair.get(trade.pairKey) ?? trade.entryPrice;
      const currentReturn =
        trade.weeklyDirection === "LONG"
          ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
          : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
      openMtm += currentReturn;
      pairCounts.set(trade.pair, (pairCounts.get(trade.pair) ?? 0) + 1);
    }

    const equity = realized + openMtm;
    peakEquity = Math.max(peakEquity, equity);
    maxDrawdown = Math.max(maxDrawdown, peakEquity - equity);
    worstOpenBookMtm = Math.min(worstOpenBookMtm, openMtm);
    maxConcurrentTrades = Math.max(maxConcurrentTrades, openTrades.size);
    maxSamePairOverlap = Math.max(maxSamePairOverlap, ...Array.from(pairCounts.values()), 0);
    concurrentSum += openTrades.size;
    concurrentCount += 1;
  }

  const weeklyValues = Array.from(weeklyRealized.values());
  const finalRealizedPctPoints = round(realized, 4);
  const maxDrawdownPctPoints = round(maxDrawdown, 4);
  return {
    finalRealizedPctPoints,
    maxDrawdownPctPoints,
    drawdownAdjustedBookScore:
      maxDrawdownPctPoints === 0 ? 0 : round(finalRealizedPctPoints / maxDrawdownPctPoints, 4),
    maxConcurrentTrades,
    avgConcurrentTrades: round(concurrentCount === 0 ? 0 : concurrentSum / concurrentCount, 2),
    maxSamePairOverlap,
    worstOpenBookMtmPctPoints: round(worstOpenBookMtm, 4),
    worstWeekRealizedPctPoints: round(weeklyValues.length === 0 ? 0 : Math.min(...weeklyValues), 4),
    bestWeekRealizedPctPoints: round(weeklyValues.length === 0 ? 0 : Math.max(...weeklyValues), 4),
  };
}

async function main() {
  const pairUniverse = buildPairUniverse();
  const targetWeeks = await getTargetWeeks();
  const weeklyMatrixMap = await loadWeeklyMatrixMap(targetWeeks, pairUniverse);
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
      indicatorsByPair.set(key, buildIndicatorPack(candles));
    } catch (error) {
      missingPairs.push(`${key} (${error instanceof Error ? error.message : String(error)})`);
    }
  });

  const entries: EntryTrade[] = [];
  for (const weekOpenUtc of targetWeeks) {
    const weekMap = weeklyMatrixMap.get(weekOpenUtc);
    if (!weekMap) continue;
    const weekEnd = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ weeks: 1 });
    const sessionWindows = buildSessionWindowsForWeek(weekOpenUtc);

    for (const pairInfo of pairUniverse) {
      const weekly = weekMap.get(pairInfo.pair);
      if (!weekly || weekly.weeklyDirection === "NEUTRAL") continue;

      const key = pairKey(pairInfo.assetClass, pairInfo.pair);
      const candles = rawM5ByPair.get(key);
      const indicators = indicatorsByPair.get(key);
      if (!candles || !indicators) continue;

      const eligibleSessions = new Set(SESSION_ELIGIBILITY.get(pairInfo.pair) ?? ["LONDON"]);
      for (const sessionWindow of sessionWindows) {
        if (!eligibleSessions.has(sessionWindow.session)) continue;
        const found = findTriggerEntry(
          weekly.weeklyDirection,
          candles,
          indicators,
          sessionWindow.sessionStart.toMillis(),
          sessionWindow.sessionEnd.toMillis(),
        );
        if (!found) continue;

        const handshake = computeHandshakeDetail(pairInfo, weekly.weeklyDirection, weekMap, fxBuckets);
        if (!handshake.passed) continue;

        const stop3dPrice = computeThreeDayStopPrice(weekly.weeklyDirection, candles, found.index);
        const stop3dDistancePct =
          weekly.weeklyDirection === "LONG"
            ? ((found.entryPrice - stop3dPrice) / found.entryPrice) * 100
            : ((stop3dPrice - found.entryPrice) / found.entryPrice) * 100;

        entries.push({
          entryId: `${pairInfo.pair}|${weekOpenUtc}|${sessionWindow.session}|${found.entryTs}`,
          pairKey: key,
          weekOpenUtc,
          weekLabel: weekLabelFromOpen(weekOpenUtc),
          pair: pairInfo.pair,
          assetClass: pairInfo.assetClass,
          session: sessionWindow.session,
          sessionDateUtc: sessionWindow.sessionStart.toISODate() ?? weekLabelFromOpen(weekOpenUtc),
          weeklyDirection: weekly.weeklyDirection,
          weeklyTier: weekly.weeklyTier === "NEUTRAL" ? "MEDIUM" : weekly.weeklyTier,
          entryTs: found.entryTs,
          entryIndex: found.index,
          entryTimeUtc: DateTime.fromMillis(found.entryTs, { zone: "utc" }).toISO() ?? "",
          entryPrice: round(found.entryPrice),
          ma200: round(found.ma200),
          bollingerMid: round(found.bollingerMid),
          bollingerUpper: round(found.bollingerUpper),
          bollingerLower: round(found.bollingerLower),
          sessionEndTs: sessionWindow.sessionEnd.toMillis(),
          weekEndTs: weekEnd.toMillis(),
          stop3dPrice: round(stop3dPrice),
          stop3dDistancePct: round(Math.max(stop3dDistancePct, 0), 4),
          handshake,
        });
      }
    }
  }

  console.log(JSON.stringify({ lockedEntryBaselineTrades: entries.length }, null, 2));

  const policyOutputs = EXIT_POLICIES.map((policy) => {
    console.log(`Running exit policy ${policy.id} ...`);
    const executed = entries.map((entry) => simulateExit(policy.id, entry, rawM5ByPair.get(entry.pairKey)!, indicatorsByPair.get(entry.pairKey)!));
    return {
      policyId: policy.id,
      label: policy.label,
      overall: summarizeExecutedTrades(executed),
      bookSummary: simulateBook(executed, rawM5ByPair),
      byAssetClass: aggregateExecutedBy(executed, (trade) => trade.assetClass).map((row) => ({ assetClass: row.key as AssetClass, ...row })),
      bySession: aggregateExecutedBy(executed, (trade) => trade.session).map((row) => ({ session: row.key as SessionName, ...row })),
      byDirection: aggregateExecutedBy(executed, (trade) => trade.weeklyDirection).map((row) => ({ direction: row.key as Exclude<Direction, "NEUTRAL">, ...row })),
      byExitReason: Array.from(executed.reduce((map, trade) => map.set(trade.exitReason, (map.get(trade.exitReason) ?? 0) + 1), new Map<ExitReason, number>()).entries()).map(([exitReason, count]) => ({ exitReason, count })),
      weeklyNetPnl: Array.from(executed.reduce((map, trade) => map.set(trade.weekLabel, round((map.get(trade.weekLabel) ?? 0) + trade.returnPct, 4)), new Map<string, number>()).entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([weekLabel, netPnlPctPoints]) => ({ weekLabel, netPnlPctPoints })),
      sampleTrades: executed.slice(0, 40),
    };
  });

  const ranking = [...policyOutputs]
    .sort((a, b) => {
      if (b.bookSummary.drawdownAdjustedBookScore !== a.bookSummary.drawdownAdjustedBookScore) return b.bookSummary.drawdownAdjustedBookScore - a.bookSummary.drawdownAdjustedBookScore;
      if (b.overall.winRatePct !== a.overall.winRatePct) return b.overall.winRatePct - a.overall.winRatePct;
      return b.overall.avgReturnPct - a.overall.avgReturnPct;
    })
    .map((row, index) => ({ rank: index + 1, policyId: row.policyId, ...row.overall, ...row.bookSummary }));

  const report = {
    generatedUtc: new Date().toISOString(),
    config: {
      weeks: targetWeeks,
      pairCount: pairUniverse.length,
      warmupDays: WARMUP_DAYS,
      fetchConcurrency: FETCH_CONCURRENCY,
      entry: {
        maLength: MA_LENGTH,
        bbLength: BB_LENGTH,
        bbStdDev: BB_STD_DEV,
        weeklyHandshakeThresholdPct: WEEKLY_HANDSHAKE_THRESHOLD,
        tradeFrequency: "first trade per pair per eligible session",
        bias: "weekly dealer + commercial + sentiment majority",
      },
      bookAssumption: "normalized 1-unit-per-trade book; realized and MTM equity are summed trade-return percentage points, not sized account dollars",
      exitPolicies: EXIT_POLICIES,
      sessionsUtc: SESSION_WINDOWS_UTC,
    },
    lockedEntrySummary: {
      trades: entries.length,
      avgWeeklyHandshakePct: round(safeAverage(entries.map((entry) => entry.handshake.agreementPct).filter((value): value is number => value !== null)), 2),
      avgStop3dDistancePct: round(safeAverage(entries.map((entry) => entry.stop3dDistancePct)), 4),
      byAssetClass: Array.from(entries.reduce((map, entry) => map.set(entry.assetClass, (map.get(entry.assetClass) ?? 0) + 1), new Map<AssetClass, number>()).entries()).map(([assetClass, trades]) => ({ assetClass, trades })),
    },
    ranking,
    policies: policyOutputs,
    missingPairs,
    notes: [
      "Entry is locked to weekly_60__bb2_0 logic from the handshake sweep.",
      "Overlapping positions are allowed naturally across sessions and pairs in the portfolio simulation.",
      "Same-pair overlap is allowed in this first pass because entries are session-based and exits can extend beyond a session.",
      "Opposite-band exits assume fill at the band price when touched intrabar.",
      "Stop + target policies assume the stop fills first if both stop and target are touched in the same candle.",
    ],
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const reportPath = path.join(REPORTS_DIR, `cfd-portfolio-exit-research-${timestamp}.json`);
  const latestPath = path.join(REPORTS_DIR, "cfd-portfolio-exit-research-latest.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(latestPath, JSON.stringify(report, null, 2), "utf8");

  console.log("CFD portfolio exit research complete.");
  console.log(JSON.stringify({ ranking, reportPath, latestPath, missingPairs: missingPairs.length }, null, 2));
}

main().catch((error) => {
  console.error("backtest-cfd-portfolio-exit-research failed:", error);
  process.exitCode = 1;
});
