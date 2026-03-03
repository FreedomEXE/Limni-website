
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: analyze-bitget-liq-sweep-backtest.ts
 *
 * Description:
 * Bitget liquidation-sweep variant backtest (BTC/ETH):
 * - Base sweep detection with rejection + displacement
 * - Limit entry at sweep +/- configurable liquidation offset
 * - 2-session fill window
 * - Fill diagnostics + scaling-risk replay on filled entries
 * - Multi-offset comparison against V2-style market-entry baseline
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

type SignalCandidate = {
  id: string;
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  sessionWindow: SessionWindow;
  direction: "LONG" | "SHORT";
  sweepTs: number;
  confirmTs: number;
  sweepLevel: number;
  confirmIndex: number;
  confirmPrice: number;
  deadlineTs: number;
  baselineLeveragedPnlPct: number;
  candles: Candle[];
};

type FillScan = {
  filled: boolean;
  fillTs: number | null;
  fillIndex: number | null;
  maxExcursionPct: number;
  sessionsElapsed: number;
};

type OffsetSignalResult = {
  signal: SignalCandidate;
  offsetPct: number;
  limitEntryPrice: number;
  filled: boolean;
  fillTs: number | null;
  sessionsElapsed: number;
  maxExcursionPct: number;
  leveragedPnlPct: number | null;
};

type OffsetSummary = {
  offsetPct: number;
  signals: number;
  fills: number;
  fillRatePct: number;
  avgTimeToFillMin: number | null;
  avgMaxExcursionPct: number | null;
  avgPnlFilledPct: number | null;
  avgBaselinePnlOnFilledPct: number | null;
  vsBaselinePct: number | null;
  handshakePairsFilled: number;
  handshakeSignalsFilled: number;
  singleLegFills: number;
};

const SYMBOLS: SymbolBase[] = ["BTC", "ETH"];
const WEEKS_TO_BACKTEST = Number(process.env.BACKTEST_WEEKS ?? "6");
const LIQ_SWEEP_OFFSETS_RAW = process.env.LIQ_SWEEP_OFFSETS ?? "0.01,0.02,0.03,0.05,0.10";
const MAX_SESSIONS_TO_FILL = 2;
const HANDSHAKE_WINDOW_MINUTES = Number(process.env.HANDSHAKE_WINDOW_MIN ?? "60");
const HANDSHAKE_WINDOW_MS = Math.max(0, HANDSHAKE_WINDOW_MINUTES) * 60_000;
const BACKTEST_INCLUDE_SUNDAYS = process.env.BACKTEST_INCLUDE_SUNDAYS === "1";

const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
const FUNDING_EXTREME_THRESHOLD = 0.0001;

const SWEEP_MIN_PCT = 0.1;
const NEUTRAL_SWEEP_MIN_PCT = 0.3;
const DISPLACEMENT_BODY_MIN_PCT = 0.1;

const SCALING_INITIAL_LEVERAGE = Number(process.env.BACKTEST_SCALING_INITIAL_LEVERAGE ?? "5");
const SCALING_INITIAL_STOP_PCT = 10;
const SCALING_MILESTONES = [1, 2, 3, 4] as const;
const SCALING_RELEASE_FRACTION: Record<(typeof SCALING_MILESTONES)[number], number> = {
  1: 0.5,
  2: 0.3,
  3: 0.1,
  4: 1 / 30,
};

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
          (value.startsWith("\"") && value.endsWith("\""))
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
    if (!response.ok) throw new Error(`Funding fetch failed (${response.status}) ${symbol}`);
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
  if (!history.length) return { direction: "NEUTRAL" as Direction, rate: null as number | null };
  const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const before = history.filter((r) => r.ts <= weekMs);
  const pick = before.length ? before[before.length - 1] : history[0];
  if (!pick) return { direction: "NEUTRAL" as Direction, rate: null as number | null };
  if (pick.rate > FUNDING_EXTREME_THRESHOLD) return { direction: "SHORT" as Direction, rate: pick.rate };
  if (pick.rate < -FUNDING_EXTREME_THRESHOLD) return { direction: "LONG" as Direction, rate: pick.rate };
  return { direction: "NEUTRAL" as Direction, rate: pick.rate };
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
      sentimentDir = deriveFundingProxyDirection(fundingBySymbol[symbol], weekOpenUtc).direction;
    }
    const cls = classifyWeeklyBias(dealer, commercial, sentimentDir);
    out[symbol] = {
      direction: cls.direction,
      tier: cls.tier,
    };
  }
  return out;
}

function getUtcHour(ts: number) {
  return DateTime.fromMillis(ts, { zone: "utc" }).hour;
}

function getUtcDateKey(ts: number) {
  return DateTime.fromMillis(ts, { zone: "utc" }).toISODate() ?? "";
}

function addDays(day: string, days: number) {
  const dt = DateTime.fromISO(day, { zone: "utc" });
  return dt.isValid ? dt.plus({ days }).toISODate() ?? day : day;
}

function previousUtcDateKey(day: string) {
  return addDays(day, -1);
}

function isSundayUtc(day: string) {
  const dt = DateTime.fromISO(day, { zone: "utc" });
  return dt.isValid && dt.weekday === 7;
}

function dayHourTs(day: string, hourUtc: number) {
  const dt = DateTime.fromISO(day, { zone: "utc" }).set({
    hour: hourUtc,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return dt.toMillis();
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

function sessionSeqIndex(ts: number) {
  const dayNumber = Math.floor(ts / 86_400_000);
  const session = sessionOfTs(ts);
  const slot = session === "ASIA" ? 0 : session === "LONDON" ? 1 : 2;
  return dayNumber * 3 + slot;
}

function computeSessionsElapsed(fromTs: number, toTs: number) {
  return Math.max(0, Math.min(MAX_SESSIONS_TO_FILL, sessionSeqIndex(toTs) - sessionSeqIndex(fromTs)));
}

function twoSessionDeadlineFromSweepTs(sweepTs: number, weekCloseTs: number) {
  const day = getUtcDateKey(sweepTs);
  const session = sessionOfTs(sweepTs);
  const rawDeadline = session === "ASIA"
    ? dayHourTs(day, 13)
    : session === "LONDON"
      ? dayHourTs(day, 21)
      : dayHourTs(addDays(day, 1), 8);
  return Math.min(rawDeadline, weekCloseTs);
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
    if (!response.ok) throw new Error(`M1 fetch failed (${response.status}) ${symbol}`);
    const body = (await response.json()) as { code?: string; data?: string[][] };
    if (body.code && body.code !== "00000") throw new Error(`M1 API error ${symbol}: ${body.code}`);
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
        };
      })
      .filter(
        (r) =>
          Number.isFinite(r.ts)
          && Number.isFinite(r.open)
          && Number.isFinite(r.high)
          && Number.isFinite(r.low)
          && Number.isFinite(r.close),
      )
      .filter((r) => r.ts >= cursor && r.ts < windowEnd)
      .sort((a, b) => a.ts - b.ts);

    if (!rows.length) {
      cursor = windowEnd;
      continue;
    }

    for (const row of rows) out.set(row.ts, row);
    cursor = windowEnd;
  }

  return Array.from(out.values()).sort((a, b) => a.ts - b.ts);
}

function aggregateM1ToM5(m1: Candle[]): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const candle of m1) {
    const bucket = Math.floor(candle.ts / 300_000) * 300_000;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)?.push(candle);
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
        quoteVolume: rows.reduce((sum, row) => sum + (row.quoteVolume ?? 0), 0),
      };
    });
}

function buildAsiaLondonRange(candles: Candle[]): Map<string, DailyRange> {
  const dayMap = new Map<string, { asia: Candle[]; london: Candle[] }>();
  for (const candle of candles) {
    const day = getUtcDateKey(candle.ts);
    if (isAsiaSessionCandle(candle.ts)) {
      if (!dayMap.has(day)) dayMap.set(day, { asia: [], london: [] });
      dayMap.get(day)?.asia.push(candle);
    }
    if (isLondonSessionCandle(candle.ts)) {
      if (!dayMap.has(day)) dayMap.set(day, { asia: [], london: [] });
      dayMap.get(day)?.london.push(candle);
    }
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

function buildUsSessionRange(candles: Candle[]): Map<string, DailyRange> {
  const dayMap = new Map<string, Candle[]>();
  for (const candle of candles) {
    if (!isNySessionCandle(candle.ts)) continue;
    const day = getUtcDateKey(candle.ts);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)?.push(candle);
  }
  const ranges = new Map<string, DailyRange>();
  for (const [day, sessionCandles] of dayMap.entries()) {
    if (!sessionCandles.length) continue;
    ranges.set(day, {
      high: Math.max(...sessionCandles.map((c) => c.high)),
      low: Math.min(...sessionCandles.map((c) => c.low)),
      locked: true,
    });
  }
  return ranges;
}

function nyCandleIndicesForDay(candles: Candle[], dayUtc: string) {
  const indices: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    if (getUtcDateKey(candle.ts) !== dayUtc) continue;
    if (!isNySessionCandle(candle.ts)) continue;
    indices.push(i);
  }
  return indices;
}

function asiaLondonCandleIndicesForDay(candles: Candle[], dayUtc: string) {
  const indices: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    if (getUtcDateKey(candle.ts) !== dayUtc) continue;
    if (!isAsiaLondonSessionCandle(candle.ts)) continue;
    indices.push(i);
  }
  return indices;
}

function allowedDirectionsForBias(bias: WeeklyBiasForSymbol) {
  if (bias.tier === "NEUTRAL" || bias.direction === "NEUTRAL") return ["LONG", "SHORT"] as Array<"LONG" | "SHORT">;
  return bias.direction === "LONG" ? (["LONG"] as Array<"LONG" | "SHORT">) : (["SHORT"] as Array<"LONG" | "SHORT">);
}

function detectSignalForWindow(params: {
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  candles: Candle[];
  sessionIndices: number[];
  range: DailyRange;
  bias: WeeklyBiasForSymbol;
  sessionWindow: SessionWindow;
}): Omit<SignalCandidate, "id" | "deadlineTs" | "baselineLeveragedPnlPct" | "candles"> | null {
  const {
    symbol,
    weekOpenUtc,
    dayUtc,
    candles,
    sessionIndices,
    range,
    bias,
    sessionWindow,
  } = params;
  if (!sessionIndices.length) return null;

  const allowed = allowedDirectionsForBias(bias);
  if (!allowed.length) return null;
  const minSweep = bias.tier === "NEUTRAL" ? NEUTRAL_SWEEP_MIN_PCT : SWEEP_MIN_PCT;

  for (let pos = 0; pos < sessionIndices.length; pos += 1) {
    const sweepIdx = sessionIndices[pos];
    const nextIdx = pos + 1 < sessionIndices.length ? sessionIndices[pos + 1] : null;
    const sweepCandle = candles[sweepIdx];
    if (!sweepCandle) continue;

    const upSweepPct = ((sweepCandle.high - range.high) / range.high) * 100;
    const downSweepPct = ((range.low - sweepCandle.low) / range.low) * 100;
    const candidates: Array<{ dir: "LONG" | "SHORT"; sweepLevel: number }> = [];
    if (upSweepPct >= minSweep) candidates.push({ dir: "SHORT", sweepLevel: sweepCandle.high });
    if (downSweepPct >= minSweep) candidates.push({ dir: "LONG", sweepLevel: sweepCandle.low });
    if (!candidates.length) continue;

    for (const candidate of candidates) {
      if (!allowed.includes(candidate.dir)) continue;

      const confirmChoices: number[] = [sweepIdx];
      if (nextIdx !== null) confirmChoices.push(nextIdx);

      let rejectionIdx: number | null = null;
      for (const ci of confirmChoices) {
        const c = candles[ci];
        if (!c) continue;
        if (candidate.dir === "SHORT" && c.close < range.high) {
          rejectionIdx = ci;
          break;
        }
        if (candidate.dir === "LONG" && c.close > range.low) {
          rejectionIdx = ci;
          break;
        }
      }
      if (rejectionIdx === null) continue;

      const confirmCandle = candles[rejectionIdx];
      if (!confirmCandle) continue;
      const bodyPct = candidate.dir === "SHORT"
        ? ((confirmCandle.open - confirmCandle.close) / confirmCandle.open) * 100
        : ((confirmCandle.close - confirmCandle.open) / confirmCandle.open) * 100;
      if (bodyPct < DISPLACEMENT_BODY_MIN_PCT) continue;

      return {
        symbol,
        weekOpenUtc,
        dayUtc,
        sessionWindow,
        direction: candidate.dir,
        sweepTs: sweepCandle.ts,
        confirmTs: confirmCandle.ts,
        sweepLevel: candidate.sweepLevel,
        confirmIndex: rejectionIdx,
        confirmPrice: confirmCandle.close,
      };
    }
  }
  return null;
}
function pctMove(entryPrice: number, exitPrice: number, direction: "LONG" | "SHORT") {
  return direction === "LONG"
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;
}

function buildExitIndices(candles: Candle[], startIndex: number, endTs: number) {
  const indices: number[] = [];
  for (let i = startIndex; i < candles.length; i += 1) {
    const candle = candles[i];
    if (!candle) continue;
    if (candle.ts > endTs) break;
    indices.push(i);
  }
  return indices.length ? indices : [startIndex];
}

function simulateScalingRisk(
  candles: Candle[],
  exitIndices: number[],
  entryIndex: number,
  entryPrice: number,
  direction: "LONG" | "SHORT",
): { unleveredPnlPct: number; pnlLeverage: number } {
  const entryPos = exitIndices.findIndex((idx) => idx === entryIndex);
  const initialStop = direction === "LONG"
    ? entryPrice * (1 - SCALING_INITIAL_STOP_PCT / 100)
    : entryPrice * (1 + SCALING_INITIAL_STOP_PCT / 100);

  if (entryPos < 0) {
    const fallback = candles[entryIndex];
    const unlev = pctMove(entryPrice, fallback.close, direction);
    return { unleveredPnlPct: unlev, pnlLeverage: SCALING_INITIAL_LEVERAGE };
  }

  let stopPrice = initialStop;
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
    } else if (candle.low < peakFavorable) {
      peakFavorable = candle.low;
    }

    const move = favorableMovePct();
    for (const milestone of SCALING_MILESTONES) {
      if (move < milestone) continue;
      if (milestonesHit.includes(milestone)) continue;
      milestonesHit.push(milestone);
      if (milestone >= 2) {
        stopPrice = entryPrice;
        breakevenReached = true;
      }
      if (milestone >= 3) {
        trailingOffsetPct = milestone >= 4 ? 1.0 : 1.5;
      }
      const _unused = SCALING_RELEASE_FRACTION[milestone];
      void _unused;
    }

    const trailPrice = trailingOffsetPct === null
      ? null
      : direction === "LONG"
        ? peakFavorable * (1 - trailingOffsetPct / 100)
        : peakFavorable * (1 + trailingOffsetPct / 100);

    if (direction === "LONG") {
      const stopHit = candle.low <= stopPrice;
      const trailHit = trailPrice !== null && candle.low <= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.max(stopPrice, trailPrice as number)
          : stopHit
            ? stopPrice
            : (trailPrice as number);
        return {
          unleveredPnlPct: pctMove(entryPrice, exitPrice, direction),
          pnlLeverage: SCALING_INITIAL_LEVERAGE,
        };
      }
    } else {
      const stopHit = candle.high >= stopPrice;
      const trailHit = trailPrice !== null && candle.high >= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.min(stopPrice, trailPrice as number)
          : stopHit
            ? stopPrice
            : (trailPrice as number);
        return {
          unleveredPnlPct: pctMove(entryPrice, exitPrice, direction),
          pnlLeverage: SCALING_INITIAL_LEVERAGE,
        };
      }
    }
  }

  const eod = candles[lastIdx];
  return {
    unleveredPnlPct: pctMove(entryPrice, eod.close, direction),
    pnlLeverage: SCALING_INITIAL_LEVERAGE,
  };
}

function computeLimitEntryPrice(direction: "LONG" | "SHORT", sweepLevel: number, offsetPct: number) {
  return direction === "SHORT"
    ? sweepLevel * (1 + offsetPct)
    : sweepLevel * (1 - offsetPct);
}

function scanForFill(signal: SignalCandidate, limitEntryPrice: number): FillScan {
  const candles = signal.candles;
  const startIndex = signal.confirmIndex;
  let fillTs: number | null = null;
  let fillIndex: number | null = null;
  let maxExcursionPct = 0;
  let trackingExcursion = false;

  for (let i = startIndex; i < candles.length; i += 1) {
    const candle = candles[i];
    if (!candle) continue;
    if (candle.ts > signal.deadlineTs) break;

    const touched = signal.direction === "SHORT"
      ? candle.high >= limitEntryPrice
      : candle.low <= limitEntryPrice;
    if (touched && fillTs === null) {
      fillTs = candle.ts;
      fillIndex = i;
      trackingExcursion = true;
    }

    if (!trackingExcursion) continue;
    const excursion = signal.direction === "SHORT"
      ? ((candle.high - limitEntryPrice) / limitEntryPrice) * 100
      : ((limitEntryPrice - candle.low) / limitEntryPrice) * 100;
    if (excursion > maxExcursionPct) {
      maxExcursionPct = excursion;
    }
  }

  if (fillTs === null || fillIndex === null) {
    return {
      filled: false,
      fillTs: null,
      fillIndex: null,
      maxExcursionPct: 0,
      sessionsElapsed: MAX_SESSIONS_TO_FILL,
    };
  }

  return {
    filled: true,
    fillTs,
    fillIndex,
    maxExcursionPct,
    sessionsElapsed: computeSessionsElapsed(signal.sweepTs, fillTs),
  };
}

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function parseOffsets(raw: string) {
  const parsed = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => Number(v.toFixed(6)));
  return Array.from(new Set(parsed));
}

function fmtPct(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

async function buildSignals(
  weekOpens: string[],
  cotHistory: CotSnapshot[],
  fundingBySymbol: Record<SymbolBase, FundingPoint[]>,
) {
  const signals: SignalCandidate[] = [];

  for (const weekOpenUtc of weekOpens) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekDataOpen = weekOpen.minus({ days: 1 });
    const weekCloseTs = weekClose.toMillis();
    const biasBySymbol = await buildBiasBySymbolForWeek(weekOpenUtc, cotHistory, fundingBySymbol);

    console.log(`Week ${weekOpenUtc.slice(0, 10)}: fetching BTC/ETH candles...`);

    const candlesBySymbol = {} as Record<SymbolBase, Candle[]>;
    const asiaLondonRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;
    const usRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;

    for (const symbol of SYMBOLS) {
      const rawM1 = await fetchRawM1Candles(symbol, weekDataOpen, weekClose);
      const m5 = aggregateM1ToM5(rawM1);
      candlesBySymbol[symbol] = m5;
      asiaLondonRangesBySymbol[symbol] = buildAsiaLondonRange(m5);
      usRangesBySymbol[symbol] = buildUsSessionRange(m5);
      console.log(`  ${symbol}: m1=${rawM1.length}, m5=${m5.length}, bias=${biasBySymbol[symbol].direction}/${biasBySymbol[symbol].tier}`);
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
          const indices = sessionDef.sessionIndicesForSymbol(symbol);
          if (!candles.length || !range?.locked || !indices.length) continue;

          const detected = detectSignalForWindow({
            symbol,
            weekOpenUtc,
            dayUtc,
            candles,
            sessionIndices: indices,
            range,
            bias: biasBySymbol[symbol],
            sessionWindow: sessionDef.sessionWindow,
          });
          if (!detected) continue;

          const deadlineTs = twoSessionDeadlineFromSweepTs(detected.sweepTs, weekCloseTs);
          const baselineExitIndices = buildExitIndices(candles, detected.confirmIndex, deadlineTs);
          const baseline = simulateScalingRisk(
            candles,
            baselineExitIndices,
            detected.confirmIndex,
            detected.confirmPrice,
            detected.direction,
          );
          const baselineLeveragedPnlPct = baseline.unleveredPnlPct * baseline.pnlLeverage;

          signals.push({
            ...detected,
            id: `${weekOpenUtc}|${dayUtc}|${sessionDef.sessionWindow}|${symbol}|${detected.direction}|${detected.sweepTs}`,
            deadlineTs,
            baselineLeveragedPnlPct,
            candles,
          });
        }
      }
    }
  }

  return signals;
}
function summarizeOffset(offsetPct: number, results: OffsetSignalResult[]): OffsetSummary {
  const fills = results.filter((r) => r.filled);
  const fillTimes = fills
    .map((r) => (r.fillTs === null ? null : (r.fillTs - r.signal.confirmTs) / 60_000))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const excursions = fills.map((r) => r.maxExcursionPct);
  const pnlFilled = fills
    .map((r) => r.leveragedPnlPct)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const baselineOnFilled = fills.map((r) => r.signal.baselineLeveragedPnlPct);

  const groups = new Map<string, OffsetSignalResult[]>();
  for (const row of results) {
    const key = `${row.signal.weekOpenUtc}|${row.signal.dayUtc}|${row.signal.sessionWindow}|${row.signal.direction}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(row);
  }

  let handshakePairsFilled = 0;
  let handshakeSignalsFilled = 0;
  for (const groupRows of groups.values()) {
    const btc = groupRows.find((row) => row.signal.symbol === "BTC");
    const eth = groupRows.find((row) => row.signal.symbol === "ETH");
    if (!btc || !eth) continue;
    if (!btc.filled || !eth.filled) continue;
    if (btc.fillTs === null || eth.fillTs === null) continue;
    const delay = Math.abs(btc.fillTs - eth.fillTs);
    if (delay <= HANDSHAKE_WINDOW_MS) {
      handshakePairsFilled += 1;
      handshakeSignalsFilled += 2;
    }
  }

  const totalFills = fills.length;
  const singleLegFills = Math.max(0, totalFills - handshakeSignalsFilled);

  const avgPnlFilledPct = mean(pnlFilled);
  const avgBaselinePnlOnFilledPct = mean(baselineOnFilled);
  return {
    offsetPct,
    signals: results.length,
    fills: totalFills,
    fillRatePct: results.length > 0 ? (totalFills / results.length) * 100 : 0,
    avgTimeToFillMin: mean(fillTimes),
    avgMaxExcursionPct: mean(excursions),
    avgPnlFilledPct,
    avgBaselinePnlOnFilledPct,
    vsBaselinePct:
      avgPnlFilledPct === null || avgBaselinePnlOnFilledPct === null
        ? null
        : avgPnlFilledPct - avgBaselinePnlOnFilledPct,
    handshakePairsFilled,
    handshakeSignalsFilled,
    singleLegFills,
  };
}

function runOffset(offsetPct: number, signals: SignalCandidate[]): { summary: OffsetSummary; rows: OffsetSignalResult[] } {
  const rows: OffsetSignalResult[] = [];
  for (const signal of signals) {
    const limitEntryPrice = computeLimitEntryPrice(signal.direction, signal.sweepLevel, offsetPct);
    const fill = scanForFill(signal, limitEntryPrice);
    let leveragedPnlPct: number | null = null;
    if (fill.filled && fill.fillIndex !== null) {
      const exitIndices = buildExitIndices(signal.candles, fill.fillIndex, signal.deadlineTs);
      const sim = simulateScalingRisk(
        signal.candles,
        exitIndices,
        fill.fillIndex,
        limitEntryPrice,
        signal.direction,
      );
      leveragedPnlPct = sim.unleveredPnlPct * sim.pnlLeverage;
    }

    rows.push({
      signal,
      offsetPct,
      limitEntryPrice,
      filled: fill.filled,
      fillTs: fill.fillTs,
      sessionsElapsed: fill.sessionsElapsed,
      maxExcursionPct: fill.maxExcursionPct,
      leveragedPnlPct,
    });
  }
  return {
    summary: summarizeOffset(offsetPct, rows),
    rows,
  };
}

function buildConsoleTable(summaries: OffsetSummary[]) {
  const header = [
    "Offset".padEnd(8),
    "Signals".padStart(8),
    "Fills".padStart(8),
    "Fill%".padStart(8),
    "Avg PnL (filled)".padStart(18),
    "vs V2 Baseline".padStart(16),
  ].join(" | ");
  const separator = "-".repeat(header.length);
  const lines = [header, separator];
  for (const summary of summaries) {
    lines.push(
      [
        `${(summary.offsetPct * 100).toFixed(2)}%`.padEnd(8),
        String(summary.signals).padStart(8),
        String(summary.fills).padStart(8),
        fmtPct(summary.fillRatePct).padStart(8),
        fmtPct(summary.avgPnlFilledPct).padStart(18),
        fmtPct(summary.vsBaselinePct).padStart(16),
      ].join(" | "),
    );
  }
  return lines.join("\n");
}

function buildReport(
  weekOpens: string[],
  offsets: number[],
  summaries: OffsetSummary[],
) {
  const lines: string[] = [];
  lines.push("Bitget Liquidation Sweep Backtest");
  lines.push(`Generated UTC: ${DateTime.utc().toISO() ?? ""}`);
  lines.push(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  lines.push(`Symbols: ${SYMBOLS.join(", ")}`);
  lines.push(`Offsets: ${offsets.join(", ")}`);
  lines.push(`Handshake window (minutes): ${HANDSHAKE_WINDOW_MINUTES}`);
  lines.push(`Max sessions to fill: ${MAX_SESSIONS_TO_FILL}`);
  lines.push("");
  lines.push(buildConsoleTable(summaries));
  lines.push("");
  lines.push("Per-offset diagnostics:");
  for (const summary of summaries) {
    lines.push(
      `- ${(summary.offsetPct * 100).toFixed(2)}%: fills=${summary.fills}/${summary.signals}, `
      + `avg_time_to_fill_min=${fmtNum(summary.avgTimeToFillMin)}, `
      + `avg_max_excursion_pct=${fmtPct(summary.avgMaxExcursionPct)}, `
      + `handshake_pairs_filled=${summary.handshakePairsFilled}, `
      + `single_leg_fills=${summary.singleLegFills}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  loadEnvFromFile();

  const offsets = parseOffsets(LIQ_SWEEP_OFFSETS_RAW);
  if (!offsets.length) {
    throw new Error(`LIQ_SWEEP_OFFSETS has no valid positive values: "${LIQ_SWEEP_OFFSETS_RAW}"`);
  }
  if (!Number.isFinite(WEEKS_TO_BACKTEST) || WEEKS_TO_BACKTEST <= 0) {
    throw new Error(`Invalid BACKTEST_WEEKS: ${String(WEEKS_TO_BACKTEST)}`);
  }

  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) throw new Error("No crypto COT snapshots found.");

  console.log(`Running liq-sweep backtest across ${weekOpens.length} completed week(s)...`);
  console.log(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  console.log(`Offsets: ${offsets.map((v) => `${(v * 100).toFixed(2)}%`).join(", ")}`);
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log("");

  const fundingBySymbol: Record<SymbolBase, FundingPoint[]> = {
    BTC: await fetchFundingHistory("BTC"),
    ETH: await fetchFundingHistory("ETH"),
  };
  const signals = await buildSignals(weekOpens, cotHistory, fundingBySymbol);
  console.log(`Base signals detected (bias-aligned): ${signals.length}`);

  const summaries: OffsetSummary[] = [];
  for (const offset of offsets) {
    const { summary } = runOffset(offset, signals);
    summaries.push(summary);
  }

  const table = buildConsoleTable(summaries);
  console.log("");
  console.log(table);
  console.log("");

  const reportText = buildReport(weekOpens, offsets, summaries);
  const outputPath = path.resolve(process.cwd(), "reports/bitget-liq-sweep-latest.txt");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, reportText, "utf8");
  console.log(`Report written: ${outputPath}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[liq-sweep] fatal:", message);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await getPool().end();
  } catch {
    // no-op
  }
});
