/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-corrected.ts
 *
 * Description:
 * Reruns the ADR Fresh Start backtest with all parity fixes applied:
 * - M5 bars (matches indicator's 5M resolution)
 * - ADR from Oanda API daily bars (skip most recent, correct alignment per asset class)
 * - Correct week starts (FX=5PM ET, Commodities/Indices=6PM ET)
 * - Anchor seed fix (seed from TP bar, not null)
 * - from+count pagination (fixes Oanda API data gap)
 *
 * Usage: npx tsx scripts/adr-backtest-corrected.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

import { DateTime } from "luxon";
import { query } from "@/lib/db";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { fetchOanda5MinuteSeries, fetchOandaDailySeries, type OandaHourlyCandle } from "@/lib/oandaPrices";
import { computeTieredWeekForSystem } from "@/lib/performance/tiered";
import { buildCotGateContext, buildGateMap, evaluatePairWithGate, type GateDecision } from "@/lib/performance/gateEvaluation";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { scanAdrTrades, toBacktestTradeRows, type H1Bar } from "@/lib/flagship/adrTradeScanner";

/* ─── Constants ─── */

const LOOKBACK_WEEKS = 9;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const FETCH_CONCURRENCY = 4; // lower than cron to avoid rate limits on historical data
const BOT_ID = "adr-forward";
const VARIANT = "fresh-start";
const MARKET = "multi-asset";
const CONFIG_KEY = "default";

const MODEL_TO_TIER: Record<string, string | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
};

type Direction = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";

/* ─── Utility ─── */

function buildCompletedWeekOpens(count: number): string[] {
  const now = DateTime.utc();
  const currentWeekOpen = getCanonicalWeekOpenUtc(now);
  const currentWeekOpenDt = DateTime.fromISO(currentWeekOpen, { zone: "utc" });
  const lastCompleted = currentWeekOpenDt.minus({ weeks: 1 });
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const weekOpen = lastCompleted.minus({ weeks: i });
    weeks.push(getCanonicalWeekOpenUtc(weekOpen.plus({ hours: 1 })));
  }
  return weeks;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }));
  return results;
}

/** Compute ADR from Oanda API daily bars — matches indicator exactly */
async function computeAdr(pair: string, beforeUtc: string, assetClass: string): Promise<{ adrPct: number; adrDistance: number } | null> {
  const before = DateTime.fromISO(beforeUtc, { zone: "utc" });
  const from = before.minus({ days: ADR_LOOKBACK_DAYS + 10 });
  const dailyAlignment = assetClass === "fx" ? 17 : 18;
  const dailyBars = await fetchOandaDailySeries(pair, from, before, dailyAlignment).catch(() => []);
  // Skip most recent daily bar (Pine uses high[1..10], not high[0..9])
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
    [BOT_ID, VARIANT, MARKET, "ADR Dynamic Fresh Start", CONFIG_KEY, JSON.stringify({ entryMultiple: 1.0, tpMultiple: 0.25, adrLookback: 10, resolution: "M5" })],
  );
  return Number(inserted[0]!.id);
}

/* ─── Main ─── */

async function main() {
  const completedWeeks = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  console.log(`\n=== ADR Fresh Start Backtest (Corrected) ===`);
  console.log(`Weeks: ${completedWeeks.length} (${completedWeeks[0]?.slice(0, 10)} to ${completedWeeks[completedWeeks.length - 1]?.slice(0, 10)})`);
  console.log(`Resolution: M5 | ADR: Oanda daily (skip most recent, aligned per asset class)`);
  console.log();

  const runId = await ensureRunId();

  const weekResults: { week: string; trades: number; tpHits: number; returnPct: number; active: number }[] = [];
  let grandTotalTrades = 0;
  let grandTotalTpHits = 0;
  let grandTotalReturn = 0;

  for (const weekOpenUtc of completedWeeks) {
    const weekStart = Date.now();
    const weekLabel = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York").plus({ days: 1 }).toFormat("MMM dd");
    process.stdout.write(`${weekLabel} (${weekOpenUtc.slice(0, 10)})... `);

    // Get signals for this week
    const computed = await computeTieredWeekForSystem({ weekOpenUtc, system: "v3" });
    if (!computed) {
      console.log("no signals (null)");
      weekResults.push({ week: weekOpenUtc, trades: 0, tpHits: 0, returnPct: 0, active: 0 });
      continue;
    }
    const cotContext = await buildCotGateContext(weekOpenUtc);
    const gateMap = buildGateMap(cotContext);

    // Build asset class map
    const assetClassMap = new Map<string, AssetClass>();
    for (const [ac, pairs] of Object.entries(computed.perAsset)) {
      for (const modelRow of pairs) {
        const details = (modelRow as { pair_details?: Array<{ pair: string }> }).pair_details ?? [];
        for (const d of details) assetClassMap.set(d.pair.toUpperCase(), ac as AssetClass);
      }
    }

    // Build signal list (matches old script structure)
    type Signal = { pair: string; direction: Direction; assetClass: AssetClass; tier: string; model: string; gateDecision: string };
    const signals: Signal[] = [];
    for (const modelRow of computed.combined) {
      const model = (modelRow as { model: string }).model ?? "";
      const tier = MODEL_TO_TIER[model] ?? null;
      if (!tier) continue;

      const details = (modelRow as { pair_details?: Array<{ pair: string; direction: string }> }).pair_details ?? [];
      for (const detail of details) {
        const pair = detail.pair.toUpperCase();
        const direction = detail.direction;
        if (direction !== "LONG" && direction !== "SHORT") continue;

        const assetClass = assetClassMap.get(pair) ?? "fx";
        let gate: { decision: GateDecision; reasons: string[] };
        try {
          gate = evaluatePairWithGate({ pair, weekOpenUtc, direction, assetClass, gateMap, cotContext, reduceAsSkip: true });
        } catch {
          gate = { decision: "NO_DATA" as GateDecision, reasons: ["gate_eval_error"] };
        }
        if (gate.decision === "SKIP") continue;

        signals.push({ pair, direction: direction as Direction, assetClass, tier, model, gateDecision: gate.decision });
      }
    }

    // Delete old trades for this week
    await query(`DELETE FROM strategy_backtest_trades WHERE run_id = $1 AND week_open_utc = $2::timestamptz`, [runId, weekOpenUtc]);

    let weekTrades = 0;
    let weekTpHits = 0;
    let weekActive = 0;

    await mapWithConcurrency(signals, FETCH_CONCURRENCY, async (signal) => {
      try {
        const weekWindow = getCanonicalWeekWindow(weekOpenUtc, signal.assetClass as "fx" | "indices" | "crypto" | "commodities");
        const adr = await computeAdr(signal.pair, weekWindow.openUtc.toISO()!, signal.assetClass);
        if (!adr) return;

        // Fetch M5 bars for the week
        const m5Bars: OandaHourlyCandle[] = await fetchOanda5MinuteSeries(
          signal.pair,
          weekWindow.openUtc,
          weekWindow.closeUtc,
        ).catch(() => []);
        if (m5Bars.length === 0) return;

        // Run scanner
        const trades = scanAdrTrades({
          pair: signal.pair,
          assetClass: signal.assetClass,
          direction: signal.direction,
          weekOpenUtc,
          adrPct: adr.adrPct,
          adrAbsoluteDistance: adr.adrDistance,
          bars: m5Bars as H1Bar[],
          metadata: {
            assetClass: signal.assetClass,
            tier: signal.tier,
            gateDecision: signal.gateDecision,
            model: signal.model,
          },
        });
        if (trades.length === 0) return;

        // Write to DB
        const dbRows = toBacktestTradeRows(trades);
        for (const row of dbRows) {
          await query(
            `INSERT INTO strategy_backtest_trades
              (run_id, week_open_utc, symbol, direction, entry_time_utc, exit_time_utc,
               entry_price, exit_price, pnl_pct, exit_reason, metadata)
             VALUES ($1, $2::timestamptz, $3, $4, $5::timestamptz, $6::timestamptz,
                     $7, $8, $9, $10, $11::jsonb)`,
            [runId, row.weekOpenUtc, row.symbol, row.direction, row.entryTimeUtc, row.exitTimeUtc,
              row.entryPrice, row.exitPrice, row.pnlPct, row.exitReason, JSON.stringify(row.metadata ?? {})],
          );
        }

        weekTrades += trades.length;
        weekTpHits += trades.filter((t) => t.exitType === "TP_HIT").length;
        weekActive += trades.filter((t) => t.exitType === null).length;
      } catch (err) {
        console.error(`  ${signal.pair}: ${err instanceof Error ? err.message : "error"}`);
      }
    });

    // Compute weekly return
    const weeklyReturn = await query<{ total: string }>(
      `SELECT COALESCE(SUM(pnl_pct), 0) as total FROM strategy_backtest_trades WHERE run_id = $1 AND week_open_utc = $2::timestamptz AND pnl_pct IS NOT NULL`,
      [runId, weekOpenUtc],
    );
    const weekReturn = Number(weeklyReturn[0]?.total ?? 0);

    // Upsert weekly summary
    await query(
      `INSERT INTO strategy_backtest_weekly (run_id, week_open_utc, return_pct, trades, wins, losses)
       VALUES ($1, $2::timestamptz, $3, $4, $5, $6)
       ON CONFLICT (run_id, week_open_utc) DO UPDATE SET
         return_pct = EXCLUDED.return_pct, trades = EXCLUDED.trades,
         wins = EXCLUDED.wins, losses = EXCLUDED.losses, updated_at = NOW()`,
      [runId, weekOpenUtc, weekReturn, weekTrades, weekTpHits, weekTrades - weekTpHits - weekActive],
    );

    weekResults.push({ week: weekOpenUtc, trades: weekTrades, tpHits: weekTpHits, returnPct: weekReturn, active: weekActive });
    grandTotalTrades += weekTrades;
    grandTotalTpHits += weekTpHits;
    grandTotalReturn += weekReturn;

    const elapsed = ((Date.now() - weekStart) / 1000).toFixed(1);
    console.log(`${weekTrades} trades, ${weekTpHits} TP, +${weekReturn.toFixed(2)}% (${elapsed}s)`);
  }

  // Summary
  console.log("\n=== BACKTEST RESULTS (Corrected) ===\n");
  console.log("Week".padEnd(14), "Trades", "TP", "Return");
  console.log("-".repeat(45));
  for (const wr of weekResults) {
    const label = DateTime.fromISO(wr.week, { zone: "utc" }).setZone("America/New_York").plus({ days: 1 }).toFormat("MMM dd");
    console.log(label.padEnd(14), String(wr.trades).padEnd(7), String(wr.tpHits).padEnd(4), `+${wr.returnPct.toFixed(2)}%`);
  }
  console.log("-".repeat(45));
  const winRate = grandTotalTrades > 0 ? (grandTotalTpHits / grandTotalTrades * 100).toFixed(1) : "0";
  console.log("TOTAL".padEnd(14), String(grandTotalTrades).padEnd(7), String(grandTotalTpHits).padEnd(4), `+${grandTotalReturn.toFixed(2)}%`);
  console.log(`\nWin Rate: ${winRate}%`);
  console.log(`Avg Return/Week: +${(grandTotalReturn / weekResults.length).toFixed(2)}%`);

  console.log("\n=== OLD RESULTS (for comparison) ===");
  console.log("330 fills, +79.57%, 92.73% WR (H1, wrong ADR, wrong anchor)");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
