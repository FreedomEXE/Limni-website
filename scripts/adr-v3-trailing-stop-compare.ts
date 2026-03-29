/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/adr-v3-trailing-stop-compare.ts
 *
 * Description:
 * Compare V3 ADR pullback in four variants over the completed persisted weeks:
 *   1. Fixed TP, multi-entry
 *   2. Fixed TP, first-trade-only
 *   3. Trailing stop, multi-entry
 *   4. Trailing stop, first-trade-only
 *
 * Trailing rule:
 *   - entry logic unchanged
 *   - trail activates after +0.25 ADR excursion
 *   - once active, stop trails 0.25 ADR behind the best excursion
 *   - no same-bar activation/stop or stop-tighten/stop-hit assumptions
 *
 * Usage:
 *   npx tsx scripts/adr-v3-trailing-stop-compare.ts
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
  type AdrTradeResult,
  type H1Bar,
} from "../src/lib/flagship/adrTradeScanner";
import { fetchOanda5MinuteSeries, fetchOandaDailySeries } from "../src/lib/oandaPrices";

loadEnvConfig(process.cwd());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const RUN_ID = 54;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const TRAIL_ACTIVATION_MULTIPLE = 0.25;
const TRAIL_DISTANCE_MULTIPLE = 0.25;
const FIXED_TP_MULTIPLE = 0.25;

type AssetClass = "fx" | "indices" | "commodities" | "crypto";
type VariantKey = "siteMultiFixed" | "siteFirstFixed" | "recalcMultiFixed" | "recalcFirstFixed" | "trailMulti" | "trailFirst";

type V3Signal = {
  pair: string;
  direction: AdrTradeDirection;
  assetClass: AssetClass;
};

type WeeklyTradeRow = {
  week_open_utc: string | Date;
  symbol: string;
  direction: AdrTradeDirection;
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

type VariantStats = {
  trades: number;
  wins: number;
  losses: number;
  grossProfit: number;
  grossLoss: number;
  net: number;
  weekly: number[];
};

type TrailTradeResult = {
  pair: string;
  assetClass: string;
  direction: AdrTradeDirection;
  weekOpenUtc: string;
  tradeNumber: number;
  entryPrice: number;
  exitPrice: number;
  entryUtc: string;
  exitUtc: string;
  exitType: "TRAIL_HIT" | "WEEK_CLOSE";
  anchorPrice: number;
  adrPct: number;
  adrDistance: number;
  returnPct: number;
  maePct: number;
};

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function makeStats(): VariantStats {
  return {
    trades: 0,
    wins: 0,
    losses: 0,
    grossProfit: 0,
    grossLoss: 0,
    net: 0,
    weekly: [],
  };
}

function fmtPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function winRate(stats: VariantStats) {
  return stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
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

function addTrades(stats: VariantStats, trades: Array<{ returnPct: number; exitType: string }>) {
  let net = 0;
  for (const trade of trades) {
    stats.trades += 1;
    net += trade.returnPct;
    stats.net += trade.returnPct;
    if (trade.returnPct > 0) {
      stats.wins += 1;
      stats.grossProfit += trade.returnPct;
    } else {
      stats.losses += 1;
      stats.grossLoss += trade.returnPct;
    }
  }
  return net;
}

async function loadCompletedWeeks() {
  const rows = await pool.query(
    `SELECT DISTINCT week_open_utc
     FROM strategy_backtest_trades
     WHERE run_id = $1
     ORDER BY week_open_utc ASC`,
    [RUN_ID],
  );
  return rows.rows.map((row) => new Date(row.week_open_utc).toISOString());
}

async function loadV3Signals() {
  const rows = await pool.query(
    `SELECT DISTINCT ON (week_open_utc, symbol)
        week_open_utc,
        symbol,
        direction,
        COALESCE(metadata->>'assetClass', 'fx') AS asset_class
     FROM strategy_backtest_trades
     WHERE run_id = $1
     ORDER BY week_open_utc, symbol, entry_time_utc ASC`,
    [RUN_ID],
  );

  const out: Record<string, V3Signal[]> = {};
  for (const row of rows.rows) {
    const weekIso = new Date(row.week_open_utc).toISOString();
    const bucket = out[weekIso] ?? [];
    bucket.push({
      pair: row.symbol,
      direction: row.direction,
      assetClass: row.asset_class,
    });
    out[weekIso] = bucket;
  }
  return out;
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

  if (absRanges.length < ADR_MIN_REQUIRED_DAYS || pctRanges.length < ADR_MIN_REQUIRED_DAYS) {
    return null;
  }

  return {
    adrDistance: absRanges.reduce((sum, value) => sum + value, 0) / absRanges.length,
    adrPct: pctRanges.reduce((sum, value) => sum + value, 0) / pctRanges.length,
  };
}

function scanAdrTrailingTrades(input: {
  pair: string;
  assetClass: AssetClass;
  direction: AdrTradeDirection;
  weekOpenUtc: string;
  adrPct: number;
  adrAbsoluteDistance: number;
  bars: H1Bar[];
  entryMultiple?: number;
  activationMultiple?: number;
  trailDistanceMultiple?: number;
  closeAtWeekEnd?: boolean;
}): TrailTradeResult[] {
  const {
    pair,
    assetClass,
    direction,
    weekOpenUtc,
    adrPct,
    adrAbsoluteDistance,
    bars,
    entryMultiple = 1.0,
    activationMultiple = TRAIL_ACTIVATION_MULTIPLE,
    trailDistanceMultiple = TRAIL_DISTANCE_MULTIPLE,
    closeAtWeekEnd = true,
  } = input;

  if (bars.length === 0) return [];

  const rawAdr = adrAbsoluteDistance;
  const entryDistance = rawAdr * entryMultiple;
  const activationDistance = rawAdr * activationMultiple;
  const trailDistance = rawAdr * trailDistanceMultiple;

  const results: TrailTradeResult[] = [];

  let anchor: number | null = null;
  let inTrade = false;
  let tradeNumber = 0;

  let entryPrice = 0;
  let entryTs = 0;
  let currentAnchor = 0;
  let maePrice = 0;
  let bestPrice = 0;
  let trailArmed = false;

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]!;

    if (inTrade) {
      maePrice =
        direction === "LONG"
          ? Math.min(maePrice, bar.low)
          : Math.max(maePrice, bar.high);

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
              ? (stopPrice - entryPrice) / rawAdr
              : (entryPrice - stopPrice) / rawAdr;
          results.push({
            pair,
            assetClass,
            direction,
            weekOpenUtc,
            tradeNumber,
            entryPrice,
            exitPrice: stopPrice,
            entryUtc: new Date(entryTs).toISOString(),
            exitUtc: new Date(bar.ts).toISOString(),
            exitType: "TRAIL_HIT",
            anchorPrice: currentAnchor,
            adrPct,
            adrDistance: rawAdr,
            returnPct: lockedAdr * adrPct,
            maePct: Math.abs(maePrice - entryPrice) / entryPrice * 100,
          });
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
        if (activationHit) {
          trailArmed = true;
        }
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
      tradeNumber += 1;
      inTrade = true;
      entryPrice = ep;
      entryTs = bar.ts;
      currentAnchor = anchor;
      trailArmed = false;
      bestPrice =
        direction === "LONG"
          ? Math.max(ep, bar.high)
          : Math.min(ep, bar.low);
      maePrice =
        direction === "LONG"
          ? Math.min(ep, bar.low)
          : Math.max(ep, bar.high);
    }
  }

  if (inTrade && closeAtWeekEnd) {
    const lastBar = bars[bars.length - 1]!;
    const weekCloseReturn =
      direction === "LONG"
        ? ((lastBar.close - entryPrice) / entryPrice) * 100
        : ((entryPrice - lastBar.close) / entryPrice) * 100;

    results.push({
      pair,
      assetClass,
      direction,
      weekOpenUtc,
      tradeNumber,
      entryPrice,
      exitPrice: lastBar.close,
      entryUtc: new Date(entryTs).toISOString(),
      exitUtc: new Date(lastBar.ts).toISOString(),
      exitType: "WEEK_CLOSE",
      anchorPrice: currentAnchor,
      adrPct,
      adrDistance: rawAdr,
      returnPct: weekCloseReturn,
      maePct: Math.abs(maePrice - entryPrice) / entryPrice * 100,
    });
  }

  return results;
}

async function loadStoredFixedBaseline(weeks: readonly string[]) {
  const tradeRows = await pool.query<WeeklyTradeRow>(
    `SELECT week_open_utc, symbol, direction, entry_price, pnl_pct, exit_reason, metadata
     FROM strategy_backtest_trades
     WHERE run_id = $1
     ORDER BY week_open_utc ASC, entry_time_utc ASC`,
    [RUN_ID],
  );

  const closeRows = await pool.query<PriceRow>(
    `SELECT period_open_utc, symbol, close_price
     FROM pair_period_returns
     WHERE period_type = 'weekly'`,
  );

  const closeByWeekSymbol = new Map<string, number>();
  for (const row of closeRows.rows) {
    closeByWeekSymbol.set(`${toIso(row.period_open_utc)}|${row.symbol.toUpperCase()}`, toNumber(row.close_price));
  }

  const byWeek = new Map<string, WeeklyTradeRow[]>();
  for (const row of tradeRows.rows) {
    const weekIso = toIso(row.week_open_utc);
    const bucket = byWeek.get(weekIso) ?? [];
    bucket.push(row);
    byWeek.set(weekIso, bucket);
  }

  const multi = makeStats();
  const first = makeStats();

  for (const weekIso of weeks) {
    const rows = byWeek.get(weekIso) ?? [];
    const adjusted = rows.map((row) => {
      if (row.exit_reason !== "active") {
        return { returnPct: toNumber(row.pnl_pct), exitType: row.exit_reason ?? "" };
      }
      const entryPrice = toNumber(row.entry_price);
      const weekClosePrice = closeByWeekSymbol.get(`${weekIso}|${row.symbol.toUpperCase()}`) ?? 0;
      if (entryPrice <= 0 || weekClosePrice <= 0) {
        return { returnPct: toNumber(row.pnl_pct), exitType: row.exit_reason ?? "" };
      }
      const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
      return {
        returnPct: row.direction === "SHORT" ? -rawReturn : rawReturn,
        exitType: "week_close",
      };
    });

    const multiNet = addTrades(multi, adjusted);
    multi.weekly.push(multiNet);

    const firstOnly = adjusted.filter((_, index) => {
      const tradeNumber = toNumber(rows[index]?.metadata?.tradeNumber);
      return tradeNumber === 1;
    });
    const firstNet = addTrades(first, firstOnly);
    first.weekly.push(firstNet);
  }

  return { multi, first };
}

async function main() {
  console.log("Loading V3 trailing-stop comparison...\n");

  const weeks = await loadCompletedWeeks();
  const v3SignalsByWeek = await loadV3Signals();
  const storedFixed = await loadStoredFixedBaseline(weeks);

  const stats: Record<VariantKey, VariantStats> = {
    siteMultiFixed: storedFixed.multi,
    siteFirstFixed: storedFixed.first,
    recalcMultiFixed: makeStats(),
    recalcFirstFixed: makeStats(),
    trailMulti: makeStats(),
    trailFirst: makeStats(),
  };

  const weeklyRows: Array<Record<VariantKey | "label", number | string>> = [];
  const barsCache = new Map<string, H1Bar[]>();
  const adrCache = new Map<string, { adrDistance: number; adrPct: number } | null>();

  for (const weekOpenUtc of weeks) {
    const weekSignals = v3SignalsByWeek[weekOpenUtc] ?? [];

    let recalcMultiNet = 0;
    let recalcFirstNet = 0;
    let trailMultiNet = 0;
    let trailFirstNet = 0;

    for (const signal of weekSignals) {
      const weekWindow = getCanonicalWeekWindow(weekOpenUtc, signal.assetClass);
      const cacheKey = `${weekOpenUtc}|${signal.pair}|${signal.assetClass}`;

      let adr = adrCache.get(cacheKey);
      if (adr === undefined) {
        adr = await computeAdr(signal.pair, weekWindow.openUtc.toISO()!, signal.assetClass);
        adrCache.set(cacheKey, adr);
      }
      if (!adr) continue;

      let bars = barsCache.get(cacheKey);
      if (!bars) {
        bars = await fetchOanda5MinuteSeries(signal.pair, weekWindow.openUtc, weekWindow.closeUtc).catch(() => []);
        barsCache.set(cacheKey, bars);
      }
      if (bars.length === 0) continue;

      const fixedTrades = scanAdrTrades({
        pair: signal.pair,
        assetClass: signal.assetClass,
        direction: signal.direction,
        weekOpenUtc,
        adrPct: adr.adrPct,
        adrAbsoluteDistance: adr.adrDistance,
        bars,
        tpMultiple: FIXED_TP_MULTIPLE,
        closeAtWeekEnd: true,
      });

      const trailingTrades = scanAdrTrailingTrades({
        pair: signal.pair,
        assetClass: signal.assetClass,
        direction: signal.direction,
        weekOpenUtc,
        adrPct: adr.adrPct,
        adrAbsoluteDistance: adr.adrDistance,
        bars,
        activationMultiple: TRAIL_ACTIVATION_MULTIPLE,
        trailDistanceMultiple: TRAIL_DISTANCE_MULTIPLE,
        closeAtWeekEnd: true,
      });

      recalcMultiNet += addTrades(stats.recalcMultiFixed, fixedTrades.map((trade) => ({
        returnPct: trade.returnPct ?? 0,
        exitType: trade.exitType ?? "",
      })));
      recalcFirstNet += addTrades(stats.recalcFirstFixed, fixedTrades.slice(0, 1).map((trade) => ({
        returnPct: trade.returnPct ?? 0,
        exitType: trade.exitType ?? "",
      })));

      trailMultiNet += addTrades(stats.trailMulti, trailingTrades.map((trade) => ({
        returnPct: trade.returnPct,
        exitType: trade.exitType,
      })));
      trailFirstNet += addTrades(stats.trailFirst, trailingTrades.slice(0, 1).map((trade) => ({
        returnPct: trade.returnPct,
        exitType: trade.exitType,
      })));
    }

    stats.recalcMultiFixed.weekly.push(recalcMultiNet);
    stats.recalcFirstFixed.weekly.push(recalcFirstNet);
    stats.trailMulti.weekly.push(trailMultiNet);
    stats.trailFirst.weekly.push(trailFirstNet);

    const label = new Date(new Date(weekOpenUtc).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(5, 10);
    weeklyRows.push({
      label,
      siteMultiFixed: stats.siteMultiFixed.weekly[weeklyRows.length] ?? 0,
      siteFirstFixed: stats.siteFirstFixed.weekly[weeklyRows.length] ?? 0,
      recalcMultiFixed: recalcMultiNet,
      recalcFirstFixed: recalcFirstNet,
      trailMulti: trailMultiNet,
      trailFirst: trailFirstNet,
    });

    console.log(
      `${label}: site ${fmtPct(stats.siteMultiFixed.weekly[weeklyRows.length - 1] as number)} / ${fmtPct(stats.siteFirstFixed.weekly[weeklyRows.length - 1] as number)} | ` +
      `recalc ${fmtPct(recalcMultiNet)} / ${fmtPct(recalcFirstNet)} | ` +
      `trail ${fmtPct(trailMultiNet)} / ${fmtPct(trailFirstNet)}`,
    );
  }

  console.log(`\n${"=".repeat(118)}`);
  console.log("V3 ADR PULLBACK — FIXED TP vs 0.25/0.25 TRAILING STOP (10 completed weeks)");
  console.log("=".repeat(118));

  console.log("\nPer-week net return\n");
  console.log(
    "Week".padEnd(7),
    "Site Fixed M/F".padEnd(24),
    "Recalc Fixed M/F".padEnd(24),
    "Trail M/F".padEnd(24),
  );
  console.log("-".repeat(82));
  for (const row of weeklyRows) {
    const siteStr = `${fmtPct(row.siteMultiFixed as number)} / ${fmtPct(row.siteFirstFixed as number)}`;
    const fixedStr = `${fmtPct(row.recalcMultiFixed as number)} / ${fmtPct(row.recalcFirstFixed as number)}`;
    const trailStr = `${fmtPct(row.trailMulti as number)} / ${fmtPct(row.trailFirst as number)}`;
    console.log(
      String(row.label).padEnd(7),
      siteStr.padEnd(24),
      fixedStr.padEnd(24),
      trailStr.padEnd(24),
    );
  }

  console.log("\nSummary\n");
  console.log(
    "Variant".padEnd(20),
    "Net".padEnd(10),
    "Trades".padEnd(8),
    "Wins".padEnd(7),
    "Losses".padEnd(8),
    "WR".padEnd(8),
    "Gross+".padEnd(10),
    "Gross-".padEnd(10),
    "MaxDD".padEnd(10),
    "WorstWk".padEnd(10),
    "LoseWk".padEnd(8),
  );
  console.log("-".repeat(112));

  const order: VariantKey[] = [
    "siteMultiFixed",
    "siteFirstFixed",
    "recalcMultiFixed",
    "recalcFirstFixed",
    "trailMulti",
    "trailFirst",
  ];

  for (const key of order) {
    const stat = stats[key];
    const curve = curveStats(stat.weekly);
    console.log(
      key.padEnd(20),
      fmtPct(stat.net).padEnd(10),
      String(stat.trades).padEnd(8),
      String(stat.wins).padEnd(7),
      String(stat.losses).padEnd(8),
      `${winRate(stat).toFixed(1)}%`.padEnd(8),
      fmtPct(stat.grossProfit).padEnd(10),
      fmtPct(stat.grossLoss).padEnd(10),
      fmtPct(curve.maxDd).padEnd(10),
      fmtPct(curve.worstWeek).padEnd(10),
      String(curve.losingWeeks).padEnd(8),
    );
  }

  console.log("\nDelta vs site fixed multi\n");
  console.log(
    "Variant".padEnd(20),
    "Net Δ".padEnd(10),
    "Trades Δ".padEnd(10),
    "WR Δ".padEnd(10),
    "MaxDD Δ".padEnd(10),
    "WorstWk Δ".padEnd(12),
  );
  console.log("-".repeat(72));

  const siteCurve = curveStats(stats.siteMultiFixed.weekly);
  for (const key of ["siteFirstFixed", "recalcMultiFixed", "recalcFirstFixed", "trailMulti", "trailFirst"] as VariantKey[]) {
    const stat = stats[key];
    const curve = curveStats(stat.weekly);
    console.log(
      key.padEnd(20),
      fmtPct(stat.net - stats.siteMultiFixed.net).padEnd(10),
      String(stat.trades - stats.siteMultiFixed.trades).padEnd(10),
      `${(winRate(stat) - winRate(stats.siteMultiFixed)).toFixed(1)}%`.padEnd(10),
      fmtPct(curve.maxDd - siteCurve.maxDd).padEnd(10),
      fmtPct(curve.worstWeek - siteCurve.worstWeek).padEnd(12),
    );
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
