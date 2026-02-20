/**
 * GET /api/mt5/reconcile-preview
 *
 * Simulates the EA's Friday rollover logic server-side. Shows the final action
 * each open position will take when new COT data arrives, without touching broker state.
 *
 * EA Friday rollover sequence (when report_date changes):
 * 1. Close ALL winning positions (profit+swap > 0) with reason "friday_winner_close"
 * 2. Run ReconcilePositionsWithSignals on remaining losers:
 *    - KEEP if signal direction still matches
 *    - CLOSE if signal flipped or symbol/model has no signal ("weekly_flip")
 *
 * This endpoint returns both:
 * - `reconcile_verdict` (what reconcile alone would do)
 * - `verdict` (final Friday action after winner-close override)
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
  if (!raw) return "unknown";
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

// Mirrors EA NormalizeSymbolKey(): keep only A-Z0-9.
function normalizeSymbolKey(brokerSymbol: string): string {
  return brokerSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Mirrors EA ResolveSymbolByFamily() buckets for index/commodity aliases.
function symbolFamilyKey(normalizedSymbol: string): "spx" | "ndx" | "nikkei" | "wti" | null {
  if (
    normalizedSymbol === "SPXUSD" ||
    normalizedSymbol.includes("SPX") ||
    normalizedSymbol.includes("SP500") ||
    normalizedSymbol.includes("US500")
  ) {
    return "spx";
  }
  if (
    normalizedSymbol === "NDXUSD" ||
    normalizedSymbol.includes("NDX") ||
    normalizedSymbol.includes("NAS100") ||
    normalizedSymbol.includes("US100")
  ) {
    return "ndx";
  }
  if (
    normalizedSymbol === "NIKKEIUSD" ||
    normalizedSymbol.includes("NIKKEI") ||
    normalizedSymbol.includes("JPN225") ||
    normalizedSymbol.includes("JP225")
  ) {
    return "nikkei";
  }
  if (
    normalizedSymbol === "WTIUSD" ||
    normalizedSymbol.includes("WTI") ||
    normalizedSymbol.includes("USOIL") ||
    normalizedSymbol.includes("USOUSD") ||
    normalizedSymbol.includes("XTI") ||
    normalizedSymbol.includes("USCRUDE")
  ) {
    return "wti";
  }
  return null;
}

function pickBestByLengthDelta(target: string, candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestDelta = Math.abs(best.length - target.length);
  for (let i = 1; i < candidates.length; i += 1) {
    const delta = Math.abs(candidates[i].length - target.length);
    if (delta < bestDelta) {
      best = candidates[i];
      bestDelta = delta;
    }
  }
  return best;
}

// Resolve broker symbol to the signal key similarly to EA resolve behavior.
function resolveSignalSymbolKey(
  brokerSymbol: string,
  signalMap: Map<string, Map<string, number>>,
): string | null {
  const key = normalizeSymbolKey(brokerSymbol);
  if (!key) return null;
  if (signalMap.has(key)) return key;

  const signalKeys = Array.from(signalMap.keys());
  const prefixCandidates = signalKeys.filter(
    (signalKey) => key.startsWith(signalKey) || signalKey.startsWith(key),
  );
  const prefixBest = pickBestByLengthDelta(key, prefixCandidates);
  if (prefixBest) return prefixBest;

  const targetFamily = symbolFamilyKey(key);
  if (!targetFamily) return null;
  const familyCandidates = signalKeys.filter((signalKey) => symbolFamilyKey(signalKey) === targetFamily);
  return pickBestByLengthDelta(key, familyCandidates);
}

function inferNetMode(broker: string | null, server: string | null): boolean {
  const haystack = `${String(broker ?? "")}|${String(server ?? "")}`.toLowerCase();
  const hints = ["5ers", "the5ers", "fiveers", "fivepercent", "five percent", "fxify"];
  return hints.some((hint) => haystack.includes(hint));
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
    const sym = normalizeSymbolKey(pair.symbol);
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
    swap: string;
    comment: string;
    open_price: string;
    open_time: Date;
    broker: string | null;
    server: string | null;
  };

  const params: Array<string> = [];
  let whereClause = "";
  if (accountIdFilter) {
    params.push(accountIdFilter);
    whereClause = "WHERE p.account_id = $1";
  }

  const positions = await query<PositionRow>(
    `SELECT p.account_id, p.ticket, p.symbol, p.type, p.lots, p.profit, p.swap,
            p.comment, p.open_price, p.open_time, a.broker, a.server
     FROM mt5_positions p
     LEFT JOIN mt5_accounts a ON a.account_id = p.account_id
     ${whereClause}
     ORDER BY p.account_id, p.symbol, p.type`,
    params,
  );

  // 3. Evaluate each position against current signals
  type PositionVerdict = {
    account_id: string;
    ticket: number;
    symbol: string;
    broker_symbol: string;
    matched_signal_symbol: string | null;
    account_mode: "MODEL" | "NET";
    model: string;
    current_direction: "BUY" | "SELL";
    signal_direction: "LONG" | "SHORT" | "NO_SIGNAL";
    reconcile_verdict: "KEEP" | "CLOSE" | "UNKNOWN";
    reconcile_reason: string;
    winner_close: boolean;
    net_pnl: number;
    verdict: "KEEP" | "CLOSE" | "UNKNOWN";
    verdict_reason: string;
    lots: number;
    profit: number;
    swap: number;
    open_price: number;
    open_time: string;
  };

  const results: PositionVerdict[] = [];

  for (const pos of positions) {
    const model = parseModelFromComment(pos.comment);
    const brokerSym = pos.symbol;
    const sym = normalizeSymbolKey(brokerSym);
    const matchedSignalSymbol = resolveSignalSymbolKey(sym, signalMap);
    const accountMode = inferNetMode(pos.broker, pos.server) ? "NET" : "MODEL";
    const posDir = pos.type.toUpperCase() === "BUY" ? 1 : -1;
    const posDirLabel = posDir === 1 ? "BUY" : "SELL";

    const modelMap = matchedSignalSymbol ? signalMap.get(matchedSignalSymbol) : null;
    let signalDir: number | null = null;
    let signalDirLabel: "LONG" | "SHORT" | "NO_SIGNAL" = "NO_SIGNAL";
    let reconcileVerdict: "KEEP" | "CLOSE" | "UNKNOWN" = "UNKNOWN";
    let reconcileReason = "";

    if (accountMode === "NET") {
      if (!modelMap) {
        reconcileVerdict = "CLOSE";
        reconcileReason = "symbol not in current signal set (net mode)";
      } else {
        const netSignal = Array.from(modelMap.values()).reduce((sum, dir) => sum + dir, 0);
        if (netSignal === 0) {
          reconcileVerdict = "CLOSE";
          reconcileReason = "net signal is flat (net mode)";
        } else {
          signalDir = netSignal > 0 ? 1 : -1;
          signalDirLabel = signalDir === 1 ? "LONG" : "SHORT";
          if (signalDir === posDir) {
            reconcileVerdict = "KEEP";
            reconcileReason = "net direction matches new signal";
          } else {
            reconcileVerdict = "CLOSE";
            reconcileReason = `net direction flipped: position is ${posDirLabel}, new net signal is ${signalDirLabel}`;
          }
        }
      }
    } else if (model === "unknown") {
      reconcileVerdict = "UNKNOWN";
      reconcileReason = "cannot parse model from comment";
    } else {
      if (!modelMap) {
        reconcileVerdict = "CLOSE";
        reconcileReason = "symbol not in current signal set";
      } else {
      signalDir = modelMap.get(model) ?? null;
      if (signalDir === null) {
        // Symbol exists but no signal for this model
          reconcileVerdict = "CLOSE";
          reconcileReason = `no ${model} signal for ${matchedSignalSymbol ?? sym}`;
        signalDirLabel = "NO_SIGNAL";
      } else if (signalDir === posDir) {
          reconcileVerdict = "KEEP";
          reconcileReason = "direction matches new signal";
        signalDirLabel = signalDir === 1 ? "LONG" : "SHORT";
      } else {
          reconcileVerdict = "CLOSE";
          reconcileReason = `direction flipped: position is ${posDirLabel}, new signal is ${signalDir === 1 ? "LONG" : "SHORT"}`;
        signalDirLabel = signalDir === 1 ? "LONG" : "SHORT";
        }
      }
    }

    const profit = Number(pos.profit);
    const swap = Number(pos.swap);
    const netPnl = profit + swap;
    const winnerClose = Number.isFinite(netPnl) && netPnl > 0;
    const finalVerdict: "KEEP" | "CLOSE" | "UNKNOWN" = winnerClose ? "CLOSE" : reconcileVerdict;
    const finalReason = winnerClose
      ? "friday_winner_close: net PnL > 0 (profit + swap)"
      : reconcileReason;
    const openTime = pos.open_time instanceof Date
      ? pos.open_time
      : new Date(pos.open_time);

    results.push({
      account_id: pos.account_id,
      ticket: Number(pos.ticket),
      symbol: sym,
      broker_symbol: brokerSym,
      matched_signal_symbol: matchedSignalSymbol,
      account_mode: accountMode,
      model,
      current_direction: posDirLabel,
      signal_direction: signalDirLabel,
      reconcile_verdict: reconcileVerdict,
      reconcile_reason: reconcileReason,
      winner_close: winnerClose,
      net_pnl: Number.isFinite(netPnl) ? netPnl : 0,
      verdict: finalVerdict,
      verdict_reason: finalReason,
      lots: Number(pos.lots),
      profit,
      swap,
      open_price: Number(pos.open_price),
      open_time: openTime.toISOString(),
    });
  }

  // 4. Freshenss context so caller knows if signals are current or stale
  const freshness = evaluateFreshness(signals.report_date, signals.last_refresh_utc);

  const summary = {
    total: results.length,
    keep: results.filter((r) => r.verdict === "KEEP").length,
    close: results.filter((r) => r.verdict === "CLOSE").length,
    unknown: results.filter((r) => r.verdict === "UNKNOWN").length,
    winner_close: results.filter((r) => r.winner_close).length,
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
