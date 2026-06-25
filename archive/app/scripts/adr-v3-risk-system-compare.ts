/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/adr-v3-risk-system-compare.ts
 *
 * Description:
 * Test V3 ADR pullback with a fuller risk layer:
 *   - trail activates at +0.25 ADR
 *   - trail distance stays 0.25 ADR behind best excursion
 *   - optional hard stop loss at 1.0 ADR from entry
 *
 * Compared variants:
 *   1. Persisted site fixed TP multi-entry
 *   2. Persisted site fixed TP first-trade-only
 *   3. Recomputed trailing-only multi-entry
 *   4. Recomputed trailing-only first-trade-only
 *   5. Recomputed trailing + 1x ADR SL multi-entry
 *   6. Recomputed trailing + 1x ADR SL first-trade-only
 *
 * Usage:
 *   npx tsx scripts/adr-v3-risk-system-compare.ts
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

const RUN_ID = 54;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const TRAIL_ACTIVATION_MULTIPLE = 0.25;
const TRAIL_DISTANCE_MULTIPLE = 0.25;
const HARD_STOP_MULTIPLE = 1.0;

type AssetClass = "fx" | "indices" | "commodities" | "crypto";
type VariantKey =
  | "siteMultiFixed"
  | "siteFirstFixed"
  | "trailMulti"
  | "trailFirst"
  | "riskMulti"
  | "riskFirst";

type V3Signal = {
  pair: string;
  direction: AdrTradeDirection;
  assetClass: AssetClass;
};

type StoredTradeRow = {
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

type TradeLike = {
  returnPct: number;
  exitType: "tp" | "trail_hit" | "stop_loss" | "week_close";
};

type VariantStats = {
  trades: number;
  wins: number;
  losses: number;
  grossProfit: number;
  grossLoss: number;
  net: number;
  weekly: number[];
  tp: number;
  trailHits: number;
  stopLossHits: number;
  weekCloses: number;
};

type RiskTradeResult = {
  returnPct: number;
  exitType: "trail_hit" | "stop_loss" | "week_close";
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
    tp: 0,
    trailHits: 0,
    stopLossHits: 0,
    weekCloses: 0,
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

function addTrades(stats: VariantStats, trades: TradeLike[]) {
  let weekNet = 0;
  for (const trade of trades) {
    stats.trades += 1;
    stats.net += trade.returnPct;
    weekNet += trade.returnPct;

    if (trade.returnPct > 0) {
      stats.wins += 1;
      stats.grossProfit += trade.returnPct;
    } else {
      stats.losses += 1;
      stats.grossLoss += trade.returnPct;
    }

    if (trade.exitType === "tp") stats.tp += 1;
    if (trade.exitType === "trail_hit") stats.trailHits += 1;
    if (trade.exitType === "stop_loss") stats.stopLossHits += 1;
    if (trade.exitType === "week_close") stats.weekCloses += 1;
  }
  return weekNet;
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

function scanTrailingRiskTrades(input: {
  direction: AdrTradeDirection;
  adrPct: number;
  adrDistance: number;
  bars: H1Bar[];
  entryMultiple?: number;
  activationMultiple?: number;
  trailDistanceMultiple?: number;
  hardStopMultiple?: number | null;
}): RiskTradeResult[] {
  const {
    direction,
    adrPct,
    adrDistance,
    bars,
    entryMultiple = 1.0,
    activationMultiple = TRAIL_ACTIVATION_MULTIPLE,
    trailDistanceMultiple = TRAIL_DISTANCE_MULTIPLE,
    hardStopMultiple = null,
  } = input;

  if (bars.length === 0) return [];

  const entryDistance = adrDistance * entryMultiple;
  const activationDistance = adrDistance * activationMultiple;
  const trailDistance = adrDistance * trailDistanceMultiple;
  const hardStopDistance = hardStopMultiple == null ? null : adrDistance * hardStopMultiple;

  const out: RiskTradeResult[] = [];

  let anchor: number | null = null;
  let inTrade = false;

  let entryPrice = 0;
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

      const hardStopPrice = hardStopDistance == null
        ? null
        : direction === "LONG"
          ? entryPrice - hardStopDistance
          : entryPrice + hardStopDistance;

      const trailingStopPrice = trailArmed
        ? direction === "LONG"
          ? bestPrice - trailDistance
          : bestPrice + trailDistance
        : null;

      const activeStopPrice =
        direction === "LONG"
          ? Math.max(
              hardStopPrice ?? Number.NEGATIVE_INFINITY,
              trailingStopPrice ?? Number.NEGATIVE_INFINITY,
            )
          : Math.min(
              hardStopPrice ?? Number.POSITIVE_INFINITY,
              trailingStopPrice ?? Number.POSITIVE_INFINITY,
            );

      const stopIsActive = Number.isFinite(activeStopPrice);
      const stopHit = stopIsActive && (
        direction === "LONG"
          ? bar.low <= activeStopPrice
          : bar.high >= activeStopPrice
      );

      if (stopHit) {
        const returnPct =
          direction === "LONG"
            ? ((activeStopPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - activeStopPrice) / entryPrice) * 100;
        const exitType =
          trailingStopPrice != null &&
          Math.abs(activeStopPrice - trailingStopPrice) < 1e-12
            ? "trail_hit"
            : "stop_loss";
        out.push({ returnPct, exitType });
        inTrade = false;
        trailArmed = false;
        anchor = direction === "LONG" ? bar.high : bar.low;
        continue;
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

    const entryPriceCandidate =
      direction === "LONG"
        ? prevAnchor - entryDistance
        : prevAnchor + entryDistance;

    const triggerHit =
      direction === "LONG"
        ? bar.low <= entryPriceCandidate
        : bar.high >= entryPriceCandidate;

    if (triggerHit) {
      inTrade = true;
      entryPrice = entryPriceCandidate;
      trailArmed = false;
      bestPrice =
        direction === "LONG"
          ? Math.max(entryPriceCandidate, bar.high)
          : Math.min(entryPriceCandidate, bar.low);
      maePrice =
        direction === "LONG"
          ? Math.min(entryPriceCandidate, bar.low)
          : Math.max(entryPriceCandidate, bar.high);
    }
  }

  if (inTrade) {
    const lastBar = bars[bars.length - 1]!;
    const returnPct =
      direction === "LONG"
        ? ((lastBar.close - entryPrice) / entryPrice) * 100
        : ((entryPrice - lastBar.close) / entryPrice) * 100;
    out.push({ returnPct, exitType: "week_close" });
  }

  return out;
}

async function loadStoredFixedBaseline(weeks: readonly string[]) {
  const tradeRows = await pool.query<StoredTradeRow>(
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

  const byWeek = new Map<string, StoredTradeRow[]>();
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
        return {
          returnPct: toNumber(row.pnl_pct),
          exitType: row.exit_reason === "tp" ? "tp" : "week_close",
        } as TradeLike;
      }
      const entryPrice = toNumber(row.entry_price);
      const weekClosePrice = closeByWeekSymbol.get(`${weekIso}|${row.symbol.toUpperCase()}`) ?? 0;
      if (entryPrice <= 0 || weekClosePrice <= 0) {
        return {
          returnPct: toNumber(row.pnl_pct),
          exitType: "week_close",
        } as TradeLike;
      }
      const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
      return {
        returnPct: row.direction === "SHORT" ? -rawReturn : rawReturn,
        exitType: "week_close",
      } as TradeLike;
    });

    const multiNet = addTrades(multi, adjusted);
    multi.weekly.push(multiNet);

    const firstOnly = adjusted.filter((_, index) => toNumber(rows[index]?.metadata?.tradeNumber) === 1);
    const firstNet = addTrades(first, firstOnly);
    first.weekly.push(firstNet);
  }

  return { multi, first };
}

async function main() {
  console.log("Loading V3 risk-system comparison...\n");

  const weeks = await loadCompletedWeeks();
  const signalsByWeek = await loadV3Signals();
  const storedFixed = await loadStoredFixedBaseline(weeks);

  const stats: Record<VariantKey, VariantStats> = {
    siteMultiFixed: storedFixed.multi,
    siteFirstFixed: storedFixed.first,
    trailMulti: makeStats(),
    trailFirst: makeStats(),
    riskMulti: makeStats(),
    riskFirst: makeStats(),
  };

  const adrCache = new Map<string, { adrDistance: number; adrPct: number } | null>();
  const barsCache = new Map<string, H1Bar[]>();
  const weeklyRows: Array<Record<VariantKey | "label", number | string>> = [];

  for (const weekOpenUtc of weeks) {
    const signals = signalsByWeek[weekOpenUtc] ?? [];
    let trailMultiNet = 0;
    let trailFirstNet = 0;
    let riskMultiNet = 0;
    let riskFirstNet = 0;

    for (const signal of signals) {
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

      const trailingOnly = scanTrailingRiskTrades({
        direction: signal.direction,
        adrPct: adr.adrPct,
        adrDistance: adr.adrDistance,
        bars,
        hardStopMultiple: null,
      });

      const trailingWithStop = scanTrailingRiskTrades({
        direction: signal.direction,
        adrPct: adr.adrPct,
        adrDistance: adr.adrDistance,
        bars,
        hardStopMultiple: HARD_STOP_MULTIPLE,
      });

      trailMultiNet += addTrades(stats.trailMulti, trailingOnly);
      trailFirstNet += addTrades(stats.trailFirst, trailingOnly.slice(0, 1));
      riskMultiNet += addTrades(stats.riskMulti, trailingWithStop);
      riskFirstNet += addTrades(stats.riskFirst, trailingWithStop.slice(0, 1));
    }

    stats.trailMulti.weekly.push(trailMultiNet);
    stats.trailFirst.weekly.push(trailFirstNet);
    stats.riskMulti.weekly.push(riskMultiNet);
    stats.riskFirst.weekly.push(riskFirstNet);

    const label = new Date(new Date(weekOpenUtc).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(5, 10);
    weeklyRows.push({
      label,
      siteMultiFixed: stats.siteMultiFixed.weekly[weeklyRows.length] ?? 0,
      siteFirstFixed: stats.siteFirstFixed.weekly[weeklyRows.length] ?? 0,
      trailMulti: trailMultiNet,
      trailFirst: trailFirstNet,
      riskMulti: riskMultiNet,
      riskFirst: riskFirstNet,
    });

    console.log(
      `${label}: fixed ${fmtPct(stats.siteMultiFixed.weekly[weeklyRows.length - 1] as number)} / ${fmtPct(stats.siteFirstFixed.weekly[weeklyRows.length - 1] as number)} | ` +
      `trail ${fmtPct(trailMultiNet)} / ${fmtPct(trailFirstNet)} | ` +
      `risk ${fmtPct(riskMultiNet)} / ${fmtPct(riskFirstNet)}`,
    );
  }

  console.log(`\n${"=".repeat(124)}`);
  console.log("V3 ADR PULLBACK — FIXED vs TRAILING vs TRAILING + 1x ADR STOP LOSS");
  console.log("=".repeat(124));

  console.log("\nPer-week net return\n");
  console.log(
    "Week".padEnd(7),
    "Fixed M/F".padEnd(24),
    "Trail M/F".padEnd(24),
    "Trail+SL M/F".padEnd(24),
  );
  console.log("-".repeat(82));
  for (const row of weeklyRows) {
    const fixedStr = `${fmtPct(row.siteMultiFixed as number)} / ${fmtPct(row.siteFirstFixed as number)}`;
    const trailStr = `${fmtPct(row.trailMulti as number)} / ${fmtPct(row.trailFirst as number)}`;
    const riskStr = `${fmtPct(row.riskMulti as number)} / ${fmtPct(row.riskFirst as number)}`;
    console.log(
      String(row.label).padEnd(7),
      fixedStr.padEnd(24),
      trailStr.padEnd(24),
      riskStr.padEnd(24),
    );
  }

  console.log("\nSummary\n");
  console.log(
    "Variant".padEnd(18),
    "Net".padEnd(10),
    "Trades".padEnd(8),
    "WR".padEnd(8),
    "Trail".padEnd(8),
    "SL".padEnd(6),
    "WkCls".padEnd(8),
    "Gross+".padEnd(10),
    "Gross-".padEnd(10),
    "MaxDD".padEnd(10),
    "WorstWk".padEnd(10),
  );
  console.log("-".repeat(112));

  const ordered: VariantKey[] = [
    "siteMultiFixed",
    "siteFirstFixed",
    "trailMulti",
    "trailFirst",
    "riskMulti",
    "riskFirst",
  ];

  for (const key of ordered) {
    const stat = stats[key];
    const curve = curveStats(stat.weekly);
    console.log(
      key.padEnd(18),
      fmtPct(stat.net).padEnd(10),
      String(stat.trades).padEnd(8),
      `${winRate(stat).toFixed(1)}%`.padEnd(8),
      String(stat.trailHits).padEnd(8),
      String(stat.stopLossHits).padEnd(6),
      String(stat.weekCloses).padEnd(8),
      fmtPct(stat.grossProfit).padEnd(10),
      fmtPct(stat.grossLoss).padEnd(10),
      fmtPct(curve.maxDd).padEnd(10),
      fmtPct(curve.worstWeek).padEnd(10),
    );
  }

  console.log("\nDelta vs trailing-only\n");
  console.log(
    "Variant".padEnd(18),
    "Net Δ".padEnd(10),
    "Trades Δ".padEnd(10),
    "WR Δ".padEnd(10),
    "MaxDD Δ".padEnd(10),
    "WorstWk Δ".padEnd(12),
  );
  console.log("-".repeat(72));

  const trailMultiCurve = curveStats(stats.trailMulti.weekly);
  const trailFirstCurve = curveStats(stats.trailFirst.weekly);

  console.log(
    "riskMulti".padEnd(18),
    fmtPct(stats.riskMulti.net - stats.trailMulti.net).padEnd(10),
    String(stats.riskMulti.trades - stats.trailMulti.trades).padEnd(10),
    `${(winRate(stats.riskMulti) - winRate(stats.trailMulti)).toFixed(1)}%`.padEnd(10),
    fmtPct(curveStats(stats.riskMulti.weekly).maxDd - trailMultiCurve.maxDd).padEnd(10),
    fmtPct(curveStats(stats.riskMulti.weekly).worstWeek - trailMultiCurve.worstWeek).padEnd(12),
  );
  console.log(
    "riskFirst".padEnd(18),
    fmtPct(stats.riskFirst.net - stats.trailFirst.net).padEnd(10),
    String(stats.riskFirst.trades - stats.trailFirst.trades).padEnd(10),
    `${(winRate(stats.riskFirst) - winRate(stats.trailFirst)).toFixed(1)}%`.padEnd(10),
    fmtPct(curveStats(stats.riskFirst.weekly).maxDd - trailFirstCurve.maxDd).padEnd(10),
    fmtPct(curveStats(stats.riskFirst.weekly).worstWeek - trailFirstCurve.worstWeek).padEnd(12),
  );

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
