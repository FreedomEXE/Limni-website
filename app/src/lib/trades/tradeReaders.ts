/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: tradeReaders.ts
 *
 * Description:
 * Query helpers for filtered views over the universal trade ledger.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query } from "@/lib/db";
import type { AnchorType, Trade, TradeStrategyFamily, TradeSurface } from "@/lib/trades/tradeTypes";

type TradeRow = {
  trade_id: string;
  origin: Trade["origin"];
  strategy_family: string;
  strategy_variant: string;
  engine_version: string;
  anchor_type: AnchorType;
  anchor_version: string;
  symbol: string;
  asset_class: string;
  direction: Trade["direction"];
  source_model: string | null;
  tier: number | null;
  week_open_utc: Date | string;
  entry_utc: Date | string | null;
  exit_utc: Date | string | null;
  entry_price: string | number | null;
  exit_price: string | number | null;
  raw_pct: string | number | null;
  adr_normalized_pct: string | number | null;
  adr_pct: string | number | null;
  weight: string | number | null;
  exit_reason: string | null;
  parent_trade_id: string | null;
  fill_seq: number | null;
  active_fills_at_entry: number | null;
  cap_threshold_at_entry: number | null;
  cap_violated: boolean;
  live_trade_id: string | null;
  warnings: unknown;
  created_at_utc: Date | string;
};

export type TradeReaderOptions = {
  surface: TradeSurface;
  strategyFamily?: TradeStrategyFamily;
  strategyVariant?: string;
  anchorType?: AnchorType;
  symbol?: string;
  weekOpenUtc?: string;
  fromWeekUtc?: string;
  toWeekUtc?: string;
};

export type CapViolationOptions = {
  strategyVariant?: string;
  fromWeekUtc?: string;
  toWeekUtc?: string;
};

function iso(value: Date | string | null) {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function numberOrNull(value: string | number | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function warningsArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapTradeRow(row: TradeRow): Trade {
  return {
    tradeId: row.trade_id,
    origin: row.origin,
    strategyFamily: row.strategy_family,
    strategyVariant: row.strategy_variant,
    engineVersion: row.engine_version,
    anchorType: row.anchor_type,
    anchorVersion: row.anchor_version,
    symbol: row.symbol,
    assetClass: row.asset_class,
    direction: row.direction,
    sourceModel: row.source_model,
    tier: row.tier,
    weekOpenUtc: iso(row.week_open_utc)!,
    entryUtc: iso(row.entry_utc),
    exitUtc: iso(row.exit_utc),
    entryPrice: numberOrNull(row.entry_price),
    exitPrice: numberOrNull(row.exit_price),
    rawPct: numberOrNull(row.raw_pct),
    adrNormalizedPct: numberOrNull(row.adr_normalized_pct),
    adrPct: numberOrNull(row.adr_pct),
    weight: numberOrNull(row.weight),
    exitReason: row.exit_reason,
    parentTradeId: row.parent_trade_id,
    fillSeq: row.fill_seq,
    activeFillsAtEntry: row.active_fills_at_entry,
    capThresholdAtEntry: row.cap_threshold_at_entry,
    capViolated: row.cap_violated,
    liveTradeId: row.live_trade_id,
    warnings: warningsArray(row.warnings),
    createdAtUtc: iso(row.created_at_utc)!,
  };
}

function addCondition(
  clauses: string[],
  params: unknown[],
  sql: string,
  value: unknown,
) {
  params.push(value);
  clauses.push(sql.replace("?", `$${params.length}`));
}

function applySurfaceDefaults(opts: TradeReaderOptions, clauses: string[], params: unknown[]) {
  if (opts.surface === "live") {
    addCondition(clauses, params, "origin = ?", "live");
    if (opts.anchorType) addCondition(clauses, params, "anchor_type = ?", opts.anchorType);
    return;
  }

  clauses.push("origin IN ('backtest','simulation')");
  if (opts.surface === "data") {
    addCondition(clauses, params, "strategy_family = ?", opts.strategyFamily ?? "weekly_hold");
  } else if (opts.strategyFamily) {
    addCondition(clauses, params, "strategy_family = ?", opts.strategyFamily);
  }
  addCondition(clauses, params, "anchor_type = ?", opts.anchorType ?? "execution");
}

export async function getTradesForSurface(opts: TradeReaderOptions): Promise<Trade[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  applySurfaceDefaults(opts, clauses, params);

  if (opts.strategyVariant) addCondition(clauses, params, "strategy_variant = ?", opts.strategyVariant);
  if (opts.symbol) addCondition(clauses, params, "symbol = ?", opts.symbol.toUpperCase());
  if (opts.weekOpenUtc) addCondition(clauses, params, "week_open_utc = ?::timestamptz", opts.weekOpenUtc);
  if (opts.fromWeekUtc) addCondition(clauses, params, "week_open_utc >= ?::timestamptz", opts.fromWeekUtc);
  if (opts.toWeekUtc) addCondition(clauses, params, "week_open_utc <= ?::timestamptz", opts.toWeekUtc);

  const rows = await query<TradeRow>(
    `SELECT trade_id::text AS trade_id, origin, strategy_family, strategy_variant,
            engine_version, anchor_type, anchor_version, symbol, asset_class,
            direction, source_model, tier, week_open_utc, entry_utc, exit_utc,
            entry_price, exit_price, raw_pct, adr_normalized_pct, adr_pct,
            weight, exit_reason, parent_trade_id::text AS parent_trade_id, fill_seq,
            active_fills_at_entry, cap_threshold_at_entry, cap_violated,
            live_trade_id, warnings, created_at_utc
       FROM trades
      WHERE ${clauses.length > 0 ? clauses.join(" AND ") : "TRUE"}
      ORDER BY week_open_utc DESC, symbol ASC, source_model ASC NULLS FIRST, fill_seq ASC NULLS FIRST`,
    params,
  );
  return rows.map(mapTradeRow);
}

export async function getFillsForParentTrade(parentTradeId: string): Promise<Trade[]> {
  const rows = await query<TradeRow>(
    `SELECT trade_id::text AS trade_id, origin, strategy_family, strategy_variant,
            engine_version, anchor_type, anchor_version, symbol, asset_class,
            direction, source_model, tier, week_open_utc, entry_utc, exit_utc,
            entry_price, exit_price, raw_pct, adr_normalized_pct, adr_pct,
            weight, exit_reason, parent_trade_id::text AS parent_trade_id, fill_seq,
            active_fills_at_entry, cap_threshold_at_entry, cap_violated,
            live_trade_id, warnings, created_at_utc
       FROM trades
      WHERE parent_trade_id = $1::uuid
      ORDER BY fill_seq ASC`,
    [parentTradeId],
  );
  return rows.map(mapTradeRow);
}

export async function getCapViolations(opts: CapViolationOptions = {}): Promise<Trade[]> {
  const clauses = ["cap_violated"];
  const params: unknown[] = [];
  if (opts.strategyVariant) addCondition(clauses, params, "strategy_variant = ?", opts.strategyVariant);
  if (opts.fromWeekUtc) addCondition(clauses, params, "week_open_utc >= ?::timestamptz", opts.fromWeekUtc);
  if (opts.toWeekUtc) addCondition(clauses, params, "week_open_utc <= ?::timestamptz", opts.toWeekUtc);

  const rows = await query<TradeRow>(
    `SELECT trade_id::text AS trade_id, origin, strategy_family, strategy_variant,
            engine_version, anchor_type, anchor_version, symbol, asset_class,
            direction, source_model, tier, week_open_utc, entry_utc, exit_utc,
            entry_price, exit_price, raw_pct, adr_normalized_pct, adr_pct,
            weight, exit_reason, parent_trade_id::text AS parent_trade_id, fill_seq,
            active_fills_at_entry, cap_threshold_at_entry, cap_violated,
            live_trade_id, warnings, created_at_utc
       FROM trades
      WHERE ${clauses.join(" AND ")}
      ORDER BY week_open_utc DESC, symbol ASC, fill_seq ASC NULLS FIRST`,
    params,
  );
  return rows.map(mapTradeRow);
}
