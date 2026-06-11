/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: triton-alerts.ts
 *
 * Description:
 * Alert type system, dedup cooldown logic, and Telegram formatting helpers
 * for Triton's full-platform monitoring engine.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type AlertPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AlertType =
  | "bitget_trade_opened"
  | "bitget_trade_closed"
  | "bitget_milestone"
  | "bitget_breakeven"
  | "bitget_signal_detected"
  | "bitget_bot_error"
  | "oanda_basket_entered"
  | "oanda_trailing_active"
  | "oanda_basket_exited"
  | "oanda_bot_stale"
  | "mt5_api_down"
  | "mt5_basket_opened"
  | "mt5_basket_closed"
  | "mt5_position_closed"
  | "mt5_sync_stale"
  | "account_error"
  | "account_sync_stale"
  | "account_drawdown"
  | "sentiment_crowding"
  | "sentiment_flip"
  | "sentiment_provider_down"
  | "cot_new_release"
  | "cot_bias_flip"
  | "cot_data_stale"
  | "cron_stale"
  | "cron_error"
  | "news_high_impact_upcoming"
  | "funding_extreme"
  | "funding_flip"
  | "oi_surge"
  | "liquidation_flip";

export type TritonAlert = {
  type: AlertType;
  priority: AlertPriority;
  discriminator: string;
  body: string;
};

type DedupEntry = {
  key: string;
  sentAt: number;
};

const dedupCache: Map<string, DedupEntry> = new Map();
const MAX_DEDUP_ENTRIES = 3000;

const PRIORITY_ICON: Record<AlertPriority, string> = {
  CRITICAL: "🔴",
  HIGH: "⚡",
  MEDIUM: "📡",
  LOW: "📋",
};

const PRIORITY_COOLDOWN_MS: Record<AlertPriority, number> = {
  CRITICAL: 5 * 60_000,
  HIGH: 10 * 60_000,
  MEDIUM: 30 * 60_000,
  LOW: 60 * 60_000,
};

const ALERT_TITLES: Record<AlertType, string> = {
  bitget_trade_opened: "TRADE OPENED",
  bitget_trade_closed: "TRADE CLOSED",
  bitget_milestone: "MILESTONE HIT",
  bitget_breakeven: "BREAKEVEN SET",
  bitget_signal_detected: "SIGNAL DETECTED",
  bitget_bot_error: "BITGET BOT ISSUE",
  oanda_basket_entered: "OANDA BASKET ENTERED",
  oanda_trailing_active: "OANDA TRAILING ACTIVE",
  oanda_basket_exited: "OANDA BASKET EXITED",
  oanda_bot_stale: "OANDA BOT STALE",
  mt5_api_down: "MT5 API DOWN",
  mt5_basket_opened: "MT5 BASKET OPENED",
  mt5_basket_closed: "MT5 BASKET CLOSED",
  mt5_position_closed: "MT5 POSITION CLOSED",
  mt5_sync_stale: "MT5 SYNC STALE",
  account_error: "ACCOUNT ERROR",
  account_sync_stale: "ACCOUNT SYNC STALE",
  account_drawdown: "ACCOUNT DRAWDOWN",
  sentiment_crowding: "SENTIMENT CROWDING",
  sentiment_flip: "SENTIMENT FLIP",
  sentiment_provider_down: "SENTIMENT PROVIDER DOWN",
  cot_new_release: "COT RELEASE",
  cot_bias_flip: "COT BIAS FLIP",
  cot_data_stale: "COT DATA STALE",
  cron_stale: "CRON STALE",
  cron_error: "CRON ERROR",
  news_high_impact_upcoming: "HIGH-IMPACT NEWS",
  funding_extreme: "FUNDING EXTREME",
  funding_flip: "FUNDING FLIP",
  oi_surge: "OI SURGE",
  liquidation_flip: "LIQUIDATION FLIP",
};

export function getAlertTitle(type: AlertType): string {
  return ALERT_TITLES[type] ?? "ALERT";
}

export function formatTritonAlert(
  type: AlertType,
  priority: AlertPriority,
  body: string,
): string {
  const header = `${PRIORITY_ICON[priority]} TRITON`;
  const separator = "━".repeat(24);
  const title = getAlertTitle(type);
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return `${header}\n${separator}\n${title}`;
  }
  return `${header}\n${separator}\n${title}\n${trimmedBody}`;
}

function dedupKey(type: AlertType, discriminator: string): string {
  return `${type}:${discriminator}`;
}

function pruneDedupCache() {
  if (dedupCache.size <= MAX_DEDUP_ENTRIES) return;
  const cutoff = Date.now() - 24 * 60 * 60_000;
  for (const [key, entry] of dedupCache.entries()) {
    if (entry.sentAt < cutoff) {
      dedupCache.delete(key);
    }
  }
  if (dedupCache.size <= MAX_DEDUP_ENTRIES) return;

  const entries = Array.from(dedupCache.entries()).sort((a, b) => a[1].sentAt - b[1].sentAt);
  const removeCount = Math.max(0, entries.length - MAX_DEDUP_ENTRIES);
  for (let i = 0; i < removeCount; i += 1) {
    dedupCache.delete(entries[i][0]);
  }
}

export function shouldSendAlert(
  type: AlertType,
  priority: AlertPriority,
  discriminator: string,
): boolean {
  const key = dedupKey(type, discriminator);
  const existing = dedupCache.get(key);
  if (!existing) return true;
  const cooldownMs = PRIORITY_COOLDOWN_MS[priority];
  return Date.now() - existing.sentAt > cooldownMs;
}

export function markAlertSent(
  type: AlertType,
  discriminator: string,
  sentAt = Date.now(),
): void {
  const key = dedupKey(type, discriminator);
  dedupCache.set(key, { key, sentAt });
  pruneDedupCache();
}

export function hydrateDedupCache(entries: Array<{ key: string; sentAt: number }>): void {
  dedupCache.clear();
  for (const entry of entries) {
    if (!entry || typeof entry.key !== "string") continue;
    if (!Number.isFinite(entry.sentAt)) continue;
    dedupCache.set(entry.key, { key: entry.key, sentAt: entry.sentAt });
  }
  pruneDedupCache();
}

export function snapshotDedupCache(): Array<{ key: string; sentAt: number }> {
  return Array.from(dedupCache.values());
}

const MILESTONE_TYPES = new Set<AlertType>([
  "bitget_milestone",
  "bitget_breakeven",
]);

const BIAS_TYPES = new Set<AlertType>([
  "cot_bias_flip",
  "sentiment_flip",
  "sentiment_crowding",
]);

const ERROR_TYPES = new Set<AlertType>([
  "bitget_bot_error",
  "oanda_bot_stale",
  "mt5_api_down",
  "mt5_sync_stale",
  "account_error",
  "account_sync_stale",
  "sentiment_provider_down",
  "cot_data_stale",
  "cron_stale",
  "cron_error",
]);

export function isMilestoneType(type: AlertType): boolean {
  return MILESTONE_TYPES.has(type);
}

export function isBiasType(type: AlertType): boolean {
  return BIAS_TYPES.has(type);
}

export function isErrorType(type: AlertType): boolean {
  return ERROR_TYPES.has(type);
}
