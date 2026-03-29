/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/adr-backtest-weekstart-hybrid-sweep.ts
 *
 * Description:
 * Test a week-start entry overlay on the ADR pullback family using the
 * currently preferred trailing-only risk layer:
 *   - trail activates at +0.25 ADR
 *   - trail distance remains 0.25 ADR behind best excursion
 *
 * Compared entry structures:
 *   1. pullback multi-entry
 *   2. pullback first-trade-only
 *   3. week-start only
 *   4. week-start first trade + later ADR pullbacks
 *
 * Swept across:
 *   - dealer
 *   - commercial
 *   - sentiment
 *   - 2-of-3 agreement
 *   - 3-of-3 agreement
 *   - V3
 *
 * Usage:
 *   npx tsx scripts/adr-backtest-weekstart-hybrid-sweep.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { Pool } from "pg";

import { getCanonicalWeekWindow } from "../src/lib/canonicalPriceWindows";
import type { AdrTradeDirection, H1Bar } from "../src/lib/flagship/adrTradeScanner";
import { fetchOanda5MinuteSeries, fetchOandaDailySeries } from "../src/lib/oandaPrices";

loadEnvConfig(process.cwd());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const RUN_ID = 54;
const TRAIL_ACTIVATION_MULTIPLE = 0.25;
const TRAIL_DISTANCE_MULTIPLE = 0.25;

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
type StrategyKey = "dealer" | "commercial" | "sentiment" | "agree2" | "agree3" | "v3";
type ModeKey = "pullbackMulti" | "pullbackFirst" | "weekStartOnly" | "weekStartHybrid";

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
  wins: number;
  losses: number;
  net: number;
  grossProfit: number;
  grossLoss: number;
  weekly: number[];
};

type WeekResult = Record<StrategyKey, Record<ModeKey, number>>;

function makeAcc(): Accumulator {
  return {
    trades: 0,
    wins: 0,
    losses: 0,
    net: 0,
    grossProfit: 0,
    grossLoss: 0,
    weekly: [],
  };
}

function fmtPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function winRate(acc: Accumulator) {
  return acc.trades > 0 ? (acc.wins / acc.trades) * 100 : 0;
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

  return { maxDd, worstWeek, losingWeeks, finalEquity: equity };
}

function addTrades(acc: Accumulator, trades: Array<{ returnPct: number }>) {
  let net = 0;
  for (const trade of trades) {
    acc.trades += 1;
    acc.net += trade.returnPct;
    net += trade.returnPct;
    if (trade.returnPct > 0) {
      acc.wins += 1;
      acc.grossProfit += trade.returnPct;
    } else {
      acc.losses += 1;
      acc.grossLoss += trade.returnPct;
    }
  }
  return net;
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

function agree2of3(d1: AdrTradeDirection | null, d2: AdrTradeDirection | null, d3: AdrTradeDirection | null): AdrTradeDirection | null {
  const votes = [d1, d2, d3].filter(Boolean);
  if (votes.length < 2) return null;
  const longs = votes.filter((v) => v === "LONG").length;
  const shorts = votes.filter((v) => v === "SHORT").length;
  if (longs >= 2) return "LONG";
  if (shorts >= 2) return "SHORT";
  return null;
}

function agree3of3(d1: AdrTradeDirection | null, d2: AdrTradeDirection | null, d3: AdrTradeDirection | null): AdrTradeDirection | null {
  if (!d1 || !d2 || !d3) return null;
  if (d1 === d2 && d2 === d3) return d1;
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
     WHERE run_id = $1
     ORDER BY week_open_utc`,
    [RUN_ID],
  );
  return weeks.rows.map((row) => new Date(row.week_open_utc).toISOString());
}

async function loadV3Signals(): Promise<V3Signals> {
  const rows = await pool.query(
    `SELECT DISTINCT ON (week_open_utc, symbol) week_open_utc, symbol, direction
     FROM strategy_backtest_trades
     WHERE run_id = $1
     ORDER BY week_open_utc, symbol, entry_time_utc ASC`,
    [RUN_ID],
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

function scanTrailingEntries(input: {
  direction: AdrTradeDirection;
  adrPct: number;
  adrDistance: number;
  bars: H1Bar[];
  firstEntryMode: "pullback" | "week_start" | "hybrid";
}): Array<{ returnPct: number }> {
  const { direction, adrPct, adrDistance, bars, firstEntryMode } = input;
  if (bars.length === 0) return [];

  const activationDistance = adrDistance * TRAIL_ACTIVATION_MULTIPLE;
  const trailDistance = adrDistance * TRAIL_DISTANCE_MULTIPLE;

  const out: Array<{ returnPct: number }> = [];

  let anchor: number | null = null;
  let inTrade = false;
  let entryPrice = 0;
  let bestPrice = 0;
  let trailArmed = false;
  let tradeNumber = 0;
  let enteredThisBar = false;

  const enterTrade = (price: number) => {
    inTrade = true;
    entryPrice = price;
    trailArmed = false;
    bestPrice = price;
    enteredThisBar = true;
    tradeNumber += 1;
  };

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]!;
    enteredThisBar = false;

    if (!inTrade && i === 0 && (firstEntryMode === "week_start" || firstEntryMode === "hybrid")) {
      enterTrade(bar.open);
      continue;
    }

    if (inTrade) {
      if (!enteredThisBar && trailArmed) {
        const stopPrice =
          direction === "LONG"
            ? bestPrice - trailDistance
            : bestPrice + trailDistance;
        const stopHit =
          direction === "LONG"
            ? bar.low <= stopPrice
            : bar.high >= stopPrice;

        if (stopHit) {
          const lockedAdr =
            direction === "LONG"
              ? (stopPrice - entryPrice) / adrDistance
              : (entryPrice - stopPrice) / adrDistance;
          out.push({ returnPct: lockedAdr * adrPct });
          inTrade = false;
          trailArmed = false;
          anchor = direction === "LONG" ? bar.high : bar.low;
          continue;
        }
      }

      if (!enteredThisBar) {
        const favorableExtreme =
          direction === "LONG"
            ? Math.max(bestPrice, bar.high)
            : Math.min(bestPrice, bar.low);

        if (!trailArmed) {
          const activationHit =
            direction === "LONG"
              ? favorableExtreme >= entryPrice + activationDistance
              : favorableExtreme <= entryPrice - activationDistance;
          if (activationHit) trailArmed = true;
        }

        bestPrice = favorableExtreme;
      }
      continue;
    }

    if (anchor === null) {
      anchor = direction === "LONG" ? bar.high : bar.low;
      continue;
    }

    if (firstEntryMode === "week_start" && tradeNumber >= 1) {
      continue;
    }

    const prevAnchor = anchor;
    anchor =
      direction === "LONG"
        ? Math.max(anchor, bar.high)
        : Math.min(anchor, bar.low);

    const ep =
      direction === "LONG"
        ? prevAnchor - adrDistance
        : prevAnchor + adrDistance;
    const triggerHit =
      direction === "LONG"
        ? bar.low <= ep
        : bar.high >= ep;

    if (triggerHit) {
      enterTrade(ep);
    }
  }

  if (inTrade) {
    const lastBar = bars[bars.length - 1]!;
    const returnPct =
      direction === "LONG"
        ? ((lastBar.close - entryPrice) / entryPrice) * 100
        : ((entryPrice - lastBar.close) / entryPrice) * 100;
    out.push({ returnPct });
  }

  return out;
}

async function main() {
  console.log("Loading week-start hybrid sweep...\n");

  const [weeks, v3Signals, sentimentBySymbol, cotLoader] = await Promise.all([
    loadWeeks(),
    loadV3Signals(),
    loadSentimentRows(),
    loadCotSnapshots(),
  ]);

  const strategies: Record<StrategyKey, Record<ModeKey, Accumulator>> = {
    dealer: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
    commercial: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
    sentiment: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
    agree2: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
    agree3: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
    v3: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
  };

  const weeklyRows: Array<{ label: string; result: WeekResult }> = [];
  const adrCache = new Map<string, { adrDistance: number; adrPct: number } | null>();
  const barsCache = new Map<string, H1Bar[]>();

  for (const weekOpenUtc of weeks) {
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    const sentMap = resolveSentiment(sentimentBySymbol, weekOpenMs);
    const cotSnap = cotLoader.findCotForWeek(weekOpenMs);
    const v3Map = v3Signals[weekOpenUtc] ?? {};

    const weekAcc: Record<StrategyKey, Record<ModeKey, Accumulator>> = {
      dealer: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
      commercial: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
      sentiment: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
      agree2: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
      agree3: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
      v3: { pullbackMulti: makeAcc(), pullbackFirst: makeAcc(), weekStartOnly: makeAcc(), weekStartHybrid: makeAcc() },
    };

    for (const { pair, ac } of ALL_PAIRS) {
      const weekWindow = getCanonicalWeekWindow(weekOpenUtc, ac);
      const cacheKey = `${weekOpenUtc}|${pair}|${ac}`;

      let adr = adrCache.get(cacheKey);
      if (adr === undefined) {
        adr = await computeAdr(pair, weekWindow.openUtc.toISO()!, ac);
        adrCache.set(cacheKey, adr);
      }
      if (!adr) continue;

      let bars = barsCache.get(cacheKey);
      if (!bars) {
        bars = await fetchOanda5MinuteSeries(pair, weekWindow.openUtc, weekWindow.closeUtc).catch(() => []);
        barsCache.set(cacheKey, bars);
      }
      if (bars.length === 0) continue;

      const dealerDir = cotSnap ? cotDirection(pair, cotSnap, "dealer") : null;
      const commercialDir = cotSnap ? cotDirection(pair, cotSnap, "commercial") : null;
      const sentimentDir = sentimentDirection(sentMap[pair] ?? null);
      const agree2Dir = agree2of3(dealerDir, commercialDir, sentimentDir);
      const agree3Dir = agree3of3(dealerDir, commercialDir, sentimentDir);
      const v3Dir = v3Map[pair] ?? null;

      const dirs: Record<StrategyKey, AdrTradeDirection | null> = {
        dealer: dealerDir,
        commercial: commercialDir,
        sentiment: sentimentDir,
        agree2: agree2Dir,
        agree3: agree3Dir,
        v3: v3Dir,
      };

      if (!Object.values(dirs).some(Boolean)) continue;

      for (const strategy of Object.keys(dirs) as StrategyKey[]) {
        const dir = dirs[strategy];
        if (!dir) continue;

        const pullbackTrades = scanTrailingEntries({
          direction: dir,
          adrPct: adr.adrPct,
          adrDistance: adr.adrDistance,
          bars,
          firstEntryMode: "pullback",
        });
        const weekStartOnlyTrades = scanTrailingEntries({
          direction: dir,
          adrPct: adr.adrPct,
          adrDistance: adr.adrDistance,
          bars,
          firstEntryMode: "week_start",
        });
        const hybridTrades = scanTrailingEntries({
          direction: dir,
          adrPct: adr.adrPct,
          adrDistance: adr.adrDistance,
          bars,
          firstEntryMode: "hybrid",
        });

        addTrades(weekAcc[strategy].pullbackMulti, pullbackTrades);
        addTrades(weekAcc[strategy].pullbackFirst, pullbackTrades.slice(0, 1));
        addTrades(weekAcc[strategy].weekStartOnly, weekStartOnlyTrades);
        addTrades(weekAcc[strategy].weekStartHybrid, hybridTrades);
      }
    }

    const label = new Date(weekOpenMs + 24 * 3600 * 1000).toISOString().slice(5, 10);
    const result: WeekResult = {
      dealer: { pullbackMulti: 0, pullbackFirst: 0, weekStartOnly: 0, weekStartHybrid: 0 },
      commercial: { pullbackMulti: 0, pullbackFirst: 0, weekStartOnly: 0, weekStartHybrid: 0 },
      sentiment: { pullbackMulti: 0, pullbackFirst: 0, weekStartOnly: 0, weekStartHybrid: 0 },
      agree2: { pullbackMulti: 0, pullbackFirst: 0, weekStartOnly: 0, weekStartHybrid: 0 },
      agree3: { pullbackMulti: 0, pullbackFirst: 0, weekStartOnly: 0, weekStartHybrid: 0 },
      v3: { pullbackMulti: 0, pullbackFirst: 0, weekStartOnly: 0, weekStartHybrid: 0 },
    };

    for (const strategy of Object.keys(strategies) as StrategyKey[]) {
      for (const mode of ["pullbackMulti", "pullbackFirst", "weekStartOnly", "weekStartHybrid"] as ModeKey[]) {
        const src = weekAcc[strategy][mode];
        const dst = strategies[strategy][mode];
        dst.trades += src.trades;
        dst.wins += src.wins;
        dst.losses += src.losses;
        dst.net += src.net;
        dst.grossProfit += src.grossProfit;
        dst.grossLoss += src.grossLoss;
        dst.weekly.push(src.net);
        result[strategy][mode] = src.net;
      }
    }

    weeklyRows.push({ label, result });

    console.log(
      `${label}: Dealer ${fmtPct(result.dealer.pullbackMulti)} / ${fmtPct(result.dealer.weekStartHybrid)} | ` +
      `Comm ${fmtPct(result.commercial.pullbackMulti)} / ${fmtPct(result.commercial.weekStartHybrid)} | ` +
      `Sent ${fmtPct(result.sentiment.pullbackMulti)} / ${fmtPct(result.sentiment.weekStartHybrid)} | ` +
      `2of3 ${fmtPct(result.agree2.pullbackMulti)} / ${fmtPct(result.agree2.weekStartHybrid)} | ` +
      `3of3 ${fmtPct(result.agree3.pullbackMulti)} / ${fmtPct(result.agree3.weekStartHybrid)} | ` +
      `V3 ${fmtPct(result.v3.pullbackMulti)} / ${fmtPct(result.v3.weekStartHybrid)}`,
    );
  }

  console.log(`\n${"=".repeat(150)}`);
  console.log("ADR WEEK-START HYBRID SWEEP — TRAILING RISK LAYER");
  console.log("=".repeat(150));

  console.log("\nSummary\n");
  console.log(
    "Strategy".padEnd(12),
    "Mode".padEnd(16),
    "Net".padEnd(10),
    "Trades".padEnd(8),
    "WR".padEnd(8),
    "Gross+".padEnd(10),
    "Gross-".padEnd(10),
    "MaxDD".padEnd(10),
    "WorstWk".padEnd(10),
    "LoseWk".padEnd(8),
  );
  console.log("-".repeat(108));

  for (const strategy of ["dealer", "commercial", "sentiment", "agree2", "agree3", "v3"] as StrategyKey[]) {
    for (const mode of ["pullbackMulti", "pullbackFirst", "weekStartOnly", "weekStartHybrid"] as ModeKey[]) {
      const acc = strategies[strategy][mode];
      const curve = curveStats(acc.weekly);
      console.log(
        strategy.padEnd(12),
        mode.padEnd(16),
        fmtPct(acc.net).padEnd(10),
        String(acc.trades).padEnd(8),
        `${winRate(acc).toFixed(1)}%`.padEnd(8),
        fmtPct(acc.grossProfit).padEnd(10),
        fmtPct(acc.grossLoss).padEnd(10),
        fmtPct(curve.maxDd).padEnd(10),
        fmtPct(curve.worstWeek).padEnd(10),
        String(curve.losingWeeks).padEnd(8),
      );
    }
    console.log("-".repeat(108));
  }

  console.log("\nHybrid impact vs pullback multi\n");
  console.log(
    "Strategy".padEnd(12),
    "Net Δ".padEnd(10),
    "Trades Δ".padEnd(10),
    "WR Δ".padEnd(10),
    "MaxDD Δ".padEnd(10),
    "WorstWk Δ".padEnd(12),
  );
  console.log("-".repeat(72));

  for (const strategy of ["dealer", "commercial", "sentiment", "agree2", "agree3", "v3"] as StrategyKey[]) {
    const base = strategies[strategy].pullbackMulti;
    const hybrid = strategies[strategy].weekStartHybrid;
    const baseCurve = curveStats(base.weekly);
    const hybridCurve = curveStats(hybrid.weekly);
    console.log(
      strategy.padEnd(12),
      fmtPct(hybrid.net - base.net).padEnd(10),
      String(hybrid.trades - base.trades).padEnd(10),
      `${(winRate(hybrid) - winRate(base)).toFixed(1)}%`.padEnd(10),
      fmtPct(hybridCurve.maxDd - baseCurve.maxDd).padEnd(10),
      fmtPct(hybridCurve.worstWeek - baseCurve.worstWeek).padEnd(12),
    );
  }

  console.log("\nBest week-start hybrid variants by max drawdown\n");
  const ranked = (["dealer", "commercial", "sentiment", "agree2", "agree3", "v3"] as StrategyKey[])
    .map((strategy) => ({
      strategy,
      acc: strategies[strategy].weekStartHybrid,
      curve: curveStats(strategies[strategy].weekStartHybrid.weekly),
    }))
    .sort((a, b) => {
      if (a.curve.maxDd !== b.curve.maxDd) return b.curve.maxDd - a.curve.maxDd;
      return b.acc.net - a.acc.net;
    });

  for (const item of ranked) {
    console.log(
      `${item.strategy}/weekStartHybrid`.padEnd(28),
      `Net ${fmtPct(item.acc.net)}`.padEnd(18),
      `MaxDD ${fmtPct(item.curve.maxDd)}`.padEnd(18),
      `Worst ${fmtPct(item.curve.worstWeek)}`.padEnd(18),
    );
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
