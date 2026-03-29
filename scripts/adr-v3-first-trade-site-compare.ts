/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/adr-v3-first-trade-site-compare.ts
 *
 * Description:
 * Compare persisted Limni-site ADR V3 baseline (multi-entry) against
 * a derived first-trade-only variant built from the same stored trade rows.
 *
 * Source of truth:
 *   - strategy_backtest_weekly  (persisted multi-entry weekly baseline)
 *   - strategy_backtest_trades  (persisted trade rows, filtered by tradeNumber=1)
 *
 * Usage:
 *   npx tsx scripts/adr-v3-first-trade-site-compare.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { query } from "../src/lib/db";

loadEnvConfig(process.cwd());

const RUN_ID = 54;
const WEEK_CUTOFF = "2026-03-22T23:00:00Z";

type WeeklyRow = {
  week_open_utc: string | Date;
  return_pct: number | string | null;
  trades: number | string | null;
  wins: number | string | null;
  losses: number | string | null;
  drawdown_pct: number | string | null;
  gross_profit_pct: number | string | null;
  gross_loss_pct: number | string | null;
};

type TradeRow = {
  week_open_utc: string | Date;
  symbol: string;
  direction: string;
  entry_price: number | string | null;
  pnl_pct: number | string | null;
  exit_reason: string | null;
  metadata: Record<string, unknown> | null;
};

type PriceRow = {
  period_open_utc: string | Date;
  symbol: string;
  close_price: number | string | null;
};

type Aggregate = {
  net: number;
  trades: number;
  tp: number;
  wc: number;
  grossProfit: number;
  grossLoss: number;
  weeklyReturns: number[];
};

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function fmtPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function winRate(tp: number, trades: number) {
  return trades > 0 ? (tp / trades) * 100 : 0;
}

function computeCurveStats(weeklyReturns: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  let worstWeek = 0;
  let losingWeeks = 0;

  for (const weekReturn of weeklyReturns) {
    equity += weekReturn;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
    worstWeek = Math.min(worstWeek, weekReturn);
    if (weekReturn < 0) losingWeeks += 1;
  }

  return {
    finalEquity: equity,
    maxDrawdown: maxDd,
    worstWeek,
    losingWeeks,
  };
}

async function main() {
  const weeklyRows = await query<WeeklyRow>(
    `SELECT week_open_utc, return_pct, trades, wins, losses, drawdown_pct, gross_profit_pct, gross_loss_pct
     FROM strategy_backtest_weekly
     WHERE run_id = $1 AND week_open_utc < $2::timestamptz
     ORDER BY week_open_utc ASC`,
    [RUN_ID, WEEK_CUTOFF],
  );

  const tradeRows = await query<TradeRow>(
    `SELECT week_open_utc, symbol, direction, entry_price, pnl_pct, exit_reason, metadata
     FROM strategy_backtest_trades
     WHERE run_id = $1 AND week_open_utc < $2::timestamptz
     ORDER BY week_open_utc ASC`,
    [RUN_ID, WEEK_CUTOFF],
  );

  const closePriceRows = await query<PriceRow>(
    `SELECT period_open_utc, symbol, close_price
     FROM pair_period_returns
     WHERE period_type = 'weekly' AND period_open_utc < $1::timestamptz`,
    [WEEK_CUTOFF],
  );

  const closeByWeekSymbol = new Map<string, number>();
  for (const row of closePriceRows) {
    closeByWeekSymbol.set(`${toIso(row.period_open_utc)}|${row.symbol.toUpperCase()}`, toNumber(row.close_price));
  }

  const firstTradeByWeek = new Map<string, TradeRow[]>();
  for (const row of tradeRows) {
    const tradeNumber = toNumber(row.metadata?.tradeNumber);
    if (tradeNumber !== 1) continue;
    const weekIso = toIso(row.week_open_utc);
    const bucket = firstTradeByWeek.get(weekIso) ?? [];
    bucket.push(row);
    firstTradeByWeek.set(weekIso, bucket);
  }

  const tradesByWeek = new Map<string, TradeRow[]>();
  for (const row of tradeRows) {
    const weekIso = toIso(row.week_open_utc);
    const bucket = tradesByWeek.get(weekIso) ?? [];
    bucket.push(row);
    tradesByWeek.set(weekIso, bucket);
  }

  const multi: Aggregate = {
    net: 0,
    trades: 0,
    tp: 0,
    wc: 0,
    grossProfit: 0,
    grossLoss: 0,
    weeklyReturns: [],
  };

  const first: Aggregate = {
    net: 0,
    trades: 0,
    tp: 0,
    wc: 0,
    grossProfit: 0,
    grossLoss: 0,
    weeklyReturns: [],
  };

  console.log("\nADR V3 — persisted site baseline vs first-trade-only\n");
  console.log(
    "Week".padEnd(7),
    "Multi Net".padEnd(12),
    "First Net".padEnd(12),
    "Multi T".padEnd(8),
    "First T".padEnd(8),
    "First TP".padEnd(9),
    "First WC".padEnd(9),
  );
  console.log("-".repeat(72));

  for (const weekly of weeklyRows) {
    const weekIso = toIso(weekly.week_open_utc);
    const label = new Date(new Date(weekIso).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(5, 10);

    const adjustTrades = (rows: TradeRow[]) => rows.map((row) => {
      const pnl = toNumber(row.pnl_pct);
      if (row.exit_reason !== "active") {
        return { pnl, exitReason: row.exit_reason ?? "" };
      }
      const entryPrice = toNumber(row.entry_price);
      const closeKey = `${weekIso}|${row.symbol.toUpperCase()}`;
      const weekClosePrice = closeByWeekSymbol.get(closeKey) ?? 0;
      if (entryPrice <= 0 || weekClosePrice <= 0) {
        return { pnl, exitReason: row.exit_reason ?? "" };
      }
      const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
      const adjustedPnl = row.direction === "SHORT" ? -rawReturn : rawReturn;
      return { pnl: adjustedPnl, exitReason: "week_close" };
    });

    const multiAdjusted = adjustTrades(tradesByWeek.get(weekIso) ?? []);
    const multiReturn = multiAdjusted.reduce((sum, row) => sum + row.pnl, 0);
    const multiTrades = multiAdjusted.length;
    const multiWins = multiAdjusted.filter((row) => row.exitReason === "tp").length;
    const multiLosses = multiAdjusted.filter((row) => row.exitReason === "week_close").length;
    const multiGrossProfit = multiAdjusted.filter((row) => row.pnl > 0).reduce((sum, row) => sum + row.pnl, 0);
    const multiGrossLoss = multiAdjusted.filter((row) => row.pnl < 0).reduce((sum, row) => sum + row.pnl, 0);

    multi.net += multiReturn;
    multi.trades += multiTrades;
    multi.tp += multiWins;
    multi.wc += multiLosses;
    multi.grossProfit += multiGrossProfit;
    multi.grossLoss += multiGrossLoss;
    multi.weeklyReturns.push(multiReturn);

    const firstAdjusted = adjustTrades(firstTradeByWeek.get(weekIso) ?? []);
    const firstReturn = firstAdjusted.reduce((sum, row) => sum + row.pnl, 0);
    const firstTp = firstAdjusted.filter((row) => row.exitReason === "tp").length;
    const firstWc = firstAdjusted.filter((row) => row.exitReason === "week_close").length;
    const firstGrossProfit = firstAdjusted.filter((row) => row.pnl > 0).reduce((sum, row) => sum + row.pnl, 0);
    const firstGrossLoss = firstAdjusted.filter((row) => row.pnl < 0).reduce((sum, row) => sum + row.pnl, 0);

    first.net += firstReturn;
    first.trades += firstAdjusted.length;
    first.tp += firstTp;
    first.wc += firstWc;
    first.grossProfit += firstGrossProfit;
    first.grossLoss += firstGrossLoss;
    first.weeklyReturns.push(firstReturn);

    console.log(
      label.padEnd(7),
      fmtPct(multiReturn).padEnd(12),
      fmtPct(firstReturn).padEnd(12),
      String(multiTrades).padEnd(8),
      String(firstAdjusted.length).padEnd(8),
      String(firstTp).padEnd(9),
      String(firstWc).padEnd(9),
    );
  }

  const multiCurve = computeCurveStats(multi.weeklyReturns);
  const firstCurve = computeCurveStats(first.weeklyReturns);

  console.log("\nSummary\n");
  console.log(
    "Mode".padEnd(12),
    "Net".padEnd(10),
    "Trades".padEnd(8),
    "TP".padEnd(6),
    "WC".padEnd(6),
    "WR".padEnd(8),
    "Gross+".padEnd(10),
    "Gross-".padEnd(10),
    "MaxDD".padEnd(10),
    "WorstWk".padEnd(10),
    "LoseWk".padEnd(8),
  );
  console.log("-".repeat(100));
  console.log(
    "Multi".padEnd(12),
    fmtPct(multi.net).padEnd(10),
    String(multi.trades).padEnd(8),
    String(multi.tp).padEnd(6),
    String(multi.wc).padEnd(6),
    `${winRate(multi.tp, multi.trades).toFixed(1)}%`.padEnd(8),
    fmtPct(multi.grossProfit).padEnd(10),
    fmtPct(multi.grossLoss).padEnd(10),
    fmtPct(multiCurve.maxDrawdown).padEnd(10),
    fmtPct(multiCurve.worstWeek).padEnd(10),
    String(multiCurve.losingWeeks).padEnd(8),
  );
  console.log(
    "First Only".padEnd(12),
    fmtPct(first.net).padEnd(10),
    String(first.trades).padEnd(8),
    String(first.tp).padEnd(6),
    String(first.wc).padEnd(6),
    `${winRate(first.tp, first.trades).toFixed(1)}%`.padEnd(8),
    fmtPct(first.grossProfit).padEnd(10),
    fmtPct(first.grossLoss).padEnd(10),
    fmtPct(firstCurve.maxDrawdown).padEnd(10),
    fmtPct(firstCurve.worstWeek).padEnd(10),
    String(firstCurve.losingWeeks).padEnd(8),
  );

  console.log("\nDelta (First - Multi)\n");
  console.log(`Net: ${fmtPct(first.net - multi.net)}`);
  console.log(`Trades: ${first.trades - multi.trades}`);
  console.log(`Win Rate: ${(winRate(first.tp, first.trades) - winRate(multi.tp, multi.trades)).toFixed(1)}%`);
  console.log(`Max Drawdown: ${fmtPct(firstCurve.maxDrawdown - multiCurve.maxDrawdown)}`);
  console.log(`Worst Week: ${fmtPct(firstCurve.worstWeek - multiCurve.worstWeek)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
