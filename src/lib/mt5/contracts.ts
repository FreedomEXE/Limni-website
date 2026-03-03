/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: contracts.ts
 *
 * Description:
 * AUTO-GENERATED FROM contracts/mt5_event_contract.json.
 * DO NOT EDIT MANUALLY.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { z } from "zod";

export const ReasonCodeValues =   [
    "basket_tp",
    "basket_sl",
    "trail_lock",
    "friday_winner_close",
    "friday_prop_close",
    "sunday_crypto_close",
    "sunday_rollover_reopen",
    "swap_guard_close",
    "daily_flat_close",
    "daily_reopen",
    "weekly_flip",
    "added_loser",
    "manual",
    "signal",
    "generic",
    "not_allowed",
    "unresolved_symbol",
    "duplicate_open",
    "crypto_not_open",
    "not_tradable",
    "invalid_volume",
    "sizing_guard",
    "order_failed",
    "max_volume_reached",
    "max_positions",
    "rate_limit",
    "pending_leg_fill",
    "entry_window_closed",
    "add_window_closed",
    "max_loser_adds",
    "reconcile_keep",
    "reconcile_close",
    "kill_switch",
    "risk_capital_source",
    "compliance_sl_basis"
  ] as const;
export const EventTypeValues =   [
    "decision",
    "lifecycle",
    "health",
    "error"
  ] as const;
export const StateKeyValues =   [
    "baseline_equity",
    "trailing_active",
    "week_start_gmt",
    "report_date",
    "basket_state",
    "trading_allowed",
    "last_sync_utc",
    "last_api_error",
    "data_source",
    "reconstruction_status",
    "risk_capital_usd",
    "policy_version",
    "contract_version"
  ] as const;

export const ReasonCodeSchema = z.enum(ReasonCodeValues);
export const EventTypeSchema = z.enum(EventTypeValues);
export const StateKeySchema = z.enum(StateKeyValues);

export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
export type StateKey = z.infer<typeof StateKeySchema>;

export const SignalsResponseSchema = z.object({
  "report_date": z.string(),
  "trading_allowed": z.boolean(),
  "pairs": z.array(z.object({
  "symbol": z.string(),
  "direction": z.enum(["LONG", "SHORT"] as const),
  "model": z.string(),
  "asset_class": z.string()
}).passthrough()),
  "trail_profile": z.object({
  "avg_peak_pct": z.number(),
  "start_pct": z.number(),
  "offset_pct": z.number()
}).passthrough(),
  "portfolio_strategy": z.object({
  "family": z.enum(["universal", "tiered", "composite_tiered"] as const),
  "version": z.enum(["v1", "v2", "v3"] as const),
  "overlap_mode": z.enum(["stacked", "dedup_weighted"] as const).optional(),
  "weights": z.object({
  "tier1": z.number().optional(),
  "tier2": z.number().optional(),
  "tier3": z.number().optional()
}).passthrough().optional(),
  "voters": z.array(z.string()).optional(),
  "blocks": z.array(z.string()).optional()
}).passthrough().optional(),
  "portfolio_plan": z.object({
  "plan_id": z.string(),
  "report_date": z.string(),
  "legs": z.array(z.object({
  "symbol": z.string(),
  "direction": z.enum(["LONG", "SHORT"] as const),
  "asset_class": z.string(),
  "model_hint": z.string().optional(),
  "tier": z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  "weight_multiplier": z.number(),
  "source_family": z.enum(["universal", "tiered", "composite_tiered"] as const),
  "source_version": z.enum(["v1", "v2", "v3"] as const),
  "source_block": z.string().optional(),
  "reason_code": ReasonCodeSchema,
  "vote_trace": z.object({
  "voters": z.array(z.string()),
  "long_votes": z.number(),
  "short_votes": z.number(),
  "neutral_votes": z.number()
}).passthrough().optional()
}).passthrough())
}).passthrough().optional(),
  "contract_version": z.string()
}).passthrough();

export const PolicyResponseSchema = z.object({
  "risk_mode": z.enum(["high", "low", "god"] as const),
  "leg_scale": z.number(),
  "sizing_capital_mode": z.enum(["balance", "equity", "prop_max_daily_dd"] as const),
  "risk_capital_usd": z.number().optional(),
  "prop_nominal_account_usd": z.number().optional(),
  "prop_max_daily_drawdown_usd": z.number().optional(),
  "per_trade_sl_compliance_mode": z.enum(["none", "prop_pct_of_nominal"] as const).optional(),
  "per_trade_sl_cap_pct_of_nominal": z.number().optional(),
  "asset_filter": z.array(z.string()),
  "trail_start_pct": z.number(),
  "trail_offset_pct": z.number(),
  "basket_tp_pct": z.number(),
  "basket_sl_pct": z.number(),
  "max_positions": z.number(),
  "policy_version": z.string()
}).passthrough();

export const KillSwitchResponseSchema = z.object({
  "halt": z.boolean(),
  "liquidate": z.boolean(),
  "reason": z.string(),
  "issued_at": z.string()
}).passthrough();

export const VersionCheckResponseSchema = z.object({
  "required_version": z.string(),
  "deprecated": z.boolean(),
  "upgrade_required": z.boolean(),
  "grace_period_ends": z.union([z.string(), z.null()])
}).passthrough();

export const EventPushSchema = z.object({
  "event_id": z.string(),
  "account_id": z.string(),
  "ts_utc": z.string(),
  "ea_version": z.string(),
  "event_type": EventTypeSchema,
  "reason_code": ReasonCodeSchema,
  "symbol": z.string().optional(),
  "ticket": z.number().optional(),
  "action": z.enum(["open", "close", "skip"] as const).optional(),
  "lot": z.number().optional(),
  "price": z.number().optional(),
  "retcode": z.number().optional(),
  "metadata": z.record(z.string(), z.unknown())
}).passthrough();

export const HeartbeatPushSchema = z.object({
  "account_id": z.string(),
  "ts_utc": z.string(),
  "ea_version": z.string(),
  "state": z.enum(["idle", "ready", "active", "paused", "closed"] as const),
  "open_positions": z.number(),
  "basket_pnl_pct": z.number(),
  "equity": z.number(),
  "errors_last_hour": z.number()
}).passthrough();

export const PositionSnapshotPushSchema = z.object({
  "account_id": z.string(),
  "ts_utc": z.string(),
  "positions": z.array(z.object({
  "ticket": z.number(),
  "symbol": z.string(),
  "type": z.enum(["BUY", "SELL"] as const),
  "lots": z.number(),
  "profit": z.number(),
  "swap": z.number(),
  "open_time": z.string()
}).passthrough())
}).passthrough();

export const LegacyPushSchema = z.object({
  "account_id": z.string(),
  "label": z.string().optional(),
  "broker": z.string().optional(),
  "server": z.string().optional(),
  "status": z.string().optional(),
  "trade_mode": z.enum(["AUTO", "MANUAL"] as const).optional(),
  "currency": z.string().optional(),
  "equity": z.number().optional(),
  "balance": z.number().optional(),
  "margin": z.number().optional(),
  "free_margin": z.number().optional(),
  "basket_state": z.string().optional(),
  "open_positions": z.number().optional(),
  "open_pairs": z.number().optional(),
  "total_lots": z.number().optional(),
  "baseline_equity": z.number().optional(),
  "locked_profit_pct": z.number().optional(),
  "basket_pnl_pct": z.number().optional(),
  "weekly_pnl_pct": z.number().optional(),
  "risk_used_pct": z.number().optional(),
  "trade_count_week": z.number().optional(),
  "win_rate_pct": z.number().optional(),
  "max_drawdown_pct": z.number().optional(),
  "report_date": z.string().optional(),
  "api_ok": z.boolean().optional(),
  "trading_allowed": z.boolean().optional(),
  "last_api_error": z.string().optional(),
  "next_add_seconds": z.number().optional(),
  "next_poll_seconds": z.number().optional(),
  "last_sync_utc": z.string().optional(),
  "data_source": z.string().optional(),
  "reconstruction_status": z.string().optional(),
  "reconstruction_note": z.string().optional(),
  "reconstruction_window_start_utc": z.string().optional(),
  "reconstruction_window_end_utc": z.string().optional(),
  "reconstruction_market_closed_segments": z.number().optional(),
  "reconstruction_trades": z.number().optional(),
  "reconstruction_week_realized": z.number().optional(),
  "license_key": z.string().optional(),
  "positions": z.array(z.record(z.string(), z.unknown())).optional(),
  "closed_positions": z.array(z.record(z.string(), z.unknown())).optional(),
  "lot_map": z.array(z.record(z.string(), z.unknown())).optional(),
  "lot_map_updated_utc": z.string().optional(),
  "planning_diagnostics": z.record(z.string(), z.unknown()).optional(),
  "recent_logs": z.array(z.string()).optional()
}).passthrough();

export const Mt5PushPayloadSchema = z.union([
  EventPushSchema,
  HeartbeatPushSchema,
  PositionSnapshotPushSchema,
  LegacyPushSchema,
]);

export type Mt5PushPayload = z.infer<typeof Mt5PushPayloadSchema>;
export type SignalsResponse = z.infer<typeof SignalsResponseSchema>;
export type PolicyResponse = z.infer<typeof PolicyResponseSchema>;
export type KillSwitchResponse = z.infer<typeof KillSwitchResponseSchema>;
export type VersionCheckResponse = z.infer<typeof VersionCheckResponseSchema>;
export type EventPush = z.infer<typeof EventPushSchema>;
export type HeartbeatPush = z.infer<typeof HeartbeatPushSchema>;
export type PositionSnapshotPush = z.infer<typeof PositionSnapshotPushSchema>;
export type LegacyPush = z.infer<typeof LegacyPushSchema>;
