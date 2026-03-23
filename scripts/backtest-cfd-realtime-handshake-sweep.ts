/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-cfd-realtime-handshake-sweep.ts
 *
 * Description:
 * Tests real-time basket confirmation on top of the validated
 * weekly 60% handshake + 5m CFD MA+BB directional-close trigger.
 *
 * Reduced first pass:
 * - weekly_60_only control
 * - engulfing handshake, 6-candle lookback
 * - RRanjan handshake, 6-candle lookback
 * - either-or handshake, 6-candle lookback
 * - thresholds 30 / 40 / 50
 *
 * Run:
 *   npx tsx scripts/backtest-cfd-realtime-handshake-sweep.ts
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
type RealtimeSignalMode = "NONE" | "ENGULF" | "RRANJAN" | "EITHER";

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
};

type TriggerConfig = {
  id: string;
  bbStdDev: number;
  weeklyThresholdPct: number;
  realtimeThresholdPct: number | null;
  realtimeSignalMode: RealtimeSignalMode;
  lookbackCandles: number | null;
};

type SignalContributionStats = {
  engulfOnly: number;
  rranjanOnly: number;
  both: number;
};

type HandshakeDetail = {
  bucketType: "FX" | "INDICES" | "CRYPTO" | "NONE";
  weakCurrency: string | null;
  strongCurrency: string | null;
  weeklyWeakAgreementPct: number | null;
  weeklyStrongAgreementPct: number | null;
  weeklyAgreementPct: number | null;
  realtimeWeakAgreementPct: number | null;
  realtimeStrongAgreementPct: number | null;
  realtimeAgreementPct: number | null;
  realtimeSignalMode: RealtimeSignalMode;
  lookbackCandles: number | null;
  contributionStats: SignalContributionStats;
  passed: boolean;
};

type TriggerTrade = {
  variantId: string;
  bbStdDev: number;
  weeklyThresholdPct: number;
  realtimeThresholdPct: number | null;
  realtimeSignalMode: RealtimeSignalMode;
  lookbackCandles: number | null;
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  assetClass: AssetClass;
  session: SessionName;
  sessionDateUtc: string;
  weeklyDirection: Exclude<Direction, "NEUTRAL">;
  weeklyTier: "HIGH" | "MEDIUM";
  entryTimeUtc: string;
  entryPrice: number;
  ma200: number;
  bollingerMid: number;
  bollingerUpper: number;
  bollingerLower: number;
  handshake: HandshakeDetail;
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

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

const CACHE_DIR = path.join(process.cwd(), ".cache", "cfd-ma-bb-trigger");
const REPORTS_DIR = path.join(process.cwd(), "reports");
const TARGET_WEEKS_COUNT = Number(process.env.CFD_MA_BB_BACKTEST_WEEKS ?? "8");
const WARMUP_DAYS = Number(process.env.CFD_MA_BB_WARMUP_DAYS ?? "14");
const FETCH_CONCURRENCY = Number(process.env.CFD_MA_BB_FETCH_CONCURRENCY ?? "4");
const MA_LENGTH = Number(process.env.CFD_MA_BB_MA_LENGTH ?? "200");
const BB_LENGTH = Number(process.env.CFD_MA_BB_BB_LENGTH ?? "20");
const STOCHASTIC_K_LENGTH = 21;
const STOCHASTIC_K_SMOOTHING = 3;
const STOCHASTIC_D_SMOOTHING = 13;
const OVERSOLD_LEVEL = 20;
const OVERBOUGHT_LEVEL = 80;
const MIN_TRADES_WARNING_THRESHOLD = 150;
const PAIR_FILTER = new Set(
  (process.env.CFD_MA_BB_PAIR_FILTER ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

const TRIGGER_CONFIGS: TriggerConfig[] = [
  { id: "weekly_60_only", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: null, realtimeSignalMode: "NONE", lookbackCandles: null },
  { id: "w60_engulf6_30pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 30, realtimeSignalMode: "ENGULF", lookbackCandles: 6 },
  { id: "w60_engulf6_40pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 40, realtimeSignalMode: "ENGULF", lookbackCandles: 6 },
  { id: "w60_engulf6_50pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 50, realtimeSignalMode: "ENGULF", lookbackCandles: 6 },
  { id: "w60_rranjan6_30pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 30, realtimeSignalMode: "RRANJAN", lookbackCandles: 6 },
  { id: "w60_rranjan6_40pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 40, realtimeSignalMode: "RRANJAN", lookbackCandles: 6 },
  { id: "w60_rranjan6_50pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 50, realtimeSignalMode: "RRANJAN", lookbackCandles: 6 },
  { id: "w60_either6_30pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 30, realtimeSignalMode: "EITHER", lookbackCandles: 6 },
  { id: "w60_either6_40pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 40, realtimeSignalMode: "EITHER", lookbackCandles: 6 },
  { id: "w60_either6_50pct", bbStdDev: 2.0, weeklyThresholdPct: 60, realtimeThresholdPct: 50, realtimeSignalMode: "EITHER", lookbackCandles: 6 },
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
  return path.join(
    CACHE_DIR,
    `${safeSymbol}__${fromUtc.replace(/[:.]/g, "-")}__${toUtc.replace(/[:.]/g, "-")}.json`,
  );
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
    if (i >= length - 1 && count === length) out[i] = sum / length;
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

function buildIndicatorPack(candles: OhlcCandle[], bbStdDev: number): IndicatorPack {
  const closes = candles.map((candle) => candle.close);
  const sma200 = computeSma(closes, MA_LENGTH);
  const bbMid = computeSma(closes, BB_LENGTH);
  const bbStd = computeStdDev(closes, BB_LENGTH, bbMid);
  const bbUpper = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid + bbStdDev * (bbStd[index] ?? 0)));
  const bbLower = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid - bbStdDev * (bbStd[index] ?? 0)));
  return { sma200, bbMid, bbUpper, bbLower };
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

  const returnPct = direction === "LONG" ? ((exitPrice - entryPrice) / entryPrice) * 100 : ((entryPrice - exitPrice) / entryPrice) * 100;
  return {
    exitPrice: round(exitPrice),
    returnPct: round(returnPct, 4),
    maePct: round(Math.max(maePct, 0), 4),
    mfePct: round(Math.max(mfePct, 0), 4),
  };
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
    const closeTs = candle.ts + 5 * 60 * 1000;
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

function computeWeeklyBucketAgreementPct(
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

function getPairDirectionForCurrencyState(
  pair: PairInfo,
  sharedCurrency: string,
  desiredState: Exclude<CurrencyState, "NEUTRAL">,
): Exclude<Direction, "NEUTRAL"> | null {
  if (pair.base === sharedCurrency) return desiredState === "STRONG" ? "LONG" : "SHORT";
  if (pair.quote === sharedCurrency) return desiredState === "STRONG" ? "SHORT" : "LONG";
  return null;
}

function isEngulfing(
  direction: Exclude<Direction, "NEUTRAL">,
  previous: OhlcCandle | undefined,
  current: OhlcCandle | undefined,
) {
  if (!previous || !current) return false;
  return direction === "LONG" ? current.close > previous.high : current.close < previous.low;
}

function findLastClosedIndexAtOrBefore(candles: OhlcCandle[], entryTs: number) {
  let lastIndex = -1;
  for (let i = 0; i < candles.length; i += 1) {
    const closeTs = candles[i].ts + 5 * 60 * 1000;
    if (closeTs <= entryTs) lastIndex = i;
    else break;
  }
  return lastIndex;
}

function hasEngulfingWithinLookback(
  direction: Exclude<Direction, "NEUTRAL">,
  candles: OhlcCandle[],
  lastClosedIndex: number,
  lookbackCandles: number,
) {
  if (lastClosedIndex < 1) return false;
  const start = Math.max(1, lastClosedIndex - lookbackCandles + 1);
  for (let i = start; i <= lastClosedIndex; i += 1) {
    if (isEngulfing(direction, candles[i - 1], candles[i])) return true;
  }
  return false;
}

function hasRranjanWithinLookback(
  direction: Exclude<Direction, "NEUTRAL">,
  signal: Array<number | null>,
  lastClosedIndex: number,
  lookbackCandles: number,
) {
  if (lastClosedIndex < 0) return false;
  const start = Math.max(0, lastClosedIndex - lookbackCandles + 1);
  for (let i = start; i <= lastClosedIndex; i += 1) {
    const value = signal[i];
    if (value === null) continue;
    if (direction === "LONG" && value < OVERSOLD_LEVEL) return true;
    if (direction === "SHORT" && value > OVERBOUGHT_LEVEL) return true;
  }
  return false;
}

function evaluateRealtimePairConfirmation(
  mode: RealtimeSignalMode,
  pairDirection: Exclude<Direction, "NEUTRAL">,
  candles: OhlcCandle[],
  rranjanSignal: Array<number | null>,
  entryTs: number,
  lookbackCandles: number,
) {
  const lastClosedIndex = findLastClosedIndexAtOrBefore(candles, entryTs);
  if (lastClosedIndex < 0) return { agreed: false, viaEngulfing: false, viaRranjan: false };

  const viaEngulfing = hasEngulfingWithinLookback(pairDirection, candles, lastClosedIndex, lookbackCandles);
  const viaRranjan = hasRranjanWithinLookback(pairDirection, rranjanSignal, lastClosedIndex, lookbackCandles);

  if (mode === "ENGULF") return { agreed: viaEngulfing, viaEngulfing, viaRranjan: false };
  if (mode === "RRANJAN") return { agreed: viaRranjan, viaEngulfing: false, viaRranjan };
  if (mode === "EITHER") return { agreed: viaEngulfing || viaRranjan, viaEngulfing, viaRranjan };
  return { agreed: true, viaEngulfing: false, viaRranjan: false };
}

function mergeContributionStats(left: SignalContributionStats, right: SignalContributionStats): SignalContributionStats {
  return {
    engulfOnly: left.engulfOnly + right.engulfOnly,
    rranjanOnly: left.rranjanOnly + right.rranjanOnly,
    both: left.both + right.both,
  };
}

function computeRealtimeBucketAgreementPct(
  sharedCurrency: string,
  desiredState: Exclude<CurrencyState, "NEUTRAL">,
  bucketPairs: readonly PairInfo[],
  currentPair: PairInfo,
  entryTs: number,
  rawM5ByPair: Map<string, OhlcCandle[]>,
  rranjanByPair: Map<string, Array<number | null>>,
  mode: RealtimeSignalMode,
  lookbackCandles: number,
) {
  let eligible = 0;
  let agreeing = 0;
  const contributionStats: SignalContributionStats = { engulfOnly: 0, rranjanOnly: 0, both: 0 };
  for (const pairInfo of bucketPairs) {
    if (pairInfo.pair === currentPair.pair) continue;
    const pairDirection = getPairDirectionForCurrencyState(pairInfo, sharedCurrency, desiredState);
    if (!pairDirection) continue;
    const key = pairKey(pairInfo.assetClass, pairInfo.pair);
    const candles = rawM5ByPair.get(key);
    const rranjanSignal = rranjanByPair.get(key);
    if (!candles || !rranjanSignal) continue;

    eligible += 1;
    const signal = evaluateRealtimePairConfirmation(mode, pairDirection, candles, rranjanSignal, entryTs, lookbackCandles);
    if (!signal.agreed) continue;

    agreeing += 1;
    if (signal.viaEngulfing && signal.viaRranjan) contributionStats.both += 1;
    else if (signal.viaEngulfing) contributionStats.engulfOnly += 1;
    else if (signal.viaRranjan) contributionStats.rranjanOnly += 1;
  }
  return {
    agreementPct: eligible === 0 ? null : round((agreeing / eligible) * 100, 2),
    contributionStats,
  };
}

function computeHandshakeDetail(
  config: TriggerConfig,
  pairInfo: PairInfo,
  direction: Exclude<Direction, "NEUTRAL">,
  weekMap: Map<string, WeeklyMatrixRow>,
  fxBuckets: Map<string, PairInfo[]>,
  entryTs: number,
  rawM5ByPair: Map<string, OhlcCandle[]>,
  rranjanByPair: Map<string, Array<number | null>>,
) {
  if (pairInfo.assetClass === "indices" || pairInfo.assetClass === "crypto") {
    const bucketPairs =
      pairInfo.assetClass === "indices"
        ? (PAIRS_BY_ASSET_CLASS.indices ?? []).map((row) => ({ ...row, assetClass: "indices" as const }))
        : (PAIRS_BY_ASSET_CLASS.crypto ?? []).map((row) => ({ ...row, assetClass: "crypto" as const }));
    const weeklyPass = bucketPairs.every((row) => weekMap.get(row.pair)?.weeklyDirection === direction);
    let realtimePass = true;
    let contributionStats: SignalContributionStats = { engulfOnly: 0, rranjanOnly: 0, both: 0 };

    if (config.realtimeSignalMode !== "NONE" && config.lookbackCandles !== null) {
      for (const row of bucketPairs) {
        const key = pairKey(row.assetClass, row.pair);
        const candles = rawM5ByPair.get(key);
        const rranjanSignal = rranjanByPair.get(key);
        if (!candles || !rranjanSignal) {
          realtimePass = false;
          continue;
        }
        const signal = evaluateRealtimePairConfirmation(
          config.realtimeSignalMode,
          direction,
          candles,
          rranjanSignal,
          entryTs,
          config.lookbackCandles,
        );
        if (!signal.agreed) realtimePass = false;
        if (signal.agreed) {
          if (signal.viaEngulfing && signal.viaRranjan) contributionStats.both += 1;
          else if (signal.viaEngulfing) contributionStats.engulfOnly += 1;
          else if (signal.viaRranjan) contributionStats.rranjanOnly += 1;
        }
      }
    }

    return {
      bucketType: pairInfo.assetClass === "indices" ? ("INDICES" as const) : ("CRYPTO" as const),
      weakCurrency: null,
      strongCurrency: null,
      weeklyWeakAgreementPct: null,
      weeklyStrongAgreementPct: null,
      weeklyAgreementPct: weeklyPass ? 100 : 0,
      realtimeWeakAgreementPct: null,
      realtimeStrongAgreementPct: null,
      realtimeAgreementPct: config.realtimeSignalMode === "NONE" ? null : realtimePass ? 100 : 0,
      realtimeSignalMode: config.realtimeSignalMode,
      lookbackCandles: config.lookbackCandles,
      contributionStats,
      passed: config.realtimeSignalMode === "NONE" ? weeklyPass : weeklyPass && realtimePass,
    };
  }

  if (pairInfo.assetClass !== "fx") {
    return {
      bucketType: "NONE" as const,
      weakCurrency: null,
      strongCurrency: null,
      weeklyWeakAgreementPct: null,
      weeklyStrongAgreementPct: null,
      weeklyAgreementPct: null,
      realtimeWeakAgreementPct: null,
      realtimeStrongAgreementPct: null,
      realtimeAgreementPct: null,
      realtimeSignalMode: config.realtimeSignalMode,
      lookbackCandles: config.lookbackCandles,
      contributionStats: { engulfOnly: 0, rranjanOnly: 0, both: 0 },
      passed: true,
    };
  }

  const strongCurrency = direction === "LONG" ? pairInfo.base : pairInfo.quote;
  const weakCurrency = direction === "LONG" ? pairInfo.quote : pairInfo.base;
  const strongBucket = fxBuckets.get(strongCurrency) ?? [];
  const weakBucket = fxBuckets.get(weakCurrency) ?? [];

  const weeklyStrongAgreementPct = computeWeeklyBucketAgreementPct(strongCurrency, "STRONG", strongBucket, pairInfo, weekMap);
  const weeklyWeakAgreementPct = computeWeeklyBucketAgreementPct(weakCurrency, "WEAK", weakBucket, pairInfo, weekMap);
  const weeklyAvailable = [weeklyStrongAgreementPct, weeklyWeakAgreementPct].filter((v): v is number => v !== null);
  const weeklyAgreementPct = weeklyAvailable.length === 0 ? 0 : round(safeAverage(weeklyAvailable), 2);

  let realtimeStrongAgreementPct: number | null = null;
  let realtimeWeakAgreementPct: number | null = null;
  let realtimeAgreementPct: number | null = null;
  let contributionStats: SignalContributionStats = { engulfOnly: 0, rranjanOnly: 0, both: 0 };

  if (config.realtimeSignalMode !== "NONE" && config.lookbackCandles !== null) {
    const strongRealtime = computeRealtimeBucketAgreementPct(
      strongCurrency,
      "STRONG",
      strongBucket,
      pairInfo,
      entryTs,
      rawM5ByPair,
      rranjanByPair,
      config.realtimeSignalMode,
      config.lookbackCandles,
    );
    const weakRealtime = computeRealtimeBucketAgreementPct(
      weakCurrency,
      "WEAK",
      weakBucket,
      pairInfo,
      entryTs,
      rawM5ByPair,
      rranjanByPair,
      config.realtimeSignalMode,
      config.lookbackCandles,
    );
    realtimeStrongAgreementPct = strongRealtime.agreementPct;
    realtimeWeakAgreementPct = weakRealtime.agreementPct;
    const realtimeAvailable = [realtimeStrongAgreementPct, realtimeWeakAgreementPct].filter(
      (v): v is number => v !== null,
    );
    realtimeAgreementPct = realtimeAvailable.length === 0 ? 0 : round(safeAverage(realtimeAvailable), 2);
    contributionStats = mergeContributionStats(strongRealtime.contributionStats, weakRealtime.contributionStats);
  }

  return {
    bucketType: "FX" as const,
    weakCurrency,
    strongCurrency,
    weeklyWeakAgreementPct,
    weeklyStrongAgreementPct,
    weeklyAgreementPct,
    realtimeWeakAgreementPct,
    realtimeStrongAgreementPct,
    realtimeAgreementPct,
    realtimeSignalMode: config.realtimeSignalMode,
    lookbackCandles: config.lookbackCandles,
    contributionStats,
    passed:
      weeklyAgreementPct >= config.weeklyThresholdPct &&
      (config.realtimeSignalMode === "NONE" || (realtimeAgreementPct ?? 0) >= (config.realtimeThresholdPct ?? 0)),
  };
}

function histogram(values: number[]) {
  return {
    "0_30": values.filter((value) => value < 30).length,
    "30_40": values.filter((value) => value >= 30 && value < 40).length,
    "40_50": values.filter((value) => value >= 40 && value < 50).length,
    "50_60": values.filter((value) => value >= 50 && value < 60).length,
    "60_75": values.filter((value) => value >= 60 && value < 75).length,
    "75_100": values.filter((value) => value >= 75).length,
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
  const rranjanByPair = new Map<string, Array<number | null>>();
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
      rranjanByPair.set(key, computeSlowStochasticD(candles));
    } catch (error) {
      missingPairs.push(`${key} (${error instanceof Error ? error.message : String(error)})`);
    }
  });

  const variantOutputs: Array<Record<string, unknown>> = [];

  for (const config of TRIGGER_CONFIGS) {
    const trades: TriggerTrade[] = [];
    console.log(`Running variant ${config.id} ...`);

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

          const handshake = computeHandshakeDetail(
            config,
            pairInfo,
            weekly.weeklyDirection,
            weekMap,
            fxBuckets,
            found.entryTs,
            rawM5ByPair,
            rranjanByPair,
          );
          if (!handshake.passed) continue;

          const sessionMetrics = computeTradeMetrics(
            weekly.weeklyDirection,
            candles,
            found.entryTs,
            found.entryPrice,
            sessionWindow.sessionEnd.toMillis(),
          );
          const weekMetrics = computeTradeMetrics(
            weekly.weeklyDirection,
            candles,
            found.entryTs,
            found.entryPrice,
            weekEnd.toMillis(),
          );

          trades.push({
            variantId: config.id,
            bbStdDev: config.bbStdDev,
            weeklyThresholdPct: config.weeklyThresholdPct,
            realtimeThresholdPct: config.realtimeThresholdPct,
            realtimeSignalMode: config.realtimeSignalMode,
            lookbackCandles: config.lookbackCandles,
            weekOpenUtc,
            weekLabel: weekLabelFromOpen(weekOpenUtc),
            pair: pairInfo.pair,
            assetClass: pairInfo.assetClass,
            session: sessionWindow.session,
            sessionDateUtc: sessionWindow.sessionStart.toISODate() ?? weekLabelFromOpen(weekOpenUtc),
            weeklyDirection: weekly.weeklyDirection,
            weeklyTier: weekly.weeklyTier === "NEUTRAL" ? "MEDIUM" : weekly.weeklyTier,
            entryTimeUtc: DateTime.fromMillis(found.entryTs, { zone: "utc" }).toISO() ?? "",
            entryPrice: round(found.entryPrice),
            ma200: round(found.ma200),
            bollingerMid: round(found.bollingerMid),
            bollingerUpper: round(found.bollingerUpper),
            bollingerLower: round(found.bollingerLower),
            handshake,
            sessionMetrics,
            weekMetrics,
          });
        }
      }
    }

    const overall = summarizeTrades(trades);
    const realtimeAgreementValues = trades
      .map((trade) => trade.handshake.realtimeAgreementPct)
      .filter((value): value is number => value !== null);
    const contributionTotals = trades.reduce(
      (acc, trade) => mergeContributionStats(acc, trade.handshake.contributionStats),
      { engulfOnly: 0, rranjanOnly: 0, both: 0 },
    );

    variantOutputs.push({
      variantId: config.id,
      bbStdDev: config.bbStdDev,
      weeklyThresholdPct: config.weeklyThresholdPct,
      realtimeThresholdPct: config.realtimeThresholdPct,
      realtimeSignalMode: config.realtimeSignalMode,
      lookbackCandles: config.lookbackCandles,
      lowSampleWarning: overall.trades < MIN_TRADES_WARNING_THRESHOLD,
      overall,
      overallFxCryptoOnly: summarizeTrades(
        trades.filter((trade) => trade.assetClass === "fx" || trade.assetClass === "crypto"),
      ),
      byAssetClass: aggregateBy(trades, (trade) => trade.assetClass)
        .sort((a, b) => b.trades - a.trades)
        .map((row) => ({ assetClass: row.key as AssetClass, ...row })),
      bySession: aggregateBy(trades, (trade) => trade.session)
        .sort((a, b) => String(a.key).localeCompare(String(b.key)))
        .map((row) => ({ session: row.key as SessionName, ...row })),
      byDirection: aggregateBy(trades, (trade) => trade.weeklyDirection)
        .sort((a, b) => String(a.key).localeCompare(String(b.key)))
        .map((row) => ({ direction: row.key as Exclude<Direction, "NEUTRAL">, ...row })),
      byPair: aggregateBy(trades, (trade) => trade.pair)
        .sort((a, b) => {
          if (b.trades !== a.trades) return b.trades - a.trades;
          return String(a.key).localeCompare(String(b.key));
        })
        .slice(0, 12)
        .map((row) => ({ pair: row.key, ...row })),
      realtimeHandshakeStats: {
        averageAgreementPct: round(safeAverage(realtimeAgreementValues), 2),
        medianAgreementPct: round(median(realtimeAgreementValues), 2),
        distribution: histogram(realtimeAgreementValues),
      },
      signalTypeBreakdown:
        config.realtimeSignalMode === "EITHER"
          ? {
              engulfOnly: contributionTotals.engulfOnly,
              rranjanOnly: contributionTotals.rranjanOnly,
              both: contributionTotals.both,
            }
          : null,
      sampleTrades: trades.slice(0, 50),
    });

    console.log(JSON.stringify({ variantId: config.id, trades: trades.length }, null, 2));
  }

  const ranking = [...variantOutputs]
    .sort((a, b) => {
      const ao = a.overall as SummaryRow;
      const bo = b.overall as SummaryRow;
      if (bo.drawdownAdjustedWeekScore !== ao.drawdownAdjustedWeekScore) return bo.drawdownAdjustedWeekScore - ao.drawdownAdjustedWeekScore;
      if (bo.winRateSessionClosePct !== ao.winRateSessionClosePct) return bo.winRateSessionClosePct - ao.winRateSessionClosePct;
      return bo.avgWeekReturnPct - ao.avgWeekReturnPct;
    })
    .map((row, index) => ({
      rank: index + 1,
      variantId: row.variantId,
      bbStdDev: row.bbStdDev,
      weeklyThresholdPct: row.weeklyThresholdPct,
      realtimeThresholdPct: row.realtimeThresholdPct,
      realtimeSignalMode: row.realtimeSignalMode,
      lookbackCandles: row.lookbackCandles,
      lowSampleWarning: row.lowSampleWarning,
      ...(row.overall as SummaryRow),
    }));

  const weeklyControlTrades =
    ((variantOutputs.find((row) => row.variantId === "weekly_60_only")?.overall as SummaryRow | undefined)
      ?.trades ?? 0);

  const highWinLowMaeRanking = [...variantOutputs]
    .map((row) => {
      const overall = row.overall as SummaryRow;
      return {
        variantId: row.variantId,
        realtimeSignalMode: row.realtimeSignalMode,
        realtimeThresholdPct: row.realtimeThresholdPct,
        lowSampleWarning: row.lowSampleWarning,
        highWinLowMaeScore:
          overall.avgSessionMaePct === 0 ? 0 : round(overall.winRateSessionClosePct / overall.avgSessionMaePct, 4),
        ...overall,
      };
    })
    .sort((a, b) => {
      if (b.highWinLowMaeScore !== a.highWinLowMaeScore) return b.highWinLowMaeScore - a.highWinLowMaeScore;
      if (b.winRateSessionClosePct !== a.winRateSessionClosePct) return b.winRateSessionClosePct - a.winRateSessionClosePct;
      return a.avgSessionMaePct - b.avgSessionMaePct;
    })
    .map((row, index) => ({ rank: index + 1, ...row }));

  const realtimeHandshakeStats = variantOutputs.map((row) => ({
    variantId: row.variantId,
    realtimeSignalMode: row.realtimeSignalMode,
    realtimeThresholdPct: row.realtimeThresholdPct,
    tradeCount: (row.overall as SummaryRow).trades,
    averageAgreementPct: (row.realtimeHandshakeStats as { averageAgreementPct: number }).averageAgreementPct,
    medianAgreementPct: (row.realtimeHandshakeStats as { medianAgreementPct: number }).medianAgreementPct,
    surviveVsWeekly60Pct:
      weeklyControlTrades === 0 ? 0 : round((((row.overall as SummaryRow).trades ?? 0) / weeklyControlTrades) * 100, 2),
    distribution: (row.realtimeHandshakeStats as { distribution: ReturnType<typeof histogram> }).distribution,
    lowSampleWarning: row.lowSampleWarning,
  }));

  const signalTypeBreakdown = variantOutputs
    .filter((row) => row.realtimeSignalMode === "EITHER")
    .map((row) => ({
      variantId: row.variantId,
      ...(row.signalTypeBreakdown as { engulfOnly: number; rranjanOnly: number; both: number }),
    }));

  const tradeCountImpact = variantOutputs.map((row) => {
    const currentTrades = (row.overall as SummaryRow).trades;
    return {
      variantId: row.variantId,
      currentTrades,
      weekly60ControlTrades: weeklyControlTrades,
      filteredOutVsWeekly60: Math.max(0, weeklyControlTrades - currentTrades),
      surviveVsWeekly60Pct:
        weeklyControlTrades === 0 ? 0 : round((currentTrades / weeklyControlTrades) * 100, 2),
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
      variants: TRIGGER_CONFIGS,
      tradeFrequency: "first trade per pair per eligible session",
      exits: "passive session close and passive week close marks only",
      bias: "weekly dealer + commercial + sentiment majority",
      realtimeSignalDefinition:
        "engulfing and RRanjan checks only use candles fully closed by the trigger candle close; FX bucket agreement excludes the current pair and averages strong/weak side agreement percentages",
      sessionsUtc: SESSION_WINDOWS_UTC,
    },
    ranking,
    highWinLowMaeRanking,
    variants: variantOutputs,
    realtimeHandshakeStats,
    signalTypeBreakdown,
    tradeCountImpact,
    missingPairs,
    notes: [
      "All variants use the validated weekly 60% handshake as the first gate.",
      "This reduced first pass only tests BB 2.0, 6-candle real-time lookback, and three signal families: engulfing, RRanjan, and either-or.",
      "FX handshake uses average bucket agreement across the strong-currency and weak-currency buckets with the current pair excluded.",
      "Engulfing and RRanjan checks only use candles fully closed by the trigger candle close.",
      "Indices and crypto use fixed all-members-must-agree checks for weekly and real-time confirmation.",
      "Commodities are included in the run but do not use a dedicated handshake bucket in this pass.",
      `Variants with fewer than ${MIN_TRADES_WARNING_THRESHOLD} trades are flagged as low-sample.`,
    ],
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const reportPath = path.join(REPORTS_DIR, `cfd-realtime-handshake-sweep-${timestamp}.json`);
  const latestPath = path.join(REPORTS_DIR, "cfd-realtime-handshake-sweep-latest.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(latestPath, JSON.stringify(report, null, 2), "utf8");

  console.log("CFD realtime handshake sweep complete.");
  console.log(JSON.stringify({ ranking, reportPath, latestPath, missingPairs: missingPairs.length }, null, 2));
}

main().catch((error) => {
  console.error("backtest-cfd-realtime-handshake-sweep failed:", error);
  process.exitCode = 1;
});
