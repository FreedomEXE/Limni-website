/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: kataraktiDashboard.ts
 *
 * Description:
 * Read-only data access helpers for the Katarakti sweep-entry system
 * monitoring UI. Aggregates bot state, trades, signals, weekly bias,
 * and correlation matrix with graceful fallbacks.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "@/lib/db";

/* ── Row types ─────────────────────────────── */

export type KataraktiTradeRow = {
  id: number;
  bot_id: string;
  week_anchor: string | Date;
  symbol: string;
  asset_class: string;
  direction: string;
  bias_system: string;
  bias_direction: string;
  bias_tier: string | null;
  session_window: string;
  entry_time_utc: string | Date;
  entry_price: string | number;
  exit_time_utc: string | Date | null;
  exit_price: string | number | null;
  exit_reason: string | null;
  exit_step: string | null;
  stop_price: string | number | null;
  risk_pct: string | number;
  risk_usd: string | number | null;
  notional_usd: string | number | null;
  pnl_usd: string | number | null;
  pnl_pct: string | number | null;
  peak_profit_pct: string | number | null;
  reached_025: boolean;
  reached_050: boolean;
  reached_075: boolean;
  reached_100: boolean;
  duration_hours: string | number | null;
};

export type KataraktiSignalRow = {
  id: number;
  bot_id: string;
  week_anchor: string | Date;
  symbol: string;
  asset_class: string;
  direction: string;
  signal_time_utc: string | Date;
  session_window: string;
  ref_high: string | number | null;
  ref_low: string | number | null;
  sweep_price: string | number | null;
  sweep_pct: string | number | null;
  displacement_pct: string | number | null;
  triggered_entry: boolean;
  filter_reason: string | null;
};

export type KataraktiBiasRow = {
  id: number;
  bot_id: string;
  week_anchor: string | Date;
  symbol: string;
  asset_class: string;
  bias_system: string;
  direction: string;
  tier: string | null;
  risk_pct: string | number;
};

export type CorrelationMatrixRow = {
  symbol_a: string;
  symbol_b: string;
  context: string;
  lookback_hours: number;
  correlation: string | number;
  sample_size: number;
  computed_at: string | Date;
};

/* ── Payload ───────────────────────────────── */

export type KataraktiStatusPayload = {
  botState: Record<string, unknown> | null;
  trades: KataraktiTradeRow[];
  signals: KataraktiSignalRow[];
  weeklyBias: KataraktiBiasRow[];
  correlationMatrix: CorrelationMatrixRow[];
  fetchedAt: string;
};

/* ── Safe query wrappers ───────────────────── */

const BOT_ID = "katarakti_v1";
const TRADE_LIMIT = 200;
const SIGNAL_LIMIT = 500;
const WEEKLY_BIAS_LIMIT = 200;

async function safeQuery<T>(
  sql: string,
  params?: readonly unknown[],
): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn(
      "[kataraktiDashboard] query failed:",
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
      "[kataraktiDashboard] queryOne failed:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/* ── Main data fetch ───────────────────────── */

export async function readKataraktiStatusData(): Promise<KataraktiStatusPayload> {
  const [botStateRow, trades, signals, weeklyBias, correlationMatrix] =
    await Promise.all([
      safeQueryOne<{ state: Record<string, unknown> }>(
        `SELECT state
           FROM bot_states
          WHERE bot_id = $1`,
        [BOT_ID],
      ),
      safeQuery<KataraktiTradeRow>(
        `SELECT id, bot_id, week_anchor, symbol, asset_class, direction, bias_system,
                bias_direction, bias_tier, session_window, entry_time_utc, entry_price,
                exit_time_utc, exit_price, exit_reason, exit_step, stop_price,
                risk_pct, risk_usd, notional_usd, pnl_usd, pnl_pct, peak_profit_pct,
                reached_025, reached_050, reached_075, reached_100, duration_hours
           FROM katarakti_trades
          WHERE bot_id = $1
          ORDER BY entry_time_utc DESC
          LIMIT $2`,
        [BOT_ID, TRADE_LIMIT],
      ),
      safeQuery<KataraktiSignalRow>(
        `SELECT id, bot_id, week_anchor, symbol, asset_class, direction,
                signal_time_utc, session_window, ref_high, ref_low, sweep_price,
                sweep_pct, displacement_pct, triggered_entry, filter_reason
           FROM katarakti_signals
          WHERE bot_id = $1
          ORDER BY signal_time_utc DESC
          LIMIT $2`,
        [BOT_ID, SIGNAL_LIMIT],
      ),
      safeQuery<KataraktiBiasRow>(
        `SELECT id, bot_id, week_anchor, symbol, asset_class, bias_system,
                direction, tier, risk_pct
           FROM katarakti_weekly_bias
          WHERE bot_id = $1
            AND week_anchor = (
              SELECT MAX(week_anchor)
                FROM katarakti_weekly_bias
               WHERE bot_id = $1
            )
          ORDER BY symbol, bias_system
          LIMIT $2`,
        [BOT_ID, WEEKLY_BIAS_LIMIT],
      ),
      safeQuery<CorrelationMatrixRow>(
        `SELECT symbol_a, symbol_b, context, lookback_hours, correlation,
                sample_size, computed_at
           FROM correlation_matrix
          WHERE context = 'fx'
            AND computed_at = (
                  SELECT MAX(computed_at) FROM correlation_matrix WHERE context = 'fx'
                )
          ORDER BY symbol_a, symbol_b`,
      ),
    ]);

  return {
    botState: botStateRow?.state ?? null,
    trades,
    signals,
    weeklyBias,
    correlationMatrix,
    fetchedAt: new Date().toISOString(),
  };
}
