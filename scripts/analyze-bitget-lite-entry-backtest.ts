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

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { getPool, query } from "../src/lib/db";
import { classifyWeeklyBias } from "../src/lib/bitgetBotSignals";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { upsertStrategyBacktestSnapshot } from "../src/lib/performance/strategyBacktestStore";

type SymbolBase = string;
type CoreSymbol = "BTC" | "ETH";
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

type WeeklyBiasForSymbol = {
  direction: Direction;
  tier: ConfidenceTier;
};

type SnapshotRow = {
  week_open_utc: Date;
  asset_class: string;
  model: string;
  pair_details:
    | Array<{
      pair?: string;
      direction?: Direction | null;
    }>
    | string
    | null;
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

type ExecutedTrade = TradeRecord & {
  equityAtEntryUsd: number;
  marginUsd: number;
  pnlUsd: number;
};

type EntryConfig = {
  dwell: number;
  closeLocation: number;
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

type WeeklyAltRecommendationsFile = {
  weeklyRecommendations?: Array<{
    weekOpenUtc?: string;
    recommendedSymbols?: string[];
  }>;
};

const CORE_SYMBOLS: CoreSymbol[] = ["BTC", "ETH"];
const FALLBACK_ALT_SYMBOLS = [
  "SOL", "XRP", "SUI", "LINK", "DOGE", "ADA", "BNB", "PEPE", "UNI", "AVAX",
  "PENGU", "ZEC", "LTC", "HYPE", "NEAR", "PUMP", "HBAR", "TAO", "ENA", "WLD",
  "FARTCOIN", "AAVE", "ONDO", "SHIB", "SEI", "ASTER", "VIRTUAL", "DOT", "APT", "BCH",
];
const WEEKS_TO_BACKTEST = Number(process.env.BACKTEST_WEEKS ?? "5");
const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
const BACKTEST_INCLUDE_SUNDAYS = process.env.BACKTEST_INCLUDE_SUNDAYS === "1";
const SWEEP_MIN_PCT = Number(process.env.BITGET_LITE_SWEEP_MIN_PCT ?? "0.1");
const BITGET_MAX_RETRIES = Number(process.env.BITGET_FETCH_RETRIES ?? "6");
const BITGET_RETRY_BASE_MS = Number(process.env.BITGET_RETRY_BASE_MS ?? "500");
const BITGET_SYMBOL_DELAY_MS = Number(process.env.BITGET_SYMBOL_DELAY_MS ?? "500");
const START_LEVERAGE = Number(process.env.BITGET_LITE_START_LEVERAGE ?? "5");
const STARTING_EQUITY_USD = Number(process.env.BITGET_LITE_START_EQUITY_USD ?? "10000");
const ALLOCATION_PCT = Number(process.env.BITGET_LITE_ALLOCATION_PCT ?? "0.5");
const RUN_ALT_UNIVERSE = process.env.BITGET_LITE_RUN_ALT_UNIVERSE === "0" ? false : true;
const DWELL_VALUES = (process.env.BITGET_LITE_DWELL_VALUES ?? "2,3,5")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v >= 1)
  .sort((a, b) => a - b);
const CLOSE_LOCATION_VALUES = (process.env.BITGET_LITE_CLOSE_LOC_VALUES ?? "0.35,0.40,0.45")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v > 0 && v < 1)
  .sort((a, b) => a - b);
const REPORT_PATH = path.join(process.cwd(), "reports", "bitget-lite-entry-latest.txt");
const JSON_REPORT_PATH = path.join(process.cwd(), "reports", "bitget-lite-entry-latest.json");

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

function parsePairDetails(value: SnapshotRow["pair_details"]) {
  if (!value) return [] as Array<{ pair: string; direction: Direction }>;
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        pair: String(item?.pair ?? "").toUpperCase(),
        direction:
          item?.direction === "LONG" || item?.direction === "SHORT" || item?.direction === "NEUTRAL"
            ? item.direction
            : "NEUTRAL",
      }))
      .filter((item) => item.pair.length > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsePairDetails(parsed as SnapshotRow["pair_details"]);
    } catch {
      return [];
    }
  }
  return [];
}

async function loadBtcBiasByWeek(weeks: string[]): Promise<Map<string, WeeklyBiasForSymbol>> {
  const rows = await query<SnapshotRow>(
    `SELECT week_open_utc, asset_class, model, pair_details
     FROM performance_snapshots
     WHERE week_open_utc = ANY($1::timestamptz[])
       AND asset_class = 'crypto'
       AND model = ANY($2::text[])`,
    [weeks, ["dealer", "commercial", "sentiment"]],
  );

  const byWeekModel = new Map<string, Map<string, Direction>>();
  for (const week of weeks) byWeekModel.set(week, new Map<string, Direction>());

  for (const row of rows) {
    const week = row.week_open_utc.toISOString();
    const map = byWeekModel.get(week);
    if (!map) continue;
    const details = parsePairDetails(row.pair_details);
    const btcDirection = details.find((d) => d.pair === "BTCUSD" || d.pair === "BTCUSDT")?.direction ?? "NEUTRAL";
    map.set(String(row.model).toLowerCase(), btcDirection);
  }

  const out = new Map<string, WeeklyBiasForSymbol>();
  for (const week of weeks) {
    const map = byWeekModel.get(week) ?? new Map<string, Direction>();
    const dealer = map.get("dealer") ?? "NEUTRAL";
    const commercial = map.get("commercial") ?? "NEUTRAL";
    const sentiment = map.get("sentiment") ?? "NEUTRAL";
    const cls = classifyWeeklyBias(dealer, commercial, sentiment);
    out.set(week, { direction: cls.direction, tier: cls.tier });
  }
  return out;
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

function closeLocationPass(candle: Candle, direction: "LONG" | "SHORT", pct: number) {
  const span = candle.high - candle.low;
  if (!(span > 0)) return false;
  if (direction === "SHORT") {
    const closeFromLowPct = (candle.close - candle.low) / span;
    return closeFromLowPct <= pct;
  }
  const closeFromHighPct = (candle.high - candle.close) / span;
  return closeFromHighPct <= pct;
}

function findLiteEntry(params: {
  candles: Candle[];
  indices: number[];
  range: DailyRange;
  direction: "LONG" | "SHORT";
  dwell: number;
  closeLocation: number;
  windowEndTs: number;
}): { entryIndex: number; direction: "LONG" | "SHORT" } | null {
  const { candles, indices, range, direction, dwell, closeLocation, windowEndTs } = params;
  let hasSweep = false;
  let dwellCount = 0;

  for (const idx of indices) {
    const c = candles[idx];
    if (!c) continue;
    if (c.ts >= windowEndTs) break;

    const pct = breachPct(direction, c, range);
    const beyond = closeBeyondRange(direction, c, range);
    const inside = closeInsideRange(direction, c, range);

    if (!hasSweep) {
      if (pct >= SWEEP_MIN_PCT && pct > 0) {
        hasSweep = true;
        dwellCount = beyond ? 1 : 0;
        if (inside && dwellCount >= dwell && closeLocationPass(c, direction, closeLocation)) {
          return { entryIndex: idx, direction };
        }
      }
      continue;
    }

    if (beyond) {
      dwellCount += 1;
      continue;
    }

    if (inside && dwellCount >= dwell && closeLocationPass(c, direction, closeLocation)) {
      return { entryIndex: idx, direction };
    }

    hasSweep = false;
    dwellCount = 0;
  }

  return null;
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

function loadWeeklyRecommendationsForWeeks(weekOpens: string[]) {
  const rankingsPath = path.join(process.cwd(), "docs", "bots", "alt-pair-rankings.json");
  const weekSet = new Set(weekOpens);
  const weekToAlts = new Map<string, string[]>();
  const union = new Set<string>();

  try {
    const raw = readFileSync(rankingsPath, "utf8");
    const parsed = JSON.parse(raw) as WeeklyAltRecommendationsFile;
    for (const rec of parsed.weeklyRecommendations ?? []) {
      const weekOpenUtc = String(rec.weekOpenUtc ?? "");
      if (!weekSet.has(weekOpenUtc)) continue;
      const symbols = Array.from(
        new Set(
          (rec.recommendedSymbols ?? [])
            .map((s) => String(s).trim().toUpperCase())
            .filter((s) => Boolean(s) && !CORE_SYMBOLS.includes(s as CoreSymbol)),
        ),
      );
      weekToAlts.set(weekOpenUtc, symbols);
      for (const symbol of symbols) union.add(symbol);
    }
  } catch {
    // fallback below
  }

  if (!union.size) {
    for (const week of weekOpens) weekToAlts.set(week, [...FALLBACK_ALT_SYMBOLS]);
    for (const symbol of FALLBACK_ALT_SYMBOLS) union.add(symbol);
  }

  return {
    weekToAlts,
    unionAlts: Array.from(union),
  };
}

function lowerBoundCandles(candles: Candle[], ts: number) {
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (candles[mid].ts < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sliceCandles(candles: Candle[], startTs: number, endTs: number) {
  const from = lowerBoundCandles(candles, startTs);
  const to = lowerBoundCandles(candles, endTs);
  return candles.slice(from, to);
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

type SimpleBacktestTradeRow = {
  symbol: string;
  direction: "LONG" | "SHORT";
  entry_time_utc: string;
  exit_time_utc: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  pnl_usd: number;
  exit_reason: string;
  max_milestone: number;
  leverage_at_exit: number;
};

type SimpleBacktestWeeklyRow = {
  week_open_utc: string;
  trades: number;
  wins: number;
  losses: number;
  pnl_usd: number;
  pnl_pct: number;
  max_drawdown_pct: number;
};

type SimpleBacktestReport = {
  meta: {
    botId: string;
    market: "crypto_futures";
    generatedUtc: string;
    weeks: string[];
    selectedConfig: string;
    startEquityUsd: number;
    allocationPct: number;
    startLeverage: number;
  };
  weekly: SimpleBacktestWeeklyRow[];
  summary: {
    total_trades: number;
    total_pnl_usd: number;
    total_return_pct: number;
    win_rate_pct: number;
    max_drawdown_pct: number;
    avg_pnl_pct: number;
    profit_factor: number | null;
  };
  trades: SimpleBacktestTradeRow[];
};

function deriveWeekOpenUtcFromIso(isoUtc: string | null | undefined) {
  if (!isoUtc) return null;
  const parsed = DateTime.fromISO(isoUtc, { zone: "utc" });
  if (!parsed.isValid) return null;
  return getCanonicalWeekOpenUtc(parsed);
}

async function persistLiteCryptoReportToDb(report: SimpleBacktestReport) {
  if (!process.env.DATABASE_URL) {
    console.log("DB upsert skipped: DATABASE_URL is not configured.");
    return;
  }

  let runningEquityPct = 0;
  const weeklyRows = report.weekly.map((week) => {
    const grossProfitPct = Math.max(0, week.pnl_pct);
    const grossLossPct = Math.abs(Math.min(0, week.pnl_pct));
    runningEquityPct += week.pnl_pct;
    return {
      weekOpenUtc: week.week_open_utc,
      returnPct: week.pnl_pct,
      trades: week.trades,
      wins: week.wins,
      losses: week.losses,
      stopHits: 0,
      drawdownPct: week.max_drawdown_pct,
      grossProfitPct,
      grossLossPct,
      equityEndPct: runningEquityPct,
      pnlUsd: week.pnl_usd,
    };
  });

  const tradeRows = report.trades.flatMap((trade) => {
    const weekOpenUtc = deriveWeekOpenUtcFromIso(trade.entry_time_utc);
    if (!weekOpenUtc) return [];
    return [{
      weekOpenUtc,
      symbol: trade.symbol,
      direction: trade.direction,
      entryTimeUtc: trade.entry_time_utc,
      exitTimeUtc: trade.exit_time_utc,
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      pnlPct: trade.pnl_pct,
      pnlUsd: trade.pnl_usd,
      exitReason: trade.exit_reason,
      maxMilestone: trade.max_milestone,
      leverageAtExit: trade.leverage_at_exit,
      metadata: {
        selected_config: report.meta.selectedConfig,
      },
    }];
  });

  const result = await upsertStrategyBacktestSnapshot({
    run: {
      botId: report.meta.botId,
      variant: "lite",
      market: report.meta.market,
      strategyName: "Katarakti Lite (Crypto Futures)",
      backtestWeeks: report.meta.weeks.length,
      positionAllocationPct: report.meta.allocationPct,
      generatedUtc: report.meta.generatedUtc,
      configJson: {
        selectedConfig: report.meta.selectedConfig,
        startEquityUsd: report.meta.startEquityUsd,
        startLeverage: report.meta.startLeverage,
        allocationPct: report.meta.allocationPct,
        weeks: report.meta.weeks,
      },
    },
    weekly: weeklyRows,
    trades: tradeRows,
  });

  console.log(
    `DB upsert complete (lite crypto): run_id=${result.runId}, weekly=${result.weeklyUpserted}, trades=${result.tradesInserted}`,
  );
}

function equityAtEntry(startEquity: number, executed: ExecutedTrade[], entryTs: number) {
  let equity = startEquity;
  for (const trade of executed) {
    if (trade.exitTs <= entryTs) equity += trade.pnlUsd;
  }
  return equity;
}

function hasOpenPositionSameSymbol(executed: ExecutedTrade[], symbol: string, entryTs: number) {
  return executed.some((t) => t.symbol === symbol && t.entryTs <= entryTs && t.exitTs > entryTs);
}

function executeWithSizing(candidates: TradeRecord[]): ExecutedTrade[] {
  const ordered = [...candidates].sort((a, b) => a.entryTs - b.entryTs || a.exitTs - b.exitTs);
  const out: ExecutedTrade[] = [];
  for (const trade of ordered) {
    if (hasOpenPositionSameSymbol(out, trade.symbol, trade.entryTs)) continue;
    const eq = equityAtEntry(STARTING_EQUITY_USD, out, trade.entryTs);
    if (!(eq > 0)) continue;
    const marginUsd = eq * ALLOCATION_PCT;
    const pnlUsd = marginUsd * (trade.leveragedPnlPct / 100);
    out.push({
      ...trade,
      equityAtEntryUsd: eq,
      marginUsd,
      pnlUsd,
    });
  }
  return out;
}

function computeScenarioMetrics(executed: ExecutedTrade[]): ScenarioMetrics {
  if (!executed.length) {
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

  const pnlUsd = executed.map((t) => t.pnlUsd);
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
  const byExit = [...executed].sort((a, b) => a.exitTs - b.exitTs || a.entryTs - b.entryTs);
  for (const trade of byExit) {
    equity += trade.pnlUsd;
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

function buildHourlyReturnsFromM1(candles: Candle[]) {
  const hourlyClose = new Map<number, { ts: number; close: number }>();
  for (const candle of candles) {
    const bucket = Math.floor(candle.ts / 3_600_000) * 3_600_000;
    const prev = hourlyClose.get(bucket);
    if (!prev || candle.ts > prev.ts) hourlyClose.set(bucket, { ts: candle.ts, close: candle.close });
  }
  const series = Array.from(hourlyClose.entries())
    .map(([bucket, row]) => ({ bucket, close: row.close }))
    .sort((a, b) => a.bucket - b.bucket);
  const out: Array<{ ts: number; ret: number }> = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1];
    const curr = series[i];
    if (!(prev.close > 0) || !(curr.close > 0)) continue;
    out.push({ ts: curr.bucket, ret: (curr.close - prev.close) / prev.close });
  }
  return out;
}

function computePearson(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 2) return null;
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (!(varX > 0) || !(varY > 0)) return null;
  return cov / Math.sqrt(varX * varY);
}

function computeWindowCorrelation(
  symbolReturns: Array<{ ts: number; ret: number }>,
  btcReturns: Array<{ ts: number; ret: number }>,
  startTs: number,
  endTs: number,
) {
  const btcMap = new Map<number, number>();
  for (const row of btcReturns) {
    if (row.ts >= startTs && row.ts < endTs) btcMap.set(row.ts, row.ret);
  }
  const x: number[] = [];
  const y: number[] = [];
  for (const row of symbolReturns) {
    if (row.ts < startTs || row.ts >= endTs) continue;
    const b = btcMap.get(row.ts);
    if (b === undefined) continue;
    x.push(row.ret);
    y.push(b);
  }
  if (x.length < 24) return null;
  return computePearson(x, y);
}

function avgMin(values: Array<number | null>) {
  const clean = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!clean.length) return { avg: null as number | null, min: null as number | null };
  return {
    avg: clean.reduce((s, v) => s + v, 0) / clean.length,
    min: Math.min(...clean),
  };
}

function fmtCorr(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(3);
}

function fmtPf(value: number) {
  if (!Number.isFinite(value)) return "INF";
  return value.toFixed(2);
}

function round(value: number, digits = 6) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function buildSimpleBacktestReport(options: {
  botId: string;
  weekOpens: string[];
  selectedConfig: string;
  executed: ExecutedTrade[];
  startEquityUsd: number;
}): SimpleBacktestReport {
  const executed = [...options.executed].sort((a, b) => a.entryTs - b.entryTs || a.exitTs - b.exitTs);
  let rollingWeekStartEquity = options.startEquityUsd;
  const weekly: SimpleBacktestWeeklyRow[] = options.weekOpens.map((weekOpenUtc) => {
    const weekTrades = executed
      .filter((trade) => trade.weekOpenUtc === weekOpenUtc)
      .sort((a, b) => a.exitTs - b.exitTs || a.entryTs - b.entryTs);
    let equity = rollingWeekStartEquity;
    let peak = equity;
    let maxDrawdownPct = 0;
    let pnlUsd = 0;
    let wins = 0;
    let losses = 0;
    for (const trade of weekTrades) {
      pnlUsd += trade.pnlUsd;
      if (trade.pnlUsd > 0) wins += 1;
      if (trade.pnlUsd < 0) losses += 1;
      equity += trade.pnlUsd;
      if (equity > peak) peak = equity;
      if (peak > 0) {
        const drawdownPct = ((peak - equity) / peak) * 100;
        if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;
      }
    }
    rollingWeekStartEquity += pnlUsd;
    return {
      week_open_utc: weekOpenUtc,
      trades: weekTrades.length,
      wins,
      losses,
      pnl_usd: round(pnlUsd),
      pnl_pct: round(options.startEquityUsd > 0 ? (pnlUsd / options.startEquityUsd) * 100 : 0),
      max_drawdown_pct: round(maxDrawdownPct),
    };
  });

  const totalPnlUsd = executed.reduce((sum, trade) => sum + trade.pnlUsd, 0);
  const totalTrades = executed.length;
  const wins = executed.filter((trade) => trade.pnlUsd > 0).length;
  const grossWins = executed
    .filter((trade) => trade.pnlUsd > 0)
    .reduce((sum, trade) => sum + trade.pnlUsd, 0);
  const grossLossAbs = Math.abs(
    executed
      .filter((trade) => trade.pnlUsd < 0)
      .reduce((sum, trade) => sum + trade.pnlUsd, 0),
  );
  const maxDrawdownPct = weekly.reduce((max, row) => Math.max(max, row.max_drawdown_pct), 0);
  const avgPnlPct = totalTrades > 0
    ? executed.reduce((sum, trade) => {
      const entryEq = trade.equityAtEntryUsd > 0 ? trade.equityAtEntryUsd : options.startEquityUsd;
      return sum + (entryEq > 0 ? (trade.pnlUsd / entryEq) * 100 : 0);
    }, 0) / totalTrades
    : 0;

  const trades: SimpleBacktestTradeRow[] = executed.map((trade) => {
    const entryEq = trade.equityAtEntryUsd > 0 ? trade.equityAtEntryUsd : options.startEquityUsd;
    return {
      symbol: trade.symbol,
      direction: trade.direction,
      entry_time_utc: new Date(trade.entryTs).toISOString(),
      exit_time_utc: new Date(trade.exitTs).toISOString(),
      entry_price: round(trade.entryPrice),
      exit_price: round(trade.exitPrice),
      pnl_pct: round(entryEq > 0 ? (trade.pnlUsd / entryEq) * 100 : 0),
      pnl_usd: round(trade.pnlUsd),
      exit_reason: trade.exitReason.toLowerCase(),
      max_milestone: trade.milestonesHit.length > 0 ? Math.max(...trade.milestonesHit) : 0,
      leverage_at_exit: trade.maxLeverageReached,
    };
  });

  return {
    meta: {
      botId: options.botId,
      market: "crypto_futures",
      generatedUtc: new Date().toISOString(),
      weeks: [...options.weekOpens],
      selectedConfig: options.selectedConfig,
      startEquityUsd: options.startEquityUsd,
      allocationPct: ALLOCATION_PCT,
      startLeverage: START_LEVERAGE,
    },
    weekly,
    summary: {
      total_trades: totalTrades,
      total_pnl_usd: round(totalPnlUsd),
      total_return_pct: round(options.startEquityUsd > 0 ? (totalPnlUsd / options.startEquityUsd) * 100 : 0),
      win_rate_pct: round(totalTrades > 0 ? (wins / totalTrades) * 100 : 0),
      max_drawdown_pct: round(maxDrawdownPct),
      avg_pnl_pct: round(avgPnlPct),
      profit_factor: grossLossAbs > 0 ? round(grossWins / grossLossAbs) : (grossWins > 0 ? Number.POSITIVE_INFINITY : null),
    },
    trades,
  };
}

// mainOld removed — dead code with broken readSnapshotHistory reference
// (helpers below were shared with mainLite and are still needed)

function buildSymbolsForWeek(weekOpens: string[], weekToAlts: Map<string, string[]>, includeAlts: boolean) {
  const out = new Map<string, Set<string>>();
  for (const week of weekOpens) {
    const set = new Set<string>(CORE_SYMBOLS);
    if (includeAlts) {
      for (const alt of weekToAlts.get(week) ?? []) set.add(alt);
    }
    out.set(week, set);
  }
  return out;
}

function runLiteScenario(params: {
  weekOpens: string[];
  symbolsForWeek: Map<string, Set<string>>;
  biasByWeek: Map<string, WeeklyBiasForSymbol>;
  candlesBySymbol: Map<string, Candle[]>;
  config: EntryConfig;
}) {
  const { weekOpens, symbolsForWeek, biasByWeek, candlesBySymbol, config } = params;
  const candidates: TradeRecord[] = [];

  for (const weekOpenUtc of weekOpens) {
    const weekBias = biasByWeek.get(weekOpenUtc);
    if (!weekBias || weekBias.direction === "NEUTRAL" || weekBias.tier === "NEUTRAL") continue;
    const direction = weekBias.direction as "LONG" | "SHORT";
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekDataOpen = weekOpen.minus({ days: 1 });
    const weekDataOpenMs = weekDataOpen.toMillis();
    const weekCloseMs = weekClose.toMillis();
    const weekSymbols = symbolsForWeek.get(weekOpenUtc) ?? new Set<string>();

    const perSymbol = new Map<string, {
      candles: Candle[];
      asiaLondonRanges: Map<string, DailyRange>;
      usRanges: Map<string, DailyRange>;
      weekIndices: number[];
    }>();

    for (const symbol of weekSymbols) {
      const allCandles = candlesBySymbol.get(symbol);
      if (!allCandles?.length) continue;
      const weekCandles = sliceCandles(allCandles, weekDataOpenMs, weekCloseMs);
      const expectedM1 = (weekCloseMs - weekDataOpenMs) / 60_000;
      const coverage = expectedM1 > 0 ? weekCandles.length / expectedM1 : 0;
      if (!weekCandles.length || coverage < 0.7) continue;
      perSymbol.set(symbol, {
        candles: weekCandles,
        asiaLondonRanges: buildDailyRanges(weekCandles),
        usRanges: buildUsSessionRanges(weekCandles),
        weekIndices: weekIndicesForSymbol(weekCandles, weekOpen, weekClose),
      });
    }

    const dateKeys: string[] = [];
    for (let d = weekOpen.startOf("day"); d < weekClose; d = d.plus({ days: 1 })) {
      const key = d.toISODate();
      if (key) dateKeys.push(key);
    }

    for (const dayUtc of dateKeys) {
      if (!BACKTEST_INCLUDE_SUNDAYS && isSundayUtc(dayUtc)) continue;
      for (const symbol of weekSymbols) {
        const state = perSymbol.get(symbol);
        if (!state) continue;
        const { candles, asiaLondonRanges, usRanges, weekIndices } = state;
        if (!weekIndices.length) continue;

        const sessionDefinitions: Array<{
          sessionWindow: SessionWindow;
          range: DailyRange | undefined;
          sessionIndices: number[];
          windowEndTs: number;
        }> = [
          {
            sessionWindow: "ASIA_LONDON_RANGE_NY_ENTRY",
            range: asiaLondonRanges.get(dayUtc),
            sessionIndices: asiaLondonWindowIndices(candles, dayUtc),
            windowEndTs: Math.min(dayHourTs(addDays(dayUtc, 1), 8), weekCloseMs),
          },
          {
            sessionWindow: "US_RANGE_ASIA_LONDON_ENTRY",
            range: usRanges.get(previousUtcDateKey(dayUtc)),
            sessionIndices: usWindowIndices(candles, dayUtc),
            windowEndTs: Math.min(dayHourTs(dayUtc, 13), weekCloseMs),
          },
        ];

        for (const session of sessionDefinitions) {
          if (!session.range?.locked || !session.sessionIndices.length) continue;
          const entry = findLiteEntry({
            candles,
            indices: session.sessionIndices,
            range: session.range,
            direction,
            dwell: config.dwell,
            closeLocation: config.closeLocation,
            windowEndTs: session.windowEndTs,
          });
          if (!entry) continue;
          const entryCandle = candles[entry.entryIndex];
          if (!entryCandle || !(entryCandle.close > 0)) continue;
          const sim = simulateScalingRisk(
            candles,
            weekIndices,
            entry.entryIndex,
            entryCandle.close,
            direction,
            START_LEVERAGE,
            "WEEK_CLOSE",
          );
          candidates.push({
            weekOpenUtc,
            dayUtc,
            symbol,
            sessionWindow: session.sessionWindow,
            direction,
            entryTs: entryCandle.ts,
            exitTs: sim.exitTs,
            entryPrice: entryCandle.close,
            exitPrice: sim.exitPrice,
            unleveredPnlPct: sim.unleveredPnlPct,
            leveragedPnlPct: Math.max(-100, sim.unleveredPnlPct * sim.pnlLeverage),
            exitReason: sim.exitReason,
            maxLeverageReached: sim.maxLeverageReached,
            breakevenReached: sim.breakevenReached,
            milestonesHit: sim.milestonesHit,
          });
        }
      }
    }
  }

  const executed = executeWithSizing(candidates);
  const metrics = computeScenarioMetrics(executed);
  return { candidates, executed, metrics };
}

function bestGridRun<T extends { config: EntryConfig; metrics: ScenarioMetrics }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (b.metrics.totalPnlUsd !== a.metrics.totalPnlUsd) return b.metrics.totalPnlUsd - a.metrics.totalPnlUsd;
    if (b.metrics.profitFactor !== a.metrics.profitFactor) return b.metrics.profitFactor - a.metrics.profitFactor;
    if (a.metrics.maxDrawdownPct !== b.metrics.maxDrawdownPct) return a.metrics.maxDrawdownPct - b.metrics.maxDrawdownPct;
    return b.metrics.trades - a.metrics.trades;
  })[0];
}

async function mainLite() {
  loadEnvFromFile();
  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const biasByWeek = await loadBtcBiasByWeek(weekOpens);
  const { weekToAlts, unionAlts } = loadWeeklyRecommendationsForWeeks(weekOpens);
  const firstWeekOpen = DateTime.fromISO(weekOpens[0], { zone: "utc" });
  const lastWeekOpen = DateTime.fromISO(weekOpens[weekOpens.length - 1], { zone: "utc" });
  const globalOpen = firstWeekOpen.minus({ days: 7 });
  const globalClose = lastWeekOpen.plus({ weeks: 1 });

  const candlesBySymbol = new Map<string, Candle[]>();
  const fetchFailures: Array<{ symbol: string; reason: string }> = [];

  const coreSymbols = [...CORE_SYMBOLS];
  console.log("Fetching BTC+ETH candles...");
  for (let i = 0; i < coreSymbols.length; i += 1) {
    const symbol = coreSymbols[i];
    try {
      const candles = await fetchRawM1Candles(symbol, globalOpen, globalClose);
      if (candles.length) candlesBySymbol.set(symbol, candles);
      else fetchFailures.push({ symbol, reason: "empty_candles" });
      console.log(`  ${symbol}: m1=${candles.length}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      fetchFailures.push({ symbol, reason });
      console.log(`  ${symbol}: fetch failed (${reason})`);
    }
    if (i < coreSymbols.length - 1) await sleep(BITGET_SYMBOL_DELAY_MS);
  }

  const gridRuns: Array<{ config: EntryConfig; metrics: ScenarioMetrics; executed: ExecutedTrade[] }> = [];
  const coreWeekSymbols = buildSymbolsForWeek(weekOpens, weekToAlts, false);
  for (const dwell of DWELL_VALUES) {
    for (const closeLocation of CLOSE_LOCATION_VALUES) {
      const config: EntryConfig = { dwell, closeLocation };
      const run = runLiteScenario({
        weekOpens,
        symbolsForWeek: coreWeekSymbols,
        biasByWeek,
        candlesBySymbol,
        config,
      });
      gridRuns.push({ config, metrics: run.metrics, executed: run.executed });
    }
  }

  const bestCore = bestGridRun(gridRuns);
  const reportLines: string[] = [];

  reportLines.push("/-----------------------------------------------");
  reportLines.push("  Property of Freedom_EXE  (c) 2026");
  reportLines.push("-----------------------------------------------/");
  reportLines.push("");
  reportLines.push("=== BITGET LITE ENTRY BACKTEST ===");
  reportLines.push(`Weeks tested: [${weekOpens.map((w) => w.slice(0, 10)).join(", ")}]`);
  reportLines.push(`Sweep threshold: ${SWEEP_MIN_PCT.toFixed(3)}%`);
  reportLines.push(`Start equity: $${fmt2(STARTING_EQUITY_USD)} | Allocation/trade: ${(ALLOCATION_PCT * 100).toFixed(1)}% | Start leverage: ${START_LEVERAGE}x`);
  reportLines.push("");
  reportLines.push("Bias by week (BTC proxy from performance_snapshots):");
  for (const week of weekOpens) {
    const b = biasByWeek.get(week);
    if (!b) continue;
    reportLines.push(`  ${week.slice(0, 10)} -> ${b.direction}/${b.tier}`);
  }
  reportLines.push("");
  reportLines.push("BTC+ETH grid:");
  reportLines.push("| Config (dwell/closeLoc) | Trades | WR% | PnL ($) | PF | Max DD% |");
  reportLines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of gridRuns) {
    reportLines.push(`| d${row.config.dwell}/c${row.config.closeLocation.toFixed(2)} | ${row.metrics.trades} | ${fmt2(row.metrics.winRatePct)} | ${fmt2(row.metrics.totalPnlUsd)} | ${fmtPf(row.metrics.profitFactor)} | ${fmt2(row.metrics.maxDrawdownPct)} |`);
  }
  reportLines.push("");
  reportLines.push("Comparison vs existing systems (BTC+ETH only):");
  reportLines.push("| System | Trades | WR% | PnL ($) | PF | Max DD% |");
  reportLines.push("| --- | --- | --- | --- | --- | --- |");
  reportLines.push("| V2 Baseline (complex entry) | 16 | 87.50 | 661.00 | 14.07 | 3.08 |");
  reportLines.push("| V3 N=30 (sustained) | 19 | 84.21 | 2596.00 | 9.29 | 8.32 |");
  reportLines.push(`| Lite d${bestCore.config.dwell}/c${bestCore.config.closeLocation.toFixed(2)} (best) | ${bestCore.metrics.trades} | ${fmt2(bestCore.metrics.winRatePct)} | ${fmt2(bestCore.metrics.totalPnlUsd)} | ${fmtPf(bestCore.metrics.profitFactor)} | ${fmt2(bestCore.metrics.maxDrawdownPct)} |`);
  reportLines.push("");

  if (RUN_ALT_UNIVERSE) {
    const altSymbols = [...unionAlts].sort((a, b) => a.localeCompare(b));
    console.log(`Fetching alt candles (${altSymbols.length})...`);
    for (let i = 0; i < altSymbols.length; i += 1) {
      const symbol = altSymbols[i];
      if (candlesBySymbol.has(symbol)) continue;
      try {
        const candles = await fetchRawM1Candles(symbol, globalOpen, globalClose);
        if (candles.length) candlesBySymbol.set(symbol, candles);
        else fetchFailures.push({ symbol, reason: "empty_candles" });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        fetchFailures.push({ symbol, reason });
      }
      if (i < altSymbols.length - 1) await sleep(BITGET_SYMBOL_DELAY_MS);
    }

    const altWeekSymbols = buildSymbolsForWeek(weekOpens, weekToAlts, true);
    const bestAltRun = runLiteScenario({
      weekOpens,
      symbolsForWeek: altWeekSymbols,
      biasByWeek,
      candlesBySymbol,
      config: bestCore.config,
    });

    const hourlyReturnsBySymbol = new Map<string, Array<{ ts: number; ret: number }>>();
    for (const [symbol, candles] of candlesBySymbol.entries()) {
      hourlyReturnsBySymbol.set(symbol, buildHourlyReturnsFromM1(candles));
    }
    const btcReturns = hourlyReturnsBySymbol.get("BTC") ?? [];
    const corrBySymbol = new Map<string, number | null>();
    const corrBySymbolWeek = new Map<string, Array<number | null>>();
    for (const symbol of [...CORE_SYMBOLS, ...altSymbols]) {
      if (symbol === "BTC") {
        corrBySymbol.set(symbol, 1);
        corrBySymbolWeek.set(symbol, weekOpens.map(() => 1));
        continue;
      }
      const symReturns = hourlyReturnsBySymbol.get(symbol) ?? [];
      const values: Array<number | null> = [];
      for (const week of weekOpens) {
        const weekOpenMs = DateTime.fromISO(week, { zone: "utc" }).toMillis();
        values.push(computeWindowCorrelation(symReturns, btcReturns, weekOpenMs - 7 * 24 * 60 * 60 * 1000, weekOpenMs));
      }
      corrBySymbolWeek.set(symbol, values);
      corrBySymbol.set(symbol, avgMin(values).avg);
    }

    const highCorrAlts = altSymbols.filter((s) => {
      const c = corrBySymbol.get(s);
      return c !== undefined && c !== null && c > 0.75;
    });
    const highCorrRun = computeScenarioMetrics(bestAltRun.executed.filter((t) => highCorrAlts.includes(t.symbol)));

    reportLines.push("Alt universe (best config only):");
    reportLines.push("| Universe | Trades | WR% | PnL ($) | PF | Max DD% |");
    reportLines.push("| --- | --- | --- | --- | --- | --- |");
    reportLines.push(`| BTC+ETH only | ${bestCore.metrics.trades} | ${fmt2(bestCore.metrics.winRatePct)} | ${fmt2(bestCore.metrics.totalPnlUsd)} | ${fmtPf(bestCore.metrics.profitFactor)} | ${fmt2(bestCore.metrics.maxDrawdownPct)} |`);
    reportLines.push(`| High-corr alts (>0.75) | ${highCorrRun.trades} | ${fmt2(highCorrRun.winRatePct)} | ${fmt2(highCorrRun.totalPnlUsd)} | ${fmtPf(highCorrRun.profitFactor)} | ${fmt2(highCorrRun.maxDrawdownPct)} |`);
    reportLines.push(`| Full ${new Set(bestAltRun.executed.map((t) => t.symbol)).size} symbols | ${bestAltRun.metrics.trades} | ${fmt2(bestAltRun.metrics.winRatePct)} | ${fmt2(bestAltRun.metrics.totalPnlUsd)} | ${fmtPf(bestAltRun.metrics.profitFactor)} | ${fmt2(bestAltRun.metrics.maxDrawdownPct)} |`);
    reportLines.push("");
    reportLines.push("Correlation matrix (vs BTC, hourly returns):");
    reportLines.push("| Symbol | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Average | Min |");
    reportLines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const symbol of [...CORE_SYMBOLS, ...altSymbols]) {
      const row = corrBySymbolWeek.get(symbol) ?? [];
      const stats = avgMin(row);
      const c = (idx: number) => (row[idx] === null || row[idx] === undefined ? "n/a" : fmt3(row[idx] as number));
      reportLines.push(`| ${symbol} | ${c(0)} | ${c(1)} | ${c(2)} | ${c(3)} | ${c(4)} | ${stats.avg === null ? "n/a" : fmt3(stats.avg)} | ${stats.min === null ? "n/a" : fmt3(stats.min)} |`);
    }
    reportLines.push("");

    const perSymbolRows = Array.from(new Set(bestAltRun.executed.map((t) => t.symbol))).map((symbol) => {
      const metrics = computeScenarioMetrics(bestAltRun.executed.filter((t) => t.symbol === symbol));
      return { symbol, metrics, corr: corrBySymbol.get(symbol) ?? null };
    });
    const top10 = [...perSymbolRows].sort((a, b) => b.metrics.totalPnlUsd - a.metrics.totalPnlUsd).slice(0, 10);
    const bottom10 = [...perSymbolRows].sort((a, b) => a.metrics.totalPnlUsd - b.metrics.totalPnlUsd).slice(0, 10);

    reportLines.push("Per-symbol top 10 by PnL:");
    reportLines.push("| Rank | Symbol | Corr(avg) | Trades | WR% | PnL ($) | PF | Max DD% |");
    reportLines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    top10.forEach((row, idx) => {
      reportLines.push(`| ${idx + 1} | ${row.symbol} | ${fmtCorr(row.corr)} | ${row.metrics.trades} | ${fmt2(row.metrics.winRatePct)} | ${fmt2(row.metrics.totalPnlUsd)} | ${fmtPf(row.metrics.profitFactor)} | ${fmt2(row.metrics.maxDrawdownPct)} |`);
    });
    reportLines.push("");

    reportLines.push("Per-symbol bottom 10 by PnL:");
    reportLines.push("| Rank | Symbol | Corr(avg) | Trades | WR% | PnL ($) | PF | Max DD% |");
    reportLines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    bottom10.forEach((row, idx) => {
      reportLines.push(`| ${idx + 1} | ${row.symbol} | ${fmtCorr(row.corr)} | ${row.metrics.trades} | ${fmt2(row.metrics.winRatePct)} | ${fmt2(row.metrics.totalPnlUsd)} | ${fmtPf(row.metrics.profitFactor)} | ${fmt2(row.metrics.maxDrawdownPct)} |`);
    });
    reportLines.push("");
  } else {
    reportLines.push("Alt universe run skipped (`BITGET_LITE_RUN_ALT_UNIVERSE=0`).");
    reportLines.push("");
  }

  reportLines.push("Fetch failures:");
  if (!fetchFailures.length) {
    reportLines.push("  None");
  } else {
    for (const row of fetchFailures) reportLines.push(`  ${row.symbol}: ${row.reason}`);
  }

  const reportText = reportLines.join("\n");
  writeFileSync(REPORT_PATH, reportText, "utf8");
  const jsonReport = buildSimpleBacktestReport({
    botId: "katarakti_crypto_lite",
    weekOpens,
    selectedConfig: `d${bestCore.config.dwell}/c${bestCore.config.closeLocation.toFixed(2)}`,
    executed: bestCore.executed,
    startEquityUsd: STARTING_EQUITY_USD,
  });
  writeFileSync(JSON_REPORT_PATH, JSON.stringify(jsonReport, null, 2), "utf8");
  await persistLiteCryptoReportToDb(jsonReport);
  console.log(reportText);
  console.log(`\nReport written: ${REPORT_PATH}`);
  console.log(`JSON report written: ${JSON_REPORT_PATH}`);
}

mainLite()
  .catch((error) => {
    console.error("analyze-bitget-lite-entry-backtest failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
