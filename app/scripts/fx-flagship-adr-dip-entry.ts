/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: fx-flagship-adr-dip-entry.ts
 *
 * Description:
 * Compares baseline (week open) entry vs ADR 1.0 dip entry for FX-only
 * Tiered V3 Gated flagship trades over the past 9 completed weeks.
 *
 * Dip entry logic: wait for price to move 1 ADR AGAINST the trade direction
 * before entering. LONG → lower ADR band hit. SHORT → upper ADR band hit.
 * If dip never reached during the week, trade is skipped (no fill).
 *
 * ADR = 10-day average of (daily_high - daily_low) / daily_open * 100
 * Touch detection uses daily high/low bars from pair_period_returns.
 * Return from dip entry = (close/entry - 1) * 100, signed by direction.
 *
 * Usage: npx tsx scripts/fx-flagship-adr-dip-entry.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { getCanonicalWeeklyBasket } from "@/lib/flagship/canonicalWeeklyBasket";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";

// ── env loading ──────────────────────────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
const REPO_ROOT = path.resolve(__dirname, "..");
loadEnvFile(path.join(REPO_ROOT, ".env"));
loadEnvFile(path.join(REPO_ROOT, ".env.local"));

// ── constants ────────────────────────────────────────────────────────
const LOOKBACK_WEEKS = 9;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ADR_MULTIPLIER = 1.0;

// ── types ────────────────────────────────────────────────────────────
type Direction = "LONG" | "SHORT";

type TradeResult = {
  week: string;
  weekLabel: string;
  pair: string;
  direction: Direction;
  tier: string;
  weekOpenPrice: number;
  weekClosePrice: number;
  adrPct: number;
  dipEntryPrice: number;
  dipFilled: boolean;
  baselineReturnPct: number;
  dipReturnPct: number | null; // null if not filled
};

// ── helpers ──────────────────────────────────────────────────────────
function toFinite(value: number | string | null): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildCompletedWeekOpens(count: number): string[] {
  const now = DateTime.utc();
  const currentWeekOpen = getCanonicalWeekOpenUtc(now);
  const currentWeekOpenDt = DateTime.fromISO(currentWeekOpen, { zone: "utc" });
  const lastCompleted = currentWeekOpenDt.minus({ weeks: 1 });
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const weekOpen = lastCompleted.minus({ weeks: i });
    weeks.push(getCanonicalWeekOpenUtc(weekOpen.plus({ hours: 1 })));
  }
  return weeks;
}

function weekLabel(weekOpenUtc: string): string {
  const dt = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!dt.isValid) return weekOpenUtc.slice(0, 10);
  return dt.plus({ days: 1 }).startOf("day").toFormat("MMM dd");
}

function formatSignedPct(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  console.log(`\nADR 1.0 Dip-Entry Analysis — ${weekOpens.length} completed weeks (FX only, Tiered V3 Gated, 1:1 equal weight)\n`);
  console.log(`ADR: ${ADR_LOOKBACK_DAYS}-day lookback · Multiplier: ${ADR_MULTIPLIER}x · Dip = opposite direction\n`);

  const allTrades: TradeResult[] = [];

  for (const weekOpenUtc of weekOpens) {
    const label = weekLabel(weekOpenUtc);
    console.log(`Processing week ${label} (${weekOpenUtc})...`);

    // 1. Get gated FX signals
    let basket;
    try {
      basket = await getCanonicalWeeklyBasket({ weekOpenUtc });
    } catch {
      console.log(`  ⚠ No gated basket for ${label}`);
      continue;
    }
    if (!basket || basket.signals.length === 0) {
      console.log(`  ⚠ Empty basket for ${label}`);
      continue;
    }

    const fxSignals = basket.signals
      .filter((s) => s.assetClass === "fx" && s.gateDecision === "PASS")
      .map((s) => ({
        pair: s.pair.toUpperCase(),
        direction: s.direction as Direction,
        tier: s.tier,
        model: s.model,
      }));

    // 2. Get week window for FX
    const weekWindow = getCanonicalWeekWindow(weekOpenUtc, "fx");

    for (const signal of fxSignals) {
      // 3. Get weekly open/close prices
      const weeklyRow = await client.query(
        `SELECT open_price, close_price
           FROM pair_period_returns
          WHERE symbol = $1
            AND period_type = 'weekly'
            AND period_open_utc >= $2::timestamptz
            AND period_open_utc < $3::timestamptz
          ORDER BY period_open_utc ASC
          LIMIT 1`,
        [signal.pair, weekWindow.openUtc.toISO(), weekWindow.closeUtc.toISO()],
      );

      if (weeklyRow.rows.length === 0) {
        console.log(`  ⚠ No weekly prices for ${signal.pair}`);
        continue;
      }

      const weekOpenPrice = toFinite(weeklyRow.rows[0].open_price);
      const weekClosePrice = toFinite(weeklyRow.rows[0].close_price);
      if (weekOpenPrice <= 0) continue;

      // 4. Compute ADR (10-day lookback before this week)
      const adrRows = await client.query(
        `SELECT open_price, high_price, low_price
           FROM pair_period_returns
          WHERE symbol = $1
            AND period_type = 'daily'
            AND period_open_utc < $2::timestamptz
          ORDER BY period_open_utc DESC
          LIMIT $3`,
        [signal.pair, weekWindow.openUtc.toISO(), ADR_LOOKBACK_DAYS],
      );

      const adrRanges = adrRows.rows
        .map((row: { open_price: number | string; high_price: number | string | null; low_price: number | string | null }) => {
          const o = toFinite(row.open_price);
          const h = row.high_price === null ? null : toFinite(row.high_price);
          const l = row.low_price === null ? null : toFinite(row.low_price);
          if (o <= 0 || h === null || l === null) return null;
          return ((h - l) / o) * 100;
        })
        .filter((v): v is number => v !== null && Number.isFinite(v));

      if (adrRanges.length < ADR_MIN_REQUIRED_DAYS) {
        console.log(`  ⚠ Insufficient ADR data for ${signal.pair} (${adrRanges.length} days)`);
        continue;
      }

      const adrPct = adrRanges.reduce((a, b) => a + b, 0) / adrRanges.length;
      const thresholdPct = adrPct * ADR_MULTIPLIER;

      // 5. Dip entry price (opposite direction)
      // LONG → wait for lower band (price drops 1 ADR from open)
      // SHORT → wait for upper band (price rises 1 ADR from open)
      const dipEntryPrice =
        signal.direction === "LONG"
          ? weekOpenPrice * (1 - thresholdPct / 100)
          : weekOpenPrice * (1 + thresholdPct / 100);

      // 6. Check if dip was hit during the week using daily bars
      const dailyRows = await client.query(
        `SELECT high_price, low_price
           FROM pair_period_returns
          WHERE symbol = $1
            AND period_type = 'daily'
            AND period_open_utc >= $2::timestamptz
            AND period_open_utc < $3::timestamptz
          ORDER BY period_open_utc ASC`,
        [signal.pair, weekWindow.openUtc.toISO(), weekWindow.closeUtc.toISO()],
      );

      const dipFilled = dailyRows.rows.some(
        (bar: { high_price: number | string | null; low_price: number | string | null }) =>
          signal.direction === "LONG"
            ? bar.low_price !== null && toFinite(bar.low_price) <= dipEntryPrice
            : bar.high_price !== null && toFinite(bar.high_price) >= dipEntryPrice,
      );

      // 7. Calculate returns
      const baselineReturnPct =
        signal.direction === "LONG"
          ? ((weekClosePrice / weekOpenPrice) - 1) * 100
          : ((weekOpenPrice / weekClosePrice) - 1) * 100;

      let dipReturnPct: number | null = null;
      if (dipFilled) {
        dipReturnPct =
          signal.direction === "LONG"
            ? ((weekClosePrice / dipEntryPrice) - 1) * 100
            : ((dipEntryPrice / weekClosePrice) - 1) * 100;
      }

      allTrades.push({
        week: weekOpenUtc,
        weekLabel: label,
        pair: signal.pair,
        direction: signal.direction,
        tier: signal.tier,
        weekOpenPrice,
        weekClosePrice,
        adrPct,
        dipEntryPrice,
        dipFilled,
        baselineReturnPct,
        dipReturnPct,
      });
    }
  }

  await client.end();

  // ─────────────────────────────────────────────────────────────────
  // OUTPUT: Per-trade comparison table
  // ─────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(130));
  console.log("PER-TRADE COMPARISON: Baseline (Week Open) vs ADR 1.0 Dip Entry");
  console.log("═".repeat(130));
  console.log(
    "WEEK".padEnd(10) +
    "PAIR".padEnd(10) +
    "DIR".padEnd(7) +
    "TIER".padEnd(7) +
    "ADR%".padStart(8) +
    "OPEN".padStart(10) +
    "DIP ENTRY".padStart(11) +
    "CLOSE".padStart(10) +
    "FILLED?".padStart(9) +
    "BASELINE".padStart(10) +
    "DIP RET".padStart(10) +
    "DELTA".padStart(10) +
    "IMPROVEMENT".padStart(14),
  );
  console.log("─".repeat(130));

  let totalBaselineFilled = 0;
  let totalDipFilled = 0;
  let sumBaselineAll = 0;
  let sumDipFilled = 0;
  let sumBaselineWhenFilled = 0;
  let fillCount = 0;
  let missCount = 0;

  for (const t of allTrades) {
    const delta = t.dipReturnPct !== null ? t.dipReturnPct - t.baselineReturnPct : null;
    const improvement = delta !== null ? (delta > 0 ? "BETTER" : delta < 0 ? "WORSE" : "SAME") : "MISS";

    sumBaselineAll += t.baselineReturnPct;
    if (t.dipFilled && t.dipReturnPct !== null) {
      fillCount++;
      sumDipFilled += t.dipReturnPct;
      sumBaselineWhenFilled += t.baselineReturnPct;
    } else {
      missCount++;
    }

    console.log(
      t.weekLabel.padEnd(10) +
      t.pair.padEnd(10) +
      t.direction.padEnd(7) +
      t.tier.padEnd(7) +
      t.adrPct.toFixed(2).padStart(7) + "%" +
      t.weekOpenPrice.toFixed(5).padStart(10) +
      t.dipEntryPrice.toFixed(5).padStart(11) +
      t.weekClosePrice.toFixed(5).padStart(10) +
      (t.dipFilled ? "YES" : "NO").padStart(9) +
      formatSignedPct(t.baselineReturnPct).padStart(10) +
      formatSignedPct(t.dipReturnPct).padStart(10) +
      formatSignedPct(delta).padStart(10) +
      improvement.padStart(14),
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // OUTPUT: Weekly summary comparison
  // ─────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(110));
  console.log("WEEKLY BASKET COMPARISON: Baseline vs ADR 1.0 Dip Entry");
  console.log("═".repeat(110));
  console.log(
    "WEEK".padEnd(10) +
    "SIGNALS".padStart(9) +
    "FILLED".padStart(8) +
    "FILL%".padStart(8) +
    "BASE AVG".padStart(10) +
    "DIP AVG".padStart(10) +
    "DELTA".padStart(10) +
    "BASE TOT".padStart(10) +
    "DIP TOT".padStart(10) +
    "MISSED RETURN".padStart(15),
  );
  console.log("─".repeat(110));

  let cumBaseline = 0;
  let cumDip = 0;
  let peakBaseline = 0;
  let peakDip = 0;
  let maxDdBaseline = 0;
  let maxDdDip = 0;

  for (const weekOpenUtc of weekOpens) {
    const weekTrades = allTrades.filter((t) => t.week === weekOpenUtc);
    if (weekTrades.length === 0) continue;

    const label = weekLabel(weekOpenUtc);
    const filled = weekTrades.filter((t) => t.dipFilled);
    const missed = weekTrades.filter((t) => !t.dipFilled);
    const fillRate = (filled.length / weekTrades.length) * 100;

    const baselineAvg = weekTrades.reduce((s, t) => s + t.baselineReturnPct, 0) / weekTrades.length;
    const dipAvg = filled.length > 0
      ? filled.reduce((s, t) => s + (t.dipReturnPct ?? 0), 0) / filled.length
      : 0;
    const baselineTotal = weekTrades.reduce((s, t) => s + t.baselineReturnPct, 0);
    const dipTotal = filled.reduce((s, t) => s + (t.dipReturnPct ?? 0), 0);
    const missedReturn = missed.reduce((s, t) => s + t.baselineReturnPct, 0);

    cumBaseline += baselineAvg;
    peakBaseline = Math.max(peakBaseline, cumBaseline);
    maxDdBaseline = Math.max(maxDdBaseline, peakBaseline - cumBaseline);

    const dipWeekAvg = weekTrades.length > 0
      ? filled.reduce((s, t) => s + (t.dipReturnPct ?? 0), 0) / weekTrades.length
      : 0;
    cumDip += dipWeekAvg;
    peakDip = Math.max(peakDip, cumDip);
    maxDdDip = Math.max(maxDdDip, peakDip - cumDip);

    console.log(
      label.padEnd(10) +
      String(weekTrades.length).padStart(9) +
      String(filled.length).padStart(8) +
      `${fillRate.toFixed(0)}%`.padStart(8) +
      formatSignedPct(baselineAvg).padStart(10) +
      formatSignedPct(dipAvg).padStart(10) +
      formatSignedPct(dipAvg - baselineAvg).padStart(10) +
      formatSignedPct(baselineTotal).padStart(10) +
      formatSignedPct(dipTotal).padStart(10) +
      formatSignedPct(missedReturn).padStart(15),
    );
  }

  console.log("─".repeat(110));

  // ─────────────────────────────────────────────────────────────────
  // OUTPUT: Summary stats
  // ─────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("AGGREGATE COMPARISON");
  console.log("═".repeat(70));

  const totalTrades = allTrades.length;
  const overallFillRate = totalTrades > 0 ? (fillCount / totalTrades) * 100 : 0;
  const baselineAvgAll = totalTrades > 0 ? sumBaselineAll / totalTrades : 0;
  const dipAvgFilled = fillCount > 0 ? sumDipFilled / fillCount : 0;
  const baselineAvgWhenFilled = fillCount > 0 ? sumBaselineWhenFilled / fillCount : 0;

  // Count improvements
  let betterCount = 0;
  let worseCount = 0;
  for (const t of allTrades) {
    if (!t.dipFilled || t.dipReturnPct === null) continue;
    if (t.dipReturnPct > t.baselineReturnPct) betterCount++;
    else if (t.dipReturnPct < t.baselineReturnPct) worseCount++;
  }

  console.log(`Total signals:              ${totalTrades}`);
  console.log(`Dip entries filled:         ${fillCount} (${overallFillRate.toFixed(1)}%)`);
  console.log(`Dip entries missed:         ${missCount}`);
  console.log(``);
  console.log(`BASELINE (all trades):`);
  console.log(`  Avg return per trade:     ${formatSignedPct(baselineAvgAll)}`);
  console.log(`  Cumulative (avg method):  ${formatSignedPct(cumBaseline)}`);
  console.log(`  Max drawdown:             -${maxDdBaseline.toFixed(3)}%`);
  console.log(``);
  console.log(`DIP ENTRY (filled only, missed trades excluded):`);
  console.log(`  Avg return per trade:     ${formatSignedPct(dipAvgFilled)}`);
  console.log(`  Cumulative (avg method):  ${formatSignedPct(cumDip)}`);
  console.log(`  Max drawdown:             -${maxDdDip.toFixed(3)}%`);
  console.log(``);
  console.log(`WHEN DIP WAS FILLED (${fillCount} trades):`);
  console.log(`  Baseline avg:             ${formatSignedPct(baselineAvgWhenFilled)}`);
  console.log(`  Dip avg:                  ${formatSignedPct(dipAvgFilled)}`);
  console.log(`  Avg improvement:          ${formatSignedPct(dipAvgFilled - baselineAvgWhenFilled)}`);
  console.log(`  Better / Worse / Same:    ${betterCount} / ${worseCount} / ${fillCount - betterCount - worseCount}`);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
