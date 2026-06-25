/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: analyze-bitget-v2-overshoot-by-bias.ts
 *
 * Description:
 * Standalone overshoot analysis split by weekly bias alignment.
 * Reuses Bitget v2 backtest candle/range/session wiring and weekly
 * COT+sentiment bias classification flow.
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
type SweepDirection = "SHORT" | "LONG";

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

type SweepEvent = {
  symbol: SymbolBase;
  direction: SweepDirection;
  sessionWindow: SessionWindow;
  overshootPct: number;
  day: string;
  weekOpenUtc: string;
  biasDirection: Direction;
  biasTier: ConfidenceTier;
  isBiasAligned: boolean;
};

type StatsSummary = {
  count: number;
  mean: number;
  median: number;
  std: number;
  p25: number;
  p75: number;
  p90: number;
};

const SYMBOLS: SymbolBase[] = ["BTC", "ETH"];
const WEEKS_TO_BACKTEST = Number(process.env.BACKTEST_WEEKS ?? "5");
const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
const BACKTEST_INCLUDE_SUNDAYS = process.env.BACKTEST_INCLUDE_SUNDAYS === "1";
const SWEEP_BREACH_MIN_PCT = Number(process.env.SWEEP_BREACH_MIN_PCT ?? "0");
const FUNDING_EXTREME_THRESHOLD = 0.0001;

function fmt3(value: number) {
  return value.toFixed(3);
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

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Funding fetch failed (${response.status}) ${symbol}`);
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

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`M1 fetch failed (${response.status}) ${symbol}`);
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

    for (const row of rows) {
      out.set(row.ts, row);
    }
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

function computeStats(values: number[]): StatsSummary {
  if (!values.length) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      std: 0,
      p25: 0,
      p75: 0,
      p90: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;
  return {
    count: sorted.length,
    mean,
    median: percentile(sorted, 50),
    std: Math.sqrt(variance),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

function scanOvershootEvents(params: {
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  sessionWindow: SessionWindow;
  candles: Candle[];
  sessionIndices: number[];
  range: DailyRange;
  bias: WeeklyBiasForSymbol;
}): SweepEvent[] {
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

  const events: SweepEvent[] = [];
  let activeShort: { maxOvershootPct: number } | null = null;
  let activeLong: { maxOvershootPct: number } | null = null;

  const finalize = (direction: SweepDirection, overshootPct: number) => {
    const isNeutralBias = bias.tier === "NEUTRAL" || bias.direction === "NEUTRAL";
    const isBiasAligned = isNeutralBias
      || (bias.direction === "LONG" && direction === "LONG")
      || (bias.direction === "SHORT" && direction === "SHORT");

    events.push({
      symbol,
      direction,
      sessionWindow,
      overshootPct,
      day: dayUtc,
      weekOpenUtc,
      biasDirection: bias.direction,
      biasTier: bias.tier,
      isBiasAligned,
    });
  };

  for (const idx of sessionIndices) {
    const c = candles[idx];
    if (!c) continue;

    const shortOvershootPct = ((c.high - range.high) / range.high) * 100;
    const longOvershootPct = ((range.low - c.low) / range.low) * 100;
    const shortBreached = shortOvershootPct > SWEEP_BREACH_MIN_PCT;
    const longBreached = longOvershootPct > SWEEP_BREACH_MIN_PCT;

    if (shortBreached) {
      if (!activeShort) activeShort = { maxOvershootPct: shortOvershootPct };
      else activeShort.maxOvershootPct = Math.max(activeShort.maxOvershootPct, shortOvershootPct);
    }

    if (longBreached) {
      if (!activeLong) activeLong = { maxOvershootPct: longOvershootPct };
      else activeLong.maxOvershootPct = Math.max(activeLong.maxOvershootPct, longOvershootPct);
    }

    if (activeShort) {
      const reenteredShort = c.low <= range.high;
      if (!shortBreached || reenteredShort) {
        finalize("SHORT", activeShort.maxOvershootPct);
        activeShort = null;
      }
    }

    if (activeLong) {
      const reenteredLong = c.high >= range.low;
      if (!longBreached || reenteredLong) {
        finalize("LONG", activeLong.maxOvershootPct);
        activeLong = null;
      }
    }
  }

  if (activeShort) finalize("SHORT", activeShort.maxOvershootPct);
  if (activeLong) finalize("LONG", activeLong.maxOvershootPct);

  return events;
}

function printDirectionStats(events: SweepEvent[], direction: SweepDirection) {
  const values = events.filter((e) => e.direction === direction).map((e) => e.overshootPct);
  const stats = computeStats(values);
  const label = direction === "SHORT"
    ? "SHORT sweeps (above range high)"
    : "LONG sweeps (below range low)";
  console.log(`${label}:`);
  console.log(`  Count: ${stats.count}`);
  console.log(`  Mean overshoot %: ${fmt3(stats.mean)}`);
  console.log(`  Median overshoot %: ${fmt3(stats.median)}`);
  console.log(`  Std dev: ${fmt3(stats.std)}`);
  console.log(`  P25: ${fmt3(stats.p25)}  P75: ${fmt3(stats.p75)}  P90: ${fmt3(stats.p90)}`);
  console.log("");
}

function printBuckets(title: string, events: SweepEvent[]) {
  console.log(title);
  const buckets: Array<{ label: string; min: number; max: number | null }> = [
    { label: "0.0 - 0.1%", min: 0, max: 0.1 },
    { label: "0.1 - 0.2%", min: 0.1, max: 0.2 },
    { label: "0.2 - 0.3%", min: 0.2, max: 0.3 },
    { label: "0.3 - 0.5%", min: 0.3, max: 0.5 },
    { label: "0.5 - 0.75%", min: 0.5, max: 0.75 },
    { label: "0.75 - 1.0%", min: 0.75, max: 1.0 },
    { label: "1.0 - 1.5%", min: 1.0, max: 1.5 },
    { label: "1.5 - 2.0%", min: 1.5, max: 2.0 },
    { label: "2.0%+", min: 2.0, max: null },
  ];

  for (const bucket of buckets) {
    const count = events.filter((e) => {
      if (bucket.max === null) return e.overshootPct >= bucket.min;
      return e.overshootPct >= bucket.min && e.overshootPct < bucket.max;
    }).length;
    console.log(`${bucket.label}: ${count} events`);
  }
  console.log("");
}

function printTierLine(events: SweepEvent[]) {
  const values = events.map((e) => e.overshootPct);
  const stats = computeStats(values);
  return `count=${stats.count} mean=${fmt3(stats.mean)} median=${fmt3(stats.median)} std=${fmt3(stats.std)}`;
}

function printReport(events: SweepEvent[]) {
  const aligned = events.filter((e) => e.isBiasAligned);
  const counter = events.filter((e) => !e.isBiasAligned);

  console.log("=== BIAS-ALIGNED OVERSHOOT STATISTICS ===");
  console.log(`Total bias-aligned sweep events: ${aligned.length}`);
  console.log("");
  printDirectionStats(aligned, "SHORT");
  printDirectionStats(aligned, "LONG");

  console.log("=== COUNTER-BIAS OVERSHOOT STATISTICS ===");
  console.log(`Total counter-bias sweep events: ${counter.length}`);
  console.log("");
  printDirectionStats(counter, "SHORT");
  printDirectionStats(counter, "LONG");

  printBuckets("=== DISTRIBUTION BUCKETS (bias-aligned only) ===", aligned);
  printBuckets("=== DISTRIBUTION BUCKETS (counter-bias only) ===", counter);

  console.log("=== BY TIER (bias-aligned only) ===");
  const tiers: ConfidenceTier[] = ["HIGH", "MEDIUM", "NEUTRAL"];
  for (const tier of tiers) {
    const tierEvents = aligned.filter((e) => e.biasTier === tier);
    const short = tierEvents.filter((e) => e.direction === "SHORT");
    const long = tierEvents.filter((e) => e.direction === "LONG");
    console.log(`${tier} tier:`);
    console.log(`  SHORT: ${printTierLine(short)}`);
    console.log(`  LONG:  ${printTierLine(long)}`);
  }
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

async function main() {
  loadEnvFromFile();
  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) throw new Error("No crypto COT snapshots found.");

  console.log(`Analyzing overshoots for ${weekOpens.length} completed week(s)...`);
  console.log(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Sweep breach threshold: ${SWEEP_BREACH_MIN_PCT.toFixed(3)}%`);
  console.log("");

  const fundingBySymbol: Record<SymbolBase, FundingPoint[]> = {
    BTC: await fetchFundingHistory("BTC"),
    ETH: await fetchFundingHistory("ETH"),
  };

  const allEvents: SweepEvent[] = [];

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

          const events = scanOvershootEvents({
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
    console.error("analyze-bitget-v2-overshoot-by-bias failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });

