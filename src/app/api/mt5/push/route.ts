import { NextResponse } from "next/server";

import { upsertMt5Account } from "@/lib/mt5Store";
import type { Mt5AccountSnapshot } from "@/lib/mt5Store";

function parseNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntValue(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseBool(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

export async function GET() {
  return NextResponse.json({
    error: "Method not allowed. Use POST to push MT5 data.",
    expected_method: "POST",
    expected_headers: {
      "Content-Type": "application/json",
      "x-mt5-token": "your_token_here"
    }
  }, { status: 405 });
}

export async function POST(request: Request) {
  const token =
    request.headers.get("x-admin-token") ??
    request.headers.get("x-mt5-token") ??
    "";
  const expectedToken =
    process.env.MT5_PUSH_TOKEN ?? process.env.ADMIN_TOKEN ?? "";
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const accountId = parseString(payload.account_id);
  if (!accountId) {
    return NextResponse.json({ error: "account_id is required." }, { status: 400 });
  }

  const snapshot: Mt5AccountSnapshot = {
    account_id: accountId,
    label: parseString(payload.label, accountId),
    broker: parseString(payload.broker),
    server: parseString(payload.server),
    status: parseString(payload.status, "UNKNOWN"),
    currency: parseString(payload.currency, "USD"),
    equity: parseNumber(payload.equity),
    balance: parseNumber(payload.balance),
    margin: parseNumber(payload.margin),
    free_margin: parseNumber(payload.free_margin),
    basket_state: parseString(payload.basket_state, "IDLE"),
    open_positions: parseIntValue(payload.open_positions),
    open_pairs: parseIntValue(payload.open_pairs),
    total_lots: parseNumber(payload.total_lots),
    baseline_equity: parseNumber(payload.baseline_equity),
    locked_profit_pct: parseNumber(payload.locked_profit_pct),
    basket_pnl_pct: parseNumber(payload.basket_pnl_pct),
    weekly_pnl_pct: parseNumber(payload.weekly_pnl_pct),
    risk_used_pct: parseNumber(payload.risk_used_pct),
    trade_count_week: parseIntValue(payload.trade_count_week),
    win_rate_pct: parseNumber(payload.win_rate_pct),
    max_drawdown_pct: parseNumber(payload.max_drawdown_pct),
    report_date: parseString(payload.report_date),
    api_ok: parseBool(payload.api_ok),
    trading_allowed: parseBool(payload.trading_allowed),
    last_api_error: parseString(payload.last_api_error),
    next_add_seconds: parseIntValue(payload.next_add_seconds, -1),
    next_poll_seconds: parseIntValue(payload.next_poll_seconds, -1),
    last_sync_utc:
      parseString(payload.last_sync_utc) || new Date().toISOString(),
    positions: Array.isArray(payload.positions) ? payload.positions : undefined,
  };

  await upsertMt5Account(snapshot);
  return NextResponse.json({ ok: true, account_id: snapshot.account_id });
}
