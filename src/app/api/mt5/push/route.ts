import { NextResponse } from "next/server";

import { upsertMt5Account } from "@/lib/mt5Store";
import type { Mt5AccountSnapshot, Mt5LotMapEntry } from "@/lib/mt5Store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function parseDateIso(value: unknown, fallback = new Date().toISOString()) {
  const raw = parseString(value);
  if (!raw) {
    return fallback;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed.toISOString();
}

function parseSide(value: unknown): "BUY" | "SELL" {
  const side = parseString(value, "BUY").toUpperCase();
  return side === "SELL" ? "SELL" : "BUY";
}

function parsePositions(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        ticket: parseNumber(row.ticket),
        symbol: parseString(row.symbol),
        type: parseSide(row.type),
        lots: parseNumber(row.lots),
        open_price: parseNumber(row.open_price),
        current_price: parseNumber(row.current_price),
        stop_loss: parseNumber(row.stop_loss),
        take_profit: parseNumber(row.take_profit),
        profit: parseNumber(row.profit),
        swap: parseNumber(row.swap),
        commission: parseNumber(row.commission),
        open_time: parseDateIso(row.open_time),
        magic_number: parseIntValue(row.magic_number),
        comment: parseString(row.comment),
      };
    })
    .filter((row) => row.symbol !== "" && row.ticket > 0);
}

function parseClosedPositions(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        ticket: parseNumber(row.ticket),
        symbol: parseString(row.symbol),
        type: parseSide(row.type),
        lots: parseNumber(row.lots),
        open_price: parseNumber(row.open_price),
        close_price: parseNumber(row.close_price),
        profit: parseNumber(row.profit),
        swap: parseNumber(row.swap),
        commission: parseNumber(row.commission),
        open_time: parseDateIso(row.open_time),
        close_time: parseDateIso(row.close_time),
        magic_number: parseIntValue(row.magic_number),
        comment: parseString(row.comment),
      };
    })
    .filter((row) => row.symbol !== "" && row.ticket > 0);
}

function parseLotMap(value: unknown): Mt5LotMapEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        symbol: parseString(row.symbol),
        asset_class: parseString(row.asset_class, "fx"),
        lot: parseNumber(row.lot),
        target_lot: parseNumber(row.target_lot),
        deviation_pct: parseNumber(row.deviation_pct),
        margin_required: parseNumber(row.margin_required),
        move_1pct_usd: parseNumber(row.move_1pct_usd),
      } satisfies Mt5LotMapEntry;
    })
    .filter((row) => row.symbol !== "");
}

function parseTradeMode(value: unknown): "AUTO" | "MANUAL" {
  const raw = parseString(value, "AUTO").toUpperCase();
  return raw === "MANUAL" ? "MANUAL" : "AUTO";
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
    trade_mode: parseTradeMode(payload.trade_mode),
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
    lot_map: parseLotMap(payload.lot_map),
    lot_map_updated_utc: parseDateIso(payload.lot_map_updated_utc),
    positions: parsePositions(payload.positions),
    closed_positions: parseClosedPositions(payload.closed_positions),
    recent_logs: Array.isArray(payload.recent_logs)
      ? (payload.recent_logs as string[]).slice(0, 100)
      : undefined,
  };

  await upsertMt5Account(snapshot);
  return NextResponse.json({
    ok: true,
    account_id: snapshot.account_id,
    positions_ingested: snapshot.positions?.length ?? 0,
    closed_positions_ingested: snapshot.closed_positions?.length ?? 0,
  });
}
