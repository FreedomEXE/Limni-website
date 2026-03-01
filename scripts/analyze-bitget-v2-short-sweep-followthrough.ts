/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: analyze-bitget-v2-short-sweep-followthrough.ts
 *
 * Description:
 * Standalone follow-through analysis for bias-aligned SHORT sweep
 * events from the Bitget v2 backtest universe.
 *
 * For each aligned SHORT sweep event, reports:
 * - range re-entry behavior and timing
 * - max adverse overshoot extension
 * - simple SHORT trade outcome using fixed stop and range-low target
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { getPool } from "../src/lib/db";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { derivePairDirectionsByBase } from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { CotSnapshot } from "../src/lib/cotTypes";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { classifyWeeklyBias } from "../src/lib/bitgetBotSignals";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

type SymbolBase = "BTC" | "ETH";
type Direction = "LONG" | "SHORT" | "NEUTRAL";
type ConfidenceTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type SessionWindow =
  | "ASIA_LONDON_RANGE_NY_ENTRY"
  | "US_RANGE_ASIA_LONDON_ENTRY";

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  quoteVolume: number | null;
};

type DailyRange = {
  high: number;
  low: number;
  locked: boolean;
};

type FundingPoint = {
  ts: number;
  rate: number;
};

type WeeklyBiasForSymbol = {
  direction: Direction;
  tier: ConfidenceTier;
};

type Outcome = "TARGET" | "STOP" | "WINDOW_CLOSE";

type ShortSweepFollowThrough = {
  weekOpenUtc: string;
  day: string;
  symbol: SymbolBase;
  sessionWindow: SessionWindow;
  biasDirection: Direction;
  biasTier: ConfidenceTier;

  sweepStartTs: number;
  sweepEndTs: number;

  entryPrice: number;
  rangeHigh: number;
  rangeLow: number;

  initialOvershootPct: number;
  maxOvershootPct: number;
  additionalOvershootPct: number;
  maxHighDuringEvent: number;
  maxAdverseFromEntryPct: number;

  reenteredRange: boolean;
  reentryTs: number | null;
  reentryBars: number | null;
  reentryMinutes: number | null;

  stopPct: number;
  stopPrice: number;
  targetPrice: number;
  outcome: Outcome;
  exitTs: number;
  exitPrice: number;
  pnlPct: number;
};

type BasicStats = {
  count: number;
  mean: number;
  median: number;
  std: number;
  p25: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
};

const SYMBOLS: SymbolBase[] = ["BTC", "ETH"];
const WEEKS_TO_BACKTEST = Number(process.env.BACKTEST_WEEKS ?? "5");
const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
const BACKTEST_INCLUDE_SUNDAYS = process.env.BACKTEST_INCLUDE_SUNDAYS === "1";
const SWEEP_BREACH_MIN_PCT = Number(process.env.SWEEP_BREACH_MIN_PCT ?? "0");
const FIXED_STOP_PCT = Number(process.env.SHORT_SWEEP_FIXED_STOP_PCT ?? "0.5");
const FUNDING_EXTREME_THRESHOLD = 0.0001;
const BITGET_MAX_RETRIES = Number(process.env.BITGET_FETCH_RETRIES ?? "6");
const BITGET_RETRY_BASE_MS = Number(process.env.BITGET_RETRY_BASE_MS ?? "500");

function fmt3(value: number) {
  return value.toFixed(3);
}

function fmt2(value: number) {
  return value.toFixed(2);
}

function getUtcHour(ts: number) {
  return DateTime.fromMillis(ts, { zone: "utc" }).hour;
}

function getUtcDateKey(ts: number) {
  return DateTime.fromMillis(ts, { zone: "utc" }).toISODate() ?? "";
}

function previousUtcDateKey(day: string) {
  const dt = DateTime.fromISO(day, { zone: "utc" });
  return dt.isValid ? dt.minus({ days: 1 }).toISODate() ?? "" : "";
}

function isSundayUtc(day: string) {
  const dt = DateTime.fromISO(day, { zone: "utc" });
  return dt.isValid && dt.weekday === 7;
}

function isNySessionCandle(ts: number) {
  const h = getUtcHour(ts);
  return h >= 13 && h < 21;
}

function isAsiaSessionCandle(ts: number) {
  const h = getUtcHour(ts);
  return h >= 0 && h < 8;
}

function isLondonSessionCandle(ts: number) {
  const h = getUtcHour(ts);
  return h >= 8 && h < 13;
}

function isAsiaLondonSessionCandle(ts: number) {
  const h = getUtcHour(ts);
  return h >= 0 && h < 13;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    } catch {
      // Ignore missing env files.
    }
  }
}

function getLastCompletedWeekOpens(count: number) {
  const currentWeekOpen = DateTime.fromISO(getCanonicalWeekOpenUtc(), { zone: "utc" });
  if (!currentWeekOpen.isValid) {
    throw new Error("Failed to resolve canonical week anchor.");
  }
  const out: string[] = [];
  for (let i = count; i >= 1; i -= 1) {
    out.push(currentWeekOpen.minus({ weeks: i }).toUTC().toISO() ?? "");
  }
  return out.filter(Boolean);
}

function selectCotSnapshotForWeek(history: CotSnapshot[], weekOpenUtc: string) {
  const weekDate = weekOpenUtc.slice(0, 10);
  const sorted = [...history].sort((a, b) => b.report_date.localeCompare(a.report_date));
  return sorted.find((snap) => snap.report_date <= weekDate) ?? sorted.at(-1) ?? null;
}

function directionFromSentimentAggregate(agg?: SentimentAggregate): Direction {
  if (!agg) return "NEUTRAL";
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return "NEUTRAL";
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return "NEUTRAL";
}

async function fetchFundingHistory(symbol: SymbolBase): Promise<FundingPoint[]> {
  const out: FundingPoint[] = [];
  const seen = new Set<number>();
  for (let pageNo = 1; pageNo <= 4; pageNo += 1) {
    const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/history-fund-rate`);
    url.searchParams.set("symbol", `${symbol}USDT`);
    url.searchParams.set("productType", BITGET_PRODUCT_TYPE);
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("pageNo", String(pageNo));

    let response: Response | null = null;
    for (let attempt = 0; attempt <= BITGET_MAX_RETRIES; attempt += 1) {
      response = await fetch(url.toString(), { cache: "no-store" });
      if (response.ok) break;
      if (response.status !== 429 || attempt === BITGET_MAX_RETRIES) {
        throw new Error(`Funding fetch failed (${response.status}) ${symbol}`);
      }
      await sleep(BITGET_RETRY_BASE_MS * (attempt + 1));
    }
    if (!response || !response.ok) {
      throw new Error(`Funding fetch failed (unknown) ${symbol}`);
    }
    const body = (await response.json()) as {
      code?: string;
      data?: Array<{ fundingTime?: string; fundingRate?: string }>;
    };
    if (body.code && body.code !== "00000") {
      throw new Error(`Funding API error ${symbol}: ${body.code}`);
    }
    const rows = body.data ?? [];
    for (const row of rows) {
      const ts = Number(row.fundingTime);
      const rate = Number(row.fundingRate);
      if (!Number.isFinite(ts) || !Number.isFinite(rate) || seen.has(ts)) continue;
      seen.add(ts);
      out.push({ ts, rate });
    }
    if (rows.length < 200) break;
  }
  return out.sort((a, b) => a.ts - b.ts);
}

function deriveFundingProxyDirection(history: FundingPoint[], weekOpenUtc: string) {
  if (!history.length) {
    return { direction: "NEUTRAL" as Direction, rate: null as number | null };
  }
  const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const before = history.filter((r) => r.ts <= weekMs);
  const pick = before.length ? before[before.length - 1] : history[0];
  if (!pick) return { direction: "NEUTRAL" as Direction, rate: null as number | null };
  if (pick.rate > FUNDING_EXTREME_THRESHOLD) return { direction: "SHORT" as Direction, rate: pick.rate };
  if (pick.rate < -FUNDING_EXTREME_THRESHOLD) return { direction: "LONG" as Direction, rate: pick.rate };
  return { direction: "NEUTRAL" as Direction, rate: pick.rate };
}

async function fetchRawM1Candles(symbol: SymbolBase, openUtc: DateTime, closeUtc: DateTime): Promise<Candle[]> {
  const out = new Map<number, Candle>();
  let cursor = openUtc.toMillis();
  const closeMs = closeUtc.toMillis();
  const windowMs = 200 * 60_000;

  while (cursor < closeMs) {
    const windowEnd = Math.min(cursor + windowMs, closeMs);
    const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/history-candles`);
    url.searchParams.set("symbol", `${symbol}USDT`);
    url.searchParams.set("productType", BITGET_PRODUCT_TYPE);
    url.searchParams.set("granularity", "1m");
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(windowEnd));
    url.searchParams.set("limit", "200");

    let response: Response | null = null;
    for (let attempt = 0; attempt <= BITGET_MAX_RETRIES; attempt += 1) {
      response = await fetch(url.toString(), { cache: "no-store" });
      if (response.ok) break;
      if (response.status !== 429 || attempt === BITGET_MAX_RETRIES) {
        throw new Error(`M1 fetch failed (${response.status}) ${symbol}`);
      }
      await sleep(BITGET_RETRY_BASE_MS * (attempt + 1));
    }
    if (!response || !response.ok) {
      throw new Error(`M1 fetch failed (unknown) ${symbol}`);
    }
    const body = (await response.json()) as { code?: string; data?: string[][] };
    if (body.code && body.code !== "00000") {
      throw new Error(`M1 API error ${symbol}: ${body.code}`);
    }

    const rows = (body.data ?? [])
      .map((r) => {
        const quote = Number(r[6] ?? r[5]);
        return {
          ts: Number(r[0]),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          quoteVolume: Number.isFinite(quote) ? quote : null,
        } satisfies Candle;
      })
      .filter((r) => (
        Number.isFinite(r.ts)
        && Number.isFinite(r.open)
        && Number.isFinite(r.high)
        && Number.isFinite(r.low)
        && Number.isFinite(r.close)
      ))
      .filter((r) => r.ts >= cursor && r.ts < windowEnd)
      .sort((a, b) => a.ts - b.ts);

    for (const row of rows) out.set(row.ts, row);
    cursor = windowEnd;
  }

  return Array.from(out.values()).sort((a, b) => a.ts - b.ts);
}

function aggregateM1ToM5(m1: Candle[]): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const c of m1) {
    const bucket = Math.floor(c.ts / 300_000) * 300_000;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)?.push(c);
  }

  return Array.from(groups.keys()).sort((a, b) => a - b).map((bucket) => {
    const rows = (groups.get(bucket) ?? []).sort((a, b) => a.ts - b.ts);
    return {
      ts: bucket,
      open: rows[0].open,
      high: Math.max(...rows.map((r) => r.high)),
      low: Math.min(...rows.map((r) => r.low)),
      close: rows[rows.length - 1].close,
      quoteVolume: rows.reduce((sum, row) => sum + (row.quoteVolume ?? 0), 0),
    };
  });
}

function buildDailyRanges(candles: Candle[]): Map<string, DailyRange> {
  const dayMap = new Map<string, { asia: Candle[]; london: Candle[] }>();
  for (const candle of candles) {
    const day = getUtcDateKey(candle.ts);
    if (!dayMap.has(day)) dayMap.set(day, { asia: [], london: [] });
    const bucket = dayMap.get(day);
    if (!bucket) continue;
    if (isAsiaSessionCandle(candle.ts)) bucket.asia.push(candle);
    if (isLondonSessionCandle(candle.ts)) bucket.london.push(candle);
  }

  const ranges = new Map<string, DailyRange>();
  for (const [day, sessions] of dayMap.entries()) {
    if (!sessions.asia.length || !sessions.london.length) continue;
    const asiaHigh = Math.max(...sessions.asia.map((c) => c.high));
    const asiaLow = Math.min(...sessions.asia.map((c) => c.low));
    const londonHigh = Math.max(...sessions.london.map((c) => c.high));
    const londonLow = Math.min(...sessions.london.map((c) => c.low));
    ranges.set(day, {
      high: Math.max(asiaHigh, londonHigh),
      low: Math.min(asiaLow, londonLow),
      locked: true,
    });
  }
  return ranges;
}

function buildUsSessionRanges(candles: Candle[]): Map<string, DailyRange> {
  const dayMap = new Map<string, Candle[]>();
  for (const candle of candles) {
    if (!isNySessionCandle(candle.ts)) continue;
    const day = getUtcDateKey(candle.ts);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)?.push(candle);
  }

  const ranges = new Map<string, DailyRange>();
  for (const [day, session] of dayMap.entries()) {
    if (!session.length) continue;
    ranges.set(day, {
      high: Math.max(...session.map((c) => c.high)),
      low: Math.min(...session.map((c) => c.low)),
      locked: true,
    });
  }
  return ranges;
}

function nyCandleIndicesForDay(candles: Candle[], dayUtc: string) {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (getUtcDateKey(c.ts) !== dayUtc) continue;
    if (!isNySessionCandle(c.ts)) continue;
    out.push(i);
  }
  return out;
}

function asiaLondonCandleIndicesForDay(candles: Candle[], dayUtc: string) {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (getUtcDateKey(c.ts) !== dayUtc) continue;
    if (!isAsiaLondonSessionCandle(c.ts)) continue;
    out.push(i);
  }
  return out;
}

function pctMoveShort(entry: number, exit: number) {
  if (!(entry > 0)) return 0;
  return ((entry - exit) / entry) * 100;
}

function percentile(sortedValues: number[], pct: number) {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const rank = (pct / 100) * (sortedValues.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedValues[low];
  const weight = rank - low;
  return sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
}

function summarize(values: number[]): BasicStats {
  if (!values.length) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      std: 0,
      p25: 0,
      p75: 0,
      p90: 0,
      min: 0,
      max: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
  return {
    count: sorted.length,
    mean,
    median: percentile(sorted, 50),
    std: Math.sqrt(variance),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function isAlignedShort(bias: WeeklyBiasForSymbol) {
  return bias.tier === "NEUTRAL" || bias.direction === "NEUTRAL" || bias.direction === "SHORT";
}

function scanAlignedShortSweeps(params: {
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  sessionWindow: SessionWindow;
  candles: Candle[];
  sessionIndices: number[];
  range: DailyRange;
  bias: WeeklyBiasForSymbol;
}): ShortSweepFollowThrough[] {
  const {
    symbol,
    weekOpenUtc,
    dayUtc,
    sessionWindow,
    candles,
    sessionIndices,
    range,
    bias,
  } = params;

  if (!isAlignedShort(bias)) return [];

  const out: ShortSweepFollowThrough[] = [];
  const stopPct = FIXED_STOP_PCT;
  type Active = {
    startPos: number;
    startIdx: number;
    startTs: number;
    initialOvershootPct: number;
    maxOvershootPct: number;
    maxHigh: number;
  };
  let active: Active | null = null;

  const finalize = (endPos: number, reenteredRange: boolean, reentryTs: number | null) => {
    if (!active) return;
    const startCandle = candles[active.startIdx];
    if (!startCandle || !(startCandle.close > 0)) {
      active = null;
      return;
    }

    const entryPrice = startCandle.close;
    const targetPrice = range.low;
    const stopPrice = entryPrice * (1 + stopPct / 100);

    let outcome: Outcome = "WINDOW_CLOSE";
    let exitTs = candles[sessionIndices[endPos]]?.ts ?? startCandle.ts;
    let exitPrice = candles[sessionIndices[endPos]]?.close ?? entryPrice;

    // Conservative intrabar assumption: if stop and target both touch, stop wins first.
    for (let pos = active.startPos + 1; pos < sessionIndices.length; pos += 1) {
      const idx = sessionIndices[pos];
      const c = candles[idx];
      if (!c) continue;
      const hitStop = c.high >= stopPrice;
      const hitTarget = c.low <= targetPrice;

      if (hitStop || hitTarget) {
        if (hitStop) {
          outcome = "STOP";
          exitPrice = stopPrice;
          exitTs = c.ts;
        } else {
          outcome = "TARGET";
          exitPrice = targetPrice;
          exitTs = c.ts;
        }
        break;
      }
    }

    if (outcome === "WINDOW_CLOSE") {
      const lastIdx = sessionIndices[sessionIndices.length - 1];
      const last = candles[lastIdx];
      if (last) {
        exitTs = last.ts;
        exitPrice = last.close;
      }
    }

    const reentryBars = reenteredRange && reentryTs !== null
      ? Math.max(0, endPos - active.startPos)
      : null;
    const reentryMinutes = reentryTs !== null
      ? Math.max(0, (reentryTs - active.startTs) / 60_000)
      : null;

    out.push({
      weekOpenUtc,
      day: dayUtc,
      symbol,
      sessionWindow,
      biasDirection: bias.direction,
      biasTier: bias.tier,
      sweepStartTs: active.startTs,
      sweepEndTs: candles[sessionIndices[endPos]]?.ts ?? active.startTs,
      entryPrice,
      rangeHigh: range.high,
      rangeLow: range.low,
      initialOvershootPct: active.initialOvershootPct,
      maxOvershootPct: active.maxOvershootPct,
      additionalOvershootPct: Math.max(0, active.maxOvershootPct - active.initialOvershootPct),
      maxHighDuringEvent: active.maxHigh,
      maxAdverseFromEntryPct: ((active.maxHigh - entryPrice) / entryPrice) * 100,
      reenteredRange,
      reentryTs,
      reentryBars,
      reentryMinutes,
      stopPct,
      stopPrice,
      targetPrice,
      outcome,
      exitTs,
      exitPrice,
      pnlPct: pctMoveShort(entryPrice, exitPrice),
    });

    active = null;
  };

  for (let pos = 0; pos < sessionIndices.length; pos += 1) {
    const idx = sessionIndices[pos];
    const c = candles[idx];
    if (!c) continue;

    const overshootPct = ((c.high - range.high) / range.high) * 100;
    const breached = overshootPct > SWEEP_BREACH_MIN_PCT;

    if (breached && !active) {
      active = {
        startPos: pos,
        startIdx: idx,
        startTs: c.ts,
        initialOvershootPct: overshootPct,
        maxOvershootPct: overshootPct,
        maxHigh: c.high,
      };
    } else if (breached && active) {
      active.maxOvershootPct = Math.max(active.maxOvershootPct, overshootPct);
      active.maxHigh = Math.max(active.maxHigh, c.high);
    }

    if (active) {
      const reenteredThisBar = c.low <= range.high;
      if (!breached || reenteredThisBar) {
        finalize(pos, true, c.ts);
      }
    }
  }

  if (active) {
    finalize(sessionIndices.length - 1, false, null);
  }

  return out;
}

async function buildBiasBySymbolForWeek(
  weekOpenUtc: string,
  cotHistory: CotSnapshot[],
  fundingBySymbol: Record<SymbolBase, FundingPoint[]>,
): Promise<Record<SymbolBase, WeeklyBiasForSymbol>> {
  const cotSnapshot = selectCotSnapshotForWeek(cotHistory, weekOpenUtc);
  if (!cotSnapshot) {
    throw new Error(`No COT snapshot available for week ${weekOpenUtc}`);
  }

  const weekCloseUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .plus({ weeks: 1 })
    .toUTC()
    .toISO() ?? weekOpenUtc;
  const sentiment = await getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekCloseUtc);
  const sentimentMap = new Map(sentiment.map((agg) => [String(agg.symbol).toUpperCase(), agg]));

  const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
  const dealerPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "dealer");
  const commercialPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "commercial");

  const out = {} as Record<SymbolBase, WeeklyBiasForSymbol>;
  for (const symbol of SYMBOLS) {
    const dealer = dealerPairs[`${symbol}USD`]?.direction ?? "NEUTRAL";
    const commercial = commercialPairs[`${symbol}USD`]?.direction ?? "NEUTRAL";
    const agg = sentimentMap.get(`${symbol}USD`)
      ?? sentimentMap.get(symbol)
      ?? sentimentMap.get(`${symbol}USDT`);

    let sentimentDir: Direction = directionFromSentimentAggregate(agg);
    if (!agg) {
      const proxy = deriveFundingProxyDirection(fundingBySymbol[symbol], weekOpenUtc);
      sentimentDir = proxy.direction;
    }

    const cls = classifyWeeklyBias(dealer, commercial, sentimentDir);
    out[symbol] = {
      direction: cls.direction,
      tier: cls.tier,
    };
  }

  return out;
}

function printStatsBlock(title: string, values: number[]) {
  const s = summarize(values);
  console.log(title);
  console.log(`  Count: ${s.count}`);
  console.log(`  Mean: ${fmt3(s.mean)}`);
  console.log(`  Median: ${fmt3(s.median)}`);
  console.log(`  Std dev: ${fmt3(s.std)}`);
  console.log(`  P25: ${fmt3(s.p25)}  P75: ${fmt3(s.p75)}  P90: ${fmt3(s.p90)}`);
  console.log(`  Min: ${fmt3(s.min)}  Max: ${fmt3(s.max)}`);
  console.log("");
}

function printReport(events: ShortSweepFollowThrough[]) {
  const total = events.length;
  const reentered = events.filter((e) => e.reenteredRange);
  const notReentered = events.filter((e) => !e.reenteredRange);
  const targetHits = events.filter((e) => e.outcome === "TARGET");
  const stopHits = events.filter((e) => e.outcome === "STOP");
  const timedOut = events.filter((e) => e.outcome === "WINDOW_CLOSE");
  const resolved = targetHits.length + stopHits.length;

  const reentryMinutes = reentered
    .map((e) => e.reentryMinutes)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const reentryBars = reentered
    .map((e) => e.reentryBars)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const winRateAll = total > 0 ? (targetHits.length / total) * 100 : 0;
  const winRateResolved = resolved > 0 ? (targetHits.length / resolved) * 100 : 0;
  const baselineWinRate = 87.5;
  const deltaVsBaseline = winRateAll - baselineWinRate;

  console.log("=== ALIGNED SHORT SWEEP FOLLOW-THROUGH ===");
  console.log(`Total aligned SHORT sweeps: ${total}`);
  console.log(`Bias mix: ${Array.from(new Set(events.map((e) => `${e.biasDirection}/${e.biasTier}`))).join(", ")}`);
  console.log("");

  console.log("=== RANGE RE-ENTRY ===");
  console.log(`Re-entered range before session close: ${reentered.length} (${fmt2(total > 0 ? (reentered.length / total) * 100 : 0)}%)`);
  console.log(`Did not re-enter before session close: ${notReentered.length} (${fmt2(total > 0 ? (notReentered.length / total) * 100 : 0)}%)`);
  printStatsBlock("Time to re-entry (minutes):", reentryMinutes);
  printStatsBlock("Bars to re-entry (M5 bars):", reentryBars);

  console.log("=== ADVERSE EXTENSION ===");
  printStatsBlock("Max overshoot % (range-based):", events.map((e) => e.maxOvershootPct));
  printStatsBlock("Additional overshoot % after first breach:", events.map((e) => e.additionalOvershootPct));
  printStatsBlock("Max adverse move % from entry (price-based):", events.map((e) => e.maxAdverseFromEntryPct));

  console.log("=== SIMPLE SHORT MODEL ===");
  console.log(`Assumptions: entry=sweep candle close, target=range low, fixed stop=${fmt3(FIXED_STOP_PCT)}%, intrabar tie => STOP first (conservative).`);
  console.log(`TARGET hits: ${targetHits.length}`);
  console.log(`STOP hits: ${stopHits.length}`);
  console.log(`No hit (window close exit): ${timedOut.length}`);
  console.log(`Win rate (all ${total}): ${fmt2(winRateAll)}%`);
  console.log(`Win rate (resolved only): ${fmt2(winRateResolved)}%`);
  console.log(`Baseline reference: 18-trade system win rate = ${baselineWinRate.toFixed(1)}%`);
  console.log(`Delta vs baseline (all-sweep win rate): ${fmt2(deltaVsBaseline)} pp`);
  console.log("");
  printStatsBlock("PnL % per sweep (window-closed if no TP/SL):", events.map((e) => e.pnlPct));
  printStatsBlock("PnL % on winners only:", targetHits.map((e) => e.pnlPct));
  printStatsBlock("PnL % on losers only (STOP + WINDOW_CLOSE non-winners):", events.filter((e) => e.outcome !== "TARGET").map((e) => e.pnlPct));
}

async function main() {
  loadEnvFromFile();
  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) throw new Error("No crypto COT snapshots found.");

  console.log(`Analyzing aligned SHORT sweep follow-through for ${weekOpens.length} completed week(s)...`);
  console.log(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Sweep breach threshold: ${SWEEP_BREACH_MIN_PCT.toFixed(3)}%`);
  console.log(`Fixed stop: ${FIXED_STOP_PCT.toFixed(3)}%`);
  console.log("");

  const fundingBySymbol: Record<SymbolBase, FundingPoint[]> = {
    BTC: await fetchFundingHistory("BTC"),
    ETH: await fetchFundingHistory("ETH"),
  };

  const allEvents: ShortSweepFollowThrough[] = [];

  for (const weekOpenUtc of weekOpens) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekDataOpen = weekOpen.minus({ days: 1 });
    const biasesBySymbol = await buildBiasBySymbolForWeek(weekOpenUtc, cotHistory, fundingBySymbol);

    console.log(`Fetching candles for week ${weekOpenUtc.slice(0, 10)}...`);
    for (const symbol of SYMBOLS) {
      const bias = biasesBySymbol[symbol];
      console.log(`  ${symbol} bias: ${bias.direction} (${bias.tier})`);
    }

    const candlesBySymbol = {} as Record<SymbolBase, Candle[]>;
    const asiaLondonRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;
    const usRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;

    for (const symbol of SYMBOLS) {
      const rawM1 = await fetchRawM1Candles(symbol, weekDataOpen, weekClose);
      const m5 = aggregateM1ToM5(rawM1);
      candlesBySymbol[symbol] = m5;
      asiaLondonRangesBySymbol[symbol] = buildDailyRanges(m5);
      usRangesBySymbol[symbol] = buildUsSessionRanges(m5);
      console.log(`  ${symbol} candles: m1=${rawM1.length} m5=${m5.length}`);
    }

    const dateKeys: string[] = [];
    for (let d = weekOpen.startOf("day"); d < weekClose; d = d.plus({ days: 1 })) {
      const key = d.toISODate();
      if (key) dateKeys.push(key);
    }

    for (const dayUtc of dateKeys) {
      if (!BACKTEST_INCLUDE_SUNDAYS && isSundayUtc(dayUtc)) continue;

      const sessionDefinitions: Array<{
        sessionWindow: SessionWindow;
        rangeForSymbol: (symbol: SymbolBase) => DailyRange | undefined;
        sessionIndicesForSymbol: (symbol: SymbolBase) => number[];
      }> = [
        {
          sessionWindow: "ASIA_LONDON_RANGE_NY_ENTRY",
          rangeForSymbol: (symbol) => asiaLondonRangesBySymbol[symbol].get(dayUtc),
          sessionIndicesForSymbol: (symbol) => nyCandleIndicesForDay(candlesBySymbol[symbol], dayUtc),
        },
        {
          sessionWindow: "US_RANGE_ASIA_LONDON_ENTRY",
          rangeForSymbol: (symbol) => usRangesBySymbol[symbol].get(previousUtcDateKey(dayUtc)),
          sessionIndicesForSymbol: (symbol) => asiaLondonCandleIndicesForDay(candlesBySymbol[symbol], dayUtc),
        },
      ];

      for (const sessionDef of sessionDefinitions) {
        for (const symbol of SYMBOLS) {
          const candles = candlesBySymbol[symbol];
          const range = sessionDef.rangeForSymbol(symbol);
          const sessionIndices = sessionDef.sessionIndicesForSymbol(symbol);
          if (!range?.locked || !sessionIndices.length || !candles.length) continue;

          const events = scanAlignedShortSweeps({
            symbol,
            weekOpenUtc,
            dayUtc,
            sessionWindow: sessionDef.sessionWindow,
            candles,
            sessionIndices,
            range,
            bias: biasesBySymbol[symbol],
          });
          allEvents.push(...events);
        }
      }
    }
  }

  console.log("");
  printReport(allEvents);
}

main()
  .catch((error) => {
    console.error("analyze-bitget-v2-short-sweep-followthrough failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
