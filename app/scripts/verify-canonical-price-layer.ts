/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-canonical-price-layer.ts
 * Description: Verifies canonical pair returns against canonical bars and legacy performance snapshots.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadEnvFileIntoProcess(filePath: string) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const REPO_ROOT = path.resolve(__dirname, "..");
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env"));
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env.local"));

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function almostEqual(left: number, right: number, tolerance = 0.0001) {
  return Math.abs(left - right) <= tolerance;
}

async function main() {
  const { query } = await import("../src/lib/db");
  const { CANONICAL_INSTRUMENTS } = await import("../src/lib/canonicalInstruments");
  const {
    CANONICAL_WEEKS,
    getCanonicalWeekWindow,
    listCanonicalDailyWindowsForWeek,
  } = await import("../src/lib/canonicalPriceWindows");

  const weeklyRows = await query<{
    symbol: string;
    asset_class: string;
    period_open_utc: Date;
    period_close_utc: Date;
    open_price: number | string;
    close_price: number | string;
    high_price: number | string | null;
    low_price: number | string | null;
    return_pct: number | string;
    source: string;
    derived_from_timeframe: string;
  }>(
    `SELECT symbol, asset_class, period_open_utc, period_close_utc, open_price, close_price,
            high_price, low_price, return_pct, source, derived_from_timeframe
       FROM pair_period_returns
      WHERE period_type = 'weekly'
      ORDER BY symbol ASC, period_open_utc ASC`,
  );

  const dailyRows = await query<{
    symbol: string;
    asset_class: string;
    period_open_utc: Date;
    period_close_utc: Date;
    open_price: number | string;
    close_price: number | string;
    high_price: number | string | null;
    low_price: number | string | null;
    return_pct: number | string;
  }>(
    `SELECT symbol, asset_class, period_open_utc, period_close_utc, open_price, close_price,
            high_price, low_price, return_pct
       FROM pair_period_returns
      WHERE period_type = 'daily'
      ORDER BY symbol ASC, period_open_utc ASC`,
  );

  const canonicalDailyBars = await query<{
    symbol: string;
    asset_class: string;
    bar_open_utc: Date;
    bar_close_utc: Date;
    open_price: number | string;
    high_price: number | string;
    low_price: number | string;
    close_price: number | string;
  }>(
    `SELECT symbol, asset_class, bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price
       FROM canonical_price_bars
      WHERE timeframe = '1d'
      ORDER BY symbol ASC, bar_open_utc ASC`,
  );

  const dailyBarsBySymbol = new Map<string, typeof canonicalDailyBars>();
  for (const row of canonicalDailyBars) {
    const key = `${row.asset_class}:${row.symbol}`;
    const list = dailyBarsBySymbol.get(key) ?? [];
    list.push(row);
    dailyBarsBySymbol.set(key, list);
  }

  const weeklyInternalMismatches: Array<Record<string, unknown>> = [];
  for (const row of weeklyRows) {
    const weekOpenUtc = row.period_open_utc.toISOString();
    const key = `${row.asset_class}:${row.symbol}`;
    const bars = (dailyBarsBySymbol.get(key) ?? []).filter((bar) => {
      const window = getCanonicalWeekWindow(weekOpenUtc, row.asset_class as typeof CANONICAL_INSTRUMENTS[number]["assetClass"]);
      const openMs = bar.bar_open_utc.getTime();
      return openMs >= window.openUtc.toMillis() && openMs < window.closeUtc.toMillis();
    });
    if (bars.length === 0) {
      weeklyInternalMismatches.push({
        type: "missing_daily_bars",
        symbol: row.symbol,
        assetClass: row.asset_class,
        weekOpenUtc,
      });
      continue;
    }
    const openPrice = toNumber(bars[0]!.open_price);
    const closePrice = toNumber(bars[bars.length - 1]!.close_price);
    const highPrice = Math.max(...bars.map((bar) => toNumber(bar.high_price)));
    const lowPrice = Math.min(...bars.map((bar) => toNumber(bar.low_price)));
    const returnPct = round(((closePrice - openPrice) / openPrice) * 100, 6);
    const checks = [
      almostEqual(toNumber(row.open_price), openPrice),
      almostEqual(toNumber(row.close_price), closePrice),
      almostEqual(toNumber(row.high_price), highPrice),
      almostEqual(toNumber(row.low_price), lowPrice),
      almostEqual(toNumber(row.return_pct), returnPct),
    ];
    if (checks.some((value) => !value)) {
      weeklyInternalMismatches.push({
        type: "weekly_mismatch",
        symbol: row.symbol,
        assetClass: row.asset_class,
        weekOpenUtc,
        persisted: {
          openPrice: toNumber(row.open_price),
          closePrice: toNumber(row.close_price),
          highPrice: toNumber(row.high_price),
          lowPrice: toNumber(row.low_price),
          returnPct: toNumber(row.return_pct),
        },
        reconstructed: {
          openPrice,
          closePrice,
          highPrice,
          lowPrice,
          returnPct,
        },
      });
    }
  }

  const dailyInternalMismatches: Array<Record<string, unknown>> = [];
  const dailyBarIndex = new Map<string, (typeof canonicalDailyBars)[number]>();
  for (const row of canonicalDailyBars) {
    dailyBarIndex.set(`${row.asset_class}:${row.symbol}:${row.bar_open_utc.toISOString()}`, row);
  }
  for (const row of dailyRows) {
    const key = `${row.asset_class}:${row.symbol}:${row.period_open_utc.toISOString()}`;
    const bar = dailyBarIndex.get(key);
    if (!bar) {
      dailyInternalMismatches.push({
        type: "missing_canonical_daily_bar",
        symbol: row.symbol,
        assetClass: row.asset_class,
        periodOpenUtc: row.period_open_utc.toISOString(),
      });
      continue;
    }
    const returnPct = round(((toNumber(bar.close_price) - toNumber(bar.open_price)) / toNumber(bar.open_price)) * 100, 6);
    const checks = [
      almostEqual(toNumber(row.open_price), toNumber(bar.open_price)),
      almostEqual(toNumber(row.close_price), toNumber(bar.close_price)),
      almostEqual(toNumber(row.high_price), toNumber(bar.high_price)),
      almostEqual(toNumber(row.low_price), toNumber(bar.low_price)),
      almostEqual(toNumber(row.return_pct), returnPct),
    ];
    if (checks.some((value) => !value)) {
      dailyInternalMismatches.push({
        type: "daily_mismatch",
        symbol: row.symbol,
        assetClass: row.asset_class,
        periodOpenUtc: row.period_open_utc.toISOString(),
      });
    }
  }

  const missingPeriods: Array<Record<string, unknown>> = [];
  const dailyReturnIndex = new Set(dailyRows.map((row) => `${row.asset_class}:${row.symbol}:${row.period_open_utc.toISOString()}`));
  const weeklyReturnIndex = new Set(weeklyRows.map((row) => `${row.asset_class}:${row.symbol}:${row.period_open_utc.toISOString()}`));
  for (const instrument of CANONICAL_INSTRUMENTS) {
    for (const weekOpenUtc of CANONICAL_WEEKS) {
      const weeklyKey = `${instrument.assetClass}:${instrument.symbol}:${weekOpenUtc}`;
      if (!weeklyReturnIndex.has(weeklyKey)) {
        missingPeriods.push({
          type: "missing_weekly_return",
          symbol: instrument.symbol,
          assetClass: instrument.assetClass,
          periodOpenUtc: weekOpenUtc,
        });
      }
      for (const dailyWindow of listCanonicalDailyWindowsForWeek(weekOpenUtc, instrument.assetClass)) {
        const dailyKey = `${instrument.assetClass}:${instrument.symbol}:${dailyWindow.periodOpenUtc}`;
        if (!dailyReturnIndex.has(dailyKey)) {
          missingPeriods.push({
            type: "missing_daily_return",
            symbol: instrument.symbol,
            assetClass: instrument.assetClass,
            periodOpenUtc: dailyWindow.periodOpenUtc,
            weekOpenUtc,
          });
        }
      }
    }
  }

  const snapshotRows = await query<{
    week_open_utc: Date;
    asset_class: string;
    model: string;
    pair_details: Array<{ pair?: string; percent?: number }> | null;
  }>(
    `SELECT week_open_utc, asset_class, model, pair_details
       FROM performance_snapshots
      WHERE week_open_utc = ANY($1::timestamptz[])
      ORDER BY week_open_utc ASC, asset_class ASC, model ASC`,
    [CANONICAL_WEEKS],
  );

  const weeklyReturnLookup = new Map(
    weeklyRows.map((row) => [
      `${row.asset_class}:${row.symbol}:${row.period_open_utc.toISOString()}`,
      toNumber(row.return_pct),
    ]),
  );
  const crossVerificationDetails: Array<Record<string, unknown>> = [];
  let matchesWithinTolerance = 0;
  let mismatches = 0;
  const tolerancePct = 0.5;
  for (const row of snapshotRows) {
    const weekOpenUtc = row.week_open_utc.toISOString();
    for (const detail of row.pair_details ?? []) {
      const symbol = String(detail.pair ?? "").toUpperCase();
      const snapshotReturnPct = Number(detail.percent);
      if (!symbol || !Number.isFinite(snapshotReturnPct)) {
        continue;
      }
      const canonicalReturnPct = weeklyReturnLookup.get(`${row.asset_class}:${symbol}:${weekOpenUtc}`);
      if (canonicalReturnPct === undefined) {
        continue;
      }
      const deltaPct = round(canonicalReturnPct - snapshotReturnPct, 6);
      const status = Math.abs(deltaPct) <= tolerancePct ? "MATCH" : "MISMATCH";
      if (status === "MATCH") {
        matchesWithinTolerance += 1;
      } else {
        mismatches += 1;
      }
      crossVerificationDetails.push({
        symbol,
        assetClass: row.asset_class,
        week: weekOpenUtc,
        canonical_return_pct: canonicalReturnPct,
        snapshot_return_pct: snapshotReturnPct,
        delta_pct: deltaPct,
        model: row.model,
        status,
      });
    }
  }

  const reportsDir = path.join(REPO_ROOT, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const outputPath = path.join(reportsDir, "canonical-price-layer-verification.json");
  writeFileSync(
    outputPath,
    `${JSON.stringify({
      generated_utc: new Date().toISOString(),
      internal_consistency: {
        weekly_rows_checked: weeklyRows.length,
        daily_rows_checked: dailyRows.length,
        weekly_mismatches: weeklyInternalMismatches,
        daily_mismatches: dailyInternalMismatches,
        missing_periods: missingPeriods,
      },
      legacy_cross_verification: {
        total_comparisons: crossVerificationDetails.length,
        matches_within_tolerance: matchesWithinTolerance,
        mismatches,
        tolerance_pct: tolerancePct,
        details: crossVerificationDetails,
      },
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${outputPath}`);
  console.log(`  Weekly internal mismatches: ${weeklyInternalMismatches.length}`);
  console.log(`  Daily internal mismatches: ${dailyInternalMismatches.length}`);
  console.log(`  Missing expected periods: ${missingPeriods.length}`);
  console.log(`  Cross-verification comparisons: ${crossVerificationDetails.length}`);
  console.log(`  Cross-verification mismatches: ${mismatches}`);

  if (weeklyInternalMismatches.length > 0 || dailyInternalMismatches.length > 0 || missingPeriods.length > 0) {
    throw new Error("Canonical price layer internal verification failed.");
  }
}

main().catch((error) => {
  console.error("verify-canonical-price-layer failed:", error);
  process.exitCode = 1;
});
