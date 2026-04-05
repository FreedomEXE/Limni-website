/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-veto-sleeves.ts
 *
 * Description:
 * Veto-filtered sleeve system. Each source (dealer, sentiment, strength)
 * keeps ownership of its trades. A trade is only vetoed if the other TWO
 * sources both actively disagree (neutral = no opinion, not opposition).
 *
 * Reports:
 *   1. Standalone baselines (raw dealer / sentiment / strength)
 *   2. Vetoed standalone (each minus unanimous 2-against opposition)
 *   3. Combined basket (union of vetoed sleeves, deduped, conflicts dropped)
 *   4. Comparison vs 2-of-3 NoComm
 *   5. Weekly breakdown of combined basket
 *   6. Asset class breakdown
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

type Direction = "LONG" | "SHORT";

type SleeveTrade = {
  week: string;
  weekLabel: string;
  pair: string;
  assetClass: string;
  direction: Direction;
  rawReturnPct: number;
  adrNormalizedReturnPct: number;
  source: "dealer" | "sentiment" | "strength";
  vetoed: boolean;
  vetoReason: string | null;
};

type CombinedTrade = {
  week: string;
  weekLabel: string;
  pair: string;
  assetClass: string;
  direction: Direction;
  rawReturnPct: number;
  adrNormalizedReturnPct: number;
  conviction: number; // 1, 2, or 3 sleeves agree
  sources: string[];
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

function computeStats(label: string, returns: number[]): BucketStats {
  const wins = returns.filter((r) => r > 0).length;
  const losses = returns.filter((r) => r <= 0).length;
  const total = returns.reduce((s, r) => s + r, 0);
  return {
    label,
    trades: returns.length,
    totalReturn: total,
    avgReturn: returns.length > 0 ? total / returns.length : 0,
    wins,
    losses,
    winRate: returns.length > 0 ? (wins / returns.length) * 100 : 0,
    bestTrade: returns.length > 0 ? Math.max(...returns) : 0,
    worstTrade: returns.length > 0 ? Math.min(...returns) : 0,
  };
}

function printTable(title: string, buckets: BucketStats[]) {
  console.log(`\n${"═".repeat(94)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(94)}`);
  console.log(
    "  " +
    "Strategy".padEnd(26) +
    "Trades".padStart(8) +
    "Total %".padStart(10) +
    "Avg %".padStart(9) +
    "Win %".padStart(9) +
    "W/L".padStart(8) +
    "Best %".padStart(10) +
    "Worst %".padStart(10),
  );
  console.log(`  ${"─".repeat(90)}`);
  for (const b of buckets) {
    console.log(
      "  " +
      b.label.padEnd(26) +
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
  console.log("║   Veto-Filtered Sleeve System (ADR Normalized)             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();

  // Accumulators
  const allSleeveTrades: SleeveTrade[] = [];
  const allCombinedTrades: CombinedTrade[] = [];
  const all2of3Trades: CombinedTrade[] = []; // for comparison

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);

    // Load signals
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
    const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    // Direction maps: null means neutral/absent
    const dealerMap = new Map<string, Direction | null>();
    const sentMap = new Map<string, Direction | null>();
    const strengthMap = new Map<string, { direction: Direction | null; assetClass: AssetClass }>();

    // Populate with non-neutral signals
    for (const s of dealerSignals) {
      dealerMap.set(s.symbol.toUpperCase(), s.direction as Direction);
    }
    for (const s of sentimentSignals) {
      sentMap.set(s.symbol.toUpperCase(), s.direction as Direction);
    }
    for (const row of strengthRows) {
      strengthMap.set(row.pair.toUpperCase(), {
        direction: row.compositeDirection !== "NEUTRAL" ? row.compositeDirection : null,
        assetClass: row.assetClass,
      });
    }

    // Return map
    const returnMap = new Map<string, number>();
    for (const r of weeklyReturns) {
      returnMap.set(r.symbol.toUpperCase(), r.returnPct);
    }

    // All known pairs
    const allPairs = new Set([...dealerMap.keys(), ...sentMap.keys(), ...strengthMap.keys()]);

    // Helper: compute directed + ADR-normalized return
    function getReturn(pair: string, direction: Direction, ac: AssetClass) {
      const raw = returnMap.get(pair);
      if (raw === undefined) return null;
      const directed = direction === "SHORT" ? -raw : raw;
      const pairAdr = getAdrPct(adrMap, pair, ac);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      return { rawReturnPct: directed, adrNormalizedReturnPct: directed * multiplier };
    }

    // ── Build vetoed sleeves ──

    for (const pair of allPairs) {
      const de = dealerMap.get(pair) ?? null;
      const se = sentMap.get(pair) ?? null;
      const st = strengthMap.get(pair)?.direction ?? null;
      const ac = strengthMap.get(pair)?.assetClass ?? inferAssetClass(pair);

      const sources = [
        { name: "dealer" as const, dir: de, other1Dir: se, other2Dir: st },
        { name: "sentiment" as const, dir: se, other1Dir: de, other2Dir: st },
        { name: "strength" as const, dir: st, other1Dir: de, other2Dir: se },
      ];

      for (const { name, dir, other1Dir, other2Dir } of sources) {
        if (!dir) continue; // no signal = no trade in this sleeve

        const ret = getReturn(pair, dir, ac);
        if (!ret) continue;

        // Veto: both others actively disagree (not null/neutral — actually opposing)
        const other1Opposes = other1Dir !== null && other1Dir !== dir;
        const other2Opposes = other2Dir !== null && other2Dir !== dir;
        const vetoed = other1Opposes && other2Opposes;

        allSleeveTrades.push({
          week: weekOpenUtc,
          weekLabel,
          pair,
          assetClass: ac,
          direction: dir,
          rawReturnPct: ret.rawReturnPct,
          adrNormalizedReturnPct: ret.adrNormalizedReturnPct,
          source: name,
          vetoed,
          vetoReason: vetoed ? `${name} ${dir} vetoed by unanimous opposition` : null,
        });
      }

      // ── Build combined basket (merge vetoed sleeves) ──

      // Collect surviving directions from each sleeve
      const surviving: { source: string; direction: Direction }[] = [];

      if (de) {
        const seOpposes = se !== null && se !== de;
        const stOpposes = st !== null && st !== de;
        if (!(seOpposes && stOpposes)) surviving.push({ source: "dealer", direction: de });
      }
      if (se) {
        const deOpposes = de !== null && de !== se;
        const stOpposes = st !== null && st !== se;
        if (!(deOpposes && stOpposes)) surviving.push({ source: "sentiment", direction: se });
      }
      if (st) {
        const deOpposes = de !== null && de !== st;
        const seOpposes = se !== null && se !== st;
        if (!(deOpposes && seOpposes)) surviving.push({ source: "strength", direction: st });
      }

      if (surviving.length === 0) continue;

      // Check for conflicting directions among survivors
      const longSources = surviving.filter((s) => s.direction === "LONG");
      const shortSources = surviving.filter((s) => s.direction === "SHORT");

      if (longSources.length > 0 && shortSources.length > 0) {
        // Conflict among survivors — drop the pair
        continue;
      }

      const combinedDir = surviving[0]!.direction;
      const ret = getReturn(pair, combinedDir, ac);
      if (!ret) continue;

      allCombinedTrades.push({
        week: weekOpenUtc,
        weekLabel,
        pair,
        assetClass: ac,
        direction: combinedDir,
        rawReturnPct: ret.rawReturnPct,
        adrNormalizedReturnPct: ret.adrNormalizedReturnPct,
        conviction: surviving.length,
        sources: surviving.map((s) => s.source),
      });

      // ── Also compute 2-of-3 NoComm for comparison ──

      const votes = [de, se, st].filter(Boolean) as Direction[];
      const longs = votes.filter((v) => v === "LONG").length;
      const shorts = votes.filter((v) => v === "SHORT").length;
      let dir2of3: Direction | null = null;
      if (longs >= 2) dir2of3 = "LONG";
      else if (shorts >= 2) dir2of3 = "SHORT";

      if (dir2of3) {
        const ret2 = getReturn(pair, dir2of3, ac);
        if (ret2) {
          // Avoid duplicating — only add if not already added for this week+pair
          const existing = all2of3Trades.find((t) => t.week === weekOpenUtc && t.pair === pair);
          if (!existing) {
            all2of3Trades.push({
              week: weekOpenUtc,
              weekLabel,
              pair,
              assetClass: ac,
              direction: dir2of3,
              rawReturnPct: ret2.rawReturnPct,
              adrNormalizedReturnPct: ret2.adrNormalizedReturnPct,
              conviction: [de, se, st].filter((v) => v === dir2of3).length,
              sources: [],
            });
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: Standalone baselines vs vetoed
  // ═══════════════════════════════════════════════════════════════

  const sleeveNames = ["dealer", "sentiment", "strength"] as const;

  const baselineBuckets: BucketStats[] = [];
  const vetoedBuckets: BucketStats[] = [];
  const deltaRows: { name: string; baselineAvg: number; vetoedAvg: number; baselineWR: number; vetoedWR: number; removed: number }[] = [];

  for (const name of sleeveNames) {
    const all = allSleeveTrades.filter((t) => t.source === name);
    const kept = all.filter((t) => !t.vetoed);
    const removed = all.filter((t) => t.vetoed);

    const baseStats = computeStats(`${name} (raw)`, all.map((t) => t.adrNormalizedReturnPct));
    const vetoStats = computeStats(`${name} (vetoed)`, kept.map((t) => t.adrNormalizedReturnPct));
    const removedStats = computeStats(`  removed`, removed.map((t) => t.adrNormalizedReturnPct));

    baselineBuckets.push(baseStats);
    vetoedBuckets.push(vetoStats);
    vetoedBuckets.push(removedStats);

    deltaRows.push({
      name,
      baselineAvg: baseStats.avgReturn,
      vetoedAvg: vetoStats.avgReturn,
      baselineWR: baseStats.winRate,
      vetoedWR: vetoStats.winRate,
      removed: removed.length,
    });
  }

  printTable("STANDALONE BASELINES (each source alone)", baselineBuckets);
  printTable("VETOED SLEEVES (minus unanimous 2-against opposition)", vetoedBuckets);

  // Delta summary
  console.log(`\n${"═".repeat(80)}`);
  console.log("  VETO IMPROVEMENT SUMMARY");
  console.log(`${"═".repeat(80)}`);
  console.log(
    "  " +
    "Source".padEnd(14) +
    "Raw Avg".padStart(10) +
    "Vetoed Avg".padStart(12) +
    "Δ Avg".padStart(10) +
    "Raw WR".padStart(10) +
    "Vetoed WR".padStart(12) +
    "Δ WR".padStart(10) +
    "Removed".padStart(10),
  );
  console.log(`  ${"─".repeat(76)}`);
  for (const d of deltaRows) {
    const avgDelta = d.vetoedAvg - d.baselineAvg;
    const wrDelta = d.vetoedWR - d.baselineWR;
    console.log(
      "  " +
      d.name.toUpperCase().padEnd(14) +
      d.baselineAvg.toFixed(3).padStart(10) +
      d.vetoedAvg.toFixed(3).padStart(12) +
      `${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(3)}`.padStart(10) +
      `${d.baselineWR.toFixed(1)}%`.padStart(10) +
      `${d.vetoedWR.toFixed(1)}%`.padStart(12) +
      `${wrDelta >= 0 ? "+" : ""}${wrDelta.toFixed(1)}%`.padStart(10) +
      String(d.removed).padStart(10),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: Combined basket vs 2-of-3 NoComm
  // ═══════════════════════════════════════════════════════════════

  const combinedReturns = allCombinedTrades.map((t) => t.adrNormalizedReturnPct);
  const nocommReturns = all2of3Trades.map((t) => t.adrNormalizedReturnPct);

  printTable("COMBINED BASKET vs 2-of-3 NoComm", [
    computeStats("Veto Sleeves Combined", combinedReturns),
    computeStats("2-of-3 NoComm", nocommReturns),
  ]);

  // ── Combined by conviction level ──
  const conv1 = allCombinedTrades.filter((t) => t.conviction === 1).map((t) => t.adrNormalizedReturnPct);
  const conv2 = allCombinedTrades.filter((t) => t.conviction === 2).map((t) => t.adrNormalizedReturnPct);
  const conv3 = allCombinedTrades.filter((t) => t.conviction === 3).map((t) => t.adrNormalizedReturnPct);

  printTable("COMBINED BASKET BY CONVICTION", [
    computeStats("1 sleeve", conv1),
    computeStats("2 sleeves", conv2),
    computeStats("3 sleeves", conv3),
    computeStats("TOTAL", combinedReturns),
  ]);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: Combined basket by asset class
  // ═══════════════════════════════════════════════════════════════

  const assetClasses = ["fx", "crypto", "commodities", "indices"] as const;
  for (const ac of assetClasses) {
    const acTrades = allCombinedTrades.filter((t) => t.assetClass === ac);
    if (acTrades.length === 0) continue;
    const acNocomm = all2of3Trades.filter((t) => t.assetClass === ac);
    printTable(`${ac.toUpperCase()} — VETO COMBINED vs 2-of-3`, [
      computeStats("Veto Combined", acTrades.map((t) => t.adrNormalizedReturnPct)),
      computeStats("2-of-3 NoComm", acNocomm.map((t) => t.adrNormalizedReturnPct)),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: Weekly breakdown of combined basket
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  WEEKLY RETURNS: VETO COMBINED vs 2-of-3 NoComm (ADR Normalized %)");
  console.log(`${"═".repeat(100)}`);
  console.log(
    "  " +
    "Week".padEnd(10) +
    "Veto Comb".padStart(12) +
    "2of3 NC".padStart(10) +
    "Delta".padStart(10) +
    "Veto Trds".padStart(10) +
    "NC Trds".padStart(10) +
    "  Conv (1|2|3)",
  );
  console.log(`  ${"─".repeat(96)}`);

  let vetoRunning = 0;
  let ncRunning = 0;

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const vetoWeek = allCombinedTrades.filter((t) => t.week === weekOpenUtc);
    const ncWeek = all2of3Trades.filter((t) => t.week === weekOpenUtc);

    const vetoTotal = vetoWeek.reduce((s, t) => s + t.adrNormalizedReturnPct, 0);
    const ncTotal = ncWeek.reduce((s, t) => s + t.adrNormalizedReturnPct, 0);
    vetoRunning += vetoTotal;
    ncRunning += ncTotal;

    const c1 = vetoWeek.filter((t) => t.conviction === 1).length;
    const c2 = vetoWeek.filter((t) => t.conviction === 2).length;
    const c3 = vetoWeek.filter((t) => t.conviction === 3).length;

    console.log(
      "  " +
      weekLabel.padEnd(10) +
      vetoTotal.toFixed(2).padStart(12) +
      ncTotal.toFixed(2).padStart(10) +
      `${(vetoTotal - ncTotal) >= 0 ? "+" : ""}${(vetoTotal - ncTotal).toFixed(2)}`.padStart(10) +
      String(vetoWeek.length).padStart(10) +
      String(ncWeek.length).padStart(10) +
      `  (${c1}|${c2}|${c3})`,
    );
  }
  console.log(`  ${"─".repeat(96)}`);
  console.log(
    "  " +
    "CUMULATIVE".padEnd(10) +
    vetoRunning.toFixed(2).padStart(12) +
    ncRunning.toFixed(2).padStart(10) +
    `${(vetoRunning - ncRunning) >= 0 ? "+" : ""}${(vetoRunning - ncRunning).toFixed(2)}`.padStart(10),
  );

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: What got vetoed (the trades that were removed)
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(80)}`);
  console.log("  VETOED TRADES ANALYSIS (would these have been winners or losers?)");
  console.log(`${"═".repeat(80)}`);

  for (const name of sleeveNames) {
    const removed = allSleeveTrades.filter((t) => t.source === name && t.vetoed);
    if (removed.length === 0) {
      console.log(`\n  ${name.toUpperCase()}: 0 trades vetoed`);
      continue;
    }
    const wins = removed.filter((t) => t.adrNormalizedReturnPct > 0).length;
    const losses = removed.length - wins;
    const total = removed.reduce((s, t) => s + t.adrNormalizedReturnPct, 0);
    console.log(
      `\n  ${name.toUpperCase()}: ${removed.length} vetoed — ` +
      `${wins}W/${losses}L (${((wins / removed.length) * 100).toFixed(1)}% WR) — ` +
      `Total: ${total >= 0 ? "+" : ""}${total.toFixed(2)}% — ` +
      `Avg: ${(total / removed.length).toFixed(3)}%`,
    );
    // Show each vetoed trade
    for (const t of removed.sort((a, b) => a.week.localeCompare(b.week))) {
      const marker = t.adrNormalizedReturnPct > 0 ? "✓" : "✗";
      console.log(
        `    ${marker} ${t.weekLabel.padEnd(8)} ${t.pair.padEnd(12)} ${t.direction.padEnd(6)} ${t.adrNormalizedReturnPct >= 0 ? "+" : ""}${t.adrNormalizedReturnPct.toFixed(3)}%`,
      );
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
