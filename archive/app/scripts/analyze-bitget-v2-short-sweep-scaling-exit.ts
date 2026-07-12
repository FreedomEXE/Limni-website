/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: analyze-bitget-v2-short-sweep-scaling-exit.ts
 *
 * Description:
 * Applies Bitget v2 scaling exit logic to every bias-aligned SHORT
 * sweep (entry at sweep candle close), replacing fixed TP/SL.
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
  weekOpenUtc: string;
  dayUtc: string;
  symbol: SymbolBase;
  sessionWindow: SessionWindow;
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
  weekIndices: number[];
  range: DailyRange;
  bias: WeeklyBiasForSymbol;
  startLeverage: number;
}): TradeRecord[] {
  const {
    symbol,
    weekOpenUtc,
    dayUtc,
    sessionWindow,
    candles,
    sessionIndices,
    bias,
    weekIndices,
    range,
    startLeverage,
  } = params;

  if (!isAlignedShort(bias)) return [];

  const out: TradeRecord[] = [];
  type Active = { startIdx: number };
  let active: Active | null = null;

  const finalize = () => {
    if (!active) return;
    const entryCandle = candles[active.startIdx];
    if (!entryCandle || !(entryCandle.close > 0)) {
      active = null;
      return;
    }

    const sim = simulateScalingRisk(
      candles,
      weekIndices,
      active.startIdx,
      entryCandle.close,
      "SHORT",
      startLeverage,
      "WEEK_CLOSE",
    );
    const rawLevPct = sim.unleveredPnlPct * sim.pnlLeverage;
    const leveragedPnlPct = Math.max(-100, rawLevPct);
    out.push({
      weekOpenUtc,
      dayUtc,
      symbol,
      sessionWindow,
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

    active = null;
  };

  for (let pos = 0; pos < sessionIndices.length; pos += 1) {
    const idx = sessionIndices[pos];
    const c = candles[idx];
    if (!c) continue;

    const overshootPct = ((c.high - range.high) / range.high) * 100;
    const breached = overshootPct > SWEEP_BREACH_MIN_PCT;

    if (breached && !active) {
      active = { startIdx: idx };
    }

    if (active) {
      const reenteredThisBar = c.low <= range.high;
      if (!breached || reenteredThisBar) {
        finalize();
      }
    }
  }

  if (active) finalize();

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

function printReport(startLeverage: number, trades: TradeRecord[]) {
  const wins = trades.filter((t) => t.leveragedPnlPct > 0).length;
  const losses = trades.filter((t) => t.leveragedPnlPct < 0).length;
  const flats = trades.length - wins - losses;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const baselineWinRate = 87.5;

  const byExit = new Map<ExitReason, number>();
  for (const t of trades) byExit.set(t.exitReason, (byExit.get(t.exitReason) ?? 0) + 1);

  const milestoneCounts = new Map<number, number>();
  for (const m of SCALING_MILESTONES) milestoneCounts.set(m, 0);
  for (const t of trades) {
    for (const m of t.milestonesHit) milestoneCounts.set(m, (milestoneCounts.get(m) ?? 0) + 1);
  }

  console.log(`=== SCALING EXIT RESULTS (${startLeverage}x START) ===`);
  console.log(`Total aligned SHORT sweeps: ${trades.length}`);
  console.log(`Wins: ${wins}  Losses: ${losses}  Flats: ${flats}`);
  console.log(`Win rate: ${fmt2(winRate)}% (baseline 87.5%, delta ${fmt2(winRate - baselineWinRate)} pp)`);
  console.log("");
  console.log("Exit reasons:");
  for (const reason of ["STOP_LOSS", "BREAKEVEN_STOP", "TRAILING_STOP", "WEEK_CLOSE"] as ExitReason[]) {
    const count = byExit.get(reason) ?? 0;
    console.log(`  ${reason}: ${count} (${fmt2(trades.length ? (count / trades.length) * 100 : 0)}%)`);
  }
  console.log("");

  printStatsBlock("Unlevered PnL %:", trades.map((t) => t.unleveredPnlPct));
  printStatsBlock("Leveraged PnL % (clamped at -100):", trades.map((t) => t.leveragedPnlPct));
  printStatsBlock("Max leverage reached:", trades.map((t) => t.maxLeverageReached));

  const beCount = trades.filter((t) => t.breakevenReached).length;
  console.log(`Breakeven reached: ${beCount} (${fmt2(trades.length ? (beCount / trades.length) * 100 : 0)}%)`);
  for (const milestone of SCALING_MILESTONES) {
    const count = milestoneCounts.get(milestone) ?? 0;
    console.log(`Milestone ${milestone}% hit: ${count} (${fmt2(trades.length ? (count / trades.length) * 100 : 0)}%)`);
  }
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

async function main() {
  loadEnvFromFile();
  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) throw new Error("No crypto COT snapshots found.");

  console.log(`Applying scaling exits to aligned SHORT sweeps across ${weekOpens.length} completed week(s)...`);
  console.log(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Start leverages: ${START_LEVERAGES.join(", ")}x`);
  console.log(`Sweep breach threshold: ${SWEEP_BREACH_MIN_PCT.toFixed(3)}%`);
  console.log("");

  const fundingBySymbol: Record<SymbolBase, FundingPoint[]> = {
    BTC: await fetchFundingHistory("BTC"),
    ETH: await fetchFundingHistory("ETH"),
  };

  const tradesByLeverage = new Map<number, TradeRecord[]>();
  for (const lev of START_LEVERAGES) tradesByLeverage.set(lev, []);

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
    const weekIdxBySymbol = {} as Record<SymbolBase, number[]>;

    for (const symbol of SYMBOLS) {
      const rawM1 = await fetchRawM1Candles(symbol, weekDataOpen, weekClose);
      const m5 = aggregateM1ToM5(rawM1);
      candlesBySymbol[symbol] = m5;
      asiaLondonRangesBySymbol[symbol] = buildDailyRanges(m5);
      usRangesBySymbol[symbol] = buildUsSessionRanges(m5);
      weekIdxBySymbol[symbol] = weekIndicesForSymbol(m5, weekOpen, weekClose);
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

          for (const lev of START_LEVERAGES) {
            const trades = scanAlignedShortSweeps({
              symbol,
              weekOpenUtc,
              dayUtc,
              sessionWindow: sessionDef.sessionWindow,
              candles,
              sessionIndices,
              weekIndices: weekIdxBySymbol[symbol],
              range,
              bias: biasesBySymbol[symbol],
              startLeverage: lev,
            });
            tradesByLeverage.get(lev)?.push(...trades);
          }
        }
      }
    }
  }

  console.log("");
  for (const lev of START_LEVERAGES) {
    printReport(lev, tradesByLeverage.get(lev) ?? []);
  }
}

main()
  .catch((error) => {
    console.error("analyze-bitget-v2-short-sweep-scaling-exit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
