/**
 * GET /api/mt5/reconcile-preview
 *
 * Simulates the EA's Friday rollover logic server-side. Shows which positions
 * would be KEPT vs CLOSED when new COT data arrives, without touching the broker.
 *
 * EA Friday rollover sequence (when report_date changes):
 * 1. Close ALL winning positions (profit+swap > 0) with reason "friday_winner_close"
 * 2. Run ReconcilePositionsWithSignals on remaining losers:
 *    - KEEP if signal direction still matches
 *    - CLOSE if signal flipped or symbol/model has no signal ("weekly_flip")
 *
 * NOTE: This preview shows reconcile verdicts BEFORE the winner-close step.
 * Any position with profit > 0 will be closed first, regardless of verdict shown here.
 *
 * Query params:
 *   account_id  - optional, filter to a single MT5 account
 *   asset       - optional, filter by asset class (fx|crypto|commodities|indices|all)
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildBasketSignals } from "@/lib/basketSignals";
import { evaluateFreshness } from "@/lib/cotFreshness";
import type { AssetClass } from "@/lib/cotMarkets";
import { getAssetClass } from "@/lib/cotMarkets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Mirrors EA ParseModelFromComment + NormalizeModelName
function parseModelFromComment(comment: string): string {
  const prefix = "LimniBasket ";
  const idx = comment.indexOf(prefix);
  if (idx < 0) return "unknown";
  const rest = comment.slice(idx + prefix.length).trim();
  const spaceIdx = rest.indexOf(" ");
  const raw = spaceIdx > 0 ? rest.slice(0, spaceIdx) : rest;
  return normalizeModelName(raw);
}

function normalizeModelName(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "blended";
  if (v === "anti_kythera" || v === "anti-kythera") return "antikythera";
  if (v === "dealers") return "dealer";
  if (v === "commercials") return "commercial";
  return v;
}

// Strip broker suffixes (., m, +, pro, etc.) to get canonical pair for signal lookup.
// The EA does a similar resolve; here we do a prefix-match against signal symbols.
function canonicalSymbol(brokerSymbol: string): string {
  return brokerSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountIdFilter = url.searchParams.get("account_id") ?? null;
  const assetParam = url.searchParams.get("asset") ?? "all";

  // 1. Load current basket signals
  const assetClass: AssetClass | "all" =
    assetParam !== "all" ? getAssetClass(assetParam) : "all";
  const signals = await buildBasketSignals({ assetClass });

  // Build a fast lookup: canonical_symbol -> model -> direction (1=LONG/BUY, -1=SHORT/SELL)
  // API signals use LONG/SHORT; EA position types use BUY/SELL. LONG=BUY=1, SHORT=SELL=-1.
  const signalMap = new Map<string, Map<string, number>>();
  for (const pair of signals.pairs) {
    if (pair.direction === "NEUTRAL" || !pair.direction) continue;
    const sym = canonicalSymbol(pair.symbol);
    if (!signalMap.has(sym)) signalMap.set(sym, new Map());
    const dir = pair.direction === "LONG" ? 1 : -1;
    signalMap.get(sym)!.set(normalizeModelName(pair.model), dir);
  }

  // 2. Load open positions
  type PositionRow = {
    account_id: string;
    ticket: number;
    symbol: string;
    type: string;
    lots: string;
    profit: string;
    comment: string;
    open_price: string;
    open_time: Date;
  };

  const params: Array<string> = [];
  let whereClause = "";
  if (accountIdFilter) {
    params.push(accountIdFilter);
    whereClause = "WHERE account_id = $1";
  }

  const positions = await query<PositionRow>(
    `SELECT account_id, ticket, symbol, type, lots, profit, comment, open_price, open_time
     FROM mt5_positions
     ${whereClause}
     ORDER BY account_id, symbol, type`,
    params,
  );

  // 3. Evaluate each position against current signals
  type PositionVerdict = {
    account_id: string;
    ticket: number;
    symbol: string;
    broker_symbol: string;
    model: string;
    current_direction: "BUY" | "SELL";
    signal_direction: "LONG" | "SHORT" | "NO_SIGNAL";
    verdict: "KEEP" | "CLOSE" | "UNKNOWN";
    verdict_reason: string;
    lots: number;
    profit: number;
    open_price: number;
    open_time: string;
  };

  const results: PositionVerdict[] = [];

  for (const pos of positions) {
    const model = parseModelFromComment(pos.comment);
    const brokerSym = pos.symbol;
    const sym = canonicalSymbol(brokerSym);
    const posDir = pos.type.toUpperCase() === "BUY" ? 1 : -1;
    const posDirLabel = posDir === 1 ? "BUY" : "SELL";

    const modelMap = signalMap.get(sym);
    let signalDir: number | null = null;
    let signalDirLabel: "LONG" | "SHORT" | "NO_SIGNAL" = "NO_SIGNAL";
    let verdict: "KEEP" | "CLOSE" | "UNKNOWN" = "UNKNOWN";
    let reason = "";

    if (model === "unknown") {
      verdict = "UNKNOWN";
      reason = "cannot parse model from comment";
      signalDirLabel = "NO_SIGNAL";
    } else if (!modelMap) {
      // No signals at all for this symbol
      verdict = "CLOSE";
      reason = "symbol not in current signal set";
      signalDirLabel = "NO_SIGNAL";
    } else {
      signalDir = modelMap.get(model) ?? null;
      if (signalDir === null) {
        // Symbol exists but no signal for this model
        verdict = "CLOSE";
        reason = `no ${model} signal for ${sym}`;
        signalDirLabel = "NO_SIGNAL";
      } else if (signalDir === posDir) {
        verdict = "KEEP";
        reason = "direction matches new signal";
        signalDirLabel = signalDir === 1 ? "LONG" : "SHORT";
      } else {
        verdict = "CLOSE";
        reason = `direction flipped: position is ${posDirLabel}, new signal is ${signalDir === 1 ? "LONG" : "SHORT"}`;
        signalDirLabel = signalDir === 1 ? "LONG" : "SHORT";
      }
    }

    results.push({
      account_id: pos.account_id,
      ticket: Number(pos.ticket),
      symbol: sym,
      broker_symbol: brokerSym,
      model,
      current_direction: posDirLabel,
      signal_direction: signalDirLabel,
      verdict,
      verdict_reason: reason,
      lots: Number(pos.lots),
      profit: Number(pos.profit),
      open_price: Number(pos.open_price),
      open_time: pos.open_time.toISOString(),
    });
  }

  // 4. Freshenss context so caller knows if signals are current or stale
  const freshness = evaluateFreshness(signals.report_date, signals.last_refresh_utc);

  const summary = {
    total: results.length,
    keep: results.filter((r) => r.verdict === "KEEP").length,
    close: results.filter((r) => r.verdict === "CLOSE").length,
    unknown: results.filter((r) => r.verdict === "UNKNOWN").length,
  };

  return NextResponse.json(
    {
      checked_at: new Date().toISOString(),
      signals_report_date: signals.report_date,
      signals_trading_allowed: signals.trading_allowed,
      signals_reason: signals.reason ?? freshness.reason,
      expected_report_date: freshness.expected_report_date,
      weekly_release_utc: freshness.weekly_release_utc,
      minutes_since_weekly_release: freshness.minutes_since_weekly_release,
      summary,
      positions: results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
