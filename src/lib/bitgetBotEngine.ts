/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitgetBotEngine.ts
 *
 * Description:
 * Main Bitget Bot v2 DRY_RUN engine. Implements the production state machine,
 * weekly bias computation, range/signal evaluation, handshake gating, scaling
 * progression, and persistent heartbeat/state updates on every tick.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import { fetchBitgetAccount } from "@/lib/bitgetTrade";
import { query, queryOne } from "@/lib/db";
import { readBotState, writeBotState } from "@/lib/botState";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { readSnapshotHistory } from "@/lib/cotStore";
import { derivePairDirectionsByBase } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
import type { CotSnapshot } from "@/lib/cotTypes";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { sendEmail } from "@/lib/notifications/email";
import { fetchLiquidationSummary } from "@/lib/coinank";
import { readNearestLiquidationHeatmapSnapshot } from "@/lib/marketSnapshots";
import { buildLiquidationAdvisory, buildMultiTimeframeExitContext } from "@/lib/bitgetLiquidationFeatures";
import {
  buildAsiaLondonRange,
  buildUsSessionRange,
  classifyWeeklyBias,
  detectSignalForWindow,
  evaluateHandshake,
  type BotCandle,
  type ConfidenceTier,
  type Direction,
  type SessionWindow,
} from "@/lib/bitgetBotSignals";
import {
  computeScalingState,
  computeTrailingStop,
  shouldClosePosition,
  type Direction as RiskDirection,
} from "@/lib/bitgetBotRisk";
import {
  adjustLeverage,
  closePosition,
  openPosition,
  setStopLoss,
} from "@/lib/bitgetBotOrders";

export type BotLifecycleState =
  | "IDLE"
  | "WEEK_READY"
  | "WATCHING_RANGE"
  | "WATCHING_SWEEP"
  | "AWAITING_HANDSHAKE"
  | "POSITION_OPEN"
  | "SCALING"
  | "TRAILING"
  | "EXITING"
  | "ERROR"
  | "KILLED";

type CoreSymbol = "BTC" | "ETH";

type WeeklyBiasSide = {
  tier: ConfidenceTier;
  bias: Direction;
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
};

export type WeeklyBiasState = {
  weekOpenUtc: string;
  weekCloseUtc: string;
  btc: WeeklyBiasSide;
  eth: WeeklyBiasSide;
  computedAtUtc: string;
};

export type HandshakeState = {
  active: boolean;
  sessionWindow: SessionWindow | null;
  firstSymbol: CoreSymbol | null;
  firstConfirmTs: number | null;
  expiryTs: number | null;
};

export type LivePositionState = {
  symbol: CoreSymbol;
  direction: "LONG" | "SHORT";
  entryTs: number;
  entryPrice: number;
  stopPrice: number;
  initialLeverage: number;
  currentLeverage: number;
  maxLeverageReached: number;
  milestonesHit: number[];
  breakevenReached: boolean;
  trailingActive: boolean;
  trailingOffsetPct: number | null;
  sessionWindow: SessionWindow;
  peakPrice: number;
  marginUsd: number;
  entryTimeUtc: string;
};

export type BitgetBotStateV1 = {
  version: 1;
  lifecycle: BotLifecycleState;
  lockOwner: string | null;
  lockAcquiredAtUtc: string | null;
  weeklyBias: WeeklyBiasState | null;
  handshake: HandshakeState;
  positions: LivePositionState[];
  entriesThisWeek: { weekOpenUtc: string; BTC: number; ETH: number };
  lastTickUtc: string;
  lastError: string | null;
};

export type TickResult = {
  ok: boolean;
  lifecycle: BotLifecycleState;
  transitions: string[];
  positions: LivePositionState[];
  dryRun: boolean;
  errors: string[];
  tickDurationMs: number;
};

export type TickOptions = {
  nowUtcIso?: string;
};

const BOT_ID = "bitget_perp_v2";
const STRATEGY_ID = "variant_c_handshake_scaling_overnight_v2";
const LOCK_KEY = "bitget_perp_v2";
const CORE_SYMBOLS: readonly CoreSymbol[] = ["BTC", "ETH"];
const HANDSHAKE_WINDOW_MINUTES = Number(process.env.BITGET_BOT_HANDSHAKE_WINDOW_MINUTES ?? "60");
const WEEKLY_MAX_ENTRIES = Number(process.env.BITGET_BOT_WEEKLY_MAX_ENTRIES_PER_SYMBOL ?? "5");
const INITIAL_LEVERAGE = Number(process.env.BITGET_BOT_INITIAL_LEVERAGE ?? "5");
const HANDSHAKE_MARGIN_PCT_PER_SYMBOL = (() => {
  const raw = Number(process.env.BITGET_BOT_HANDSHAKE_MARGIN_PCT_PER_SYMBOL ?? "0.45");
  const fallback = 0.45;
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(0.5, raw));
})();
const DRY_RUN = String(process.env.BITGET_BOT_DRY_RUN ?? "true").toLowerCase() !== "false";
const LIQ_ADVISORY_ENABLED = String(process.env.BITGET_LIQ_ADVISORY_ENABLED ?? "true").toLowerCase() !== "false";
const LIQ_ADVISORY_INTERVAL = (process.env.BITGET_LIQ_ADVISORY_INTERVAL ?? "1d").trim() || "1d";
const LIQ_ADVISORY_EXCHANGE_GROUP =
  (process.env.BITGET_LIQ_ADVISORY_EXCHANGE_GROUP ?? "binance_bybit").trim() || "binance_bybit";
const LIQ_ADVISORY_THRESHOLD = Number(process.env.BITGET_LIQ_ADVISORY_THRESHOLD ?? "1.2");
const LIQ_ADVISORY_MAX_AGE_MINUTES = Number(process.env.BITGET_LIQ_ADVISORY_MAX_AGE_MINUTES ?? "240");
const LIQ_EXIT_INTERVALS = ["6h", "1d", "7d", "30d"] as const;

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
          (value.startsWith("\"") && value.endsWith("\"")) ||
          (value.startsWith("'") && value.endsWith("'"))
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

function defaultState(nowIso: string, weekOpenUtc: string): BitgetBotStateV1 {
  return {
    version: 1,
    lifecycle: "IDLE",
    lockOwner: null,
    lockAcquiredAtUtc: null,
    weeklyBias: null,
    handshake: {
      active: false,
      sessionWindow: null,
      firstSymbol: null,
      firstConfirmTs: null,
      expiryTs: null,
    },
    positions: [],
    entriesThisWeek: {
      weekOpenUtc,
      BTC: 0,
      ETH: 0,
    },
    lastTickUtc: nowIso,
    lastError: null,
  };
}

function transitionState(
  state: BitgetBotStateV1,
  next: BotLifecycleState,
  transitions: string[],
  reason: string,
) {
  if (state.lifecycle === next) return;
  transitions.push(`${state.lifecycle} -> ${next} (${reason})`);
  state.lifecycle = next;
}

function getWeekWindow(nowUtc = DateTime.utc()) {
  const weekOpenUtc = getCanonicalWeekOpenUtc(nowUtc);
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekClose = weekOpen.plus({ weeks: 1 });
  return { weekOpenUtc, weekOpen, weekClose };
}

function previousUtcDay(day: string) {
  const dt = DateTime.fromISO(day, { zone: "utc" });
  return dt.minus({ days: 1 }).toISODate() ?? day;
}

function getUtcDay(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function getUtcHour(ts: number) {
  return new Date(ts).getUTCHours();
}

function getSessionWindow(nowMs: number): SessionWindow | null {
  const hour = getUtcHour(nowMs);
  if (hour >= 13 && hour < 21) return "ASIA_LONDON_RANGE_NY_ENTRY";
  if (hour >= 0 && hour < 13) return "US_RANGE_ASIA_LONDON_ENTRY";
  return null;
}

function symbolToPair(base: CoreSymbol) {
  return `${base}USD`;
}

function getBiasDirectionFromSentiment(agg?: SentimentAggregate): Direction {
  if (!agg) return "NEUTRAL";
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return "NEUTRAL";
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return "NEUTRAL";
}

function selectCotSnapshotForWeek(history: CotSnapshot[], weekOpenUtc: string) {
  const weekDate = weekOpenUtc.slice(0, 10);
  const sorted = [...history].sort((a, b) => b.report_date.localeCompare(a.report_date));
  return sorted.find((snap) => snap.report_date <= weekDate) ?? sorted.at(-1) ?? null;
}

async function computeWeeklyBiasState(
  weekOpenUtc: string,
  weekCloseUtc: string,
): Promise<WeeklyBiasState> {
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) {
    throw new Error("No crypto COT snapshot history available.");
  }

  const cotSnapshot = selectCotSnapshotForWeek(cotHistory, weekOpenUtc);
  if (!cotSnapshot) {
    throw new Error("Unable to resolve weekly COT snapshot.");
  }

  const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
  const dealerPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "dealer");
  const commercialPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "commercial");
  const sentiment = await getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekCloseUtc);
  const sentimentMap = new Map(sentiment.map((row) => [row.symbol.toUpperCase(), row]));

  const bySymbol = {} as Record<CoreSymbol, WeeklyBiasSide>;
  for (const base of CORE_SYMBOLS) {
    const pair = symbolToPair(base);
    const dealer = (dealerPairs[pair]?.direction ?? "NEUTRAL") as Direction;
    const commercial = (commercialPairs[pair]?.direction ?? "NEUTRAL") as Direction;
    const agg =
      sentimentMap.get(pair) ??
      sentimentMap.get(base) ??
      sentimentMap.get(`${base}USDT`);
    const sentimentDirection = getBiasDirectionFromSentiment(agg);
    const classified = classifyWeeklyBias(dealer, commercial, sentimentDirection);
    bySymbol[base] = {
      tier: classified.tier,
      bias: classified.direction,
      dealer,
      commercial,
      sentiment: sentimentDirection,
    };
  }

  return {
    weekOpenUtc,
    weekCloseUtc,
    btc: bySymbol.BTC,
    eth: bySymbol.ETH,
    computedAtUtc: DateTime.utc().toISO() ?? new Date().toISOString(),
  };
}

async function fetchRawMinuteCandles(
  symbolBase: CoreSymbol,
  openUtc: DateTime,
  closeUtc: DateTime,
): Promise<BotCandle[]> {
  const productType = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
  const out = new Map<number, BotCandle>();
  let cursor = openUtc.toMillis();
  const closeMs = closeUtc.toMillis();
  const windowMs = 200 * 60_000;

  while (cursor < closeMs) {
    const windowEnd = Math.min(cursor + windowMs, closeMs);
    const url = new URL("https://api.bitget.com/api/v2/mix/market/history-candles");
    url.searchParams.set("symbol", `${symbolBase}USDT`);
    url.searchParams.set("productType", productType);
    url.searchParams.set("granularity", "1m");
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(windowEnd));
    url.searchParams.set("limit", "200");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Minute candle fetch failed (${response.status}) for ${symbolBase}`);
    }

    const body = (await response.json()) as { code?: string; data?: string[][] };
    if (body.code && body.code !== "00000") {
      throw new Error(`Minute candle API error ${symbolBase}: ${body.code}`);
    }

    const rows = (body.data ?? [])
      .map((row) => {
        const quoteVolume = Number(row[6] ?? row[5]);
        return {
          ts: Number(row[0]),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : null,
        };
      })
      .filter((row) =>
        Number.isFinite(row.ts) &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close),
      )
      .filter((row) => row.ts >= cursor && row.ts < windowEnd)
      .sort((a, b) => a.ts - b.ts);

    if (!rows.length) {
      cursor = windowEnd;
      continue;
    }

    for (const row of rows) {
      out.set(row.ts, row);
    }
    cursor = windowEnd;
  }

  return Array.from(out.values()).sort((a, b) => a.ts - b.ts);
}

function sessionCandlesForNow(
  candles: BotCandle[],
  dayUtc: string,
  window: SessionWindow,
  nowMs: number,
) {
  return candles.filter((c) => {
    if (c.ts > nowMs) return false;
    if (getUtcDay(c.ts) !== dayUtc) return false;
    const hour = getUtcHour(c.ts);
    if (window === "ASIA_LONDON_RANGE_NY_ENTRY") return hour >= 13 && hour < 21;
    return hour >= 0 && hour < 13;
  });
}

function asRiskDirection(value: Direction): RiskDirection | null {
  if (value === "LONG" || value === "SHORT") return value;
  return null;
}

function safePnlUsd(position: LivePositionState, exitPrice: number) {
  if (!(position.entryPrice > 0) || !(position.marginUsd > 0)) return 0;
  const pct = position.direction === "LONG"
    ? (exitPrice - position.entryPrice) / position.entryPrice
    : (position.entryPrice - exitPrice) / position.entryPrice;
  return position.marginUsd * position.currentLeverage * pct;
}

async function sendBotNotification(subject: string, html: string) {
  const prefixed = DRY_RUN ? `[DRY RUN] ${subject}` : subject;
  await sendEmail({
    to: process.env.SENTIMENT_ALERT_EMAIL_TO ?? "",
    subject: prefixed,
    html,
  });
}

async function safeInsertTradeOpen(params: {
  symbol: CoreSymbol;
  direction: "LONG" | "SHORT";
  sessionWindow: SessionWindow;
  rangeSource: string;
  entryTimeUtc: string;
  entryPrice: number;
  stopPrice: number;
  initialLeverage: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    await query(
      `INSERT INTO bitget_bot_trades
        (bot_id, strategy_id, symbol, direction, session_window, range_source,
         entry_time_utc, entry_price, stop_price, initial_leverage, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11::jsonb)
       ON CONFLICT (strategy_id, symbol, entry_time_utc) DO NOTHING`,
      [
        BOT_ID,
        STRATEGY_ID,
        params.symbol,
        params.direction,
        params.sessionWindow,
        params.rangeSource,
        params.entryTimeUtc,
        params.entryPrice,
        params.stopPrice,
        params.initialLeverage,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
  } catch {
    // Table may not exist before migration apply; keep tick non-fatal.
  }
}

async function safeUpdateTradeClose(params: {
  symbol: CoreSymbol;
  entryTimeUtc: string;
  exitTimeUtc: string;
  exitPrice: number;
  exitReason: string;
  maxLeverageReached: number;
  milestonesHit: number[];
  pnlUsd: number;
}) {
  try {
    await query(
      `UPDATE bitget_bot_trades
         SET exit_time_utc = $1::timestamptz,
             exit_price = $2,
             exit_reason = $3,
             max_leverage_reached = $4,
             milestones_hit = $5::jsonb,
             pnl_usd = $6,
             updated_at = NOW()
       WHERE bot_id = $7
         AND strategy_id = $8
         AND symbol = $9
         AND entry_time_utc = $10::timestamptz`,
      [
        params.exitTimeUtc,
        params.exitPrice,
        params.exitReason,
        params.maxLeverageReached,
        JSON.stringify(params.milestonesHit),
        params.pnlUsd,
        BOT_ID,
        STRATEGY_ID,
        params.symbol,
        params.entryTimeUtc,
      ],
    );
  } catch {
    // Non-fatal while migrations are pending.
  }
}

async function safeInsertRange(params: {
  dayUtc: string;
  symbol: CoreSymbol;
  rangeSource: "ASIA+LONDON" | "US";
  high: number;
  low: number;
  lockedAtUtc: string;
}) {
  try {
    await query(
      `INSERT INTO bitget_bot_ranges
        (bot_id, day_utc, symbol, range_source, high, low, locked_at_utc)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7::timestamptz)
       ON CONFLICT (day_utc, symbol, range_source) DO UPDATE
         SET high = EXCLUDED.high,
             low = EXCLUDED.low,
             locked_at_utc = EXCLUDED.locked_at_utc`,
      [BOT_ID, params.dayUtc, params.symbol, params.rangeSource, params.high, params.low, params.lockedAtUtc],
    );
  } catch {
    // Non-fatal while migrations are pending.
  }
}

async function persistSessionRanges(
  candleMap: Record<CoreSymbol, BotCandle[]>,
  nowIso: string,
) {
  try {
    const todayUtc = DateTime.fromISO(nowIso, { zone: "utc" }).toISODate()
      ?? new Date().toISOString().slice(0, 10);
    const yesterdayUtc = previousUtcDay(todayUtc);

    const asiaLondonRangeByDay = {
      BTC: buildAsiaLondonRange(candleMap.BTC),
      ETH: buildAsiaLondonRange(candleMap.ETH),
    };
    const usRangeByDay = {
      BTC: buildUsSessionRange(candleMap.BTC),
      ETH: buildUsSessionRange(candleMap.ETH),
    };

    for (const symbol of CORE_SYMBOLS) {
      const asiaLondonToday = asiaLondonRangeByDay[symbol].get(todayUtc);
      if (asiaLondonToday?.locked) {
        await safeInsertRange({
          dayUtc: todayUtc,
          symbol,
          rangeSource: "ASIA+LONDON",
          high: asiaLondonToday.high,
          low: asiaLondonToday.low,
          lockedAtUtc: nowIso,
        });
      }

      const usYesterday = usRangeByDay[symbol].get(yesterdayUtc);
      if (usYesterday?.locked) {
        await safeInsertRange({
          dayUtc: yesterdayUtc,
          symbol,
          rangeSource: "US",
          high: usYesterday.high,
          low: usYesterday.low,
          lockedAtUtc: nowIso,
        });
      }
    }
  } catch {
    // Keep range persistence non-fatal and decoupled from trading flow.
  }
}

async function safeInsertSignal(params: {
  dayUtc: string;
  symbol: CoreSymbol;
  sessionWindow: SessionWindow;
  confirmTimeUtc: string;
  direction: "LONG" | "SHORT";
  sweepPct: number;
  displacementPct: number;
  status: string;
  handshakeGroupId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const existing = await queryOne<{ id: number }>(
      `SELECT id
         FROM bitget_bot_signals
        WHERE bot_id = $1
          AND day_utc = $2::date
          AND symbol = $3
          AND session_window = $4
          AND confirm_time_utc = $5::timestamptz
          AND direction = $6
        LIMIT 1`,
      [
        BOT_ID,
        params.dayUtc,
        params.symbol,
        params.sessionWindow,
        params.confirmTimeUtc,
        params.direction,
      ],
    );
    if (existing) return;

    await query(
      `INSERT INTO bitget_bot_signals
        (bot_id, day_utc, symbol, session_window, confirm_time_utc,
         direction, sweep_pct, displacement_pct, handshake_group_id, status, metadata)
       VALUES
        ($1, $2::date, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        BOT_ID,
        params.dayUtc,
        params.symbol,
        params.sessionWindow,
        params.confirmTimeUtc,
        params.direction,
        params.sweepPct,
        params.displacementPct,
        params.handshakeGroupId ?? null,
        params.status,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
  } catch {
    // Non-fatal while migrations are pending.
  }
}

async function safeAttachHandshakeGroup(params: {
  dayUtc: string;
  symbol: CoreSymbol;
  sessionWindow: SessionWindow;
  confirmTimeUtc: string;
  handshakeGroupId: string;
}) {
  try {
    await query(
      `UPDATE bitget_bot_signals
          SET handshake_group_id = $1,
              status = 'HANDSHAKE_CONFIRMED',
              metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
        WHERE bot_id = $3
          AND day_utc = $4::date
          AND symbol = $5
          AND session_window = $6
          AND confirm_time_utc = $7::timestamptz`,
      [
        params.handshakeGroupId,
        JSON.stringify({ handshake_group_id: params.handshakeGroupId }),
        BOT_ID,
        params.dayUtc,
        params.symbol,
        params.sessionWindow,
        params.confirmTimeUtc,
      ],
    );
  } catch {
    // Non-fatal while migrations are pending.
  }
}

async function fetchEntryMarketMetadata(
  symbol: CoreSymbol,
  referencePrice: number,
  direction: RiskDirection,
  atUtc: string,
) {
  const metadata: Record<string, unknown> = {
    funding_rate: null,
    open_interest: null,
    last_price: null,
    bitget_snapshot_time_utc: null,
    liquidation: {
      dominant_side: null,
      total_long_usd: null,
      total_short_usd: null,
      nearest_cluster: null,
      largest_above: null,
      largest_below: null,
      last_updated: null,
    },
    liquidation_intelligence: {
      enabled: LIQ_ADVISORY_ENABLED,
      interval: LIQ_ADVISORY_INTERVAL,
      exchange_group: LIQ_ADVISORY_EXCHANGE_GROUP,
      advisory: null,
      as_of_utc: atUtc,
    },
    exit_context: null as unknown,
    warnings: [] as string[],
  };

  try {
    const snapshot = await fetchBitgetFuturesSnapshot(symbol);
    const snapshotTsMs = Number(snapshot.lastPriceTime ?? NaN);
    metadata.funding_rate = snapshot.fundingRate;
    metadata.open_interest = snapshot.openInterest;
    metadata.last_price = snapshot.lastPrice;
    metadata.bitget_snapshot_time_utc =
      Number.isFinite(snapshotTsMs) && snapshotTsMs > 0
        ? new Date(snapshotTsMs).toISOString()
        : new Date().toISOString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    (metadata.warnings as string[]).push(`bitget_snapshot_failed: ${message}`);
  }

  try {
    const summary = await fetchLiquidationSummary(symbol, referencePrice, "Bitget Futures");
    const nearestCluster = summary.recentClusters
      .filter((cluster) => Number.isFinite(cluster.price ?? NaN))
      .sort((a, b) => Math.abs((a.price ?? 0) - referencePrice) - Math.abs((b.price ?? 0) - referencePrice))[0] ?? null;

    metadata.liquidation = {
      dominant_side: summary.dominantSide,
      total_long_usd: summary.totalLongUsd,
      total_short_usd: summary.totalShortUsd,
      nearest_cluster: nearestCluster,
      largest_above: summary.largestAbove ?? null,
      largest_below: summary.largestBelow ?? null,
      last_updated: summary.lastUpdated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    (metadata.warnings as string[]).push(`liquidation_snapshot_failed: ${message}`);
  }

  if (LIQ_ADVISORY_ENABLED) {
    // Fetch primary interval advisory (backward compatible)
    try {
      const heatmap = await readNearestLiquidationHeatmapSnapshot({
        symbol,
        atUtc,
        interval: LIQ_ADVISORY_INTERVAL,
        exchangeGroup: LIQ_ADVISORY_EXCHANGE_GROUP,
        maxAgeMinutes: LIQ_ADVISORY_MAX_AGE_MINUTES,
      });

      if (!heatmap) {
        (metadata.warnings as string[]).push("liquidation_advisory_missing_snapshot");
      } else {
        const advisory = buildLiquidationAdvisory(heatmap, direction, {
          opposingThreshold: LIQ_ADVISORY_THRESHOLD,
        });
        metadata.liquidation_intelligence = {
          enabled: true,
          interval: LIQ_ADVISORY_INTERVAL,
          exchange_group: LIQ_ADVISORY_EXCHANGE_GROUP,
          advisory,
          as_of_utc: atUtc,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      (metadata.warnings as string[]).push(`liquidation_advisory_failed: ${message}`);
    }

    // Fetch all intervals in parallel for multi-timeframe exit context
    try {
      const settled = await Promise.allSettled(
        LIQ_EXIT_INTERVALS.map(async (interval) => {
          const snapshot = await readNearestLiquidationHeatmapSnapshot({
            symbol,
            atUtc,
            interval,
            exchangeGroup: LIQ_ADVISORY_EXCHANGE_GROUP,
            maxAgeMinutes: LIQ_ADVISORY_MAX_AGE_MINUTES,
          });
          return { interval, snapshot };
        }),
      );

      const snapshotMap = new Map<string, Awaited<ReturnType<typeof readNearestLiquidationHeatmapSnapshot>> & {}>();
      for (const result of settled) {
        if (result.status === "fulfilled" && result.value.snapshot) {
          snapshotMap.set(result.value.interval, result.value.snapshot);
        }
      }

      if (snapshotMap.size > 0) {
        metadata.exit_context = buildMultiTimeframeExitContext(snapshotMap, direction, {
          symbol,
          currentPrice: referencePrice,
          opposingThreshold: LIQ_ADVISORY_THRESHOLD,
        });
      } else {
        (metadata.warnings as string[]).push("exit_context_no_snapshots_available");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      (metadata.warnings as string[]).push(`exit_context_failed: ${message}`);
    }
  }

  return metadata;
}

async function acquireLock() {
  const row = await queryOne<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
    [LOCK_KEY],
  );
  return row?.locked === true;
}

async function releaseLock() {
  await query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]).catch(() => undefined);
}

function getEquityFallback() {
  const fromEnv = Number(process.env.BITGET_BOT_PAPER_BALANCE_USD ?? "1000");
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 1000;
}

function loadAltSymbols(): string[] {
  // Phase 2: integrate alt-pair-screener.ts
  return ["BTCUSDT", "ETHUSDT"];
}

export async function tick(options?: TickOptions): Promise<TickResult> {
  loadEnvFromFile();
  const startedMs = Date.now();
  const forcedNow = options?.nowUtcIso
    ? DateTime.fromISO(options.nowUtcIso, { zone: "utc" })
    : null;
  const now = forcedNow && forcedNow.isValid ? forcedNow : DateTime.utc();
  const nowIso = now.toISO() ?? new Date().toISOString();
  const errors: string[] = [];
  const transitions: string[] = [];

  const lockAcquired = await acquireLock();
  if (!lockAcquired) {
    return {
      ok: true,
      lifecycle: "IDLE",
      transitions: ["SKIP: advisory lock busy"],
      positions: [],
      dryRun: DRY_RUN,
      errors: [],
      tickDurationMs: Date.now() - startedMs,
    };
  }

  let state: BitgetBotStateV1 | null = null;
  try {
    const { weekOpenUtc, weekClose } = getWeekWindow(now);
    const loaded = await readBotState<BitgetBotStateV1>(BOT_ID);
    state = loaded?.state ?? defaultState(nowIso, weekOpenUtc);
    state.lockOwner = LOCK_KEY;
    state.lockAcquiredAtUtc = nowIso;

    if (state.entriesThisWeek.weekOpenUtc !== weekOpenUtc) {
      if (state.positions.length) {
        transitionState(state, "EXITING", transitions, "week-roll flatten");
        for (const position of state.positions) {
          const closeResult = await closePosition(`${position.symbol}USDT`, {
            botId: BOT_ID,
            weekId: state.entriesThisWeek.weekOpenUtc,
            direction: position.direction,
          });
          if (!closeResult.ok) {
            errors.push(`Week-roll close failed for ${position.symbol}: ${closeResult.message ?? "unknown"}`);
          }
          const exitPrice = closeResult.price ?? position.entryPrice;
          const exitTimeUtc = new Date().toISOString();
          await safeUpdateTradeClose({
            symbol: position.symbol,
            entryTimeUtc: position.entryTimeUtc,
            exitTimeUtc,
            exitPrice,
            exitReason: "WEEK_CLOSE",
            maxLeverageReached: position.maxLeverageReached,
            milestonesHit: position.milestonesHit,
            pnlUsd: safePnlUsd(position, exitPrice),
          });
        }
      }

      state.weeklyBias = null;
      state.positions = [];
      state.handshake = {
        active: false,
        sessionWindow: null,
        firstSymbol: null,
        firstConfirmTs: null,
        expiryTs: null,
      };
      state.entriesThisWeek = { weekOpenUtc, BTC: 0, ETH: 0 };
      transitionState(state, "IDLE", transitions, "new week reset");
    }

    if (String(process.env.BITGET_BOT_KILL_SWITCH ?? "false").toLowerCase() === "true") {
      if (state.positions.length) {
        transitionState(state, "EXITING", transitions, "kill-switch flatten");
        for (const position of state.positions) {
          const closeResult = await closePosition(`${position.symbol}USDT`, {
            botId: BOT_ID,
            weekId: state.entriesThisWeek.weekOpenUtc,
            direction: position.direction,
          });
          if (!closeResult.ok) {
            errors.push(`Kill-switch close failed for ${position.symbol}: ${closeResult.message ?? "unknown"}`);
          }
        }
      }
      state.positions = [];
      transitionState(state, "KILLED", transitions, "kill-switch active");
      await sendBotNotification("Bitget bot kill switch triggered", "<p>All positions flattened.</p>");
      state.lastTickUtc = nowIso;
      state.lastError = null;
      await writeBotState(BOT_ID, state);
      return {
        ok: true,
        lifecycle: state.lifecycle,
        transitions,
        positions: state.positions,
        dryRun: DRY_RUN,
        errors,
        tickDurationMs: Date.now() - startedMs,
      };
    }

    if (!state.weeklyBias || state.weeklyBias.weekOpenUtc !== weekOpenUtc) {
      state.weeklyBias = await computeWeeklyBiasState(
        weekOpenUtc,
        weekClose.toISO() ?? weekOpenUtc,
      );
      transitionState(state, "WEEK_READY", transitions, "weekly bias computed");
    }

    const altUniverse = loadAltSymbols();
    if (!altUniverse.includes("BTCUSDT") || !altUniverse.includes("ETHUSDT")) {
      errors.push("Alt universe stub must include BTCUSDT and ETHUSDT.");
    }

    const candleStart = now.minus({ hours: 36 });
    const candleEnd = now.plus({ minutes: 1 });
    const candleMap = {} as Record<CoreSymbol, BotCandle[]>;
    for (const symbol of CORE_SYMBOLS) {
      candleMap[symbol] = await fetchRawMinuteCandles(symbol, candleStart, candleEnd);
    }
    await persistSessionRanges(candleMap, nowIso);

    const window = getSessionWindow(now.toMillis());
    if (!window) {
      transitionState(state, "WATCHING_RANGE", transitions, "outside entry window");
    } else {
      const currentDayUtc = now.toISODate() ?? getUtcDay(now.toMillis());

      const rangeDay = window === "ASIA_LONDON_RANGE_NY_ENTRY"
        ? currentDayUtc
        : previousUtcDay(currentDayUtc);

      const asiaLondonRangeByDay = {
        BTC: buildAsiaLondonRange(candleMap.BTC),
        ETH: buildAsiaLondonRange(candleMap.ETH),
      };
      const usRangeByDay = {
        BTC: buildUsSessionRange(candleMap.BTC),
        ETH: buildUsSessionRange(candleMap.ETH),
      };

      const ranges = {
        BTC: window === "ASIA_LONDON_RANGE_NY_ENTRY"
          ? asiaLondonRangeByDay.BTC.get(rangeDay)
          : usRangeByDay.BTC.get(rangeDay),
        ETH: window === "ASIA_LONDON_RANGE_NY_ENTRY"
          ? asiaLondonRangeByDay.ETH.get(rangeDay)
          : usRangeByDay.ETH.get(rangeDay),
      };

      if (!ranges.BTC?.locked || !ranges.ETH?.locked) {
        transitionState(state, "WATCHING_RANGE", transitions, "range not locked");
      } else {
        transitionState(state, "WATCHING_SWEEP", transitions, "range locked");

        const btcCandles = sessionCandlesForNow(candleMap.BTC, currentDayUtc, window, now.toMillis());
        const ethCandles = sessionCandlesForNow(candleMap.ETH, currentDayUtc, window, now.toMillis());
        const btcBias = state.weeklyBias.btc;
        const ethBias = state.weeklyBias.eth;
        const btcDetect = detectSignalForWindow(ranges.BTC, btcCandles, btcBias.bias, btcBias.tier);
        const ethDetect = detectSignalForWindow(ranges.ETH, ethCandles, ethBias.bias, ethBias.tier);

        if (btcDetect.signal) {
          await safeInsertSignal({
            dayUtc: currentDayUtc,
            symbol: "BTC",
            sessionWindow: window,
            confirmTimeUtc: new Date(btcDetect.signal.confirmTs).toISOString(),
            direction: btcDetect.signal.direction,
            sweepPct: btcDetect.signal.sweepPct,
            displacementPct: btcDetect.signal.displacementPct,
            status: "CANDIDATE",
            metadata: { tier: btcBias.tier, bias: btcBias.bias },
          });
        } else if (btcDetect.bestUnqualified) {
          const uq = btcDetect.bestUnqualified;
          await safeInsertSignal({
            dayUtc: currentDayUtc,
            symbol: "BTC",
            sessionWindow: window,
            confirmTimeUtc: new Date(uq.sweepTs).toISOString(),
            direction: uq.direction,
            sweepPct: uq.sweepPct,
            displacementPct: uq.displacementPct ?? 0,
            status: "UNQUALIFIED",
            metadata: {
              tier: btcBias.tier,
              bias: btcBias.bias,
              reason: uq.reason,
              diagnostics: btcDetect.diagnostics,
            },
          });
        }
        if (ethDetect.signal) {
          await safeInsertSignal({
            dayUtc: currentDayUtc,
            symbol: "ETH",
            sessionWindow: window,
            confirmTimeUtc: new Date(ethDetect.signal.confirmTs).toISOString(),
            direction: ethDetect.signal.direction,
            sweepPct: ethDetect.signal.sweepPct,
            displacementPct: ethDetect.signal.displacementPct,
            status: "CANDIDATE",
            metadata: { tier: ethBias.tier, bias: ethBias.bias },
          });
        } else if (ethDetect.bestUnqualified) {
          const uq = ethDetect.bestUnqualified;
          await safeInsertSignal({
            dayUtc: currentDayUtc,
            symbol: "ETH",
            sessionWindow: window,
            confirmTimeUtc: new Date(uq.sweepTs).toISOString(),
            direction: uq.direction,
            sweepPct: uq.sweepPct,
            displacementPct: uq.displacementPct ?? 0,
            status: "UNQUALIFIED",
            metadata: {
              tier: ethBias.tier,
              bias: ethBias.bias,
              reason: uq.reason,
              diagnostics: ethDetect.diagnostics,
            },
          });
        }

        const handshake = evaluateHandshake(
          btcDetect.signal,
          ethDetect.signal,
          HANDSHAKE_WINDOW_MINUTES,
        );

        if (handshake.reason === "single_symbol") {
          transitionState(state, "AWAITING_HANDSHAKE", transitions, "single symbol signal");
        }

        if (
          handshake.triggered &&
          handshake.entryTs !== null &&
          state.positions.length === 0 &&
          state.entriesThisWeek.BTC < WEEKLY_MAX_ENTRIES &&
          state.entriesThisWeek.ETH < WEEKLY_MAX_ENTRIES
        ) {
          const account = await fetchBitgetAccount().catch(() => null);
          const equity = Number(account?.available ?? account?.usdtEquity ?? account?.equity ?? NaN);
          const allocEquity = Number.isFinite(equity) && equity > 0 ? equity : getEquityFallback();
          const marginPerSymbol = allocEquity * HANDSHAKE_MARGIN_PCT_PER_SYMBOL;
          const entryWeekId = state.entriesThisWeek.weekOpenUtc;
          const handshakeGroupId = `${entryWeekId}:${window}:${handshake.entryTs}`;

          if (btcDetect.signal) {
            await safeAttachHandshakeGroup({
              dayUtc: currentDayUtc,
              symbol: "BTC",
              sessionWindow: window,
              confirmTimeUtc: new Date(btcDetect.signal.confirmTs).toISOString(),
              handshakeGroupId,
            });
          }
          if (ethDetect.signal) {
            await safeAttachHandshakeGroup({
              dayUtc: currentDayUtc,
              symbol: "ETH",
              sessionWindow: window,
              confirmTimeUtc: new Date(ethDetect.signal.confirmTs).toISOString(),
              handshakeGroupId,
            });
          }

          const btcDirection = asRiskDirection(btcDetect.signal?.direction ?? "NEUTRAL");
          const ethDirection = asRiskDirection(ethDetect.signal?.direction ?? "NEUTRAL");
          if (!btcDirection || !ethDirection) {
            errors.push("Handshake triggered but one or more symbol directions are not executable.");
          } else {
            const btcOpen = await openPosition(
              "BTCUSDT",
              btcDirection,
              marginPerSymbol,
              INITIAL_LEVERAGE,
              { botId: BOT_ID, weekId: entryWeekId, actionTsMs: handshake.entryTs },
            );
            const ethOpen = await openPosition(
              "ETHUSDT",
              ethDirection,
              marginPerSymbol,
              INITIAL_LEVERAGE,
              { botId: BOT_ID, weekId: entryWeekId, actionTsMs: handshake.entryTs },
            );

            if (!btcOpen.ok || !ethOpen.ok) {
              errors.push(`Entry failed BTC:${btcOpen.message ?? "ok"} ETH:${ethOpen.message ?? "ok"}`);
            } else {
              const entryTimeUtc = new Date(handshake.entryTs).toISOString();
              const btcPrice = btcOpen.price ?? 0;
              const ethPrice = ethOpen.price ?? 0;
              const btcInitialStop = btcDirection === "LONG" ? btcPrice * 0.9 : btcPrice * 1.1;
              const ethInitialStop = ethDirection === "LONG" ? ethPrice * 0.9 : ethPrice * 1.1;

              const btcStopOrder = await setStopLoss("BTCUSDT", btcInitialStop, {
                botId: BOT_ID,
                weekId: entryWeekId,
                direction: btcDirection,
                actionTsMs: handshake.entryTs,
              });
              const ethStopOrder = await setStopLoss("ETHUSDT", ethInitialStop, {
                botId: BOT_ID,
                weekId: entryWeekId,
                direction: ethDirection,
                actionTsMs: handshake.entryTs,
              });
              if (!btcStopOrder.ok || !ethStopOrder.ok) {
                errors.push(
                  `Initial stop placement failed BTC:${btcStopOrder.message ?? "ok"} ETH:${ethStopOrder.message ?? "ok"}`,
                );
              }

              const [btcMarketTag, ethMarketTag] = await Promise.all([
                fetchEntryMarketMetadata("BTC", btcPrice, btcDirection, entryTimeUtc),
                fetchEntryMarketMetadata("ETH", ethPrice, ethDirection, entryTimeUtc),
              ]);

              state.positions.push({
                symbol: "BTC",
                direction: btcDirection,
                entryTs: handshake.entryTs,
                entryPrice: btcPrice,
                stopPrice: btcInitialStop,
                initialLeverage: INITIAL_LEVERAGE,
                currentLeverage: INITIAL_LEVERAGE,
                maxLeverageReached: INITIAL_LEVERAGE,
                milestonesHit: [],
                breakevenReached: false,
                trailingActive: false,
                trailingOffsetPct: null,
                sessionWindow: window,
                peakPrice: btcPrice,
                marginUsd: marginPerSymbol,
                entryTimeUtc,
              });
              state.positions.push({
                symbol: "ETH",
                direction: ethDirection,
                entryTs: handshake.entryTs,
                entryPrice: ethPrice,
                stopPrice: ethInitialStop,
                initialLeverage: INITIAL_LEVERAGE,
                currentLeverage: INITIAL_LEVERAGE,
                maxLeverageReached: INITIAL_LEVERAGE,
                milestonesHit: [],
                breakevenReached: false,
                trailingActive: false,
                trailingOffsetPct: null,
                sessionWindow: window,
                peakPrice: ethPrice,
                marginUsd: marginPerSymbol,
                entryTimeUtc,
              });
              state.entriesThisWeek.BTC += 1;
              state.entriesThisWeek.ETH += 1;
              transitionState(state, "POSITION_OPEN", transitions, "handshake entry confirmed");

              await safeInsertTradeOpen({
                symbol: "BTC",
                direction: btcDirection,
                sessionWindow: window,
                rangeSource: window === "ASIA_LONDON_RANGE_NY_ENTRY" ? "ASIA+LONDON" : "US",
                entryTimeUtc,
                entryPrice: btcPrice,
                stopPrice: btcInitialStop,
                initialLeverage: INITIAL_LEVERAGE,
                metadata: {
                  dryRun: DRY_RUN,
                  handshakeDelayMinutes: handshake.delayMinutes,
                  handshakeGroupId,
                  marketData: btcMarketTag,
                },
              });
              await safeInsertTradeOpen({
                symbol: "ETH",
                direction: ethDirection,
                sessionWindow: window,
                rangeSource: window === "ASIA_LONDON_RANGE_NY_ENTRY" ? "ASIA+LONDON" : "US",
                entryTimeUtc,
                entryPrice: ethPrice,
                stopPrice: ethInitialStop,
                initialLeverage: INITIAL_LEVERAGE,
                metadata: {
                  dryRun: DRY_RUN,
                  handshakeDelayMinutes: handshake.delayMinutes,
                  handshakeGroupId,
                  marketData: ethMarketTag,
                },
              });

              if (state.entriesThisWeek.BTC === 1 && state.entriesThisWeek.ETH === 1) {
                await sendBotNotification(
                  "Bitget bot first entry this week",
                  `<p>Entered BTC ${btcDirection} and ETH ${ethDirection} in ${window} at ${entryTimeUtc}.</p>`,
                );
              }
            }
          }
        }
      }
    }

    if (state.positions.length > 0) {
      const remaining: LivePositionState[] = [];

      for (const position of state.positions) {
        const snapshot = await fetchBitgetFuturesSnapshot(position.symbol).catch(() => null);
        const currentPrice = snapshot?.lastPrice ?? null;
        if (!(currentPrice && currentPrice > 0)) {
          remaining.push(position);
          continue;
        }

        if (position.direction === "LONG") {
          position.peakPrice = Math.max(position.peakPrice, currentPrice);
        } else {
          position.peakPrice = Math.min(position.peakPrice, currentPrice);
        }

        const currentMilestone = position.milestonesHit.length
          ? Math.max(...position.milestonesHit)
          : 0;
        const scaling = computeScalingState(
          position.entryPrice,
          currentPrice,
          position.direction,
          currentMilestone,
        );

        if (scaling.shouldAdjust) {
          if (!position.milestonesHit.includes(scaling.milestone)) {
            position.milestonesHit.push(scaling.milestone);
          }
          position.currentLeverage = scaling.newLeverage;
          position.maxLeverageReached = Math.max(position.maxLeverageReached, scaling.newLeverage);
          position.breakevenReached = scaling.breakevenReached;
          if (scaling.newStop && scaling.newStop > 0) {
            position.stopPrice = scaling.newStop;
          }
          position.trailingOffsetPct = scaling.trailOffsetPct;
          position.trailingActive = scaling.trailOffsetPct !== null;

          await adjustLeverage(`${position.symbol}USDT`, scaling.newLeverage, {
            botId: BOT_ID,
            weekId: state.entriesThisWeek.weekOpenUtc,
          });
          await setStopLoss(`${position.symbol}USDT`, position.stopPrice, {
            botId: BOT_ID,
            weekId: state.entriesThisWeek.weekOpenUtc,
            direction: position.direction,
          });
          transitionState(state, "SCALING", transitions, `${position.symbol} milestone ${scaling.milestone}`);

          if (scaling.milestone >= 2) {
            await sendBotNotification(
              `Bitget milestone hit ${position.symbol}`,
              `<p>${position.symbol} hit +2% milestone, moved to breakeven.</p>`,
            );
          }
        }

        if (position.trailingActive) {
          const highestMilestone = position.milestonesHit.length
            ? Math.max(...position.milestonesHit)
            : 0;
          const trailStop = computeTrailingStop(position.peakPrice, position.direction, highestMilestone);
          if (trailStop && trailStop > 0) {
            if (position.direction === "LONG") {
              position.stopPrice = Math.max(position.stopPrice, trailStop);
            } else {
              position.stopPrice = Math.min(position.stopPrice, trailStop);
            }
            transitionState(state, "TRAILING", transitions, `${position.symbol} trailing active`);
          }
        }

        if (shouldClosePosition(currentPrice, position.stopPrice, position.direction)) {
          transitionState(state, "EXITING", transitions, `${position.symbol} stop hit`);
          const closeResult = await closePosition(`${position.symbol}USDT`, {
            botId: BOT_ID,
            weekId: state.entriesThisWeek.weekOpenUtc,
            direction: position.direction,
            priceHint: currentPrice,
          });

          const exitTimeUtc = new Date().toISOString();
          const exitPrice = closeResult.price ?? currentPrice;
          const pnlUsd = safePnlUsd(position, exitPrice);
          const exitReason = position.trailingActive
            ? "TRAILING_STOP"
            : position.breakevenReached
              ? "BREAKEVEN_STOP"
              : "STOP_LOSS";
          await safeUpdateTradeClose({
            symbol: position.symbol,
            entryTimeUtc: position.entryTimeUtc,
            exitTimeUtc,
            exitPrice,
            exitReason,
            maxLeverageReached: position.maxLeverageReached,
            milestonesHit: [...position.milestonesHit].sort((a, b) => a - b),
            pnlUsd,
          });
          await sendBotNotification(
            `Bitget position closed ${position.symbol}`,
            `<p>${position.symbol} ${position.direction} closed at ${exitPrice.toFixed(2)}. PnL: ${pnlUsd.toFixed(2)} USDT.</p>`,
          );
          continue;
        }

        remaining.push(position);
      }

      state.positions = remaining;
      if (state.positions.length === 0) {
        transitionState(state, "WEEK_READY", transitions, "all positions closed");
      }
    }

    state.lastTickUtc = nowIso;
    state.lastError = errors.length ? errors.join(" | ") : null;
    await writeBotState(BOT_ID, state);

    return {
      ok: errors.length === 0,
      lifecycle: state.lifecycle,
      transitions,
      positions: state.positions,
      dryRun: DRY_RUN,
      errors,
      tickDurationMs: Date.now() - startedMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);

    if (state) {
      state.lastTickUtc = DateTime.utc().toISO() ?? new Date().toISOString();
      state.lastError = message;
      state.lifecycle = "ERROR";
      await writeBotState(BOT_ID, state).catch(() => undefined);
    }

    await sendBotNotification("Bitget bot entered ERROR state", `<p>${message}</p>`);

    return {
      ok: false,
      lifecycle: state?.lifecycle ?? "ERROR",
      transitions,
      positions: state?.positions ?? [],
      dryRun: DRY_RUN,
      errors,
      tickDurationMs: Date.now() - startedMs,
    };
  } finally {
    await releaseLock();
  }
}
