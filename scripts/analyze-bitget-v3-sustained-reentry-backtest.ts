/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: analyze-bitget-v3-sustained-reentry-backtest.ts
 *
 * Description:
 * V3 backtest:
 * - Sweep + sustained deviation filter (N consecutive 1m closes beyond range)
 * - Two-session re-entry window
 * - Bias-aligned filter (weekly classification)
 * - One trade per range per symbol
 * - V2 scaling exit engine
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

type ExitReason = "STOP_LOSS" | "TRAILING_STOP" | "EOD_CLOSE" | "WEEK_CLOSE" | "BREAKEVEN_STOP";

type RiskSimulation = {
  exitTs: number;
  exitPrice: number;
  exitReason: ExitReason;
  stopPrice: number;
  stopDistancePct: number;
  unleveredPnlPct: number;
  rMultiple: number;
  initialLeverage: number;
  pnlLeverage: number;
  maxLeverageReached: number;
  breakevenReached: boolean;
  milestonesHit: number[];
};

type TradeRecord = {
  sustainedN: number;
  weekOpenUtc: string;
  dayUtc: string;
  symbol: SymbolBase;
  sessionWindow: SessionWindow;
  direction: "LONG" | "SHORT";
  entryTs: number;
  exitTs: number;
  entryPrice: number;
  exitPrice: number;
  unleveredPnlPct: number;
  leveragedPnlPct: number;
  exitReason: ExitReason;
  maxLeverageReached: number;
  breakevenReached: boolean;
  milestonesHit: number[];
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
const FUNDING_EXTREME_THRESHOLD = 0.0001;
const BITGET_MAX_RETRIES = Number(process.env.BITGET_FETCH_RETRIES ?? "6");
const BITGET_RETRY_BASE_MS = Number(process.env.BITGET_RETRY_BASE_MS ?? "500");
const START_LEVERAGES = (process.env.SHORT_SWEEP_START_LEVERAGES ?? "5,10")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v > 0);
const SUSTAINED_N_VALUES = (process.env.V3_SUSTAINED_N_VALUES ?? "1,3,5,10,15,30")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v >= 1)
  .sort((a, b) => a - b);

const SCALING_INITIAL_STOP_PCT = 10;
const SCALING_MILESTONES = [1, 2, 3, 4] as const;
const SCALING_LEVERAGE_BY_MILESTONE: Record<(typeof SCALING_MILESTONES)[number], number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 75,
};

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

function sessionOfTs(ts: number): "ASIA" | "LONDON" | "NY" | "OTHER" {
  if (isAsiaSessionCandle(ts)) return "ASIA";
  if (isLondonSessionCandle(ts)) return "LONDON";
  if (isNySessionCandle(ts)) return "NY";
  return "OTHER";
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

function pctMove(entry: number, exit: number, direction: "LONG" | "SHORT") {
  if (!(entry > 0) || !Number.isFinite(exit)) return 0;
  const raw = ((exit - entry) / entry) * 100;
  return direction === "LONG" ? raw : -raw;
}

function simulateScalingRisk(
  candles: Candle[],
  exitIndices: number[],
  entryIndex: number,
  entryPrice: number,
  direction: "LONG" | "SHORT",
  initialLeverage: number,
  noTriggerExitReason: ExitReason = "EOD_CLOSE",
): RiskSimulation {
  const entryPos = exitIndices.findIndex((idx) => idx === entryIndex);
  const initialStop = direction === "LONG"
    ? entryPrice * (1 - SCALING_INITIAL_STOP_PCT / 100)
    : entryPrice * (1 + SCALING_INITIAL_STOP_PCT / 100);

  if (entryPos < 0) {
    const fallback = candles[entryIndex];
    const unlev = pctMove(entryPrice, fallback.close, direction);
    return {
      exitTs: fallback.ts,
      exitPrice: fallback.close,
      exitReason: noTriggerExitReason,
      stopPrice: initialStop,
      stopDistancePct: SCALING_INITIAL_STOP_PCT,
      unleveredPnlPct: unlev,
      rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
      initialLeverage,
      pnlLeverage: initialLeverage,
      maxLeverageReached: initialLeverage,
      breakevenReached: false,
      milestonesHit: [],
    };
  }

  let stopPrice = initialStop;
  let maxLev = initialLeverage;
  let breakevenReached = false;
  let trailingOffsetPct: number | null = null;
  let peakFavorable = entryPrice;
  const milestonesHit: number[] = [];

  function favorableMovePct() {
    return direction === "LONG"
      ? ((peakFavorable - entryPrice) / entryPrice) * 100
      : ((entryPrice - peakFavorable) / entryPrice) * 100;
  }

  const lastIdx = exitIndices[exitIndices.length - 1];

  for (let pos = entryPos + 1; pos < exitIndices.length; pos += 1) {
    const idx = exitIndices[pos];
    const candle = candles[idx];
    if (!candle) continue;

    if (direction === "LONG") {
      if (candle.high > peakFavorable) peakFavorable = candle.high;
    } else {
      if (candle.low < peakFavorable) peakFavorable = candle.low;
    }

    const move = favorableMovePct();
    for (const milestone of SCALING_MILESTONES) {
      if (move < milestone) continue;
      if (milestonesHit.includes(milestone)) continue;
      milestonesHit.push(milestone);
      maxLev = Math.max(maxLev, SCALING_LEVERAGE_BY_MILESTONE[milestone]);
      if (milestone >= 2) {
        stopPrice = entryPrice;
        breakevenReached = true;
      }
      if (milestone >= 3) trailingOffsetPct = milestone >= 4 ? 1.0 : 1.5;
    }

    let trailPrice: number | null = null;
    if (trailingOffsetPct !== null) {
      trailPrice = direction === "LONG"
        ? peakFavorable * (1 - trailingOffsetPct / 100)
        : peakFavorable * (1 + trailingOffsetPct / 100);
    }

    if (direction === "LONG") {
      const stopHit = candle.low <= stopPrice;
      const trailHit = trailPrice !== null && candle.low <= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.max(stopPrice, trailPrice as number)
          : stopHit ? stopPrice : (trailPrice as number);
        const exitReason = stopHit
          ? (breakevenReached && Math.abs(stopPrice - entryPrice) / entryPrice < 1e-9 ? "BREAKEVEN_STOP" : "STOP_LOSS")
          : "TRAILING_STOP";
        const unlev = pctMove(entryPrice, exitPrice, direction);
        return {
          exitTs: candle.ts,
          exitPrice,
          exitReason,
          stopPrice: initialStop,
          stopDistancePct: SCALING_INITIAL_STOP_PCT,
          unleveredPnlPct: unlev,
          rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
          initialLeverage,
          pnlLeverage: initialLeverage,
          maxLeverageReached: maxLev,
          breakevenReached,
          milestonesHit: [...milestonesHit].sort((a, b) => a - b),
        };
      }
    } else {
      const stopHit = candle.high >= stopPrice;
      const trailHit = trailPrice !== null && candle.high >= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.min(stopPrice, trailPrice as number)
          : stopHit ? stopPrice : (trailPrice as number);
        const exitReason = stopHit
          ? (breakevenReached && Math.abs(stopPrice - entryPrice) / entryPrice < 1e-9 ? "BREAKEVEN_STOP" : "STOP_LOSS")
          : "TRAILING_STOP";
        const unlev = pctMove(entryPrice, exitPrice, direction);
        return {
          exitTs: candle.ts,
          exitPrice,
          exitReason,
          stopPrice: initialStop,
          stopDistancePct: SCALING_INITIAL_STOP_PCT,
          unleveredPnlPct: unlev,
          rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
          initialLeverage,
          pnlLeverage: initialLeverage,
          maxLeverageReached: maxLev,
          breakevenReached,
          milestonesHit: [...milestonesHit].sort((a, b) => a - b),
        };
      }
    }
  }

  const last = candles[lastIdx];
  const unlev = pctMove(entryPrice, last.close, direction);
  return {
    exitTs: last.ts,
    exitPrice: last.close,
    exitReason: noTriggerExitReason,
    stopPrice: initialStop,
    stopDistancePct: SCALING_INITIAL_STOP_PCT,
    unleveredPnlPct: unlev,
    rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
    initialLeverage,
    pnlLeverage: initialLeverage,
    maxLeverageReached: maxLev,
    breakevenReached,
    milestonesHit: [...milestonesHit].sort((a, b) => a - b),
  };
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

function addDays(dayUtc: string, days: number) {
  return DateTime.fromISO(dayUtc, { zone: "utc" }).plus({ days }).toISODate() ?? dayUtc;
}

function dayHourTs(dayUtc: string, hour: number) {
  return DateTime.fromISO(dayUtc, { zone: "utc" }).set({
    hour, minute: 0, second: 0, millisecond: 0,
  }).toMillis();
}

function minSweepPctForTier(tier: ConfidenceTier) {
  return tier === "NEUTRAL" ? 0.3 : 0.1;
}

function allowedDirectionsForBias(bias: WeeklyBiasForSymbol): Array<"LONG" | "SHORT"> {
  if (bias.tier === "NEUTRAL" || bias.direction === "NEUTRAL") return ["LONG", "SHORT"];
  return bias.direction === "LONG" ? ["LONG"] : ["SHORT"];
}

function closeBeyondRange(direction: "LONG" | "SHORT", candle: Candle, range: DailyRange) {
  return direction === "SHORT" ? candle.close > range.high : candle.close < range.low;
}

function closeInsideRange(direction: "LONG" | "SHORT", candle: Candle, range: DailyRange) {
  return direction === "SHORT" ? candle.close < range.high : candle.close > range.low;
}

function breachPct(direction: "LONG" | "SHORT", candle: Candle, range: DailyRange) {
  return direction === "SHORT"
    ? ((candle.high - range.high) / range.high) * 100
    : ((range.low - candle.low) / range.low) * 100;
}

function twoSessionDeadlineFromSweepTs(sweepTs: number) {
  const day = getUtcDateKey(sweepTs);
  const session = sessionOfTs(sweepTs);
  if (session === "NY") return dayHourTs(addDays(day, 1), 8);
  if (session === "ASIA") return dayHourTs(day, 13);
  if (session === "LONDON") return dayHourTs(day, 21);
  return sweepTs;
}

function findV3Entry(params: {
  candles: Candle[];
  indices: number[];
  range: DailyRange;
  bias: WeeklyBiasForSymbol;
  sustainedN: number;
  windowEndTs: number;
}): { entryIndex: number; direction: "LONG" | "SHORT" } | null {
  const { candles, indices, range, bias, sustainedN, windowEndTs } = params;
  const minSweep = minSweepPctForTier(bias.tier);
  const allowed = allowedDirectionsForBias(bias);
  type State = {
    sweepTs: number;
    runCount: number;
    confirmed: boolean;
    deadlineTs: number;
  };
  const states: Partial<Record<"LONG" | "SHORT", State>> = {};

  for (const idx of indices) {
    const c = candles[idx];
    if (!c) continue;
    if (c.ts >= windowEndTs) break;

    for (const direction of allowed) {
      let state = states[direction];

      if (state) {
        if (!state.confirmed) {
          if (closeBeyondRange(direction, c, range)) {
            state.runCount += 1;
            if (state.runCount >= sustainedN) {
              state.confirmed = true;
              state.deadlineTs = Math.min(twoSessionDeadlineFromSweepTs(state.sweepTs), windowEndTs);
            }
          } else {
            state = undefined;
            states[direction] = undefined;
          }
        } else {
          if (c.ts > state.deadlineTs) {
            state = undefined;
            states[direction] = undefined;
          } else if (closeInsideRange(direction, c, range)) {
            return { entryIndex: idx, direction };
          }
        }
      }

      if (!state) {
        const pct = breachPct(direction, c, range);
        const breach = pct >= minSweep + SWEEP_BREACH_MIN_PCT;
        const beyond = closeBeyondRange(direction, c, range);
        if (breach && beyond) {
          const next: State = {
            sweepTs: c.ts,
            runCount: 1,
            confirmed: sustainedN <= 1,
            deadlineTs: Math.min(twoSessionDeadlineFromSweepTs(c.ts), windowEndTs),
          };
          states[direction] = next;
        }
      }
    }
  }

  return null;
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

function weekIndicesForSymbol(candles: Candle[], weekOpen: DateTime, weekClose: DateTime) {
  const start = weekOpen.toMillis();
  const end = weekClose.toMillis();
  return candles
    .map((c, idx) => ({ ts: c.ts, idx }))
    .filter((r) => r.ts >= start && r.ts < end)
    .map((r) => r.idx);
}

function asiaLondonWindowIndices(candles: Candle[], rangeDay: string) {
  const nextDay = addDays(rangeDay, 1);
  const out: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    const day = getUtcDateKey(c.ts);
    if ((day === rangeDay && isNySessionCandle(c.ts)) || (day === nextDay && isAsiaSessionCandle(c.ts))) {
      out.push(i);
    }
  }
  return out;
}

function usWindowIndices(candles: Candle[], entryDay: string) {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (getUtcDateKey(c.ts) !== entryDay) continue;
    if (isAsiaLondonSessionCandle(c.ts)) out.push(i);
  }
  return out;
}

const STARTING_EQUITY_USD = 1000;

type ScenarioMetrics = {
  trades: number;
  winRatePct: number;
  totalPnlUsd: number;
  maxDrawdownPct: number;
  avgPnlUsd: number;
  profitFactor: number;
  bestWinUsd: number;
  worstLossUsd: number;
};

function computeScenarioMetrics(trades: TradeRecord[]): ScenarioMetrics {
  if (!trades.length) {
    return {
      trades: 0,
      winRatePct: 0,
      totalPnlUsd: 0,
      maxDrawdownPct: 0,
      avgPnlUsd: 0,
      profitFactor: 0,
      bestWinUsd: 0,
      worstLossUsd: 0,
    };
  }

  const ordered = [...trades].sort((a, b) => a.entryTs - b.entryTs || a.exitTs - b.exitTs);
  const pnlUsd = ordered.map((t) => STARTING_EQUITY_USD * (t.leveragedPnlPct / 100));
  const wins = pnlUsd.filter((v) => v > 0);
  const losses = pnlUsd.filter((v) => v < 0);
  const totalPnlUsd = pnlUsd.reduce((sum, v) => sum + v, 0);
  const avgPnlUsd = totalPnlUsd / pnlUsd.length;
  const winRatePct = (wins.length / pnlUsd.length) * 100;
  const grossWins = wins.reduce((sum, v) => sum + v, 0);
  const grossLossAbs = losses.reduce((sum, v) => sum + Math.abs(v), 0);
  const profitFactor = grossLossAbs > 0 ? grossWins / grossLossAbs : (grossWins > 0 ? Number.POSITIVE_INFINITY : 0);
  const bestWinUsd = wins.length ? Math.max(...wins) : 0;
  const worstLossUsd = losses.length ? Math.min(...losses) : 0;

  let equity = STARTING_EQUITY_USD;
  let peak = equity;
  let maxDd = 0;
  for (const pnl of pnlUsd) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    trades: pnlUsd.length,
    winRatePct,
    totalPnlUsd,
    maxDrawdownPct: maxDd,
    avgPnlUsd,
    profitFactor,
    bestWinUsd,
    worstLossUsd,
  };
}

async function main() {
  loadEnvFromFile();
  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) throw new Error("No crypto COT snapshots found.");

  console.log(`Running V3 sustained-deviation backtest across ${weekOpens.length} completed week(s)...`);
  console.log(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Sustained N values: ${SUSTAINED_N_VALUES.join(", ")}`);
  console.log(`Start leverages: ${START_LEVERAGES.join(", ")}x`);
  console.log(`Sweep threshold add-on: ${SWEEP_BREACH_MIN_PCT.toFixed(3)}%`);
  console.log("");

  const fundingBySymbol: Record<SymbolBase, FundingPoint[]> = {
    BTC: await fetchFundingHistory("BTC"),
    ETH: await fetchFundingHistory("ETH"),
  };

  const tradesByScenario = new Map<string, TradeRecord[]>();
  const biasByWeek = new Map<string, Record<SymbolBase, WeeklyBiasForSymbol>>();
  for (const n of SUSTAINED_N_VALUES) {
    for (const lev of START_LEVERAGES) {
      tradesByScenario.set(`${n}|${lev}`, []);
    }
  }

  for (const weekOpenUtc of weekOpens) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekDataOpen = weekOpen.minus({ days: 1 });
    const biasesBySymbol = await buildBiasBySymbolForWeek(weekOpenUtc, cotHistory, fundingBySymbol);
    biasByWeek.set(weekOpenUtc, biasesBySymbol);

    console.log(`Fetching candles for week ${weekOpenUtc.slice(0, 10)}...`);
    for (const symbol of SYMBOLS) {
      const bias = biasesBySymbol[symbol];
      console.log(`  ${symbol} bias: ${bias.direction} (${bias.tier})`);
    }

    const candlesBySymbol = {} as Record<SymbolBase, Candle[]>;
    const asiaLondonRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;
    const usRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;
    const weekIdxBySymbol = {} as Record<SymbolBase, number[]>;

    for (const symbol of SYMBOLS) {
      const rawM1 = await fetchRawM1Candles(symbol, weekDataOpen, weekClose);
      candlesBySymbol[symbol] = rawM1;
      asiaLondonRangesBySymbol[symbol] = buildDailyRanges(rawM1);
      usRangesBySymbol[symbol] = buildUsSessionRanges(rawM1);
      weekIdxBySymbol[symbol] = weekIndicesForSymbol(rawM1, weekOpen, weekClose);
      console.log(`  ${symbol} candles: m1=${rawM1.length}`);
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
        windowEndTs: number;
      }> = [
        {
          sessionWindow: "ASIA_LONDON_RANGE_NY_ENTRY",
          rangeForSymbol: (symbol) => asiaLondonRangesBySymbol[symbol].get(dayUtc),
          sessionIndicesForSymbol: (symbol) => asiaLondonWindowIndices(candlesBySymbol[symbol], dayUtc),
          windowEndTs: Math.min(dayHourTs(addDays(dayUtc, 1), 8), weekClose.toMillis()),
        },
        {
          sessionWindow: "US_RANGE_ASIA_LONDON_ENTRY",
          rangeForSymbol: (symbol) => usRangesBySymbol[symbol].get(previousUtcDateKey(dayUtc)),
          sessionIndicesForSymbol: (symbol) => usWindowIndices(candlesBySymbol[symbol], dayUtc),
          windowEndTs: Math.min(dayHourTs(dayUtc, 13), weekClose.toMillis()),
        },
      ];

      for (const sessionDef of sessionDefinitions) {
        for (const symbol of SYMBOLS) {
          const candles = candlesBySymbol[symbol];
          const range = sessionDef.rangeForSymbol(symbol);
          const sessionIndices = sessionDef.sessionIndicesForSymbol(symbol);
          if (!range?.locked || !sessionIndices.length || !candles.length) continue;

          for (const n of SUSTAINED_N_VALUES) {
            const entry = findV3Entry({
              candles,
              indices: sessionIndices,
              range,
              bias: biasesBySymbol[symbol],
              sustainedN: n,
              windowEndTs: sessionDef.windowEndTs,
            });
            if (!entry) continue;
            const entryCandle = candles[entry.entryIndex];
            if (!entryCandle || !(entryCandle.close > 0)) continue;

            for (const lev of START_LEVERAGES) {
              const sim = simulateScalingRisk(
                candles,
                weekIdxBySymbol[symbol],
                entry.entryIndex,
                entryCandle.close,
                entry.direction,
                lev,
                "WEEK_CLOSE",
              );
              const rawLevPct = sim.unleveredPnlPct * sim.pnlLeverage;
              const leveragedPnlPct = Math.max(-100, rawLevPct);
              tradesByScenario.get(`${n}|${lev}`)?.push({
                sustainedN: n,
                weekOpenUtc,
                dayUtc,
                symbol,
                sessionWindow: sessionDef.sessionWindow,
                direction: entry.direction,
                entryTs: entryCandle.ts,
                exitTs: sim.exitTs,
                entryPrice: entryCandle.close,
                exitPrice: sim.exitPrice,
                unleveredPnlPct: sim.unleveredPnlPct,
                leveragedPnlPct,
                exitReason: sim.exitReason,
                maxLeverageReached: sim.maxLeverageReached,
                breakevenReached: sim.breakevenReached,
                milestonesHit: sim.milestonesHit,
              });
            }
          }
        }
      }
    }
  }

  console.log("=== V3 BACKTEST RESULTS ===");
  console.log(`Weeks tested: [${weekOpens.map((w) => w.slice(0, 10)).join(", ")}]`);
  console.log("Bias:");
  for (const week of weekOpens) {
    const b = biasByWeek.get(week);
    if (!b) continue;
    console.log(`  ${week.slice(0, 10)} -> BTC:${b.BTC.direction}/${b.BTC.tier} ETH:${b.ETH.direction}/${b.ETH.tier}`);
  }
  console.log("");

  const metricsByKey = new Map<string, ScenarioMetrics>();
  for (const n of SUSTAINED_N_VALUES) {
    for (const lev of START_LEVERAGES) {
      const trades = tradesByScenario.get(`${n}|${lev}`) ?? [];
      metricsByKey.set(`${n}|${lev}`, computeScenarioMetrics(trades));
    }
  }

  const fiveLev = START_LEVERAGES.includes(5) ? 5 : START_LEVERAGES[0];
  const tenLev = START_LEVERAGES.includes(10) ? 10 : START_LEVERAGES[START_LEVERAGES.length - 1];

  console.log("| Threshold | Trades | WR % | Total PnL $ (5x) | Total PnL $ (10x) | Max DD % | PF | Avg PnL $ | Best Win $ | Worst Loss $ |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const n of SUSTAINED_N_VALUES) {
    const m5 = metricsByKey.get(`${n}|${fiveLev}`)!;
    const m10 = metricsByKey.get(`${n}|${tenLev}`)!;
    console.log(
      `| ${n} min | ${m5.trades} | ${fmt2(m5.winRatePct)} | ${fmt2(m5.totalPnlUsd)} | ${fmt2(m10.totalPnlUsd)} | ${fmt2(m5.maxDrawdownPct)} / ${fmt2(m10.maxDrawdownPct)} | ${fmt2(m5.profitFactor)} / ${fmt2(m10.profitFactor)} | ${fmt2(m5.avgPnlUsd)} / ${fmt2(m10.avgPnlUsd)} | ${fmt2(m5.bestWinUsd)} / ${fmt2(m10.bestWinUsd)} | ${fmt2(m5.worstLossUsd)} / ${fmt2(m10.worstLossUsd)} |`,
    );
  }
  console.log("| V2 baseline | 18 | 87.50 | ~112 | — | 6.19 | — | — | — | — |");
}

main()
  .catch((error) => {
    console.error("analyze-bitget-v3-sustained-reentry-backtest failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
