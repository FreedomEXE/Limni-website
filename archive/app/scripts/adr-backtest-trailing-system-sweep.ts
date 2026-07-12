/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/adr-backtest-trailing-system-sweep.ts
 *
 * Description:
 * Sweep the trailing-only risk layer across the core ADR system family:
 *   - dealer
 *   - commercial
 *   - sentiment
 *   - 2-of-3 agreement
 *   - 3-of-3 agreement
 *   - V3
 *
 * Compared modes per system:
 *   - fixed TP, multi-entry
 *   - fixed TP, first-trade-only
 *   - trailing, multi-entry
 *   - trailing, first-trade-only
 *
 * Trailing rule:
 *   - trail activates at +0.25 ADR
 *   - trail distance remains 0.25 ADR behind best excursion
 *   - no hard stop loss in this sweep
 *
 * Usage:
 *   npx tsx scripts/adr-backtest-trailing-system-sweep.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { Pool } from "pg";

import { getCanonicalWeekWindow } from "../src/lib/canonicalPriceWindows";
import {
  scanAdrTrades,
  type AdrTradeDirection,
  type H1Bar,
} from "../src/lib/flagship/adrTradeScanner";
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
type ModeKey = "fixedMulti" | "fixedFirst" | "trailMulti" | "trailFirst";

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

function scanAdrTrailingTrades(input: {
  direction: AdrTradeDirection;
  adrPct: number;
  adrDistance: number;
  bars: H1Bar[];
  entryMultiple?: number;
  activationMultiple?: number;
  trailDistanceMultiple?: number;
}): Array<{ returnPct: number }> {
  const {
    direction,
    adrPct,
    adrDistance,
    bars,
    entryMultiple = 1.0,
    activationMultiple = TRAIL_ACTIVATION_MULTIPLE,
    trailDistanceMultiple = TRAIL_DISTANCE_MULTIPLE,
  } = input;

  if (bars.length === 0) return [];

  const entryDistance = adrDistance * entryMultiple;
  const activationDistance = adrDistance * activationMultiple;
  const trailDistance = adrDistance * trailDistanceMultiple;

  const out: Array<{ returnPct: number }> = [];

  let anchor: number | null = null;
  let inTrade = false;
  let entryPrice = 0;
  let bestPrice = 0;
  let trailArmed = false;

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]!;

    if (inTrade) {
      if (trailArmed) {
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
      continue;
    }

    if (anchor === null) {
      anchor = direction === "LONG" ? bar.high : bar.low;
      continue;
    }

    const prevAnchor = anchor;
    anchor =
      direction === "LONG"
        ? Math.max(anchor, bar.high)
        : Math.min(anchor, bar.low);

    const ep =
      direction === "LONG"
        ? prevAnchor - entryDistance
        : prevAnchor + entryDistance;
    const triggerHit =
      direction === "LONG"
        ? bar.low <= ep
        : bar.high >= ep;

    if (triggerHit) {
      inTrade = true;
      entryPrice = ep;
      trailArmed = false;
      bestPrice =
        direction === "LONG"
          ? Math.max(ep, bar.high)
          : Math.min(ep, bar.low);
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
  console.log("Loading trailing-only system sweep...\n");

  const [weeks, v3Signals, sentimentBySymbol, cotLoader] = await Promise.all([
    loadWeeks(),
    loadV3Signals(),
    loadSentimentRows(),
    loadCotSnapshots(),
  ]);

  const strategies: Record<StrategyKey, Record<ModeKey, Accumulator>> = {
    dealer: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
    commercial: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
    sentiment: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
    agree2: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
    agree3: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
    v3: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
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
      dealer: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
      commercial: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
      sentiment: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
      agree2: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
      agree3: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
      v3: { fixedMulti: makeAcc(), fixedFirst: makeAcc(), trailMulti: makeAcc(), trailFirst: makeAcc() },
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

        const fixedTrades = scanAdrTrades({
          pair,
          assetClass: ac,
          direction: dir,
          weekOpenUtc,
          adrPct: adr.adrPct,
          adrAbsoluteDistance: adr.adrDistance,
          bars,
          closeAtWeekEnd: true,
        }).map((trade) => ({ returnPct: trade.returnPct ?? 0 }));

        const trailTrades = scanAdrTrailingTrades({
          direction: dir,
          adrPct: adr.adrPct,
          adrDistance: adr.adrDistance,
          bars,
        });

        const fixedMultiNet = addTrades(weekAcc[strategy].fixedMulti, fixedTrades);
        const fixedFirstNet = addTrades(weekAcc[strategy].fixedFirst, fixedTrades.slice(0, 1));
        const trailMultiNet = addTrades(weekAcc[strategy].trailMulti, trailTrades);
        const trailFirstNet = addTrades(weekAcc[strategy].trailFirst, trailTrades.slice(0, 1));

        weekAcc[strategy].fixedMulti.net += 0 * fixedMultiNet;
        weekAcc[strategy].fixedFirst.net += 0 * fixedFirstNet;
        weekAcc[strategy].trailMulti.net += 0 * trailMultiNet;
        weekAcc[strategy].trailFirst.net += 0 * trailFirstNet;
      }
    }

    const label = new Date(weekOpenMs + 24 * 3600 * 1000).toISOString().slice(5, 10);
    const result: WeekResult = {
      dealer: { fixedMulti: 0, fixedFirst: 0, trailMulti: 0, trailFirst: 0 },
      commercial: { fixedMulti: 0, fixedFirst: 0, trailMulti: 0, trailFirst: 0 },
      sentiment: { fixedMulti: 0, fixedFirst: 0, trailMulti: 0, trailFirst: 0 },
      agree2: { fixedMulti: 0, fixedFirst: 0, trailMulti: 0, trailFirst: 0 },
      agree3: { fixedMulti: 0, fixedFirst: 0, trailMulti: 0, trailFirst: 0 },
      v3: { fixedMulti: 0, fixedFirst: 0, trailMulti: 0, trailFirst: 0 },
    };

    for (const strategy of Object.keys(strategies) as StrategyKey[]) {
      for (const mode of ["fixedMulti", "fixedFirst", "trailMulti", "trailFirst"] as ModeKey[]) {
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
      `${label}: Dealer ${fmtPct(result.dealer.fixedMulti)}→${fmtPct(result.dealer.trailMulti)} | ` +
      `Comm ${fmtPct(result.commercial.fixedMulti)}→${fmtPct(result.commercial.trailMulti)} | ` +
      `Sent ${fmtPct(result.sentiment.fixedMulti)}→${fmtPct(result.sentiment.trailMulti)} | ` +
      `2of3 ${fmtPct(result.agree2.fixedMulti)}→${fmtPct(result.agree2.trailMulti)} | ` +
      `3of3 ${fmtPct(result.agree3.fixedMulti)}→${fmtPct(result.agree3.trailMulti)} | ` +
      `V3 ${fmtPct(result.v3.fixedMulti)}→${fmtPct(result.v3.trailMulti)}`,
    );
  }

  console.log(`\n${"=".repeat(146)}`);
  console.log("ADR SYSTEM SWEEP — FIXED vs TRAILING (0.25 activate / 0.25 distance)");
  console.log("=".repeat(146));

  console.log("\nSummary\n");
  console.log(
    "Strategy".padEnd(12),
    "Mode".padEnd(12),
    "Net".padEnd(10),
    "Trades".padEnd(8),
    "WR".padEnd(8),
    "Gross+".padEnd(10),
    "Gross-".padEnd(10),
    "MaxDD".padEnd(10),
    "WorstWk".padEnd(10),
    "LoseWk".padEnd(8),
  );
  console.log("-".repeat(104));

  for (const strategy of ["dealer", "commercial", "sentiment", "agree2", "agree3", "v3"] as StrategyKey[]) {
    for (const mode of ["fixedMulti", "fixedFirst", "trailMulti", "trailFirst"] as ModeKey[]) {
      const acc = strategies[strategy][mode];
      const curve = curveStats(acc.weekly);
      console.log(
        strategy.padEnd(12),
        mode.padEnd(12),
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
    console.log("-".repeat(104));
  }

  console.log("\nTrailing impact vs fixed\n");
  console.log(
    "Strategy".padEnd(12),
    "Multi Net Δ".padEnd(12),
    "Multi DD Δ".padEnd(12),
    "First Net Δ".padEnd(12),
    "First DD Δ".padEnd(12),
  );
  console.log("-".repeat(62));

  for (const strategy of ["dealer", "commercial", "sentiment", "agree2", "agree3", "v3"] as StrategyKey[]) {
    const fixedMulti = strategies[strategy].fixedMulti;
    const trailMulti = strategies[strategy].trailMulti;
    const fixedFirst = strategies[strategy].fixedFirst;
    const trailFirst = strategies[strategy].trailFirst;
    const fixedMultiCurve = curveStats(fixedMulti.weekly);
    const trailMultiCurve = curveStats(trailMulti.weekly);
    const fixedFirstCurve = curveStats(fixedFirst.weekly);
    const trailFirstCurve = curveStats(trailFirst.weekly);
    console.log(
      strategy.padEnd(12),
      fmtPct(trailMulti.net - fixedMulti.net).padEnd(12),
      fmtPct(trailMultiCurve.maxDd - fixedMultiCurve.maxDd).padEnd(12),
      fmtPct(trailFirst.net - fixedFirst.net).padEnd(12),
      fmtPct(trailFirstCurve.maxDd - fixedFirstCurve.maxDd).padEnd(12),
    );
  }

  console.log("\nBest trailing variants by max drawdown\n");
  const candidates = (["dealer", "commercial", "sentiment", "agree2", "agree3", "v3"] as StrategyKey[]).flatMap((strategy) => ([
    { strategy, mode: "trailMulti" as const, acc: strategies[strategy].trailMulti },
    { strategy, mode: "trailFirst" as const, acc: strategies[strategy].trailFirst },
  ]));

  const ranked = candidates
    .map((item) => ({
      ...item,
      curve: curveStats(item.acc.weekly),
    }))
    .sort((a, b) => {
      if (a.curve.maxDd !== b.curve.maxDd) return b.curve.maxDd - a.curve.maxDd;
      return b.acc.net - a.acc.net;
    });

  for (const item of ranked) {
    console.log(
      `${item.strategy}/${item.mode}`.padEnd(24),
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
