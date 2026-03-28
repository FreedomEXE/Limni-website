/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Returns ADR Forward Test trades for the current week (or a specified week).
 * For past weeks, force-closes any "active" trades using the week's close
 * price from pair_period_returns and computes their P&L.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import { query } from "@/lib/db";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_ID = "adr-forward";
const VARIANT = "fresh-start";
const MARKET = "multi-asset";
const CONFIG_KEY = "default";

export type AdrTradeRow = {
  symbol: string;
  direction: string;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  exitReason: string | null;
  tradeNumber: number | null;
  anchorPrice: number | null;
  adrPct: number | null;
  tpPrice: number | null;
  maePct: number | null;
  assetClass: string | null;
  tier: string | null;
  gateDecision: string | null;
};

export type AdrTradesPayload = {
  weekOpenUtc: string;
  generatedUtc: string;
  totalTrades: number;
  totalTpHits: number;
  totalActive: number;
  totalLosses: number;
  weekReturnPct: number;
  trades: AdrTradeRow[];
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week");
    const weekOpenUtc = weekParam ?? getCanonicalWeekOpenUtc(DateTime.utc());
    const currentWeekOpenUtc = getDisplayWeekOpenUtc();
    const isPastWeek = weekOpenUtc !== currentWeekOpenUtc;

    /* Find the run ID */
    const runRows = await query<{ id: string }>(
      `SELECT id FROM strategy_backtest_runs WHERE bot_id = $1 AND variant = $2 AND market = $3 AND config_key = $4 LIMIT 1`,
      [BOT_ID, VARIANT, MARKET, CONFIG_KEY],
    );

    if (runRows.length === 0) {
      return NextResponse.json({
        weekOpenUtc,
        generatedUtc: new Date().toISOString(),
        totalTrades: 0,
        totalTpHits: 0,
        totalActive: 0,
        totalLosses: 0,
        weekReturnPct: 0,
        trades: [],
      } satisfies AdrTradesPayload);
    }

    const runId = Number(runRows[0]!.id);

    const tradeRows = await query<{
      symbol: string;
      direction: string;
      entry_time_utc: string | null;
      exit_time_utc: string | null;
      entry_price: string | null;
      exit_price: string | null;
      pnl_pct: string | null;
      exit_reason: string | null;
      metadata: Record<string, unknown> | null;
    }>(
      `SELECT symbol, direction, entry_time_utc::text, exit_time_utc::text,
              entry_price, exit_price, pnl_pct, exit_reason, metadata
       FROM strategy_backtest_trades
       WHERE run_id = $1 AND week_open_utc = $2::timestamptz
       ORDER BY entry_time_utc ASC NULLS LAST`,
      [runId, weekOpenUtc],
    );

    // For past weeks: force-close active trades using week close prices
    let closePrices = new Map<string, number>();
    if (isPastWeek) {
      const priceRows = await query<{ symbol: string; close_price: string }>(
        `SELECT symbol, close_price FROM pair_period_returns
         WHERE period_type = 'weekly' AND period_open_utc = $1::timestamptz`,
        [weekOpenUtc],
      );
      for (const r of priceRows) {
        closePrices.set(r.symbol.toUpperCase(), Number(r.close_price));
      }
    }

    const trades: AdrTradeRow[] = tradeRows.map((r) => {
      const entryPrice = r.entry_price ? Number(r.entry_price) : null;
      let exitPrice = r.exit_price ? Number(r.exit_price) : null;
      let pnlPct = r.pnl_pct ? Number(r.pnl_pct) : null;
      let exitReason = r.exit_reason;

      // Force-close active trades for past weeks
      if (isPastWeek && exitReason === "active" && entryPrice) {
        const weekClosePrice = closePrices.get(r.symbol.toUpperCase());
        if (weekClosePrice) {
          exitPrice = weekClosePrice;
          const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
          pnlPct = r.direction === "SHORT" ? -rawReturn : rawReturn;
          exitReason = "week_close";
        }
      }

      return {
        symbol: r.symbol,
        direction: r.direction,
        entryTimeUtc: r.entry_time_utc,
        exitTimeUtc: r.exit_time_utc,
        entryPrice,
        exitPrice,
        pnlPct,
        exitReason,
        tradeNumber: (r.metadata as Record<string, unknown>)?.tradeNumber as number ?? null,
        anchorPrice: (r.metadata as Record<string, unknown>)?.anchorPrice as number ?? null,
        adrPct: (r.metadata as Record<string, unknown>)?.adrPct as number ?? null,
        tpPrice: (r.metadata as Record<string, unknown>)?.tpPrice as number ?? null,
        maePct: (r.metadata as Record<string, unknown>)?.maePct as number ?? null,
        assetClass: (r.metadata as Record<string, unknown>)?.assetClass as string ?? null,
        tier: (r.metadata as Record<string, unknown>)?.tier as string ?? null,
        gateDecision: (r.metadata as Record<string, unknown>)?.gateDecision as string ?? null,
      };
    });

    const totalTrades = trades.length;
    const totalTpHits = trades.filter((t) => t.exitReason === "tp").length;
    const totalActive = trades.filter((t) => t.exitReason === "active").length;
    const totalLosses = trades.filter((t) => t.exitReason === "week_close").length;
    const weekReturnPct = trades.reduce((sum, t) => sum + (t.pnlPct ?? 0), 0);

    return NextResponse.json({
      weekOpenUtc,
      generatedUtc: new Date().toISOString(),
      totalTrades,
      totalTpHits,
      totalActive,
      totalLosses,
      weekReturnPct,
      trades,
    } satisfies AdrTradesPayload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch ADR trades" },
      { status: 500 },
    );
  }
}
