/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: triton-monitors.ts
 *
 * Description:
 * Read-only polling monitors for Triton. Each monitor checks one subsystem,
 * compares against prior state, and returns alert payloads + updated state.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { query, queryOne } from "@/lib/db";
import { getCronStatusSummary } from "@/lib/cronStatus";
import type { AlertPriority, AlertType, TritonAlert } from "@/lib/poseidon/triton-alerts";

export type MonitorState = Record<string, unknown>;

export type TritonMonitorName =
  | "bitget"
  | "oanda"
  | "mt5"
  | "connectedAccounts"
  | "sentiment"
  | "cot"
  | "cron"
  | "news"
  | "marketData";

export type MonitorResult = {
  alerts: TritonAlert[];
  newState: MonitorState;
};

export type TritonMonitor = (lastState: MonitorState) => Promise<MonitorResult>;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const entry of value) {
    const str = asString(entry);
    if (str) result.push(str);
  }
  return result;
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const fromIso = DateTime.fromISO(value, { zone: "utc" });
    if (fromIso.isValid) return fromIso.toUTC().toISO();
    const fromSql = DateTime.fromSQL(value, { zone: "utc" });
    if (fromSql.isValid) return fromSql.toUTC().toISO();
    const fromMillis = DateTime.fromMillis(Number(value));
    if (fromMillis.isValid) return fromMillis.toUTC().toISO();
  }
  return null;
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  if (!dt.isValid) return null;
  return DateTime.utc().diff(dt, "minutes").minutes;
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatUsd(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `$${formatNumber(value, digits)}`;
}

function formatMinutesAsDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "n/a";
  const total = Math.floor(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTimeUntil(targetIso: string): string {
  const target = DateTime.fromISO(targetIso, { zone: "utc" });
  if (!target.isValid) return "n/a";
  const mins = Math.max(0, Math.floor(target.diff(DateTime.utc(), "minutes").minutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hhmm = target.toFormat("HH:mm 'UTC'");
  return `In ${h}h ${m}m (${hhmm})`;
}

function pushAlert(
  alerts: TritonAlert[],
  type: AlertType,
  priority: AlertPriority,
  discriminator: string,
  lines: Array<string | null | undefined>,
) {
  const body = lines
    .map((line) => (typeof line === "string" ? line.trim() : ""))
    .filter(Boolean)
    .join("\n");
  alerts.push({ type, priority, discriminator, body });
}

function parseMilestoneCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  const obj = parseJsonRecord(value);
  const keys = Object.keys(obj);
  if (!keys.length) return 0;
  const truthy = keys.filter((key) => Boolean(obj[key]));
  return truthy.length || keys.length;
}

function hasBreakevenFlag(milestones: unknown, metadata: unknown, exitReason: string | null): boolean {
  if (exitReason && exitReason.toLowerCase().includes("breakeven")) return true;

  if (Array.isArray(milestones)) {
    for (const entry of milestones) {
      if (typeof entry === "string" && entry.toLowerCase().includes("breakeven")) {
        return true;
      }
      const row = parseJsonRecord(entry);
      for (const value of Object.values(row)) {
        if (typeof value === "string" && value.toLowerCase().includes("breakeven")) {
          return true;
        }
      }
    }
  }

  const md = parseJsonRecord(metadata);
  const mdFlags = [
    md.breakeven,
    md.breakeven_set,
    md.break_even,
    md.stop_to_entry,
    md.stopAtEntry,
  ];
  for (const flag of mdFlags) {
    const parsed = asBoolean(flag);
    if (parsed === true) return true;
  }

  return false;
}

function extractLifecycle(state: Record<string, unknown>): string | null {
  const lifecycle = parseJsonRecord(state.lifecycle);
  const candidates: unknown[] = [
    state.lifecycle_state,
    state.lifecycleState,
    state.phase,
    state.current_state,
    state.currentState,
    state.status,
    lifecycle.state,
    lifecycle.phase,
    lifecycle.status,
  ];
  for (const value of candidates) {
    const asText = asString(value);
    if (asText) return asText;
  }
  return null;
}

function extractErrorMessage(state: Record<string, unknown>): string | null {
  const lifecycle = parseJsonRecord(state.lifecycle);
  const candidates: unknown[] = [
    state.error,
    state.last_error,
    state.lastError,
    state.error_message,
    state.errorMessage,
    lifecycle.error,
    lifecycle.lastError,
  ];
  for (const candidate of candidates) {
    const text = asString(candidate);
    if (text) return text;
  }
  return null;
}

function parseBoolPath(root: Record<string, unknown>, paths: string[]): boolean {
  for (const path of paths) {
    const parts = path.split(".");
    let node: unknown = root;
    for (const part of parts) {
      const current = asRecord(node);
      node = current[part];
    }
    const parsed = asBoolean(node);
    if (parsed !== null) return parsed;
  }
  return false;
}

function parseStringPath(root: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const parts = path.split(".");
    let node: unknown = root;
    for (const part of parts) {
      const current = asRecord(node);
      node = current[part];
    }
    const parsed = asString(node);
    if (parsed) return parsed;
  }
  return null;
}

function parseNumberPath(root: Record<string, unknown>, paths: string[]): number | null {
  for (const path of paths) {
    const parts = path.split(".");
    let node: unknown = root;
    for (const part of parts) {
      const current = asRecord(node);
      node = current[part];
    }
    const parsed = asNumber(node);
    if (parsed !== null) return parsed;
  }
  return null;
}

function isLikelyOpenBasket(state: string | null): boolean {
  if (!state) return false;
  const normalized = state.toUpperCase();
  return normalized.includes("OPEN") || normalized.includes("ACTIVE") || normalized.includes("ENTERED");
}

function isLikelyClosedBasket(state: string | null): boolean {
  if (!state) return false;
  const normalized = state.toUpperCase();
  return normalized.includes("CLOSED") || normalized.includes("FLAT") || normalized.includes("IDLE") || normalized.includes("NONE");
}

function normalizeDominantSide(value: unknown): string {
  const raw = asString(value) ?? "unknown";
  return raw.toUpperCase();
}

function isExtremeCrowding(state: string | null): boolean {
  if (!state) return false;
  const upper = state.toUpperCase();
  return upper.includes("CROWDED") || upper.includes("EXTREME");
}

function isFlipState(state: string | null): boolean {
  if (!state) return false;
  const upper = state.toUpperCase();
  return upper !== "NONE" && upper !== "NEUTRAL" && upper !== "NO_FLIP";
}

function parseReportDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = asString(value);
  if (!text) return null;
  const dt = DateTime.fromISO(text, { zone: "utc" });
  if (dt.isValid) return dt.toISODate();
  const d2 = DateTime.fromSQL(text, { zone: "utc" });
  if (d2.isValid) return d2.toISODate();
  return null;
}

function pairDirections(value: unknown): Record<string, string> {
  const pairs = parseJsonRecord(value);
  const result: Record<string, string> = {};
  for (const [pair, row] of Object.entries(pairs)) {
    const parsed = parseJsonRecord(row);
    const direction = asString(parsed.direction)?.toUpperCase();
    if (direction) {
      result[pair] = direction;
    }
  }
  return result;
}

export const monitorBitgetBot: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];
  const previousTrades = asRecord(lastState.knownTrades);
  const previousSignals = new Set(asStringArray(lastState.knownSignalIds));

  const trades = await query<{
    id: number;
    symbol: string;
    direction: string;
    session_window: string | null;
    entry_time_utc: Date | string;
    entry_price: string | number | null;
    exit_time_utc: Date | string | null;
    exit_price: string | number | null;
    exit_reason: string | null;
    initial_leverage: string | number | null;
    pnl_usd: string | number | null;
    milestones_hit: unknown;
    metadata: unknown;
  }>(
    `SELECT id, symbol, direction, session_window, entry_time_utc, entry_price,
            exit_time_utc, exit_price, exit_reason, initial_leverage, pnl_usd, milestones_hit, metadata
       FROM bitget_bot_trades
      WHERE bot_id = 'bitget_perp_v2'
      ORDER BY entry_time_utc DESC
      LIMIT 150`,
  );

  const newTradeState: Record<string, unknown> = {};
  for (const trade of trades) {
    const tradeId = String(trade.id);
    const entryIso = toIso(trade.entry_time_utc);
    const exitIso = toIso(trade.exit_time_utc);
    const milestoneCount = parseMilestoneCount(trade.milestones_hit);
    const breakeven = hasBreakevenFlag(trade.milestones_hit, trade.metadata, trade.exit_reason);

    const previous = asRecord(previousTrades[tradeId]);
    const prevExitIso = asString(previous.exitIso);
    const prevMilestones = asNumber(previous.milestones) ?? 0;
    const prevBreakeven = asBoolean(previous.breakeven) ?? false;

    if (!Object.keys(previous).length) {
      if (exitIso) {
        pushAlert(alerts, "bitget_trade_closed", "HIGH", `trade:${tradeId}:close`, [
          `${trade.symbol} ${trade.direction?.toUpperCase() ?? ""} | ${formatUsd(asNumber(trade.pnl_usd), 2)}`,
          `Entry: ${formatNumber(asNumber(trade.entry_price), 2)} -> Exit: ${formatNumber(asNumber(trade.exit_price), 2)}`,
          `Reason: ${trade.exit_reason ?? "n/a"}`,
        ]);
      } else {
        pushAlert(alerts, "bitget_trade_opened", "HIGH", `trade:${tradeId}:open`, [
          `${trade.symbol} ${trade.direction?.toUpperCase() ?? ""} @ ${formatNumber(asNumber(trade.entry_price), 2)}`,
          `Session: ${trade.session_window ?? "n/a"}`,
          `Leverage: ${formatNumber(asNumber(trade.initial_leverage), 0)}x`,
        ]);
      }
    } else {
      if (!prevExitIso && exitIso) {
        let duration: string | null = null;
        if (entryIso && exitIso) {
          const entry = DateTime.fromISO(entryIso, { zone: "utc" });
          const exit = DateTime.fromISO(exitIso, { zone: "utc" });
          if (entry.isValid && exit.isValid && exit > entry) {
            duration = formatMinutesAsDuration(exit.diff(entry, "minutes").minutes);
          }
        }
        pushAlert(alerts, "bitget_trade_closed", "HIGH", `trade:${tradeId}:close`, [
          `${trade.symbol} ${trade.direction?.toUpperCase() ?? ""} | ${formatUsd(asNumber(trade.pnl_usd), 2)}`,
          `Entry: ${formatNumber(asNumber(trade.entry_price), 2)} -> Exit: ${formatNumber(asNumber(trade.exit_price), 2)}`,
          `Reason: ${trade.exit_reason ?? "n/a"}`,
          duration ? `Duration: ${duration}` : null,
        ]);
      }

      if (milestoneCount > prevMilestones) {
        pushAlert(alerts, "bitget_milestone", "HIGH", `trade:${tradeId}:milestone:${milestoneCount}`, [
          `${trade.symbol} ${trade.direction?.toUpperCase() ?? ""}`,
          `Milestones hit: ${milestoneCount}`,
          `Current PnL: ${formatUsd(asNumber(trade.pnl_usd), 2)}`,
        ]);
      }

      if (!prevBreakeven && breakeven) {
        pushAlert(alerts, "bitget_breakeven", "HIGH", `trade:${tradeId}:breakeven`, [
          `${trade.symbol} ${trade.direction?.toUpperCase() ?? ""}`,
          "Stop moved to entry",
          `Entry: ${formatNumber(asNumber(trade.entry_price), 2)}`,
        ]);
      }
    }

    newTradeState[tradeId] = {
      exitIso,
      milestones: milestoneCount,
      breakeven,
    };
  }

  const signals = await query<{
    id: number;
    symbol: string;
    direction: string;
    session_window: string | null;
    status: string;
    confirm_time_utc: Date | string | null;
  }>(
    `SELECT id, symbol, direction, session_window, status, confirm_time_utc
       FROM bitget_bot_signals
      ORDER BY confirm_time_utc DESC
      LIMIT 200`,
  );

  const newSignalIds = new Set<string>();
  for (const signal of signals) {
    const signalId = String(signal.id);
    newSignalIds.add(signalId);
    if (!previousSignals.has(signalId)) {
      pushAlert(alerts, "bitget_signal_detected", "MEDIUM", `signal:${signalId}`, [
        `${signal.symbol} ${signal.direction?.toUpperCase() ?? ""}`,
        `Session: ${signal.session_window ?? "n/a"}`,
        `Status: ${signal.status}`,
      ]);
    }
  }

  const botStateRow = await queryOne<{
    state: Record<string, unknown> | null;
    updated_at: Date | string;
  }>(
    `SELECT state, updated_at
       FROM bot_states
      WHERE bot_id = 'bitget_perp_v2'
      ORDER BY updated_at DESC
      LIMIT 1`,
  );

  const botState = asRecord(botStateRow?.state ?? {});
  const lifecycle = extractLifecycle(botState);
  const lastUpdateIso = toIso(botStateRow?.updated_at);
  const staleMinutes = minutesSince(lastUpdateIso);
  const errorText = extractErrorMessage(botState);

  if (errorText) {
    pushAlert(alerts, "bitget_bot_error", "CRITICAL", `bitget:error:${errorText.slice(0, 80)}`, [
      `Lifecycle: ${lifecycle ?? "unknown"}`,
      `Error: ${errorText}`,
      `Updated: ${lastUpdateIso ?? "n/a"}`,
    ]);
  }

  if (staleMinutes !== null && staleMinutes > 5) {
    pushAlert(alerts, "bitget_bot_error", "CRITICAL", "bitget:stale", [
      "Last state update is stale",
      `Last update: ${Math.floor(staleMinutes)} minutes ago`,
      `Lifecycle: ${lifecycle ?? "unknown"}`,
    ]);
  }

  return {
    alerts,
    newState: {
      knownTrades: newTradeState,
      knownSignalIds: Array.from(newSignalIds).slice(0, 400),
      lifecycle,
      lastUpdateIso,
    },
  };
};

export const monitorOandaBot: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];

  const row = await queryOne<{
    state: Record<string, unknown> | null;
    updated_at: Date | string;
  }>(
    `SELECT state, updated_at
       FROM bot_states
      WHERE bot_id = 'oanda_universal_bot'
      ORDER BY updated_at DESC
      LIMIT 1`,
  );

  const state = asRecord(row?.state ?? {});
  const updatedAt = toIso(row?.updated_at);

  const entered = parseBoolPath(state, [
    "entered",
    "basket.entered",
    "basket_state.entered",
    "runtime.entered",
  ]);
  const trailingActive = parseBoolPath(state, [
    "trailing_active",
    "trailing.active",
    "trail.active",
    "basket.trailing_active",
  ]);
  const trailHitAt = parseStringPath(state, [
    "trail_hit_at",
    "trailing.hit_at",
    "trail.hit_at",
  ]);

  const prevEntered = asBoolean(lastState.entered) ?? false;
  const prevTrailing = asBoolean(lastState.trailingActive) ?? false;
  const prevTrailHitAt = asString(lastState.trailHitAt);

  if (!prevEntered && entered) {
    const entryEquity = parseNumberPath(state, ["entry_equity", "basket.entry_equity", "equity"]);
    const riskMode = parseStringPath(state, ["risk_mode", "basket.risk_mode"]);
    const positions = parseNumberPath(state, ["positions_opened", "basket.positions", "open_positions"]);
    pushAlert(alerts, "oanda_basket_entered", "HIGH", "oanda:entered", [
      entryEquity !== null ? `Entry equity: ${formatUsd(entryEquity, 2)}` : null,
      positions !== null ? `Pairs: ${formatNumber(positions, 0)} positions opened` : null,
      riskMode ? `Risk mode: ${riskMode}` : null,
    ]);
  }

  if (!prevTrailing && trailingActive) {
    pushAlert(alerts, "oanda_trailing_active", "HIGH", "oanda:trailing", [
      "Trailing logic is now active",
      `Updated: ${updatedAt ?? "n/a"}`,
    ]);
  }

  if ((prevEntered && !entered) || (!prevTrailHitAt && !!trailHitAt)) {
    const reason = parseStringPath(state, ["exit_reason", "trail_reason", "basket.exit_reason"]);
    pushAlert(alerts, "oanda_basket_exited", "HIGH", "oanda:exited", [
      `Trail hit: ${trailHitAt ?? "n/a"}`,
      reason ? `Reason: ${reason}` : null,
      `Updated: ${updatedAt ?? "n/a"}`,
    ]);
  }

  const staleMinutes = minutesSince(updatedAt);
  if (staleMinutes !== null && staleMinutes > 2) {
    pushAlert(alerts, "oanda_bot_stale", "CRITICAL", "oanda:stale", [
      `Last tick: ${Math.floor(staleMinutes)} minutes ago`,
      "Status: possibly stalled",
      "Check Render worker",
    ]);
  }

  return {
    alerts,
    newState: {
      entered,
      trailingActive,
      trailHitAt,
      updatedAt,
    },
  };
};

export const monitorMt5: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];
  const previousAccounts = asRecord(lastState.accounts);
  const previousClosed = new Set(asStringArray(lastState.closedPositionKeys));

  const accounts = await query<{
    account_id: string;
    label: string | null;
    api_ok: boolean;
    basket_state: string | null;
    basket_pnl_pct: string | number | null;
    last_sync_utc: Date | string | null;
    equity: string | number | null;
    baseline_equity: string | number | null;
    last_api_error: string | null;
  }>(
    `SELECT account_id, label, api_ok, basket_state, basket_pnl_pct, last_sync_utc,
            equity, baseline_equity, last_api_error
       FROM mt5_accounts
      WHERE UPPER(status) = 'ACTIVE'
      ORDER BY account_id`,
  );

  const newAccounts: Record<string, unknown> = {};

  for (const account of accounts) {
    const id = account.account_id;
    const prev = asRecord(previousAccounts[id]);

    const prevApiOk = asBoolean(prev.apiOk);
    const prevBasketState = asString(prev.basketState);
    const prevStale = asBoolean(prev.isStale) ?? false;
    const prevDrawdown = asNumber(prev.drawdownPct) ?? 0;

    const basketState = asString(account.basket_state);
    const lastSync = toIso(account.last_sync_utc);
    const staleMinutes = minutesSince(lastSync);
    const isStale = staleMinutes !== null && staleMinutes > 5;

    const equity = asNumber(account.equity);
    const baseline = asNumber(account.baseline_equity);
    const drawdownPct = equity !== null && baseline !== null && baseline > 0
      ? ((baseline - equity) / baseline) * 100
      : 0;

    if (account.api_ok === false && prevApiOk !== false) {
      pushAlert(alerts, "mt5_api_down", "CRITICAL", `mt5:${id}:api_down`, [
        `Account: ${account.label ?? id}`,
        `Last sync: ${lastSync ?? "n/a"}`,
        `Error: ${account.last_api_error ?? "Connection failure"}`,
      ]);
    }

    if (prevBasketState && basketState && prevBasketState !== basketState) {
      if (isLikelyOpenBasket(basketState)) {
        pushAlert(alerts, "mt5_basket_opened", "HIGH", `mt5:${id}:basket_opened`, [
          `Account: ${account.label ?? id}`,
          `State: ${prevBasketState} -> ${basketState}`,
          `Basket PnL: ${formatNumber(asNumber(account.basket_pnl_pct), 2)}%`,
        ]);
      } else if (isLikelyClosedBasket(basketState)) {
        pushAlert(alerts, "mt5_basket_closed", "HIGH", `mt5:${id}:basket_closed`, [
          `Account: ${account.label ?? id}`,
          `State: ${prevBasketState} -> ${basketState}`,
          `Basket PnL: ${formatNumber(asNumber(account.basket_pnl_pct), 2)}%`,
        ]);
      }
    }

    if (isStale && !prevStale) {
      pushAlert(alerts, "mt5_sync_stale", "CRITICAL", `mt5:${id}:sync_stale`, [
        `Account: ${account.label ?? id}`,
        `Last sync: ${Math.floor(staleMinutes ?? 0)} minutes ago`,
      ]);
    }

    if (drawdownPct >= 15 && prevDrawdown < 15) {
      pushAlert(alerts, "account_drawdown", "HIGH", `mt5:${id}:drawdown`, [
        `Account: ${account.label ?? id}`,
        `Equity: ${formatUsd(equity, 2)} | Baseline: ${formatUsd(baseline, 2)}`,
        `Drawdown: ${formatNumber(drawdownPct, 2)}%`,
      ]);
    }

    newAccounts[id] = {
      apiOk: account.api_ok,
      basketState,
      isStale,
      drawdownPct,
      lastSync,
    };
  }

  const closedPositions = await query<{
    account_id: string;
    ticket: number;
    symbol: string;
    type: string;
    profit: string | number;
    swap: string | number;
    commission: string | number;
    close_time: Date | string;
  }>(
    `SELECT account_id, ticket, symbol, type, profit, swap, commission, close_time
       FROM mt5_closed_positions
      WHERE close_time > NOW() - INTERVAL '2 hours'
      ORDER BY close_time DESC
      LIMIT 200`,
  );

  const newClosed = new Set<string>();
  for (const row of closedPositions) {
    const closeIso = toIso(row.close_time) ?? "unknown";
    const key = `${row.account_id}:${row.ticket}:${closeIso}`;
    newClosed.add(key);
    if (!previousClosed.has(key)) {
      const net = (asNumber(row.profit) ?? 0) + (asNumber(row.swap) ?? 0) + (asNumber(row.commission) ?? 0);
      pushAlert(alerts, "mt5_position_closed", "HIGH", `mt5:${key}:closed`, [
        `Account: ${row.account_id}`,
        `${row.symbol} ${row.type.toUpperCase()} | Net: ${formatUsd(net, 2)}`,
        `Closed: ${closeIso}`,
      ]);
    }
  }

  return {
    alerts,
    newState: {
      accounts: newAccounts,
      closedPositionKeys: Array.from(newClosed).slice(0, 600),
    },
  };
};

export const monitorConnectedAccounts: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];
  const previousAccounts = asRecord(lastState.accounts);
  const previousPeaks = asRecord(lastState.navPeaks);

  const rows = await query<{
    account_key: string;
    provider: string;
    status: string | null;
    last_sync_utc: Date | string | null;
    analysis: Record<string, unknown> | null;
  }>(
    `SELECT account_key, provider, status, last_sync_utc, analysis
       FROM connected_accounts
      ORDER BY updated_at DESC
      LIMIT 300`,
  );

  const dedup = new Map<string, {
    account_key: string;
    provider: string;
    status: string | null;
    last_sync_utc: Date | string | null;
    analysis: Record<string, unknown> | null;
  }>();
  for (const row of rows) {
    if (!dedup.has(row.account_key)) {
      dedup.set(row.account_key, row);
    }
  }

  const newAccounts: Record<string, unknown> = {};
  const newPeaks: Record<string, unknown> = {};

  for (const row of dedup.values()) {
    const key = row.account_key;
    const prev = asRecord(previousAccounts[key]);

    const status = asString(row.status)?.toUpperCase() ?? "UNKNOWN";
    const prevStatus = asString(prev.status)?.toUpperCase() ?? "UNKNOWN";

    const lastSync = toIso(row.last_sync_utc);
    const staleMinutes = minutesSince(lastSync);
    const isStale = staleMinutes !== null && staleMinutes > 5;
    const prevStale = asBoolean(prev.isStale) ?? false;

    const analysis = asRecord(row.analysis);
    const nav = parseNumberPath(analysis, [
      "nav",
      "equity",
      "account.nav",
      "account.equity",
      "snapshot.nav",
    ]);

    const prevPeak = asNumber(previousPeaks[key]) ?? nav ?? 0;
    const peak = nav !== null ? Math.max(prevPeak, nav) : prevPeak;
    const drawdownPct = nav !== null && peak > 0 ? ((peak - nav) / peak) * 100 : 0;
    const prevDrawdown = asNumber(prev.drawdownPct) ?? 0;

    if (status === "ERROR" && prevStatus !== "ERROR") {
      pushAlert(alerts, "account_error", "CRITICAL", `account:${key}:error`, [
        `Account: ${key} (${row.provider})`,
        `Status: ${status}`,
      ]);
    }

    if (isStale && !prevStale) {
      pushAlert(alerts, "account_sync_stale", "HIGH", `account:${key}:stale`, [
        `Account: ${key} (${row.provider})`,
        `Last sync: ${Math.floor(staleMinutes ?? 0)} minutes ago`,
      ]);
    }

    if (drawdownPct >= 10 && prevDrawdown < 10) {
      pushAlert(alerts, "account_drawdown", "HIGH", `account:${key}:drawdown`, [
        `Account: ${key} (${row.provider})`,
        `NAV: ${formatUsd(nav, 2)} | Peak: ${formatUsd(peak, 2)}`,
        `Drawdown: ${formatNumber(drawdownPct, 2)}%`,
      ]);
    }

    newAccounts[key] = {
      status,
      isStale,
      drawdownPct,
      lastSync,
    };
    newPeaks[key] = peak;
  }

  return {
    alerts,
    newState: {
      accounts: newAccounts,
      navPeaks: newPeaks,
    },
  };
};

export const monitorSentiment: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];
  const previousSymbols = asRecord(lastState.symbols);

  const rows = await query<{
    symbol: string;
    crowding_state: string;
    flip_state: string;
    sources_used: string[];
    agg_net: string | number;
    timestamp_utc: Date | string;
  }>(
    `SELECT DISTINCT ON (symbol)
            symbol, crowding_state, flip_state, sources_used, agg_net, timestamp_utc
       FROM sentiment_aggregates
      WHERE timestamp_utc > NOW() - INTERVAL '2 hours'
      ORDER BY symbol, timestamp_utc DESC`,
  );

  const nextSymbols: Record<string, unknown> = {};

  for (const row of rows) {
    const symbol = row.symbol;
    const prev = asRecord(previousSymbols[symbol]);
    const prevCrowding = asString(prev.crowding);
    const prevFlip = asString(prev.flip);
    const prevSources = asNumber(prev.sources) ?? 5;

    const crowding = asString(row.crowding_state)?.toUpperCase() ?? "UNKNOWN";
    const flip = asString(row.flip_state)?.toUpperCase() ?? "NONE";
    const sourcesCount = Array.isArray(row.sources_used) ? row.sources_used.length : 0;
    const aggNet = asNumber(row.agg_net);

    if (isExtremeCrowding(crowding) && crowding !== prevCrowding) {
      pushAlert(alerts, "sentiment_crowding", "MEDIUM", `sentiment:${symbol}:crowding:${crowding}`, [
        `${symbol} ${crowding.replaceAll("_", " ")}`,
        `Agg net: ${formatNumber(aggNet, 2)}%`,
        `Sources: ${sourcesCount}/5 active`,
      ]);
    }

    if (isFlipState(flip) && flip !== prevFlip) {
      pushAlert(alerts, "sentiment_flip", "MEDIUM", `sentiment:${symbol}:flip:${flip}`, [
        `${symbol} ${flip.replaceAll("_", " ")}`,
        `Agg net: ${formatNumber(aggNet, 2)}%`,
        `Sources: ${sourcesCount}/5 active`,
      ]);
    }

    if (sourcesCount < 3 && prevSources >= 3) {
      pushAlert(alerts, "sentiment_provider_down", "HIGH", `sentiment:${symbol}:providers_down`, [
        `${symbol} provider coverage degraded`,
        `Sources active: ${sourcesCount}/5`,
      ]);
    }

    nextSymbols[symbol] = {
      crowding,
      flip,
      sources: sourcesCount,
    };
  }

  return {
    alerts,
    newState: {
      symbols: nextSymbols,
    },
  };
};

export const monitorCot: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];

  const latestByAsset = await query<{
    asset_class: string;
    report_date: Date | string;
    pairs: Record<string, unknown> | string;
    fetched_at: Date | string;
  }>(
    `SELECT DISTINCT ON (asset_class)
            asset_class, report_date, pairs, fetched_at
       FROM cot_snapshots
      ORDER BY asset_class, report_date DESC, fetched_at DESC`,
  );

  const latestTwoByAsset = await query<{
    asset_class: string;
    report_date: Date | string;
    pairs: Record<string, unknown> | string;
    fetched_at: Date | string;
    rn: number;
  }>(
    `SELECT asset_class, report_date, pairs, fetched_at, rn
       FROM (
         SELECT asset_class, report_date, pairs, fetched_at,
                ROW_NUMBER() OVER (PARTITION BY asset_class ORDER BY report_date DESC, fetched_at DESC) AS rn
           FROM cot_snapshots
       ) ranked
      WHERE rn <= 2
      ORDER BY asset_class, rn`,
  );

  const previousKnownDates = new Set(asStringArray(lastState.knownReportDates));
  const latestDates = latestByAsset
    .map((row) => parseReportDate(row.report_date))
    .filter((value): value is string => Boolean(value));

  const newDates = Array.from(new Set(latestDates)).filter((date) => !previousKnownDates.has(date));
  for (const date of newDates) {
    const assets = latestByAsset
      .filter((row) => parseReportDate(row.report_date) === date)
      .map((row) => row.asset_class.toUpperCase())
      .join(", ");
    pushAlert(alerts, "cot_new_release", "LOW", `cot:release:${date}`, [
      `New report: ${date}`,
      assets ? `Asset classes: ${assets}` : null,
      "Check /dashboard for updated bias",
    ]);
  }

  const grouped = new Map<string, Array<{ reportDate: string | null; pairs: Record<string, string> }>>();
  for (const row of latestTwoByAsset) {
    const reportDate = parseReportDate(row.report_date);
    const pairs = pairDirections(row.pairs);
    const arr = grouped.get(row.asset_class) ?? [];
    arr.push({ reportDate, pairs });
    grouped.set(row.asset_class, arr);
  }

  for (const [assetClass, snapshots] of grouped.entries()) {
    if (snapshots.length < 2) continue;
    const latest = snapshots[0];
    const previous = snapshots[1];
    const latestPairs = latest.pairs;
    const prevPairs = previous.pairs;
    let emitted = 0;

    for (const [pair, direction] of Object.entries(latestPairs)) {
      const prevDirection = prevPairs[pair];
      if (!prevDirection || prevDirection === direction) continue;
      pushAlert(alerts, "cot_bias_flip", "MEDIUM", `cot:${assetClass}:${pair}:${latest.reportDate ?? "latest"}`, [
        `${pair} flipped ${prevDirection} -> ${direction}`,
        `Asset class: ${assetClass.toUpperCase()}`,
        `Report: ${previous.reportDate ?? "prev"} -> ${latest.reportDate ?? "latest"}`,
      ]);
      emitted += 1;
      if (emitted >= 8) break;
    }
  }

  const newestDate = latestDates.sort().at(-1) ?? null;
  if (newestDate) {
    const reportDt = DateTime.fromISO(newestDate, { zone: "utc" });
    if (reportDt.isValid) {
      const daysOld = DateTime.utc().diff(reportDt, "days").days;
      if (daysOld > 8) {
        pushAlert(alerts, "cot_data_stale", "HIGH", "cot:stale", [
          `Latest report date: ${newestDate}`,
          `Age: ${Math.floor(daysOld)} days`,
        ]);
      }
    }
  }

  return {
    alerts,
    newState: {
      knownReportDates: Array.from(new Set(latestDates)).slice(0, 30),
    },
  };
};

export const monitorCronHealth: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];
  const summary = await getCronStatusSummary();

  const previousOverall = asString(lastState.overallState) ?? "ok";
  const previousSubsystemStates = asRecord(lastState.subsystemStates);

  for (const subsystem of summary.subsystems) {
    const previousState = asString(previousSubsystemStates[subsystem.key]) ?? "ok";

    if (subsystem.state === "error" && previousState !== "error") {
      pushAlert(alerts, "cron_error", "CRITICAL", `cron:${subsystem.key}:error`, [
        `${subsystem.label} is in error state`,
        `Detail: ${subsystem.detail}`,
        `Last refresh: ${subsystem.last_refresh_utc ?? "unknown"}`,
      ]);
    }

    if (subsystem.state === "stale" && previousState !== "stale") {
      pushAlert(alerts, "cron_stale", "HIGH", `cron:${subsystem.key}:stale`, [
        `${subsystem.label} is stale`,
        `Detail: ${subsystem.detail}`,
        `Last refresh: ${subsystem.last_refresh_utc ?? "unknown"}`,
      ]);
    }
  }

  if (previousOverall === "ok" && summary.overall_state !== "ok") {
    const type: AlertType = summary.overall_state === "error" ? "cron_error" : "cron_stale";
    const priority: AlertPriority = summary.overall_state === "error" ? "CRITICAL" : "HIGH";
    pushAlert(alerts, type, priority, `cron:overall:${summary.overall_state}`, [
      `Overall state: ${summary.overall_state.toUpperCase()}`,
      `Generated: ${summary.generated_at_utc}`,
    ]);
  }

  return {
    alerts,
    newState: {
      overallState: summary.overall_state,
      subsystemStates: Object.fromEntries(summary.subsystems.map((row) => [row.key, row.state])),
    },
  };
};

export const monitorNews: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];
  const knownEventKeys = new Set(asStringArray(lastState.knownEventKeys));

  const row = await queryOne<{
    calendar: unknown;
    fetched_at: Date | string;
  }>(
    `SELECT calendar, fetched_at
       FROM news_weekly_snapshots
      ORDER BY week_open_utc DESC, fetched_at DESC
      LIMIT 1`,
  );

  const calendar = Array.isArray(row?.calendar) ? row?.calendar : [];
  const nextKnown = new Set<string>(knownEventKeys);

  const now = DateTime.utc();
  const horizon = now.plus({ hours: 4 });

  for (const raw of calendar) {
    const event = asRecord(raw);
    const impact = asString(event.impact)?.toUpperCase() ?? "";
    if (impact !== "HIGH") continue;

    const title = asString(event.title) ?? "Untitled event";
    const datetimeUtc = asString(event.datetime_utc);
    if (!datetimeUtc) continue;

    const dt = DateTime.fromISO(datetimeUtc, { zone: "utc" });
    if (!dt.isValid) continue;
    if (dt < now || dt > horizon) continue;

    const key = `${title}:${dt.toUTC().toISO()}`;
    if (knownEventKeys.has(key)) continue;

    pushAlert(alerts, "news_high_impact_upcoming", "LOW", `news:${key}`, [
      title,
      formatTimeUntil(dt.toUTC().toISO() ?? datetimeUtc),
      `Forecast: ${asString(event.forecast) ?? "n/a"} | Previous: ${asString(event.previous) ?? "n/a"}`,
    ]);

    nextKnown.add(key);
  }

  return {
    alerts,
    newState: {
      knownEventKeys: Array.from(nextKnown).slice(-600),
      lastFetchedAt: toIso(row?.fetched_at),
    },
  };
};

export const monitorMarketData: TritonMonitor = async (lastState) => {
  const alerts: TritonAlert[] = [];
  const previousFunding = asRecord(lastState.funding);
  const previousOi = asRecord(lastState.oi);
  const previousLiquidation = asRecord(lastState.liquidation);

  const fundingRows = await query<{
    symbol: string;
    funding_rate: string | number;
    snapshot_time_utc: Date | string;
  }>(
    `SELECT DISTINCT ON (symbol) symbol, funding_rate, snapshot_time_utc
       FROM market_funding_snapshots
      WHERE snapshot_time_utc > NOW() - INTERVAL '2 hours'
      ORDER BY symbol, snapshot_time_utc DESC`,
  );

  const oiRows = await query<{
    symbol: string;
    open_interest: string | number;
    snapshot_time_utc: Date | string;
  }>(
    `SELECT DISTINCT ON (symbol) symbol, open_interest, snapshot_time_utc
       FROM market_oi_snapshots
      WHERE snapshot_time_utc > NOW() - INTERVAL '2 hours'
      ORDER BY symbol, snapshot_time_utc DESC`,
  );

  const liqRows = await query<{
    symbol: string;
    dominant_side: string;
    total_long_usd: string | number | null;
    total_short_usd: string | number | null;
    snapshot_time_utc: Date | string;
  }>(
    `SELECT DISTINCT ON (symbol) symbol, dominant_side, total_long_usd, total_short_usd, snapshot_time_utc
       FROM market_liquidation_snapshots
      WHERE snapshot_time_utc > NOW() - INTERVAL '2 hours'
      ORDER BY symbol, snapshot_time_utc DESC`,
  );

  const nextFunding: Record<string, unknown> = {};
  for (const row of fundingRows) {
    const symbol = row.symbol;
    const rate = asNumber(row.funding_rate) ?? 0;
    const prev = asRecord(previousFunding[symbol]);
    const prevRate = asNumber(prev.rate) ?? 0;

    const sign = rate === 0 ? 0 : rate > 0 ? 1 : -1;
    const prevSign = prevRate === 0 ? 0 : prevRate > 0 ? 1 : -1;

    const nowExtreme = Math.abs(rate) >= 0.01;
    const wasExtreme = Math.abs(prevRate) >= 0.01;

    if (nowExtreme && !wasExtreme) {
      pushAlert(alerts, "funding_extreme", "HIGH", `funding:${symbol}:extreme`, [
        `${symbol} funding reached extreme level`,
        `Rate: ${formatNumber(rate * 100, 3)}%`,
      ]);
    }

    if (prevSign !== 0 && sign !== 0 && sign !== prevSign) {
      pushAlert(alerts, "funding_flip", "MEDIUM", `funding:${symbol}:flip`, [
        `${symbol} funding flipped ${prevRate > 0 ? "positive" : "negative"} -> ${rate > 0 ? "positive" : "negative"}`,
        `Rate: ${formatNumber(rate * 100, 3)}%`,
      ]);
    }

    nextFunding[symbol] = {
      rate,
      updatedAt: toIso(row.snapshot_time_utc),
    };
  }

  const nextOi: Record<string, unknown> = {};
  for (const row of oiRows) {
    const symbol = row.symbol;
    const currentOi = asNumber(row.open_interest);
    const prev = asRecord(previousOi[symbol]);
    const prevOiValue = asNumber(prev.value);

    if (currentOi !== null && prevOiValue !== null && prevOiValue > 0) {
      const pctChange = ((currentOi - prevOiValue) / prevOiValue) * 100;
      if (Math.abs(pctChange) >= 20) {
        pushAlert(alerts, "oi_surge", "MEDIUM", `oi:${symbol}:surge`, [
          `${symbol} OI changed ${formatNumber(pctChange, 2)}%`,
          `OI: ${formatNumber(prevOiValue, 0)} -> ${formatNumber(currentOi, 0)}`,
        ]);
      }
    }

    nextOi[symbol] = {
      value: currentOi,
      updatedAt: toIso(row.snapshot_time_utc),
    };
  }

  const nextLiquidation: Record<string, unknown> = {};
  for (const row of liqRows) {
    const symbol = row.symbol;
    const side = normalizeDominantSide(row.dominant_side);
    const prev = asRecord(previousLiquidation[symbol]);
    const prevSide = asString(prev.side)?.toUpperCase();

    if (prevSide && side && prevSide !== side) {
      pushAlert(alerts, "liquidation_flip", "MEDIUM", `liq:${symbol}:flip`, [
        `${symbol} dominant liquidation side flipped ${prevSide} -> ${side}`,
        `Long notional: ${formatUsd(asNumber(row.total_long_usd), 0)}`,
        `Short notional: ${formatUsd(asNumber(row.total_short_usd), 0)}`,
      ]);
    }

    nextLiquidation[symbol] = {
      side,
      updatedAt: toIso(row.snapshot_time_utc),
    };
  }

  return {
    alerts,
    newState: {
      funding: nextFunding,
      oi: nextOi,
      liquidation: nextLiquidation,
    },
  };
};

export const TRITON_MONITOR_ORDER: TritonMonitorName[] = [
  "bitget",
  "oanda",
  "mt5",
  "connectedAccounts",
  "sentiment",
  "cot",
  "cron",
  "news",
  "marketData",
];

export const TRITON_MONITORS: Record<TritonMonitorName, TritonMonitor> = {
  bitget: monitorBitgetBot,
  oanda: monitorOandaBot,
  mt5: monitorMt5,
  connectedAccounts: monitorConnectedAccounts,
  sentiment: monitorSentiment,
  cot: monitorCot,
  cron: monitorCronHealth,
  news: monitorNews,
  marketData: monitorMarketData,
};
