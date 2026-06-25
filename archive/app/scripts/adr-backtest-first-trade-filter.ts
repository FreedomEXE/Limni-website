/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/adr-backtest-first-trade-filter.ts
 *
 * Description:
 * Compare canonical ADR Pullback baseline in two modes:
 *   1. Multi-entry Fresh Start (current behavior)
 *   2. First-trade-only per pair-week
 *
 * Runs the corrected M5/Oanda/Fresh Start scanner across the main bias sources
 * so we can choose the best strategy to attach the filter to.
 *
 * Usage:
 *   npx tsx scripts/adr-backtest-first-trade-filter.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { Pool } from "pg";

import { getCanonicalWeekWindow } from "../src/lib/canonicalPriceWindows";
import { scanAdrTrades, type AdrTradeDirection, type AdrTradeResult } from "../src/lib/flagship/adrTradeScanner";
import { fetchOanda5MinuteSeries, fetchOandaDailySeries } from "../src/lib/oandaPrices";

loadEnvConfig(process.cwd());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const RUN_ID = 54;
const WEEK_CUTOFF = "2026-03-22T23:00:00Z";

const ALL_PAIRS = [
  { pair: "AUDCAD", ac: "fx" },
  { pair: "AUDCHF", ac: "fx" },
  { pair: "AUDJPY", ac: "fx" },
  { pair: "AUDNZD", ac: "fx" },
  { pair: "AUDUSD", ac: "fx" },
  { pair: "CADCHF", ac: "fx" },
  { pair: "CADJPY", ac: "fx" },
  { pair: "CHFJPY", ac: "fx" },
  { pair: "EURAUD", ac: "fx" },
  { pair: "EURCAD", ac: "fx" },
  { pair: "EURCHF", ac: "fx" },
  { pair: "EURGBP", ac: "fx" },
  { pair: "EURJPY", ac: "fx" },
  { pair: "EURNZD", ac: "fx" },
  { pair: "EURUSD", ac: "fx" },
  { pair: "GBPAUD", ac: "fx" },
  { pair: "GBPCAD", ac: "fx" },
  { pair: "GBPCHF", ac: "fx" },
  { pair: "GBPJPY", ac: "fx" },
  { pair: "GBPNZD", ac: "fx" },
  { pair: "GBPUSD", ac: "fx" },
  { pair: "NZDCAD", ac: "fx" },
  { pair: "NZDCHF", ac: "fx" },
  { pair: "NZDJPY", ac: "fx" },
  { pair: "NZDUSD", ac: "fx" },
  { pair: "USDCAD", ac: "fx" },
  { pair: "USDCHF", ac: "fx" },
  { pair: "USDJPY", ac: "fx" },
  { pair: "BTCUSD", ac: "crypto" },
  { pair: "ETHUSD", ac: "crypto" },
  { pair: "WTIUSD", ac: "commodities" },
  { pair: "XAGUSD", ac: "commodities" },
  { pair: "XAUUSD", ac: "commodities" },
  { pair: "SPXUSD", ac: "indices" },
  { pair: "NDXUSD", ac: "indices" },
  { pair: "NIKKEIUSD", ac: "indices" },
] as const;

type AssetClass = (typeof ALL_PAIRS)[number]["ac"];
type StrategyKey = "v3" | "sentiment" | "dealer" | "commercial";
type ModeKey = "multi" | "first";

type SentimentRow = {
  symbol: string;
  crowding_state: string | null;
  flip_state: string | null;
  ts: number;
};

type CotByDate = Record<string, Record<string, Record<string, any>>>;
type V3Signals = Record<string, Record<string, AdrTradeDirection>>;

type Accumulator = {
  trades: number;
  tp: number;
  wc: number;
  net: number;
  tpPnl: number;
  wcPnl: number;
  maeSum: number;
  maeCount: number;
  maxMae: number;
  weekly: number[];
};

type WeekResult = Record<StrategyKey, Record<ModeKey, number>>;

function makeAcc(): Accumulator {
  return {
    trades: 0,
    tp: 0,
    wc: 0,
    net: 0,
    tpPnl: 0,
    wcPnl: 0,
    maeSum: 0,
    maeCount: 0,
    maxMae: 0,
    weekly: [],
  };
}

function addTrades(acc: Accumulator, trades: AdrTradeResult[]) {
  for (const trade of trades) {
    acc.trades += 1;
    const pnl = trade.returnPct ?? 0;
    acc.net += pnl;
    if (trade.exitType === "TP_HIT") {
      acc.tp += 1;
      acc.tpPnl += pnl;
    } else {
      acc.wc += 1;
      acc.wcPnl += pnl;
    }
    if (typeof trade.maePct === "number" && Number.isFinite(trade.maePct)) {
      acc.maeSum += trade.maePct;
      acc.maeCount += 1;
      acc.maxMae = Math.max(acc.maxMae, trade.maePct);
    }
  }
}

function fmtPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function wr(acc: Accumulator) {
  return acc.trades > 0 ? (acc.tp / acc.trades) * 100 : 0;
}

function avgMae(acc: Accumulator) {
  return acc.maeCount > 0 ? acc.maeSum / acc.maeCount : 0;
}

function curveStats(weekly: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  let worstWeek = 0;
  let losingWeeks = 0;

  for (const week of weekly) {
    equity += week;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
    worstWeek = Math.min(worstWeek, week);
    if (week < 0) losingWeeks += 1;
  }

  return { finalEquity: equity, maxDd, worstWeek, losingWeeks };
}

function sentimentDirection(agg?: { flip_state: string | null; crowding_state: string | null } | null): AdrTradeDirection | null {
  if (!agg) return null;
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return null;
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return null;
}

const PAIR_CURRENCIES: Record<string, { type: string; base?: string; quote?: string; market?: string }> = {};
for (const { pair, ac } of ALL_PAIRS) {
  if (ac === "fx") {
    PAIR_CURRENCIES[pair] = { type: "fx", base: pair.slice(0, 3), quote: pair.slice(3) };
  } else {
    const marketMap: Record<string, string> = {
      XAUUSD: "XAU",
      XAGUSD: "XAG",
      WTIUSD: "WTI",
      SPXUSD: "SPX",
      NDXUSD: "NDX",
      NIKKEIUSD: "NIKKEI",
      BTCUSD: "BTC",
      ETHUSD: "ETH",
    };
    PAIR_CURRENCIES[pair] = { type: ac, market: marketMap[pair] };
  }
}

function cotDirection(pair: string, cotByAc: Record<string, Record<string, any>> | null, model: "dealer" | "commercial"): AdrTradeDirection | null {
  if (!cotByAc) return null;
  const info = PAIR_CURRENCIES[pair];
  if (!info) return null;

  if (info.type === "fx") {
    const fxSnap = cotByAc.fx;
    if (!fxSnap || !info.base || !info.quote) return null;
    const baseBias = fxSnap[info.base]?.[`${model}_bias`];
    const quoteBias = fxSnap[info.quote]?.[`${model}_bias`];
    if (!baseBias || !quoteBias) return null;
    if (baseBias === "BULLISH" && quoteBias === "BEARISH") return "LONG";
    if (baseBias === "BEARISH" && quoteBias === "BULLISH") return "SHORT";
    return null;
  }

  if (!info.market) return null;
  const snap = cotByAc[info.type];
  const bias = snap?.[info.market]?.[`${model}_bias`];
  if (bias === "BULLISH") return "LONG";
  if (bias === "BEARISH") return "SHORT";
  return null;
}

async function computeAdr(pair: string, weekOpenUtc: string, assetClass: AssetClass) {
  const before = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const from = before.minus({ days: ADR_LOOKBACK_DAYS + 10 });
  const dailyAlignment = assetClass === "fx" || assetClass === "crypto" ? 17 : 18;
  const dailyBars = await fetchOandaDailySeries(pair, from, before, dailyAlignment).catch(() => []);
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
    adrDistance: absRanges.reduce((sum, value) => sum + value, 0) / absRanges.length,
    adrPct: pctRanges.reduce((sum, value) => sum + value, 0) / pctRanges.length,
  };
}

async function loadSentimentRows() {
  const allAggs = await pool.query(
    `SELECT symbol, crowding_state, flip_state, timestamp_utc
     FROM sentiment_aggregates
     ORDER BY timestamp_utc ASC`,
  );

  const bySymbol: Record<string, SentimentRow[]> = {};
  for (const row of allAggs.rows) {
    const entry: SentimentRow = {
      symbol: row.symbol,
      crowding_state: row.crowding_state,
      flip_state: row.flip_state,
      ts: new Date(row.timestamp_utc).getTime(),
    };
    if (!bySymbol[entry.symbol]) bySymbol[entry.symbol] = [];
    bySymbol[entry.symbol]!.push(entry);
  }
  return bySymbol;
}

function resolveSentiment(bySymbol: Record<string, SentimentRow[]>, weekOpenMs: number) {
  const result: Record<string, SentimentRow> = {};
  for (const [symbol, rows] of Object.entries(bySymbol)) {
    let latestBefore: SentimentRow | null = null;
    let firstAfter: SentimentRow | null = null;
    for (const row of rows) {
      if (row.ts <= weekOpenMs) latestBefore = row;
      if (row.ts > weekOpenMs) {
        firstAfter = row;
        break;
      }
    }
    const pick = latestBefore ?? firstAfter;
    if (pick) result[symbol] = pick;
  }
  return result;
}

async function loadWeeks() {
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc
     FROM strategy_backtest_trades
     WHERE run_id = $1 AND week_open_utc < $2
     ORDER BY week_open_utc`,
    [RUN_ID, WEEK_CUTOFF],
  );
  return weeks.rows.map((row) => new Date(row.week_open_utc).toISOString());
}

async function loadV3Signals(): Promise<V3Signals> {
  const rows = await pool.query(
    `SELECT DISTINCT ON (week_open_utc, symbol) week_open_utc, symbol, direction
     FROM strategy_backtest_trades
     WHERE run_id = $1 AND week_open_utc < $2
     ORDER BY week_open_utc, symbol, entry_time_utc ASC`,
    [RUN_ID, WEEK_CUTOFF],
  );

  const signals: V3Signals = {};
  for (const row of rows.rows) {
    const weekIso = new Date(row.week_open_utc).toISOString();
    if (!signals[weekIso]) signals[weekIso] = {};
    signals[weekIso]![row.symbol] = row.direction;
  }
  return signals;
}

async function loadCotSnapshots() {
  const rows = await pool.query(
    `SELECT report_date::text, asset_class, currencies
     FROM cot_snapshots
     WHERE report_date >= '2026-01-20' AND report_date <= '2026-03-17'
     ORDER BY report_date`,
  );

  const cotByDate: CotByDate = {};
  for (const row of rows.rows) {
    if (!cotByDate[row.report_date]) cotByDate[row.report_date] = {};
    cotByDate[row.report_date]![row.asset_class] = row.currencies;
  }
  const reportDates = Object.keys(cotByDate).sort();

  function findCotForWeek(weekOpenMs: number) {
    for (const reportDate of reportDates) {
      const reportMs = new Date(`${reportDate}T00:00:00Z`).getTime();
      const diffDays = (reportMs - weekOpenMs) / (24 * 3600 * 1000);
      if (diffDays >= 0 && diffDays <= 4) return cotByDate[reportDate]!;
    }
    return null;
  }

  return { findCotForWeek };
}

async function main() {
  console.log("Loading canonical first-trade filter comparison...\n");

  const [weeks, v3Signals, sentimentBySymbol, cotLoader] = await Promise.all([
    loadWeeks(),
    loadV3Signals(),
    loadSentimentRows(),
    loadCotSnapshots(),
  ]);

  const strategies: Record<StrategyKey, Record<ModeKey, Accumulator>> = {
    v3: { multi: makeAcc(), first: makeAcc() },
    sentiment: { multi: makeAcc(), first: makeAcc() },
    dealer: { multi: makeAcc(), first: makeAcc() },
    commercial: { multi: makeAcc(), first: makeAcc() },
  };

  const weeklyRows: Array<{ label: string; result: WeekResult }> = [];

  for (const weekOpenUtc of weeks) {
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    const sentMap = resolveSentiment(sentimentBySymbol, weekOpenMs);
    const cotSnap = cotLoader.findCotForWeek(weekOpenMs);
    const v3Map = v3Signals[weekOpenUtc] ?? {};

    const weekAcc: Record<StrategyKey, Record<ModeKey, Accumulator>> = {
      v3: { multi: makeAcc(), first: makeAcc() },
      sentiment: { multi: makeAcc(), first: makeAcc() },
      dealer: { multi: makeAcc(), first: makeAcc() },
      commercial: { multi: makeAcc(), first: makeAcc() },
    };

    for (const { pair, ac } of ALL_PAIRS) {
      const weekWindow = getCanonicalWeekWindow(weekOpenUtc, ac);
      const adr = await computeAdr(pair, weekWindow.openUtc.toISO()!, ac);
      if (!adr) continue;

      const bars = await fetchOanda5MinuteSeries(pair, weekWindow.openUtc, weekWindow.closeUtc).catch(() => []);
      if (bars.length === 0) continue;

      const dirs: Partial<Record<StrategyKey, AdrTradeDirection | null>> = {
        v3: v3Map[pair] ?? null,
        sentiment: sentimentDirection(sentMap[pair] ?? null),
        dealer: cotDirection(pair, cotSnap, "dealer"),
        commercial: cotDirection(pair, cotSnap, "commercial"),
      };

      for (const strategy of Object.keys(dirs) as StrategyKey[]) {
        const dir = dirs[strategy];
        if (!dir) continue;

        const trades = scanAdrTrades({
          pair,
          assetClass: ac,
          direction: dir,
          weekOpenUtc,
          adrPct: adr.adrPct,
          adrAbsoluteDistance: adr.adrDistance,
          bars,
          closeAtWeekEnd: true,
        });

        if (trades.length === 0) continue;

        addTrades(weekAcc[strategy].multi, trades);
        addTrades(weekAcc[strategy].first, trades.slice(0, 1));
      }
    }

    const label = new Date(weekOpenMs + 24 * 3600 * 1000).toISOString().slice(5, 10);
    const result: WeekResult = {
      v3: { multi: weekAcc.v3.multi.net, first: weekAcc.v3.first.net },
      sentiment: { multi: weekAcc.sentiment.multi.net, first: weekAcc.sentiment.first.net },
      dealer: { multi: weekAcc.dealer.multi.net, first: weekAcc.dealer.first.net },
      commercial: { multi: weekAcc.commercial.multi.net, first: weekAcc.commercial.first.net },
    };
    weeklyRows.push({ label, result });

    for (const strategy of Object.keys(strategies) as StrategyKey[]) {
      for (const mode of ["multi", "first"] as ModeKey[]) {
        const src = weekAcc[strategy][mode];
        const dst = strategies[strategy][mode];
        dst.trades += src.trades;
        dst.tp += src.tp;
        dst.wc += src.wc;
        dst.net += src.net;
        dst.tpPnl += src.tpPnl;
        dst.wcPnl += src.wcPnl;
        dst.maeSum += src.maeSum;
        dst.maeCount += src.maeCount;
        dst.maxMae = Math.max(dst.maxMae, src.maxMae);
        dst.weekly.push(src.net);
      }
    }

    console.log(
      `${label}: V3 ${fmtPct(result.v3.multi)} -> ${fmtPct(result.v3.first)} | ` +
      `Sent ${fmtPct(result.sentiment.multi)} -> ${fmtPct(result.sentiment.first)} | ` +
      `Dealer ${fmtPct(result.dealer.multi)} -> ${fmtPct(result.dealer.first)} | ` +
      `Comm ${fmtPct(result.commercial.multi)} -> ${fmtPct(result.commercial.first)}`,
    );
  }

  console.log(`\n${"=".repeat(118)}`);
  console.log("ADR PULLBACK — MULTI ENTRY vs FIRST TRADE ONLY (9 weeks, canonical M5 scanner)");
  console.log("=".repeat(118));

  console.log("\nPer-week net return (multi -> first)\n");
  console.log("Week".padEnd(7), "V3".padEnd(22), "Sentiment".padEnd(22), "Dealer".padEnd(22), "Commercial".padEnd(22));
  console.log("-".repeat(97));
  for (const row of weeklyRows) {
    const fmtPair = (strategy: StrategyKey) => `${fmtPct(row.result[strategy].multi)} -> ${fmtPct(row.result[strategy].first)}`;
    console.log(
      row.label.padEnd(7),
      fmtPair("v3").padEnd(22),
      fmtPair("sentiment").padEnd(22),
      fmtPair("dealer").padEnd(22),
      fmtPair("commercial").padEnd(22),
    );
  }

  console.log("\nSummary\n");
  console.log(
    "Strategy".padEnd(14),
    "Mode".padEnd(10),
    "Net".padEnd(10),
    "Trades".padEnd(8),
    "TP".padEnd(6),
    "WC".padEnd(6),
    "WR".padEnd(8),
    "MaxDD".padEnd(10),
    "WorstWk".padEnd(10),
    "LoseWk".padEnd(8),
    "AvgMAE".padEnd(10),
    "MaxMAE".padEnd(10),
  );
  console.log("-".repeat(110));

  for (const strategy of ["v3", "sentiment", "dealer", "commercial"] as StrategyKey[]) {
    for (const mode of ["multi", "first"] as ModeKey[]) {
      const acc = strategies[strategy][mode];
      const curve = curveStats(acc.weekly);
      console.log(
        strategy.padEnd(14),
        mode.padEnd(10),
        fmtPct(acc.net).padEnd(10),
        String(acc.trades).padEnd(8),
        String(acc.tp).padEnd(6),
        String(acc.wc).padEnd(6),
        `${wr(acc).toFixed(1)}%`.padEnd(8),
        fmtPct(curve.maxDd).padEnd(10),
        fmtPct(curve.worstWeek).padEnd(10),
        String(curve.losingWeeks).padEnd(8),
        `${avgMae(acc).toFixed(2)}%`.padEnd(10),
        `${acc.maxMae.toFixed(2)}%`.padEnd(10),
      );
    }
    console.log("-".repeat(110));
  }

  console.log("\nFilter impact\n");
  console.log(
    "Strategy".padEnd(14),
    "Net Δ".padEnd(10),
    "Trades Δ".padEnd(10),
    "WR Δ".padEnd(10),
    "MaxDD Δ".padEnd(10),
    "WorstWk Δ".padEnd(12),
  );
  console.log("-".repeat(66));
  for (const strategy of ["v3", "sentiment", "dealer", "commercial"] as StrategyKey[]) {
    const multi = strategies[strategy].multi;
    const first = strategies[strategy].first;
    const multiCurve = curveStats(multi.weekly);
    const firstCurve = curveStats(first.weekly);
    console.log(
      strategy.padEnd(14),
      fmtPct(first.net - multi.net).padEnd(10),
      String(first.trades - multi.trades).padEnd(10),
      `${(wr(first) - wr(multi)).toFixed(1)}%`.padEnd(10),
      fmtPct(firstCurve.maxDd - multiCurve.maxDd).padEnd(10),
      fmtPct(firstCurve.worstWeek - multiCurve.worstWeek).padEnd(12),
    );
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
