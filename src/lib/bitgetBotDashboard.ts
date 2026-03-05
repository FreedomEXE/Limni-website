/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitgetBotDashboard.ts
 *
 * Description:
 * Read-only data access helpers for the Bitget Bot v2 monitoring UI.
 * Aggregates bot state, trades, signals, ranges, and market snapshots
 * with graceful fallbacks when optional tables are unavailable.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "@/lib/db";
import type { BitgetBotStateV1 } from "@/lib/bitgetBotEngine";

export type BitgetTradeRow = {
  id: number;
  bot_id: string;
  strategy_id: string;
  symbol: string;
  direction: string;
  session_window: string;
  range_source: string;
  entry_time_utc: string | Date;
  entry_price: string | number;
  exit_time_utc: string | Date | null;
  exit_price: string | number | null;
  exit_reason: string | null;
  stop_price: string | number | null;
  initial_leverage: string | number;
  max_leverage_reached: string | number | null;
  milestones_hit: unknown;
  freed_margin_usd: string | number | null;
  pnl_usd: string | number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type BitgetSignalRow = {
  id: number;
  bot_id: string;
  day_utc: string | Date;
  symbol: string;
  session_window: string;
  confirm_time_utc: string | Date;
  direction: string;
  sweep_pct: string | number;
  displacement_pct: string | number;
  handshake_group_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
};

export type BitgetRangeRow = {
  id: number;
  bot_id: string;
  day_utc: string | Date;
  day_utc_text?: string | null;
  symbol: string;
  range_source: string;
  high: string | number;
  low: string | number;
  locked_at_utc: string | Date;
  created_at: string | Date;
};

export type OiSnapshotRow = {
  symbol: string;
  open_interest: string | number;
  price_at_snapshot: string | number | null;
  snapshot_time_utc: string | Date;
};

export type FundingSnapshotRow = {
  symbol: string;
  funding_rate: string | number;
  snapshot_time_utc: string | Date;
};

export type LiquidationSnapshotRow = {
  symbol: string;
  total_long_usd: string | number;
  total_short_usd: string | number;
  dominant_side: string;
  reference_price: string | number | null;
  largest_above_price: string | number | null;
  largest_above_notional: string | number | null;
  largest_below_price: string | number | null;
  largest_below_notional: string | number | null;
  clusters_json: unknown;
  snapshot_time_utc: string | Date;
};

export type BitgetBotStatusPayload = {
  botState: BitgetBotStateV1 | null;
  trades: BitgetTradeRow[];
  signals: BitgetSignalRow[];
  ranges: BitgetRangeRow[];
  marketData: {
    oi: OiSnapshotRow[];
    funding: FundingSnapshotRow[];
    liquidation: LiquidationSnapshotRow[];
  };
  fetchedAt: string;
};

const BOT_ID = "bitget_perp_v2";

async function safeQuery<T>(
  sql: string,
  params?: readonly unknown[],
): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn(
      "[bitgetBotDashboard] query failed:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

async function safeQueryOne<T>(
  sql: string,
  params?: readonly unknown[],
): Promise<T | null> {
  try {
    return await queryOne<T>(sql, params);
  } catch (error) {
    console.warn(
      "[bitgetBotDashboard] queryOne failed:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function readBitgetBotStatusData(): Promise<BitgetBotStatusPayload> {
  const [botStateRow, trades, signals, ranges, oi, funding, liquidation] = await Promise.all([
    safeQueryOne<{ state: BitgetBotStateV1 }>(
      `SELECT state
         FROM bot_states
        WHERE bot_id = $1`,
      [BOT_ID],
    ),
    safeQuery<BitgetTradeRow>(
      `SELECT *
         FROM bitget_bot_trades
        WHERE bot_id = $1
          AND ABS(EXTRACT(EPOCH FROM (created_at - entry_time_utc))) < 3600
        ORDER BY entry_time_utc DESC
        LIMIT 100`,
      [BOT_ID],
    ),
    safeQuery<BitgetSignalRow>(
      `SELECT *
         FROM (
               SELECT DISTINCT ON (
                        day_utc,
                        symbol,
                        session_window,
                        confirm_time_utc,
                        direction
                      )
                      *
                 FROM bitget_bot_signals
                WHERE bot_id = $1
                  AND ABS(EXTRACT(EPOCH FROM (created_at - confirm_time_utc))) < 3600
                ORDER BY day_utc,
                         symbol,
                         session_window,
                         confirm_time_utc,
                         direction,
                         CASE status
                           WHEN 'ENTRY_CONFIRMED' THEN 0
                           WHEN 'HANDSHAKE_MATCHED' THEN 1
                           WHEN 'HANDSHAKE_CONFIRMED' THEN 2
                           WHEN 'ENTRY_FAILED' THEN 3
                           WHEN 'CANDIDATE' THEN 4
                           WHEN 'UNQUALIFIED' THEN 5
                           WHEN 'REJECTED' THEN 6
                           WHEN 'EXPIRED' THEN 7
                           ELSE 9
                         END,
                         created_at DESC
              ) deduped
        ORDER BY confirm_time_utc DESC, created_at DESC
        LIMIT 200`,
      [BOT_ID],
    ),
    safeQuery<BitgetRangeRow>(
      `SELECT *
         FROM (
               SELECT DISTINCT ON (symbol, range_source)
                      *,
                      day_utc::text AS day_utc_text
                 FROM bitget_bot_ranges
                WHERE bot_id = $1
                ORDER BY symbol,
                         range_source,
                         locked_at_utc DESC,
                         day_utc DESC
              ) latest
        ORDER BY range_source, symbol`,
      [BOT_ID],
    ),
    safeQuery<OiSnapshotRow>(
      `SELECT symbol, open_interest, price_at_snapshot, snapshot_time_utc
         FROM market_oi_snapshots
        WHERE symbol IN ('BTC', 'ETH')
          AND snapshot_time_utc > NOW() - INTERVAL '7 days'
        ORDER BY snapshot_time_utc`,
    ),
    safeQuery<FundingSnapshotRow>(
      `SELECT symbol, funding_rate, snapshot_time_utc
         FROM market_funding_snapshots
        WHERE symbol IN ('BTC', 'ETH')
          AND snapshot_time_utc > NOW() - INTERVAL '7 days'
        ORDER BY snapshot_time_utc`,
    ),
    safeQuery<LiquidationSnapshotRow>(
      `SELECT symbol, total_long_usd, total_short_usd, dominant_side, reference_price,
              largest_above_price, largest_above_notional, largest_below_price, largest_below_notional,
              clusters_json, snapshot_time_utc
         FROM (
               SELECT *,
                      ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY snapshot_time_utc DESC) AS rn
                 FROM market_liquidation_snapshots
                WHERE symbol IN ('BTC', 'ETH')
              ) ranked
        WHERE rn = 1
        ORDER BY snapshot_time_utc DESC`,
    ),
  ]);

  return {
    botState: botStateRow?.state ?? null,
    trades,
    signals,
    ranges,
    marketData: {
      oi,
      funding,
      liquidation,
    },
    fetchedAt: new Date().toISOString(),
  };
}
