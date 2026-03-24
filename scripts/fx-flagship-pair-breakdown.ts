/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: fx-flagship-pair-breakdown.ts
 *
 * Description:
 * Quick analysis script — pulls the FX-only Tiered V3 Gated flagship trades
 * for the past 9 completed weeks, shows per-pair per-week returns
 * normalized to 1:1 equal weight (raw pair return signed by direction).
 *
 * Usage: npx tsx scripts/fx-flagship-pair-breakdown.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFileSync } from "node:fs";
import path from "node:path";

// Load .env.local for DATABASE_URL
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
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { getCanonicalWeeklyBasket } from "@/lib/flagship/canonicalWeeklyBasket";
import { getWeeklyPairReturns } from "@/lib/pairReturns";

const LOOKBACK_WEEKS = 9;

type TradeRow = {
  week: string;
  weekLabel: string;
  pair: string;
  direction: "LONG" | "SHORT";
  tier: string;
  model: string;
  rawReturnPct: number;
  signedReturnPct: number;
};

function buildCompletedWeekOpens(count: number): string[] {
  const now = DateTime.utc();
  const currentWeekOpen = getCanonicalWeekOpenUtc(now);
  const currentWeekOpenDt = DateTime.fromISO(currentWeekOpen, { zone: "utc" });

  // Current week is incomplete — start from the previous completed week
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
  const monday = dt.plus({ days: 1 }).startOf("day");
  return monday.toFormat("MMM dd");
}

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  console.log(`\nAnalyzing ${weekOpens.length} completed weeks (FX only, 1:1 equal weight)\n`);

  const allTrades: TradeRow[] = [];
  const weekSummaries: Array<{
    week: string;
    weekLabel: string;
    trades: number;
    avgReturn: number;
    totalReturn: number;
    minReturn: number;
    maxReturn: number;
  }> = [];

  for (const weekOpenUtc of weekOpens) {
    const label = weekLabel(weekOpenUtc);
    console.log(`Processing week ${label} (${weekOpenUtc})...`);

    // Get gated canonical weekly basket (Tiered V3 Gated — the flagship)
    let basket;
    try {
      basket = await getCanonicalWeeklyBasket({ weekOpenUtc });
    } catch {
      console.log(`  ⚠ No gated basket data for ${label}`);
      continue;
    }
    if (!basket || basket.signals.length === 0) {
      console.log(`  ⚠ Empty gated basket for ${label}`);
      continue;
    }

    // Extract FX-only PASS signals (gating already applied by getCanonicalWeeklyBasket)
    const fxSignals = basket.signals
      .filter((s) => s.assetClass === "fx" && s.gateDecision === "PASS")
      .map((s) => ({
        pair: s.pair.toUpperCase(),
        direction: s.direction,
        tier: s.tier,
        model: s.model,
      }));

    // Get raw pair returns for this week
    const returns = await getWeeklyPairReturns(weekOpenUtc, "fx");
    const returnByPair = new Map(returns.map((r) => [r.symbol.toUpperCase(), r.returnPct]));

    const weekTrades: TradeRow[] = [];
    for (const signal of fxSignals) {
      const rawReturn = returnByPair.get(signal.pair);
      if (rawReturn === undefined) {
        console.log(`  ⚠ No return data for ${signal.pair}`);
        continue;
      }
      const signedReturn = signal.direction === "LONG" ? rawReturn : -rawReturn;
      const trade: TradeRow = {
        week: weekOpenUtc,
        weekLabel: label,
        pair: signal.pair,
        direction: signal.direction,
        tier: signal.tier,
        model: signal.model,
        rawReturnPct: rawReturn,
        signedReturnPct: signedReturn,
      };
      weekTrades.push(trade);
      allTrades.push(trade);
    }

    if (weekTrades.length > 0) {
      const returns = weekTrades.map((t) => t.signedReturnPct);
      const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
      const total = returns.reduce((a, b) => a + b, 0);
      weekSummaries.push({
        week: weekOpenUtc,
        weekLabel: label,
        trades: weekTrades.length,
        avgReturn: avg,
        totalReturn: total,
        minReturn: Math.min(...returns),
        maxReturn: Math.max(...returns),
      });
    }
  }

  // ─────────────────────────────────────────
  // OUTPUT: Per-pair per-week table
  // ─────────────────────────────────────────
  console.log("\n" + "═".repeat(120));
  console.log("PER-PAIR PER-WEEK RETURNS (FX Only · Tiered V3 Gated · 1:1 Equal Weight · Raw Pair %)");
  console.log("═".repeat(120));

  // Build pivot: rows = pairs, columns = weeks
  const allPairs = [...new Set(allTrades.map((t) => t.pair))].sort();
  const weekLabels = weekOpens.map((w) => weekLabel(w));

  // Header
  const pairColWidth = 12;
  const weekColWidth = 10;
  const header = "PAIR".padEnd(pairColWidth) + weekLabels.map((l) => l.padStart(weekColWidth)).join("") + "   AVG".padStart(weekColWidth) + "  TOTAL".padStart(weekColWidth);
  console.log(header);
  console.log("─".repeat(header.length));

  for (const pair of allPairs) {
    const pairTrades = allTrades.filter((t) => t.pair === pair);
    let row = pair.padEnd(pairColWidth);
    const pairReturns: number[] = [];

    for (const weekOpenUtc of weekOpens) {
      const trade = pairTrades.find((t) => t.week === weekOpenUtc);
      if (trade) {
        const val = trade.signedReturnPct;
        pairReturns.push(val);
        const sign = val > 0 ? "+" : "";
        row += `${sign}${val.toFixed(2)}%`.padStart(weekColWidth);
      } else {
        row += "—".padStart(weekColWidth);
      }
    }

    if (pairReturns.length > 0) {
      const avg = pairReturns.reduce((a, b) => a + b, 0) / pairReturns.length;
      const total = pairReturns.reduce((a, b) => a + b, 0);
      const avgSign = avg > 0 ? "+" : "";
      const totalSign = total > 0 ? "+" : "";
      row += `${avgSign}${avg.toFixed(2)}%`.padStart(weekColWidth);
      row += `${totalSign}${total.toFixed(2)}%`.padStart(weekColWidth);
    }

    console.log(row);
  }

  // ─────────────────────────────────────────
  // OUTPUT: Weekly basket summary
  // ─────────────────────────────────────────
  console.log("\n" + "═".repeat(90));
  console.log("WEEKLY BASKET SUMMARY (equal-weight average of all FX trades that week)");
  console.log("═".repeat(90));
  console.log(
    "WEEK".padEnd(12) +
    "TRADES".padStart(8) +
    "AVG RET".padStart(10) +
    "TOTAL RET".padStart(12) +
    "BEST PAIR".padStart(12) +
    "WORST PAIR".padStart(13) +
    "MIN".padStart(10) +
    "MAX".padStart(10),
  );
  console.log("─".repeat(90));

  let cumulativeReturn = 0;
  let maxDrawdown = 0;
  let peakCumulative = 0;

  for (const summary of weekSummaries) {
    const weekTrades = allTrades.filter((t) => t.week === summary.week);
    const best = weekTrades.reduce((a, b) => (a.signedReturnPct > b.signedReturnPct ? a : b));
    const worst = weekTrades.reduce((a, b) => (a.signedReturnPct < b.signedReturnPct ? a : b));

    cumulativeReturn += summary.avgReturn;
    peakCumulative = Math.max(peakCumulative, cumulativeReturn);
    const currentDrawdown = peakCumulative - cumulativeReturn;
    maxDrawdown = Math.max(maxDrawdown, currentDrawdown);

    const avgSign = summary.avgReturn > 0 ? "+" : "";
    const totalSign = summary.totalReturn > 0 ? "+" : "";
    console.log(
      summary.weekLabel.padEnd(12) +
      String(summary.trades).padStart(8) +
      `${avgSign}${summary.avgReturn.toFixed(2)}%`.padStart(10) +
      `${totalSign}${summary.totalReturn.toFixed(2)}%`.padStart(12) +
      best.pair.padStart(12) +
      worst.pair.padStart(13) +
      `${summary.minReturn.toFixed(2)}%`.padStart(10) +
      `${summary.maxReturn.toFixed(2)}%`.padStart(10),
    );
  }

  console.log("─".repeat(90));

  // Overall stats
  const totalAvg = weekSummaries.length > 0
    ? weekSummaries.reduce((a, b) => a + b.avgReturn, 0) / weekSummaries.length
    : 0;
  const totalAvgSign = totalAvg > 0 ? "+" : "";
  console.log(`\nOverall avg weekly return: ${totalAvgSign}${totalAvg.toFixed(3)}%`);
  console.log(`Cumulative return (avg method): ${cumulativeReturn > 0 ? "+" : ""}${cumulativeReturn.toFixed(3)}%`);
  console.log(`Max drawdown (from peak): -${maxDrawdown.toFixed(3)}%`);
  console.log(`Total trades across ${weekSummaries.length} weeks: ${allTrades.length}`);
  console.log(`Unique FX pairs traded: ${allPairs.length}`);

  // ─────────────────────────────────────────
  // Per-pair aggregate stats
  // ─────────────────────────────────────────
  console.log("\n" + "═".repeat(80));
  console.log("PER-PAIR AGGREGATE (sorted by total return)");
  console.log("═".repeat(80));
  console.log(
    "PAIR".padEnd(12) +
    "WEEKS".padStart(8) +
    "AVG RET".padStart(10) +
    "TOTAL RET".padStart(12) +
    "WIN RATE".padStart(10) +
    "MAX DD".padStart(10) +
    "BEST WK".padStart(10) +
    "WORST WK".padStart(10),
  );
  console.log("─".repeat(80));

  const pairAggregates = allPairs.map((pair) => {
    const trades = allTrades.filter((t) => t.pair === pair);
    const returns = trades.map((t) => t.signedReturnPct);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const total = returns.reduce((a, b) => a + b, 0);
    const wins = returns.filter((r) => r > 0).length;
    const winRate = (wins / returns.length) * 100;

    // Per-pair cumulative drawdown
    let cum = 0;
    let peak = 0;
    let dd = 0;
    for (const r of returns) {
      cum += r;
      peak = Math.max(peak, cum);
      dd = Math.max(dd, peak - cum);
    }

    return { pair, weeks: returns.length, avg, total, winRate, maxDd: dd, best: Math.max(...returns), worst: Math.min(...returns) };
  }).sort((a, b) => b.total - a.total);

  for (const p of pairAggregates) {
    const avgSign = p.avg > 0 ? "+" : "";
    const totalSign = p.total > 0 ? "+" : "";
    console.log(
      p.pair.padEnd(12) +
      String(p.weeks).padStart(8) +
      `${avgSign}${p.avg.toFixed(2)}%`.padStart(10) +
      `${totalSign}${p.total.toFixed(2)}%`.padStart(12) +
      `${p.winRate.toFixed(0)}%`.padStart(10) +
      `-${p.maxDd.toFixed(2)}%`.padStart(10) +
      `+${p.best.toFixed(2)}%`.padStart(10) +
      `${p.worst.toFixed(2)}%`.padStart(10),
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
