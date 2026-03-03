
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: analyze-bitget-liq-sweep-simple-backtest.ts
 *
 * Description:
 * Bare mechanics liquidation-sweep backtest for BTC/ETH:
 * - Every session-range breach is a signal
 * - Limit entry at range level +/- offset
 * - 2-session fill window
 * - Scaling-risk replay for filled trades
 * - Multi-offset comparison by symbol and combined totals
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { readSnapshotHistory } from "../src/lib/cotStore";
import { derivePairDirectionsByBase } from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { CotSnapshot } from "../src/lib/cotTypes";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { classifyWeeklyBias } from "../src/lib/bitgetBotSignals";
import { computeScalingState } from "../src/lib/bitgetBotRisk";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

type SymbolBase = "BTC" | "ETH";
type Direction = "LONG" | "SHORT" | "NEUTRAL";
type ConfidenceTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type SlotMode = "global" | "per_symbol";
type SessionWindow = "ASIA_LONDON_RANGE_NY_ENTRY" | "US_RANGE_ASIA_LONDON_ENTRY";
type ExitReason = "stop" | "breakeven" | "trailing" | "session_end";

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
  signalTs: number;
  signalIndex: number;
  sessionRangeLevel: number;
  deadlineTs: number;
  candles: Candle[];
};

type FillScan = {
  filled: boolean;
  fillTs: number | null;
  fillIndex: number | null;
  sessionsElapsed: number;
  maxExcursionPct: number;
};

type TradeResult = {
  offsetPct: number;
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  sessionWindow: SessionWindow;
  direction: "LONG" | "SHORT";
  signalTimeUtc: string;
  sessionRangeLevel: number;
  limitPrice: number;
  filled: boolean;
  fillTimeUtc: string;
  sessionsElapsed: number;
  maxExcursionPct: number;
  holdHours: number | null;
  pnlPct: number | null;
  pnlUsd: number | null;
  fillTsMs: number | null;
  exitTsMs: number | null;
  exitPrice: number | null;
  leverageAtExit: number | null;
  exitReason: ExitReason | null;
  maxMilestone: number | null;
  blockedByOpenTrade: boolean;
  prelockFilled: boolean;
};

type SummaryRow = {
  offsetPct: number;
  symbol: SymbolBase | "ALL";
  signals: number;
  fills: number;
  fillRatePct: number;
  avgPnlPct: number | null;
  winRatePct: number | null;
  avgHoldHours: number | null;
  totalPnlUsd: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
};

const SYMBOLS: SymbolBase[] = ["BTC", "ETH"];
const WEEKS_TO_BACKTEST = Number(process.env.BACKTEST_WEEKS ?? "6");
const LIQ_SWEEP_OFFSETS_RAW = process.env.LIQ_SWEEP_OFFSETS ?? "0.01,0.02,0.03,0.05";
const LIQ_MIN_SWEEP_PCT = Number(process.env.LIQ_MIN_SWEEP_PCT ?? "0.003");
const LIQ_SLOT_MODE_RAW = (process.env.LIQ_SLOT_MODE ?? "per_symbol").trim().toLowerCase();
const LIQ_SLOT_MODE: SlotMode = LIQ_SLOT_MODE_RAW === "global" ? "global" : "per_symbol";
const POSITION_ALLOCATION_PCT = Number(process.env.LIQ_POSITION_PCT ?? "0.25");
const MAX_SESSIONS_TO_FILL = 2;
const BACKTEST_INCLUDE_SUNDAYS = process.env.BACKTEST_INCLUDE_SUNDAYS === "1";
const STARTING_EQUITY_USD = Number(process.env.BACKTEST_STARTING_EQUITY_USD ?? "1000");

const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
const FUNDING_EXTREME_THRESHOLD = 0.0001;

const SCALING_INITIAL_LEVERAGE = 5;
const SCALING_INITIAL_STOP_PCT = 10;

type RiskSimulation = {
  exitTs: number;
  exitPrice: number;
  unleveredPnlPct: number;
  pnlLeverage: number;
  exitReason: ExitReason;
  maxMilestone: number;
};

type LiqSweepJsonReport = {
  meta: {
    botId: "katarakti_v3_liq_sweep";
    market: "crypto_futures";
    generatedUtc: string;
    weeks: string[];
    offsetPct: number;
    slotMode: SlotMode;
    leverage: number;
    positionAllocationPct: number;
  };
  weekly: Array<{
    week_open_utc: string;
    trades: number;
    wins: number;
    losses: number;
    pnl_usd: number;
    pnl_pct: number;
    max_drawdown_pct: number;
  }>;
  summary: {
    total_trades: number;
    total_pnl_usd: number;
    total_return_pct: number;
    win_rate_pct: number;
    max_drawdown_pct: number;
    avg_pnl_pct: number;
    profit_factor: number;
  };
  trades: Array<{
    symbol: string;
    direction: "LONG" | "SHORT";
    entry_time_utc: string;
    exit_time_utc: string;
    entry_price: number;
    exit_price: number;
    pnl_pct: number;
    pnl_usd: number;
    exit_reason: ExitReason;
    max_milestone: number;
    leverage_at_exit: number;
  }>;
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
  if (!currentWeekOpen.isValid) throw new Error("Failed to resolve canonical week anchor.");
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

function getExecutionConstraintLabel(slotMode: SlotMode) {
  return slotMode === "per_symbol"
    ? "Execution constraint: max 1 open trade per symbol"
    : "Execution constraint: max 1 open trade globally";
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
    if (body.code && body.code !== "00000") throw new Error(`Funding API error ${symbol}: ${body.code}`);
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
  if (!cotSnapshot) throw new Error(`No COT snapshot available for week ${weekOpenUtc}`);

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
    out[symbol] = { direction: cls.direction, tier: cls.tier };
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

function twoSessionDeadlineFromSignalTs(signalTs: number, weekCloseTs: number) {
  const day = getUtcDateKey(signalTs);
  const session = sessionOfTs(signalTs);
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

function buildDailyRanges(candles: Candle[]): Map<string, DailyRange> {
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
  const idx: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (getUtcDateKey(c.ts) !== dayUtc) continue;
    if (!isNySessionCandle(c.ts)) continue;
    idx.push(i);
  }
  return idx;
}

function asiaLondonCandleIndicesForDay(candles: Candle[], dayUtc: string) {
  const idx: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (getUtcDateKey(c.ts) !== dayUtc) continue;
    if (!isAsiaLondonSessionCandle(c.ts)) continue;
    idx.push(i);
  }
  return idx;
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
): RiskSimulation {
  const entryPos = exitIndices.findIndex((idx) => idx === entryIndex);
  const initialStopPrice = direction === "LONG"
    ? entryPrice * (1 - SCALING_INITIAL_STOP_PCT / 100)
    : entryPrice * (1 + SCALING_INITIAL_STOP_PCT / 100);
  if (entryPos < 0) {
    const fallback = candles[entryIndex];
    const unlev = pctMove(entryPrice, fallback.close, direction);
    return {
      exitTs: fallback.ts,
      exitPrice: fallback.close,
      unleveredPnlPct: unlev,
      pnlLeverage: SCALING_INITIAL_LEVERAGE,
      exitReason: "session_end",
      maxMilestone: 0,
    };
  }

  let maxMilestone = 0;
  let pnlLeverage = SCALING_INITIAL_LEVERAGE;
  let stopPrice = initialStopPrice;
  let trailingOffsetPct: number | null = null;
  let trailingStopPrice: number | null = null;
  let peakFavorablePrice = entryPrice;

  const lastIdx = exitIndices[exitIndices.length - 1];
  for (let pos = entryPos + 1; pos < exitIndices.length; pos += 1) {
    const idx = exitIndices[pos];
    const candle = candles[idx];

    // Conservative sequencing: evaluate currently active stop/trailing before
    // allowing new milestone transitions from the same candle.
    const stopHit = direction === "LONG"
      ? candle.low <= stopPrice
      : candle.high >= stopPrice;
    const trailingHit = trailingStopPrice !== null && (
      direction === "LONG"
        ? candle.low <= trailingStopPrice
        : candle.high >= trailingStopPrice
    );
    if (stopHit || trailingHit) {
      const exitReason: ExitReason = stopHit
        ? (maxMilestone >= 2 ? "breakeven" : "stop")
        : "trailing";
      const exitPrice = stopHit ? stopPrice : (trailingStopPrice as number);
      return {
        exitTs: candle.ts,
        exitPrice,
        unleveredPnlPct: pctMove(entryPrice, exitPrice, direction),
        pnlLeverage,
        exitReason,
        maxMilestone,
      };
    }

    if (direction === "LONG") {
      if (candle.high > peakFavorablePrice) peakFavorablePrice = candle.high;
    } else if (candle.low < peakFavorablePrice) {
      peakFavorablePrice = candle.low;
    }

    const scaling = computeScalingState(entryPrice, peakFavorablePrice, direction, maxMilestone);
    if (scaling.shouldAdjust) {
      maxMilestone = scaling.milestone;
      pnlLeverage = Math.max(pnlLeverage, scaling.newLeverage);
      if (scaling.newStop !== null) stopPrice = scaling.newStop;
      trailingOffsetPct = scaling.trailOffsetPct;
    }

    if (trailingOffsetPct !== null) {
      const candidate = direction === "LONG"
        ? peakFavorablePrice * (1 - trailingOffsetPct / 100)
        : peakFavorablePrice * (1 + trailingOffsetPct / 100);
      if (trailingStopPrice === null) {
        trailingStopPrice = candidate;
      } else {
        trailingStopPrice = direction === "LONG"
          ? Math.max(trailingStopPrice, candidate)
          : Math.min(trailingStopPrice, candidate);
      }
    }
  }

  const sessionEndCandle = candles[lastIdx];
  return {
    exitTs: sessionEndCandle.ts,
    exitPrice: sessionEndCandle.close,
    unleveredPnlPct: pctMove(entryPrice, sessionEndCandle.close, direction),
    pnlLeverage,
    exitReason: "session_end",
    maxMilestone,
  };
}
function computeLimitPrice(direction: "LONG" | "SHORT", sessionRangeLevel: number, offsetPct: number) {
  return direction === "SHORT"
    ? sessionRangeLevel * (1 + offsetPct)
    : sessionRangeLevel * (1 - offsetPct);
}

function scanForFill(signal: SignalCandidate, limitPrice: number): FillScan {
  let fillTs: number | null = null;
  let fillIndex: number | null = null;
  let maxExcursionPct = 0;
  let trackingExcursion = false;

  for (let i = signal.signalIndex; i < signal.candles.length; i += 1) {
    const candle = signal.candles[i];
    if (!candle) continue;
    if (candle.ts > signal.deadlineTs) break;

    const touched = signal.direction === "SHORT"
      ? candle.high >= limitPrice
      : candle.low <= limitPrice;
    if (touched && fillTs === null) {
      fillTs = candle.ts;
      fillIndex = i;
      trackingExcursion = true;
    }

    if (!trackingExcursion) continue;
    const excursion = signal.direction === "SHORT"
      ? ((candle.high - limitPrice) / limitPrice) * 100
      : ((limitPrice - candle.low) / limitPrice) * 100;
    if (excursion > maxExcursionPct) maxExcursionPct = excursion;
  }

  if (fillTs === null || fillIndex === null) {
    return {
      filled: false,
      fillTs: null,
      fillIndex: null,
      sessionsElapsed: MAX_SESSIONS_TO_FILL,
      maxExcursionPct: 0,
    };
  }

  return {
    filled: true,
    fillTs,
    fillIndex,
    sessionsElapsed: computeSessionsElapsed(signal.signalTs, fillTs),
    maxExcursionPct,
  };
}

function parseOffsets(raw: string) {
  const values = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => Number(v.toFixed(6)));
  return Array.from(new Set(values));
}

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function fmtPct(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(digits)}%`;
}

function allowedDirectionsForBias(bias: WeeklyBiasForSymbol) {
  if (bias.tier === "NEUTRAL" || bias.direction === "NEUTRAL") {
    return ["LONG", "SHORT"] as Array<"LONG" | "SHORT">;
  }
  return bias.direction === "LONG"
    ? (["LONG"] as Array<"LONG" | "SHORT">)
    : (["SHORT"] as Array<"LONG" | "SHORT">);
}

function makeSignalsForSession(params: {
  weekOpenUtc: string;
  dayUtc: string;
  symbol: SymbolBase;
  sessionWindow: SessionWindow;
  candles: Candle[];
  sessionIndices: number[];
  range: DailyRange;
  weekCloseTs: number;
  bias: WeeklyBiasForSymbol;
}): SignalCandidate[] {
  const {
    weekOpenUtc,
    dayUtc,
    symbol,
    sessionWindow,
    candles,
    sessionIndices,
    range,
    weekCloseTs,
    bias,
  } = params;

  const allowedDirections = allowedDirectionsForBias(bias);
  const out: SignalCandidate[] = [];
  for (const idx of sessionIndices) {
    const candle = candles[idx];
    if (!candle) continue;

    const shortSweepPct = range.high > 0 ? (candle.high - range.high) / range.high : 0;
    const longSweepPct = range.low > 0 ? (range.low - candle.low) / range.low : 0;

    if (shortSweepPct >= LIQ_MIN_SWEEP_PCT && allowedDirections.includes("SHORT")) {
      const deadlineTs = twoSessionDeadlineFromSignalTs(candle.ts, weekCloseTs);
      out.push({
        id: `${weekOpenUtc}|${dayUtc}|${sessionWindow}|${symbol}|SHORT|${candle.ts}|${idx}`,
        symbol,
        weekOpenUtc,
        dayUtc,
        sessionWindow,
        direction: "SHORT",
        signalTs: candle.ts,
        signalIndex: idx,
        sessionRangeLevel: range.high,
        deadlineTs,
        candles,
      });
    }

    if (longSweepPct >= LIQ_MIN_SWEEP_PCT && allowedDirections.includes("LONG")) {
      const deadlineTs = twoSessionDeadlineFromSignalTs(candle.ts, weekCloseTs);
      out.push({
        id: `${weekOpenUtc}|${dayUtc}|${sessionWindow}|${symbol}|LONG|${candle.ts}|${idx}`,
        symbol,
        weekOpenUtc,
        dayUtc,
        sessionWindow,
        direction: "LONG",
        signalTs: candle.ts,
        signalIndex: idx,
        sessionRangeLevel: range.low,
        deadlineTs,
        candles,
      });
    }
  }

  return out;
}

async function buildRawSignals(
  weekOpens: string[],
  cotHistory: CotSnapshot[],
  fundingBySymbol: Record<SymbolBase, FundingPoint[]>,
) {
  const signals: SignalCandidate[] = [];

  for (const weekOpenUtc of weekOpens) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekCloseTs = weekClose.toMillis();
    const weekDataOpen = weekOpen.minus({ days: 1 });
    const biasBySymbol = await buildBiasBySymbolForWeek(weekOpenUtc, cotHistory, fundingBySymbol);

    console.log(`Week ${weekOpenUtc.slice(0, 10)}: fetching BTC/ETH candles (weekly bias filtered)...`);

    const candlesBySymbol = {} as Record<SymbolBase, Candle[]>;
    const asiaLondonRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;
    const usRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;

    for (const symbol of SYMBOLS) {
      const rawM1 = await fetchRawM1Candles(symbol, weekDataOpen, weekClose);
      const m5 = aggregateM1ToM5(rawM1);
      candlesBySymbol[symbol] = m5;
      asiaLondonRangesBySymbol[symbol] = buildDailyRanges(m5);
      usRangesBySymbol[symbol] = buildUsSessionRanges(m5);
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
          const sessionIndices = sessionDef.sessionIndicesForSymbol(symbol);
          if (!candles.length || !range?.locked || !sessionIndices.length) continue;

          signals.push(
            ...makeSignalsForSession({
              weekOpenUtc,
              dayUtc,
              symbol,
              sessionWindow: sessionDef.sessionWindow,
              candles,
              sessionIndices,
              range,
              weekCloseTs,
              bias: biasBySymbol[symbol],
            }),
          );
        }
      }
    }
  }

  return signals;
}

function evaluateOffset(offsetPct: number, signals: SignalCandidate[]): TradeResult[] {
  const rows: TradeResult[] = [];

  const sortedSignals = [...signals].sort((a, b) => {
    if (a.signalTs !== b.signalTs) return a.signalTs - b.signalTs;
    if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
    return a.id.localeCompare(b.id);
  });

  for (const signal of sortedSignals) {
    const limitPrice = computeLimitPrice(signal.direction, signal.sessionRangeLevel, offsetPct);
    const fill = scanForFill(signal, limitPrice);

    let pnlPct: number | null = null;
    let holdHours: number | null = null;
    let exitTsMs: number | null = null;
    let exitPrice: number | null = null;
    let leverageAtExit: number | null = null;
    let exitReason: ExitReason | null = null;
    let maxMilestone: number | null = null;
    if (fill.filled && fill.fillIndex !== null) {
      const exitIndices = buildExitIndices(signal.candles, fill.fillIndex, signal.deadlineTs);
      const sim = simulateScalingRisk(signal.candles, exitIndices, fill.fillIndex, limitPrice, signal.direction);
      pnlPct = sim.unleveredPnlPct * sim.pnlLeverage;
      exitTsMs = sim.exitTs;
      exitPrice = sim.exitPrice;
      leverageAtExit = sim.pnlLeverage;
      exitReason = sim.exitReason;
      maxMilestone = sim.maxMilestone;
      holdHours = fill.fillTs === null ? null : Math.max(0, (sim.exitTs - fill.fillTs) / 3_600_000);
    }

    rows.push({
      offsetPct,
      symbol: signal.symbol,
      weekOpenUtc: signal.weekOpenUtc,
      dayUtc: signal.dayUtc,
      sessionWindow: signal.sessionWindow,
      direction: signal.direction,
      signalTimeUtc: DateTime.fromMillis(signal.signalTs, { zone: "utc" }).toISO() ?? "",
      sessionRangeLevel: signal.sessionRangeLevel,
      limitPrice,
      filled: fill.filled,
      fillTimeUtc: fill.fillTs === null ? "" : DateTime.fromMillis(fill.fillTs, { zone: "utc" }).toISO() ?? "",
      sessionsElapsed: fill.sessionsElapsed,
      maxExcursionPct: fill.maxExcursionPct,
      holdHours,
      pnlPct,
      pnlUsd: null,
      fillTsMs: fill.fillTs,
      exitTsMs,
      exitPrice,
      leverageAtExit,
      exitReason,
      maxMilestone,
      blockedByOpenTrade: false,
      prelockFilled: fill.filled,
    });
  }

  const filledRows = rows
    .filter((row) => row.filled && row.fillTsMs !== null && row.exitTsMs !== null)
    .sort((a, b) => {
      const ta = a.fillTsMs ?? 0;
      const tb = b.fillTsMs ?? 0;
      if (ta !== tb) return ta - tb;
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      return a.signalTimeUtc.localeCompare(b.signalTimeUtc);
    });

  if (LIQ_SLOT_MODE === "global") {
    let nextAvailableTs = Number.NEGATIVE_INFINITY;
    for (const row of filledRows) {
      const entryTs = row.fillTsMs ?? Number.NEGATIVE_INFINITY;
      const exitTs = row.exitTsMs ?? entryTs;
      if (entryTs < nextAvailableTs) {
        row.filled = false;
        row.fillTimeUtc = "";
        row.sessionsElapsed = MAX_SESSIONS_TO_FILL;
        row.holdHours = null;
        row.pnlPct = null;
        row.fillTsMs = null;
        row.exitTsMs = null;
        row.exitPrice = null;
        row.leverageAtExit = null;
        row.exitReason = null;
        row.maxMilestone = null;
        row.blockedByOpenTrade = true;
        continue;
      }
      nextAvailableTs = Math.max(nextAvailableTs, exitTs);
    }
  } else {
    const nextAvailableBySymbol: Record<SymbolBase, number> = {
      BTC: Number.NEGATIVE_INFINITY,
      ETH: Number.NEGATIVE_INFINITY,
    };
    for (const row of filledRows) {
      const entryTs = row.fillTsMs ?? Number.NEGATIVE_INFINITY;
      const exitTs = row.exitTsMs ?? entryTs;
      const symbolLock = nextAvailableBySymbol[row.symbol] ?? Number.NEGATIVE_INFINITY;
      if (entryTs < symbolLock) {
        row.filled = false;
        row.fillTimeUtc = "";
        row.sessionsElapsed = MAX_SESSIONS_TO_FILL;
        row.holdHours = null;
        row.pnlPct = null;
        row.fillTsMs = null;
        row.exitTsMs = null;
        row.exitPrice = null;
        row.leverageAtExit = null;
        row.exitReason = null;
        row.maxMilestone = null;
        row.blockedByOpenTrade = true;
        continue;
      }
      nextAvailableBySymbol[row.symbol] = Math.max(symbolLock, exitTs);
    }
  }

  return rows;
}

type EquitySummary = {
  totalPnlUsd: number;
  maxDrawdownPct: number;
};

function computeSequentialEquitySummary(fills: TradeResult[]): EquitySummary {
  const ordered = fills
    .filter((row) => row.fillTsMs !== null && row.pnlPct !== null)
    .sort((a, b) => {
      const ta = a.fillTsMs ?? 0;
      const tb = b.fillTsMs ?? 0;
      if (ta !== tb) return ta - tb;
      const ea = a.exitTsMs ?? ta;
      const eb = b.exitTsMs ?? tb;
      return ea - eb;
    });

  let equity = STARTING_EQUITY_USD;
  let peak = STARTING_EQUITY_USD;
  let maxDd = 0;
  let totalPnlUsd = 0;
  for (const row of ordered) {
    const tradeReturnPct = row.pnlPct ?? 0;
    const allocationUsd = Math.max(0, equity * POSITION_ALLOCATION_PCT);
    const tradePnlUsd = allocationUsd * (tradeReturnPct / 100);
    totalPnlUsd += tradePnlUsd;
    equity += tradePnlUsd;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return { totalPnlUsd, maxDrawdownPct: maxDd };
}

function computeConcurrentEquitySummary(fills: TradeResult[]): EquitySummary {
  const entries = fills
    .filter((row) => row.fillTsMs !== null && row.exitTsMs !== null && row.pnlPct !== null)
    .map((row, idx) => ({
      id: idx,
      fillTs: row.fillTsMs as number,
      exitTs: row.exitTsMs as number,
      pnlPct: row.pnlPct as number,
      symbol: row.symbol,
    }))
    .sort((a, b) => {
      if (a.fillTs !== b.fillTs) return a.fillTs - b.fillTs;
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      return a.id - b.id;
    });

  let equity = STARTING_EQUITY_USD;
  let peak = STARTING_EQUITY_USD;
  let maxDd = 0;
  let totalPnlUsd = 0;
  const openPositions: Array<{ exitTs: number; allocationUsd: number; pnlPct: number }> = [];
  let cursor = 0;

  while (cursor < entries.length || openPositions.length > 0) {
    const nextEntryTs = cursor < entries.length ? entries[cursor].fillTs : Number.POSITIVE_INFINITY;
    const nextExitTs = openPositions.length > 0
      ? Math.min(...openPositions.map((pos) => pos.exitTs))
      : Number.POSITIVE_INFINITY;
    const eventTs = Math.min(nextEntryTs, nextExitTs);
    if (!Number.isFinite(eventTs)) break;

    if (nextExitTs <= nextEntryTs) {
      const survivors: typeof openPositions = [];
      for (const pos of openPositions) {
        if (pos.exitTs === nextExitTs) {
          const tradePnlUsd = pos.allocationUsd * (pos.pnlPct / 100);
          totalPnlUsd += tradePnlUsd;
          equity += tradePnlUsd;
        } else {
          survivors.push(pos);
        }
      }
      openPositions.length = 0;
      openPositions.push(...survivors);
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
      continue;
    }

    while (cursor < entries.length && entries[cursor].fillTs === nextEntryTs) {
      const entry = entries[cursor];
      const allocationUsd = Math.max(0, equity * POSITION_ALLOCATION_PCT);
      openPositions.push({
        exitTs: entry.exitTs,
        allocationUsd,
        pnlPct: entry.pnlPct,
      });
      cursor += 1;
    }
  }

  return { totalPnlUsd, maxDrawdownPct: maxDd };
}

function summarizeRows(offsetPct: number, symbol: SymbolBase | "ALL", rows: TradeResult[]): SummaryRow {
  const fills = rows.filter((row) => row.filled);
  const pnlFilled = fills
    .map((row) => row.pnlPct)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const holdHours = fills
    .map((row) => row.holdHours)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const wins = pnlFilled.filter((v) => v > 0).length;
  const equitySummary = symbol === "ALL"
    ? computeConcurrentEquitySummary(fills)
    : computeSequentialEquitySummary(fills);

  return {
    offsetPct,
    symbol,
    signals: rows.length,
    fills: fills.length,
    fillRatePct: rows.length > 0 ? (fills.length / rows.length) * 100 : 0,
    avgPnlPct: mean(pnlFilled),
    winRatePct: pnlFilled.length > 0 ? (wins / pnlFilled.length) * 100 : null,
    avgHoldHours: mean(holdHours),
    totalPnlUsd: equitySummary.totalPnlUsd,
    totalReturnPct: STARTING_EQUITY_USD > 0 ? (equitySummary.totalPnlUsd / STARTING_EQUITY_USD) * 100 : 0,
    maxDrawdownPct: equitySummary.maxDrawdownPct,
  };
}
function buildTable(rows: SummaryRow[]) {
  const header = [
    "Offset".padEnd(8),
    "Symbol".padEnd(8),
    "Signals".padStart(8),
    "Fills".padStart(8),
    "Fill%".padStart(8),
    "Avg PnL".padStart(10),
    "Win Rate".padStart(10),
    "Avg Holdh".padStart(10),
    "Total PnL$".padStart(12),
    "Total Ret".padStart(10),
    "Max DD".padStart(8),
  ].join(" | ");
  const separator = "-".repeat(header.length);
  const lines = [header, separator];

  for (const row of rows) {
    lines.push(
      [
        `${(row.offsetPct * 100).toFixed(2)}%`.padEnd(8),
        row.symbol.padEnd(8),
        String(row.signals).padStart(8),
        String(row.fills).padStart(8),
        fmtPct(row.fillRatePct).padStart(8),
        fmtPct(row.avgPnlPct).padStart(10),
        fmtPct(row.winRatePct).padStart(10),
        (row.avgHoldHours === null ? "n/a" : row.avgHoldHours.toFixed(2)).padStart(10),
        row.totalPnlUsd.toFixed(2).padStart(12),
        fmtPct(row.totalReturnPct).padStart(10),
        fmtPct(row.maxDrawdownPct).padStart(8),
      ].join(" | "),
    );
  }

  return lines.join("\n");
}

function buildExitReasonLine(rows: TradeResult[]) {
  const filled = rows.filter((row) => row.filled);
  const counts: Record<ExitReason, number> = {
    session_end: 0,
    trailing: 0,
    breakeven: 0,
    stop: 0,
  };
  for (const row of filled) {
    if (!row.exitReason) continue;
    counts[row.exitReason] += 1;
  }
  return `session_end=${counts.session_end}, trailing=${counts.trailing}, breakeven=${counts.breakeven}, stop=${counts.stop}`;
}

function buildMilestoneLine(rows: TradeResult[]) {
  const filled = rows.filter((row) => row.filled);
  const counts = [0, 0, 0, 0, 0];
  for (const row of filled) {
    const milestone = Math.max(0, Math.min(4, Math.floor(row.maxMilestone ?? 0)));
    counts[milestone] += 1;
  }
  return `m0=${counts[0]}, m1=${counts[1]}, m2=${counts[2]}, m3=${counts[3]}, m4=${counts[4]}`;
}

function computeTradePnlUsdMap(rows: TradeResult[]) {
  const fills = rows
    .filter((row) => row.filled && row.fillTsMs !== null && row.exitTsMs !== null && row.pnlPct !== null)
    .sort((a, b) => {
      const ta = a.fillTsMs ?? 0;
      const tb = b.fillTsMs ?? 0;
      if (ta !== tb) return ta - tb;
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      return a.signalTimeUtc.localeCompare(b.signalTimeUtc);
    });
  const pnlByRow = new Map<TradeResult, number>();
  let equity = STARTING_EQUITY_USD;
  const openPositions: Array<{ row: TradeResult; exitTs: number; allocationUsd: number; pnlPct: number }> = [];
  let cursor = 0;

  while (cursor < fills.length || openPositions.length > 0) {
    const nextEntryTs = cursor < fills.length ? (fills[cursor].fillTsMs as number) : Number.POSITIVE_INFINITY;
    const nextExitTs = openPositions.length > 0
      ? Math.min(...openPositions.map((pos) => pos.exitTs))
      : Number.POSITIVE_INFINITY;
    const eventTs = Math.min(nextEntryTs, nextExitTs);
    if (!Number.isFinite(eventTs)) break;

    if (nextExitTs <= nextEntryTs) {
      const survivors: typeof openPositions = [];
      for (const pos of openPositions) {
        if (pos.exitTs === nextExitTs) {
          const tradePnlUsd = pos.allocationUsd * (pos.pnlPct / 100);
          pnlByRow.set(pos.row, tradePnlUsd);
          equity += tradePnlUsd;
        } else {
          survivors.push(pos);
        }
      }
      openPositions.length = 0;
      openPositions.push(...survivors);
      continue;
    }

    while (cursor < fills.length && (fills[cursor].fillTsMs as number) === nextEntryTs) {
      const row = fills[cursor];
      const allocationUsd = Math.max(0, equity * POSITION_ALLOCATION_PCT);
      openPositions.push({
        row,
        exitTs: row.exitTsMs as number,
        allocationUsd,
        pnlPct: row.pnlPct as number,
      });
      cursor += 1;
    }
  }

  for (const row of rows) {
    if (!row.filled || row.pnlPct === null) continue;
    row.pnlUsd = pnlByRow.get(row) ?? 0;
  }
}

function buildJsonReport(options: {
  weekOpens: string[];
  offsets: number[];
  summaryRows: SummaryRow[];
  allTradeRows: TradeResult[];
}): LiqSweepJsonReport | null {
  const primaryOffset = options.offsets[0];
  if (!Number.isFinite(primaryOffset)) return null;
  const rows = options.allTradeRows.filter((row) => Math.abs(row.offsetPct - primaryOffset) < 1e-9);
  const fills = rows.filter((row) =>
    row.filled
    && row.fillTsMs !== null
    && row.exitTsMs !== null
    && row.pnlPct !== null
    && row.pnlUsd !== null
    && row.exitPrice !== null
    && row.leverageAtExit !== null
    && row.exitReason !== null
    && row.maxMilestone !== null,
  );
  const orderedFills = [...fills].sort((a, b) => {
    const ta = a.fillTsMs as number;
    const tb = b.fillTsMs as number;
    if (ta !== tb) return ta - tb;
    return a.signalTimeUtc.localeCompare(b.signalTimeUtc);
  });

  const weeksSorted = [...options.weekOpens].sort(
    (a, b) => DateTime.fromISO(a, { zone: "utc" }).toMillis() - DateTime.fromISO(b, { zone: "utc" }).toMillis(),
  );
  const weekly: LiqSweepJsonReport["weekly"] = [];
  let weekStartEquity = STARTING_EQUITY_USD;
  for (const weekOpenUtc of weeksSorted) {
    const weekRows = orderedFills.filter((row) => row.weekOpenUtc === weekOpenUtc);
    const weekPnlUsd = weekRows.reduce((sum, row) => sum + (row.pnlUsd as number), 0);
    const wins = weekRows.filter((row) => (row.pnlUsd as number) > 0).length;
    const losses = weekRows.filter((row) => (row.pnlUsd as number) < 0).length;
    let runningEquity = weekStartEquity;
    let peak = weekStartEquity;
    let maxDd = 0;
    const byExit = [...weekRows].sort((a, b) => (a.exitTsMs as number) - (b.exitTsMs as number));
    for (const row of byExit) {
      runningEquity += row.pnlUsd as number;
      if (runningEquity > peak) peak = runningEquity;
      const dd = peak > 0 ? ((peak - runningEquity) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }
    const weekPnlPct = weekStartEquity > 0 ? (weekPnlUsd / weekStartEquity) * 100 : 0;
    weekly.push({
      week_open_utc: weekOpenUtc,
      trades: weekRows.length,
      wins,
      losses,
      pnl_usd: Number(weekPnlUsd.toFixed(6)),
      pnl_pct: Number(weekPnlPct.toFixed(6)),
      max_drawdown_pct: Number(maxDd.toFixed(6)),
    });
    weekStartEquity += weekPnlUsd;
  }

  const allRow = options.summaryRows.find(
    (row) => row.symbol === "ALL" && Math.abs(row.offsetPct - primaryOffset) < 1e-9,
  );
  const totalPnlUsd = orderedFills.reduce((sum, row) => sum + (row.pnlUsd as number), 0);
  const wins = orderedFills.filter((row) => (row.pnlUsd as number) > 0).length;
  const grossProfit = orderedFills
    .filter((row) => (row.pnlUsd as number) > 0)
    .reduce((sum, row) => sum + (row.pnlUsd as number), 0);
  const grossLossAbs = Math.abs(
    orderedFills
      .filter((row) => (row.pnlUsd as number) < 0)
      .reduce((sum, row) => sum + (row.pnlUsd as number), 0),
  );
  const avgPnlPct = mean(
    orderedFills
      .map((row) => row.pnlPct)
      .filter((v): v is number => v !== null && Number.isFinite(v)),
  ) ?? 0;

  return {
    meta: {
      botId: "katarakti_v3_liq_sweep",
      market: "crypto_futures",
      generatedUtc: DateTime.utc().toISO() ?? "",
      weeks: weeksSorted,
      offsetPct: primaryOffset,
      slotMode: LIQ_SLOT_MODE,
      leverage: SCALING_INITIAL_LEVERAGE,
      positionAllocationPct: POSITION_ALLOCATION_PCT,
    },
    weekly,
    summary: {
      total_trades: orderedFills.length,
      total_pnl_usd: Number(totalPnlUsd.toFixed(6)),
      total_return_pct: allRow ? Number(allRow.totalReturnPct.toFixed(6)) : Number(((totalPnlUsd / STARTING_EQUITY_USD) * 100).toFixed(6)),
      win_rate_pct: orderedFills.length > 0 ? Number(((wins / orderedFills.length) * 100).toFixed(6)) : 0,
      max_drawdown_pct: allRow ? Number(allRow.maxDrawdownPct.toFixed(6)) : 0,
      avg_pnl_pct: Number(avgPnlPct.toFixed(6)),
      profit_factor: grossLossAbs > 0
        ? Number((grossProfit / grossLossAbs).toFixed(6))
        : grossProfit > 0
          ? Number.POSITIVE_INFINITY
          : 0,
    },
    trades: orderedFills.map((row) => ({
      symbol: row.symbol,
      direction: row.direction,
      entry_time_utc: row.fillTimeUtc,
      exit_time_utc: DateTime.fromMillis(row.exitTsMs as number, { zone: "utc" }).toISO() ?? "",
      entry_price: Number(row.limitPrice.toFixed(8)),
      exit_price: Number((row.exitPrice as number).toFixed(8)),
      pnl_pct: Number((row.pnlPct as number).toFixed(6)),
      pnl_usd: Number((row.pnlUsd as number).toFixed(6)),
      exit_reason: row.exitReason as ExitReason,
      max_milestone: row.maxMilestone as number,
      leverage_at_exit: row.leverageAtExit as number,
    })),
  };
}

function buildReport(
  weekOpens: string[],
  offsets: number[],
  summaryRows: SummaryRow[],
  allTradeRows: TradeResult[],
) {
  const lines: string[] = [];
  lines.push("Bitget Liquidation Sweep Simple Backtest");
  lines.push(`Generated UTC: ${DateTime.utc().toISO() ?? ""}`);
  lines.push(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  lines.push(`Symbols: ${SYMBOLS.join(", ")}`);
  lines.push(`Offsets: ${offsets.join(", ")}`);
  lines.push(`Signals tracked: ${allTradeRows.length}`);
  lines.push(`Slot mode: ${LIQ_SLOT_MODE}`);
  lines.push("Weekly bias filter: enabled (COT + sentiment)");
  lines.push(`Min sweep depth filter: ${(LIQ_MIN_SWEEP_PCT * 100).toFixed(2)}%`);
  lines.push("Entry trigger: first touch of liq level (no re-entry block)");
  lines.push(getExecutionConstraintLabel(LIQ_SLOT_MODE));
  lines.push(`Position sizing: ${(POSITION_ALLOCATION_PCT * 100).toFixed(0)}% of account`);
  lines.push(`Leverage: ${SCALING_INITIAL_LEVERAGE}x`);
  lines.push("Exit model: 10% initial stop + milestone ratchet (BE/trailing/session-end)");
  lines.push(`Starting equity (metrics): $${STARTING_EQUITY_USD.toFixed(2)}`);
  lines.push(`Max sessions to fill: ${MAX_SESSIONS_TO_FILL}`);
  lines.push("");
  lines.push(buildTable(summaryRows));
  lines.push("");
  lines.push("Per-trade fields tracked:");
  lines.push("symbol, date, direction, session_range_level, limit_price, filled, fill_time, sessions_elapsed, max_excursion_pct, hold_hours, pnl_pct, exit_reason, max_milestone");
  lines.push("");
  lines.push(`Filled trades: ${allTradeRows.filter((row) => row.filled).length}`);
  lines.push(`Unfilled signals: ${allTradeRows.filter((row) => !row.filled).length}`);
  lines.push(`Blocked by open-trade rule: ${allTradeRows.filter((row) => row.blockedByOpenTrade).length}`);
  lines.push("");
  lines.push("Exit reason breakdown by offset:");
  for (const offset of offsets) {
    const rows = allTradeRows.filter((row) => Math.abs(row.offsetPct - offset) < 1e-9);
    lines.push(`- ${(offset * 100).toFixed(2)}%: ${buildExitReasonLine(rows)}`);
  }
  lines.push("");
  lines.push("Milestone distribution by offset:");
  for (const offset of offsets) {
    const rows = allTradeRows.filter((row) => Math.abs(row.offsetPct - offset) < 1e-9);
    lines.push(`- ${(offset * 100).toFixed(2)}%: ${buildMilestoneLine(rows)}`);
  }
  lines.push("");
  lines.push("Lock diagnostics by symbol:");
  for (const symbol of SYMBOLS) {
    const rows = allTradeRows.filter((row) => row.symbol === symbol);
    const prelockFills = rows.filter((row) => row.prelockFilled).length;
    const blocked = rows.filter((row) => row.blockedByOpenTrade).length;
    const finalFills = rows.filter((row) => row.filled).length;
    lines.push(`- ${symbol}: prelock_fills=${prelockFills}, blocked=${blocked}, final_fills=${finalFills}`);
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
  if (!Number.isFinite(LIQ_MIN_SWEEP_PCT) || LIQ_MIN_SWEEP_PCT < 0) {
    throw new Error(`Invalid LIQ_MIN_SWEEP_PCT: ${String(LIQ_MIN_SWEEP_PCT)}`);
  }
  if (LIQ_SLOT_MODE_RAW !== "global" && LIQ_SLOT_MODE_RAW !== "per_symbol") {
    throw new Error(`Invalid LIQ_SLOT_MODE: "${LIQ_SLOT_MODE_RAW}" (expected "global" or "per_symbol")`);
  }
  if (!Number.isFinite(POSITION_ALLOCATION_PCT) || POSITION_ALLOCATION_PCT <= 0 || POSITION_ALLOCATION_PCT > 1) {
    throw new Error(`Invalid LIQ_POSITION_PCT: ${String(POSITION_ALLOCATION_PCT)} (expected 0 < value <= 1)`);
  }
  if (!Number.isFinite(STARTING_EQUITY_USD) || STARTING_EQUITY_USD <= 0) {
    throw new Error(`Invalid BACKTEST_STARTING_EQUITY_USD: ${String(STARTING_EQUITY_USD)}`);
  }

  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) throw new Error("No crypto COT snapshots found.");
  console.log(`Running simple liq-sweep backtest across ${weekOpens.length} completed week(s)...`);
  console.log(`Weeks: ${weekOpens.map((w) => w.slice(0, 10)).join(", ")}`);
  console.log(`Offsets: ${offsets.map((v) => `${(v * 100).toFixed(2)}%`).join(", ")}`);
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Slot mode: ${LIQ_SLOT_MODE}`);
  console.log("Weekly bias filter: enabled (COT + sentiment)");
  console.log(`Min sweep depth filter: ${(LIQ_MIN_SWEEP_PCT * 100).toFixed(2)}%`);
  console.log("Entry trigger: first touch of liq level (no re-entry block)");
  console.log(getExecutionConstraintLabel(LIQ_SLOT_MODE));
  console.log(`Position sizing: ${(POSITION_ALLOCATION_PCT * 100).toFixed(0)}% of account`);
  console.log(`Leverage: ${SCALING_INITIAL_LEVERAGE}x`);
  console.log("Exit model: 10% initial stop + milestone ratchet (BE/trailing/session-end)");
  console.log(`Starting equity (metrics): $${STARTING_EQUITY_USD.toFixed(2)}`);
  console.log("");

  const fundingBySymbol: Record<SymbolBase, FundingPoint[]> = {
    BTC: await fetchFundingHistory("BTC"),
    ETH: await fetchFundingHistory("ETH"),
  };

  const baseSignals = await buildRawSignals(weekOpens, cotHistory, fundingBySymbol);
  console.log(`Bias-aligned breach signals detected: ${baseSignals.length}`);

  const summaryRows: SummaryRow[] = [];
  const allTradeRows: TradeResult[] = [];

  for (const offset of offsets) {
    const rows = evaluateOffset(offset, baseSignals);
    computeTradePnlUsdMap(rows);
    allTradeRows.push(...rows);

    const btcRows = rows.filter((row) => row.symbol === "BTC");
    const ethRows = rows.filter((row) => row.symbol === "ETH");

    summaryRows.push(summarizeRows(offset, "BTC", btcRows));
    summaryRows.push(summarizeRows(offset, "ETH", ethRows));
    summaryRows.push(summarizeRows(offset, "ALL", rows));
  }

  const table = buildTable(summaryRows);
  console.log("");
  console.log(table);
  console.log("");
  for (const symbol of SYMBOLS) {
    const rows = allTradeRows.filter((row) => row.symbol === symbol);
    const prelockFills = rows.filter((row) => row.prelockFilled).length;
    const blocked = rows.filter((row) => row.blockedByOpenTrade).length;
    const finalFills = rows.filter((row) => row.filled).length;
    console.log(`Lock diagnostics ${symbol}: prelock=${prelockFills}, blocked=${blocked}, final=${finalFills}`);
  }
  for (const offset of offsets) {
    const rows = allTradeRows.filter((row) => Math.abs(row.offsetPct - offset) < 1e-9);
    console.log(`Exit reasons ${(offset * 100).toFixed(2)}%: ${buildExitReasonLine(rows)}`);
    console.log(`Milestones ${(offset * 100).toFixed(2)}%: ${buildMilestoneLine(rows)}`);
  }
  console.log("");

  const reportText = buildReport(weekOpens, offsets, summaryRows, allTradeRows);
  const reportPath = path.resolve(process.cwd(), "reports/bitget-liq-sweep-simple-latest.txt");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, reportText, "utf8");
  console.log(`Report written: ${reportPath}`);

  const jsonReport = buildJsonReport({
    weekOpens,
    offsets,
    summaryRows,
    allTradeRows,
  });
  if (jsonReport) {
    const jsonPath = path.resolve(process.cwd(), "reports/bitget-liq-sweep-simple-latest.json");
    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), "utf8");
    console.log(`JSON written: ${jsonPath}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[liq-sweep-simple] fatal:", message);
  process.exitCode = 1;
});
