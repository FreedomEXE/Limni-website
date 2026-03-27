/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Hourly cron that scans M5 candles for all directional signals and
 * detects ADR trades using the Fresh Start state machine. Writes
 * results to strategy_backtest_trades for the matrix to display.
 *
 * Also serves as the backfill endpoint — always re-scans from week open.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { fetchOanda5MinuteSeries, fetchOandaDailySeries, type OandaHourlyCandle } from "@/lib/oandaPrices";
import { getCanonicalWeeklyBasket } from "@/lib/flagship/canonicalWeeklyBasket";
import { scanAdrTrades, toBacktestTradeRows, type H1Bar } from "@/lib/flagship/adrTradeScanner";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const BOT_ID = "adr-forward";
const VARIANT = "fresh-start";
const MARKET = "multi-asset";
const CONFIG_KEY = "default";
const CONCURRENCY = 6;

function toPct(high: number, low: number, open: number): number | null {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(open) || open <= 0) return null;
  return ((high - low) / open) * 100;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function ensureRunId(): Promise<number> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM strategy_backtest_runs WHERE bot_id = $1 AND variant = $2 AND market = $3 AND config_key = $4 LIMIT 1`,
    [BOT_ID, VARIANT, MARKET, CONFIG_KEY],
  );
  if (existing.length > 0) return Number(existing[0]!.id);

  const inserted = await query<{ id: string }>(
    `INSERT INTO strategy_backtest_runs (bot_id, variant, market, strategy_name, config_key, config_json)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (bot_id, variant, market, config_key) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [BOT_ID, VARIANT, MARKET, "ADR Dynamic Fresh Start", CONFIG_KEY, JSON.stringify({ entryMultiple: 1.0, tpMultiple: 0.25, adrLookback: 10 })],
  );
  return Number(inserted[0]!.id);
}

/** Compute ADR from Oanda API daily bars (same source as TradingView's Oanda feed) */
async function computeAdr(pair: string, beforeUtc: string, assetClass: string): Promise<{ adrPct: number; adrDistance: number } | null> {
  const before = DateTime.fromISO(beforeUtc, { zone: "utc" });
  const from = before.minus({ days: ADR_LOOKBACK_DAYS + 10 }); // padding for weekends + holidays (need 11 trading days)
  // FX daily bars align to 5PM ET (17), commodities/indices to 6PM ET (18)
  const dailyAlignment = assetClass === "fx" ? 17 : 18;
  const dailyBars = await fetchOandaDailySeries(pair, from, before, dailyAlignment).catch(() => []);
  // Skip the most recent daily bar — Pine Script uses high[1..10] not high[0..9].
  // Bar [0] is the current/just-closed bar; the indicator skips it.
  const withoutMostRecent = dailyBars.slice(0, -1);
  const recent = withoutMostRecent.slice(-ADR_LOOKBACK_DAYS);

  const absRanges = recent
    .filter((bar) => Number.isFinite(bar.high) && Number.isFinite(bar.low) && bar.high > 0 && bar.low > 0)
    .map((bar) => bar.high - bar.low);

  const pctRanges = recent
    .filter((bar) => Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.open) && bar.open > 0)
    .map((bar) => ((bar.high - bar.low) / bar.open) * 100);

  if (absRanges.length < ADR_MIN_REQUIRED_DAYS || pctRanges.length < ADR_MIN_REQUIRED_DAYS) return null;

  return {
    adrPct: pctRanges.reduce((s, v) => s + v, 0) / pctRanges.length,
    adrDistance: absRanges.reduce((s, v) => s + v, 0) / absRanges.length,
  };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const nowUtc = DateTime.utc();
  const weekOpenUtc = getCanonicalWeekOpenUtc(nowUtc);

  try {
    const [basket, runId] = await Promise.all([
      getCanonicalWeeklyBasket({ weekOpenUtc }),
      ensureRunId(),
    ]);

    /* Only process directional signals (LONG/SHORT, not NEUTRAL) */
    const signals = basket.signals.filter(
      (s) => s.direction === "LONG" || s.direction === "SHORT",
    );

    /* Delete existing trades for this week+run so we can re-scan cleanly */
    await query(
      `DELETE FROM strategy_backtest_trades WHERE run_id = $1 AND week_open_utc = $2::timestamptz`,
      [runId, weekOpenUtc],
    );

    let totalTrades = 0;
    let totalTpHits = 0;
    let totalActive = 0;
    const errors: string[] = [];

    await mapWithConcurrency(signals, CONCURRENCY, async (signal) => {
      try {
        const weekWindow = getCanonicalWeekWindow(weekOpenUtc, signal.assetClass as "fx" | "indices" | "crypto" | "commodities");
        const adr = await computeAdr(signal.pair, weekWindow.openUtc.toISO()!, signal.assetClass);
        if (adr === null) return;
        const { adrPct, adrDistance } = adr;

        /* Fetch M5 candles for the week (matches indicator's 5M resolution) */
        const m5Bars: OandaHourlyCandle[] = await fetchOanda5MinuteSeries(
          signal.pair,
          weekWindow.openUtc,
          nowUtc,
        ).catch(() => []);

        if (m5Bars.length === 0) return;

        /* Run Fresh Start scanner */
        const trades = scanAdrTrades({
          pair: signal.pair,
          assetClass: signal.assetClass,
          direction: signal.direction as "LONG" | "SHORT",
          weekOpenUtc,
          adrPct,
          adrAbsoluteDistance: adrDistance,
          bars: m5Bars as H1Bar[],
          metadata: {
            assetClass: signal.assetClass,
            tier: signal.tier,
            gateDecision: signal.gateDecision,
            model: signal.model,
          },
        });

        if (trades.length === 0) return;

        /* Write to DB */
        const dbRows = toBacktestTradeRows(trades);
        for (const row of dbRows) {
          await query(
            `INSERT INTO strategy_backtest_trades
              (run_id, week_open_utc, symbol, direction, entry_time_utc, exit_time_utc,
               entry_price, exit_price, pnl_pct, exit_reason, metadata)
             VALUES ($1, $2::timestamptz, $3, $4, $5::timestamptz, $6::timestamptz,
                     $7, $8, $9, $10, $11::jsonb)`,
            [
              runId,
              row.weekOpenUtc,
              row.symbol,
              row.direction,
              row.entryTimeUtc,
              row.exitTimeUtc,
              row.entryPrice,
              row.exitPrice,
              row.pnlPct,
              row.exitReason,
              JSON.stringify(row.metadata ?? {}),
            ],
          );
        }

        totalTrades += trades.length;
        totalTpHits += trades.filter((t) => t.exitType === "TP_HIT").length;
        totalActive += trades.filter((t) => t.exitType === null).length;
      } catch (err) {
        errors.push(`${signal.pair}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    });

    /* Upsert weekly summary row */
    const weeklyReturn = await query<{ total: string }>(
      `SELECT COALESCE(SUM(pnl_pct), 0) as total FROM strategy_backtest_trades WHERE run_id = $1 AND week_open_utc = $2::timestamptz AND pnl_pct IS NOT NULL`,
      [runId, weekOpenUtc],
    );
    const weekReturn = Number(weeklyReturn[0]?.total ?? 0);
    const tpCount = totalTpHits;
    const lossCount = totalTrades - totalTpHits - totalActive;

    await query(
      `INSERT INTO strategy_backtest_weekly (run_id, week_open_utc, return_pct, trades, wins, losses)
       VALUES ($1, $2::timestamptz, $3, $4, $5, $6)
       ON CONFLICT (run_id, week_open_utc) DO UPDATE SET
         return_pct = EXCLUDED.return_pct,
         trades = EXCLUDED.trades,
         wins = EXCLUDED.wins,
         losses = EXCLUDED.losses,
         updated_at = NOW()`,
      [runId, weekOpenUtc, weekReturn, totalTrades, tpCount, lossCount],
    );

    return NextResponse.json({
      status: "ok",
      durationMs: Date.now() - startedAt,
      weekOpenUtc,
      runId,
      signalsProcessed: signals.length,
      totalTrades,
      totalTpHits,
      totalActive,
      weekReturnPct: weekReturn,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ADR trade scan failed" },
      { status: 500 },
    );
  }
}
