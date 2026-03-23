/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-cfd-handshake-sweep.ts
 *
 * Description:
 * Tests a handshake basket-confirmation gate on top of the
 * 5m CFD MA+BB directional-close trigger.
 *
 * Run:
 *   npx tsx scripts/backtest-cfd-handshake-sweep.ts
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
  handshakeThresholdPct: number | null;
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

type TriggerTrade = {
  variantId: string;
  bbStdDev: number;
  handshakeThresholdPct: number | null;
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
const PAIR_FILTER = new Set(
  (process.env.CFD_MA_BB_PAIR_FILTER ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

const TRIGGER_CONFIGS: TriggerConfig[] = [
  { id: "handshake_40pct__bb2_0", bbStdDev: 2.0, handshakeThresholdPct: 40 },
  { id: "handshake_50pct__bb2_0", bbStdDev: 2.0, handshakeThresholdPct: 50 },
  { id: "handshake_60pct__bb2_0", bbStdDev: 2.0, handshakeThresholdPct: 60 },
  { id: "handshake_75pct__bb2_0", bbStdDev: 2.0, handshakeThresholdPct: 75 },
  { id: "handshake_40pct__bb2_5", bbStdDev: 2.5, handshakeThresholdPct: 40 },
  { id: "handshake_50pct__bb2_5", bbStdDev: 2.5, handshakeThresholdPct: 50 },
  { id: "handshake_60pct__bb2_5", bbStdDev: 2.5, handshakeThresholdPct: 60 },
  { id: "handshake_75pct__bb2_5", bbStdDev: 2.5, handshakeThresholdPct: 75 },
  { id: "no_handshake__bb2_0", bbStdDev: 2.0, handshakeThresholdPct: null },
  { id: "no_handshake__bb2_5", bbStdDev: 2.5, handshakeThresholdPct: null },
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

function buildIndicatorPack(candles: OhlcCandle[], bbStdDev: number): IndicatorPack {
  const closes = candles.map((candle) => candle.close);
  const sma200 = computeSma(closes, MA_LENGTH);
  const bbMid = computeSma(closes, BB_LENGTH);
  const bbStd = computeStdDev(closes, BB_LENGTH, bbMid);
  const bbUpper = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid + bbStdDev * (bbStd[index] ?? 0)));
  const bbLower = bbMid.map((mid, index) => (mid === null || bbStd[index] === null ? null : mid - bbStdDev * (bbStd[index] ?? 0)));
  return { sma200, bbMid, bbUpper, bbLower };
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
  thresholdPct: number | null,
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
      passed: thresholdPct === null ? true : passed,
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
      passed: thresholdPct === null ? true : passed,
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
  const strongAgreementPct = computeBucketAgreementPct(
    strongCurrency,
    "STRONG",
    strongBucket,
    pairInfo,
    weekMap,
  );
  const weakAgreementPct = computeBucketAgreementPct(
    weakCurrency,
    "WEAK",
    weakBucket,
    pairInfo,
    weekMap,
  );

  const available = [strongAgreementPct, weakAgreementPct].filter((value): value is number => value !== null);
  const agreementPct = available.length === 0 ? 0 : round(safeAverage(available), 2);
  const passed = thresholdPct === null ? true : agreementPct >= thresholdPct;
  return {
    bucketType: "FX" as const,
    weakCurrency,
    strongCurrency,
    weakAgreementPct,
    strongAgreementPct,
    agreementPct,
    passed,
  };
}

function buildCurrencyFlowDirectionMap(
  targetWeeks: readonly string[],
  weekMaps: Map<string, Map<string, WeeklyMatrixRow>>,
  fxBuckets: Map<string, PairInfo[]>,
) {
  const out = new Map<string, Map<string, { state: CurrencyState; agreementPct: number }>>();
  for (const weekOpenUtc of targetWeeks) {
    const weekMap = weekMaps.get(weekOpenUtc);
    if (!weekMap) continue;
    const byCurrency = new Map<string, { state: CurrencyState; agreementPct: number }>();
    for (const [currency, bucketPairs] of fxBuckets.entries()) {
      let eligible = 0;
      let strongCount = 0;
      let weakCount = 0;
      for (const pairInfo of bucketPairs) {
        const weekly = weekMap.get(pairInfo.pair);
        if (!weekly || weekly.weeklyDirection === "NEUTRAL") continue;
        const inferred = inferCurrencyState(pairInfo, currency, weekly.weeklyDirection);
        if (inferred === "NEUTRAL") continue;
        eligible += 1;
        if (inferred === "STRONG") strongCount += 1;
        if (inferred === "WEAK") weakCount += 1;
      }
      if (eligible === 0) continue;
      const strongPct = (strongCount / eligible) * 100;
      const weakPct = (weakCount / eligible) * 100;
      if (strongPct >= weakPct) {
        byCurrency.set(currency, { state: "STRONG", agreementPct: round(strongPct, 2) });
      } else {
        byCurrency.set(currency, { state: "WEAK", agreementPct: round(weakPct, 2) });
      }
    }
    out.set(weekOpenUtc, byCurrency);
  }
  return out;
}

async function main() {
  const pairUniverse = buildPairUniverse();
  const targetWeeks = await getTargetWeeks();
  const weeklyMatrixMap = await loadWeeklyMatrixMap(targetWeeks, pairUniverse);
  const fxBuckets = buildFxCurrencyBuckets(pairUniverse);
  const flowMap = buildCurrencyFlowDirectionMap(targetWeeks, weeklyMatrixMap, fxBuckets);

  const fetchFrom = DateTime.fromISO(targetWeeks[0], { zone: "utc" }).minus({ days: WARMUP_DAYS });
  const fetchTo = DateTime.fromISO(targetWeeks[targetWeeks.length - 1], { zone: "utc" }).plus({ weeks: 1 });

  const rawM5ByPair = new Map<string, OhlcCandle[]>();
  const indicatorsByPair = new Map<string, Map<number, IndicatorPack>>();
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
      indicatorsByPair.set(
        key,
        new Map([
          [2.0, buildIndicatorPack(candles, 2.0)],
          [2.5, buildIndicatorPack(candles, 2.5)],
        ]),
      );
    } catch (error) {
      missingPairs.push(`${key} (${error instanceof Error ? error.message : String(error)})`);
    }
  });

  const baselineTradeCountByBb = new Map<number, number>();
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
        const indicators = indicatorsByPair.get(key)?.get(config.bbStdDev);
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
            pairInfo,
            weekly.weeklyDirection,
            weekMap,
            fxBuckets,
            config.handshakeThresholdPct,
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
            handshakeThresholdPct: config.handshakeThresholdPct,
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

    if (config.handshakeThresholdPct === null) {
      baselineTradeCountByBb.set(config.bbStdDev, trades.length);
    }

    const agreementValues = trades
      .map((trade) => trade.handshake.agreementPct)
      .filter((value): value is number => value !== null);
    const histogram = {
      "40_50": agreementValues.filter((value) => value >= 40 && value < 50).length,
      "50_60": agreementValues.filter((value) => value >= 50 && value < 60).length,
      "60_75": agreementValues.filter((value) => value >= 60 && value < 75).length,
      "75_100": agreementValues.filter((value) => value >= 75).length,
    };

    const currencyFlowSummary = Array.from(fxBuckets.keys())
      .sort()
      .map((currency) => {
        let flowWeeks = 0;
        let flowTrades: TriggerTrade[] = [];
        let nonFlowTrades: TriggerTrade[] = [];
        for (const week of targetWeeks) {
          const weekFlow = flowMap.get(week)?.get(currency);
          const inWeek = trades.filter((trade) => trade.weekOpenUtc === week && (pairUniverse.find((p) => p.pair === trade.pair)?.base === currency || pairUniverse.find((p) => p.pair === trade.pair)?.quote === currency));
          if (weekFlow && weekFlow.agreementPct >= 50) {
            flowWeeks += 1;
            flowTrades = flowTrades.concat(inWeek);
          } else {
            nonFlowTrades = nonFlowTrades.concat(inWeek);
          }
        }
        return {
          currency,
          flowWeeks,
          flowWeekWinRatePct: summarizeTrades(flowTrades).winRateSessionClosePct,
          nonFlowWeekWinRatePct: summarizeTrades(nonFlowTrades).winRateSessionClosePct,
          flowTradeCount: flowTrades.length,
          nonFlowTradeCount: nonFlowTrades.length,
        };
      });

    variantOutputs.push({
      variantId: config.id,
      bbStdDev: config.bbStdDev,
      handshakeThresholdPct: config.handshakeThresholdPct,
      overall: summarizeTrades(trades),
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
      bucketStats: {
        averageAgreementPct: round(safeAverage(agreementValues), 2),
        medianAgreementPct: round(median(agreementValues), 2),
        distribution: histogram,
      },
      currencyFlowSummary,
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
      handshakeThresholdPct: row.handshakeThresholdPct,
      ...(row.overall as SummaryRow),
    }));

  const tradeCountImpact = variantOutputs.map((row) => {
    const baselineTrades = baselineTradeCountByBb.get(row.bbStdDev as number) ?? 0;
    const currentTrades = (row.overall as SummaryRow).trades;
    return {
      variantId: row.variantId,
      bbStdDev: row.bbStdDev,
      baselineTrades,
      currentTrades,
      filteredOut: Math.max(0, baselineTrades - currentTrades),
      survivePct: baselineTrades === 0 ? 0 : round((currentTrades / baselineTrades) * 100, 2),
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
      handshakeScoring: "average of strong/weak bucket agreement percentages with current pair excluded",
      tradeFrequency: "first trade per pair per eligible session",
      exits: "passive session close and passive week close marks only",
      bias: "weekly dealer + commercial + sentiment majority",
      sessionsUtc: SESSION_WINDOWS_UTC,
    },
    ranking,
    variants: variantOutputs,
    tradeCountImpact,
    missingPairs,
    notes: [
      "FX handshake uses average bucket agreement across the strong-currency and weak-currency buckets.",
      "Current pair is excluded from its own bucket counts.",
      "Indices require all 3 weekly biases to agree. Crypto requires BTC and ETH weekly biases to agree.",
      "Commodities are included in the run but do not use a dedicated handshake bucket in this first pass.",
    ],
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const reportPath = path.join(REPORTS_DIR, `cfd-handshake-sweep-${timestamp}.json`);
  const latestPath = path.join(REPORTS_DIR, "cfd-handshake-sweep-latest.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(latestPath, JSON.stringify(report, null, 2), "utf8");

  console.log("CFD handshake sweep complete.");
  console.log(JSON.stringify({ ranking, reportPath, latestPath, missingPairs: missingPairs.length }, null, 2));
}

main().catch((error) => {
  console.error("backtest-cfd-handshake-sweep failed:", error);
  process.exitCode = 1;
});
