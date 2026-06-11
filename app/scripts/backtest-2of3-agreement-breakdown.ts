/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-2of3-agreement-breakdown.ts
 *
 * Description:
 * Breaks down every 2-of-3 NoComm trade by which signals agreed.
 * Tags each trade as ALL_THREE, DEALER_SENTIMENT, DEALER_STRENGTH,
 * or SENTIMENT_STRENGTH. Reports performance by agreement pair
 * and by asset class to reveal hidden edges or weak links.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import type { AssetClass } from "../src/lib/cotMarkets";

type AgreementTag = "ALL_THREE" | "DEALER_SENTIMENT" | "DEALER_STRENGTH" | "SS_DEALER_ABSENT" | "SS_DEALER_OPPOSING";

type TaggedTrade = {
  week: string;
  weekLabel: string;
  pair: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  rawReturnPct: number;
  adrNormalizedReturnPct: number;
  tag: AgreementTag;
  dealer: "LONG" | "SHORT" | "NEUTRAL";
  sentiment: "LONG" | "SHORT" | "NEUTRAL";
  strength: "LONG" | "SHORT" | "NEUTRAL";
};

type BucketStats = {
  label: string;
  trades: number;
  totalReturn: number;
  avgReturn: number;
  wins: number;
  losses: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
};

function inferAssetClass(pair: string): AssetClass {
  const upper = pair.toUpperCase();
  if (["BTCUSD", "ETHUSD"].includes(upper)) return "crypto";
  if (["XAUUSD", "XAGUSD", "WTIUSD"].includes(upper)) return "commodities";
  if (["SPXUSD", "NDXUSD", "NIKKEIUSD"].includes(upper)) return "indices";
  return "fx";
}

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function computeBucketStats(label: string, trades: TaggedTrade[]): BucketStats {
  const returns = trades.map((t) => t.adrNormalizedReturnPct);
  const wins = returns.filter((r) => r > 0).length;
  const losses = returns.filter((r) => r <= 0).length;
  const total = returns.reduce((s, r) => s + r, 0);
  return {
    label,
    trades: trades.length,
    totalReturn: total,
    avgReturn: trades.length > 0 ? total / trades.length : 0,
    wins,
    losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    bestTrade: returns.length > 0 ? Math.max(...returns) : 0,
    worstTrade: returns.length > 0 ? Math.min(...returns) : 0,
  };
}

function printTable(title: string, buckets: BucketStats[]) {
  console.log(`\n${"═".repeat(90)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(90)}`);
  console.log(
    "  " +
    "Tag".padEnd(22) +
    "Trades".padStart(8) +
    "Total %".padStart(10) +
    "Avg %".padStart(9) +
    "Win %".padStart(9) +
    "W/L".padStart(8) +
    "Best %".padStart(10) +
    "Worst %".padStart(10),
  );
  console.log(`  ${"─".repeat(86)}`);
  for (const b of buckets) {
    console.log(
      "  " +
      b.label.padEnd(22) +
      String(b.trades).padStart(8) +
      b.totalReturn.toFixed(2).padStart(10) +
      b.avgReturn.toFixed(3).padStart(9) +
      b.winRate.toFixed(1).padStart(9) +
      `${b.wins}/${b.losses}`.padStart(8) +
      b.bestTrade.toFixed(2).padStart(10) +
      b.worstTrade.toFixed(2).padStart(10),
    );
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   2-of-3 NoComm Agreement Breakdown (ADR Normalized)       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();
  const allTrades: TaggedTrade[] = [];

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);

    // Load all three signal sources
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
    const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    // Build direction maps
    const dealerMap = new Map<string, "LONG" | "SHORT">();
    for (const s of dealerSignals) {
      if (s.direction !== "NEUTRAL") dealerMap.set(s.symbol.toUpperCase(), s.direction);
    }

    const sentMap = new Map<string, "LONG" | "SHORT">();
    for (const s of sentimentSignals) {
      if (s.direction !== "NEUTRAL") sentMap.set(s.symbol.toUpperCase(), s.direction);
    }

    const strengthMap = new Map<string, { direction: "LONG" | "SHORT"; assetClass: AssetClass }>();
    for (const row of strengthRows) {
      if (row.compositeDirection !== "NEUTRAL") {
        strengthMap.set(row.pair.toUpperCase(), {
          direction: row.compositeDirection,
          assetClass: row.assetClass,
        });
      }
    }

    // Build return map
    const returnMap = new Map<string, number>();
    for (const r of weeklyReturns) {
      returnMap.set(r.symbol.toUpperCase(), r.returnPct);
    }

    // All pairs that have at least one signal
    const allPairs = new Set([...dealerMap.keys(), ...sentMap.keys(), ...strengthMap.keys()]);

    for (const pair of allPairs) {
      const de = dealerMap.get(pair) ?? null;
      const se = sentMap.get(pair) ?? null;
      const st = strengthMap.get(pair)?.direction ?? null;
      const ac = strengthMap.get(pair)?.assetClass ?? inferAssetClass(pair);

      const votes = [de, se, st].filter(Boolean) as ("LONG" | "SHORT")[];
      const longs = votes.filter((v) => v === "LONG").length;
      const shorts = votes.filter((v) => v === "SHORT").length;

      let direction: "LONG" | "SHORT" | null = null;
      if (longs >= 2) direction = "LONG";
      else if (shorts >= 2) direction = "SHORT";
      if (!direction) continue;

      // Tag which signals agreed
      const deAgrees = de === direction;
      const seAgrees = se === direction;
      const stAgrees = st === direction;

      let tag: AgreementTag;
      if (deAgrees && seAgrees && stAgrees) {
        tag = "ALL_THREE";
      } else if (deAgrees && seAgrees) {
        tag = "DEALER_SENTIMENT";
      } else if (deAgrees && stAgrees) {
        tag = "DEALER_STRENGTH";
      } else if (de === null) {
        // Sentiment + Strength agree, dealer had no opinion (neutral/absent)
        tag = "SS_DEALER_ABSENT";
      } else {
        // Sentiment + Strength agree, dealer actively opposing
        tag = "SS_DEALER_OPPOSING";
      }

      // Get return
      const rawReturn = returnMap.get(pair);
      if (rawReturn === undefined) continue;
      const directedReturn = direction === "SHORT" ? -rawReturn : rawReturn;

      // ADR normalize
      const pairAdr = getAdrPct(adrMap, pair, ac);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      const normalizedReturn = directedReturn * multiplier;

      allTrades.push({
        week: weekOpenUtc,
        weekLabel,
        pair,
        assetClass: ac,
        direction,
        rawReturnPct: directedReturn,
        adrNormalizedReturnPct: normalizedReturn,
        tag,
        dealer: de ?? "NEUTRAL",
        sentiment: se ?? "NEUTRAL",
        strength: st ?? "NEUTRAL",
      });
    }
  }

  console.log(`Total trades: ${allTrades.length}\n`);

  // ── Section 1: Overall by agreement tag ──
  const tags: AgreementTag[] = ["ALL_THREE", "DEALER_SENTIMENT", "DEALER_STRENGTH", "SS_DEALER_ABSENT", "SS_DEALER_OPPOSING"];
  const tagBuckets = tags.map((tag) =>
    computeBucketStats(tag, allTrades.filter((t) => t.tag === tag)),
  );
  tagBuckets.push(computeBucketStats("TOTAL", allTrades));
  printTable("BREAKDOWN BY AGREEMENT PAIR", tagBuckets);

  // ── Section 2: By asset class ──
  const assetClasses = ["fx", "crypto", "commodities", "indices"] as const;
  for (const ac of assetClasses) {
    const acTrades = allTrades.filter((t) => t.assetClass === ac);
    if (acTrades.length === 0) continue;
    const acBuckets = tags.map((tag) =>
      computeBucketStats(tag, acTrades.filter((t) => t.tag === tag)),
    );
    acBuckets.push(computeBucketStats("TOTAL", acTrades));
    printTable(`${ac.toUpperCase()} — BY AGREEMENT PAIR`, acBuckets);
  }

  // ── Section 3: Dealer-present vs Dealer-absent ──
  const dealerPresent = allTrades.filter((t) => t.dealer !== "NEUTRAL");
  const dealerAbsent = allTrades.filter((t) => t.dealer === "NEUTRAL");
  printTable("DEALER PRESENT vs ABSENT", [
    computeBucketStats("DEALER PRESENT", dealerPresent),
    computeBucketStats("DEALER ABSENT", dealerAbsent),
    computeBucketStats("TOTAL", allTrades),
  ]);

  // ── Section 4: Weekly breakdown by tag ──
  console.log(`\n${"═".repeat(116)}`);
  console.log("  WEEKLY RETURN BY AGREEMENT TAG (ADR Normalized %)");
  console.log(`${"═".repeat(116)}`);
  console.log(
    "  " +
    "Week".padEnd(10) +
    "ALL_THREE".padStart(12) +
    "D+S".padStart(10) +
    "D+STR".padStart(10) +
    "SS:Absent".padStart(12) +
    "SS:Oppose".padStart(12) +
    "Week Total".padStart(12) +
    "  Trades".padStart(8) +
    "  (3|DS|DSt|Abs|Opp)",
  );
  console.log(`  ${"─".repeat(112)}`);

  let runningTotal = 0;
  for (const weekOpenUtc of weeks) {
    const weekTrades = allTrades.filter((t) => t.week === weekOpenUtc);
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const byTag = (tag: AgreementTag) =>
      weekTrades.filter((t) => t.tag === tag).reduce((s, t) => s + t.adrNormalizedReturnPct, 0);
    const counts = (tag: AgreementTag) => weekTrades.filter((t) => t.tag === tag).length;

    const all3 = byTag("ALL_THREE");
    const ds = byTag("DEALER_SENTIMENT");
    const dstr = byTag("DEALER_STRENGTH");
    const ssAbsent = byTag("SS_DEALER_ABSENT");
    const ssOppose = byTag("SS_DEALER_OPPOSING");
    const weekTotal = all3 + ds + dstr + ssAbsent + ssOppose;
    runningTotal += weekTotal;

    console.log(
      "  " +
      weekLabel.padEnd(10) +
      all3.toFixed(2).padStart(12) +
      ds.toFixed(2).padStart(10) +
      dstr.toFixed(2).padStart(10) +
      ssAbsent.toFixed(2).padStart(12) +
      ssOppose.toFixed(2).padStart(12) +
      weekTotal.toFixed(2).padStart(12) +
      String(weekTrades.length).padStart(8) +
      `  (${counts("ALL_THREE")}|${counts("DEALER_SENTIMENT")}|${counts("DEALER_STRENGTH")}|${counts("SS_DEALER_ABSENT")}|${counts("SS_DEALER_OPPOSING")})`,
    );
  }
  console.log(`  ${"─".repeat(112)}`);
  console.log(`  ${"CUMULATIVE".padEnd(76)}${runningTotal.toFixed(2).padStart(12)}`);

  // ── Section 4: Signal participation rate ──
  console.log(`\n${"═".repeat(60)}`);
  console.log("  SIGNAL PARTICIPATION IN WINNING vs LOSING TRADES");
  console.log(`${"═".repeat(60)}`);

  const winners = allTrades.filter((t) => t.adrNormalizedReturnPct > 0);
  const losers = allTrades.filter((t) => t.adrNormalizedReturnPct <= 0);

  const participationRate = (trades: TaggedTrade[], signal: "dealer" | "sentiment" | "strength") => {
    const agreed = trades.filter((t) => {
      const dir = t[signal];
      return dir === t.direction;
    }).length;
    return trades.length > 0 ? (agreed / trades.length) * 100 : 0;
  };

  console.log(
    "  " +
    "Signal".padEnd(16) +
    "Win Participation".padStart(20) +
    "Loss Participation".padStart(20) +
    "Delta".padStart(10),
  );
  console.log(`  ${"─".repeat(56)}`);
  for (const signal of ["dealer", "sentiment", "strength"] as const) {
    const winPct = participationRate(winners, signal);
    const lossPct = participationRate(losers, signal);
    console.log(
      "  " +
      signal.toUpperCase().padEnd(16) +
      `${winPct.toFixed(1)}%`.padStart(20) +
      `${lossPct.toFixed(1)}%`.padStart(20) +
      `${(winPct - lossPct) >= 0 ? "+" : ""}${(winPct - lossPct).toFixed(1)}%`.padStart(10),
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
