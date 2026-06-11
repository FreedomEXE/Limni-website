/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-cot-deep-dive.ts
 *
 * Description:
 * Deep dive into dealer vs commercial forced-direction agreement.
 * Shows every pair-week: what each source says, whether they agree,
 * the magnitude scores, and the actual return. Surfaces the 24
 * agreement cases and examines what makes them special.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks, deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { readSnapshot } from "../src/lib/cotStore";
import { getCanonicalBasketWeek, filterByModel } from "../src/lib/performance/basketSource";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { MarketSnapshot } from "../src/lib/cotTypes";

type Direction = "LONG" | "SHORT";

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function normalizeLean(net: number, long: number, short: number): number {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

type PairWeekRecord = {
  week: string;
  pair: string;
  assetClass: AssetClass;
  // Dealer
  dealerBaseNet: number;
  dealerQuoteNet: number;
  dealerRawScore: number;
  dealerNormScore: number;
  dealerForcedDir: Direction | null;
  dealerCurrentDir: Direction | null; // from basket (null = neutral)
  // Commercial
  commBaseNet: number;
  commQuoteNet: number;
  commRawScore: number;
  commNormScore: number;
  commForcedDir: Direction | null;
  commCurrentDir: Direction | null;
  // Combined
  combinedRawScore: number;
  combinedNormScore: number;
  combinedDir: Direction | null;
  // Other sources
  sentDir: Direction | null;
  sentTieDir: Direction | null;
  sentLongPct: number | null;
  strDir: Direction | null;
  strScore: number;
  // Result
  returnPct: number;
  adrNormReturn: number;
  // Agreement
  forcedAgree: boolean;
};

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Deep Dive — Dealer vs Commercial Agreement Analysis      ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();
  const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];

  const allRecords: PairWeekRecord[] = [];

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
    const reportDate = deriveCotReportDate(normalizedWeek);

    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    const returnMap = new Map<string, { returnPct: number; assetClass: string }>();
    for (const r of weeklyReturns) {
      returnMap.set(r.symbol.toUpperCase(), { returnPct: r.returnPct, assetClass: r.assetClass });
    }

    // Current system directions
    const dealerSignals = filterByModel(basketWeek, "dealer");
    const commSignals = filterByModel(basketWeek, "commercial");
    const sentSignals = filterByModel(basketWeek, "sentiment");
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);

    const stdDealerMap = new Map<string, Direction | null>();
    for (const s of dealerSignals) stdDealerMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdCommMap = new Map<string, Direction | null>();
    for (const s of commSignals) stdCommMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdSentMap = new Map<string, Direction | null>();
    for (const s of sentSignals) stdSentMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdStrMap = new Map<string, { dir: Direction | null; score: number }>();
    for (const row of strengthRows) {
      stdStrMap.set(row.pair.toUpperCase(), {
        dir: row.compositeDirection === "NEUTRAL" ? null : row.compositeDirection,
        score: row.compositeScore,
      });
    }

    // Sentiment aggregates
    const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const close = open.plus({ days: 7 });
    const aggregates = await getAggregatesForWeekStartWithBackfill(
      open.toUTC().toISO()!, close.toUTC().toISO()!,
    );
    const aggMap = new Map(aggregates.map((a) => [a.symbol.toUpperCase(), a]));

    // COT snapshots
    for (const ac of ASSET_CLASSES) {
      const snapshot = await readSnapshot({ assetClass: ac, reportDate });
      if (!snapshot) continue;

      const pairDefs = PAIRS_BY_ASSET_CLASS[ac] ?? [];
      for (const pd of pairDefs) {
        const bm = snapshot.currencies[pd.base];
        const qm = snapshot.currencies[pd.quote];
        if (!bm || !qm) continue;

        const pair = pd.pair.toUpperCase();

        // Dealer scores
        const dBaseNet = bm.dealer_net;
        const dQuoteNet = qm.dealer_net;
        const dBaseNorm = normalizeLean(bm.dealer_net, bm.dealer_long, bm.dealer_short);
        const dQuoteNorm = normalizeLean(qm.dealer_net, qm.dealer_long, qm.dealer_short);

        // Commercial scores
        const cBaseNet = bm.commercial_net ?? 0;
        const cQuoteNet = qm.commercial_net ?? 0;
        const cBaseNorm = normalizeLean(
          bm.commercial_net ?? 0, bm.commercial_long ?? 0, bm.commercial_short ?? 0,
        );
        const cQuoteNorm = normalizeLean(
          qm.commercial_net ?? 0, qm.commercial_long ?? 0, qm.commercial_short ?? 0,
        );

        let dealerRawScore: number, dealerNormScore: number;
        let commRawScore: number, commNormScore: number;

        if (ac === "fx") {
          dealerRawScore = dBaseNet - dQuoteNet;
          dealerNormScore = dBaseNorm - dQuoteNorm;
          commRawScore = cBaseNet - cQuoteNet;
          commNormScore = cBaseNorm - cQuoteNorm;
        } else {
          dealerRawScore = dBaseNet;
          dealerNormScore = dBaseNorm;
          commRawScore = cBaseNet;
          commNormScore = cBaseNorm;
        }

        const combinedRawScore = dealerRawScore + commRawScore;
        const combinedNormScore = dealerNormScore + commNormScore;

        function scoreToDir(s: number): Direction | null {
          return s > 0 ? "LONG" : s < 0 ? "SHORT" : null;
        }

        const dealerForcedDir = scoreToDir(dealerRawScore);
        const commForcedDir = scoreToDir(commRawScore);

        // Sentiment
        const agg = aggMap.get(pair);
        const sentDir = stdSentMap.get(pair) ?? null;
        let sentTieDir: Direction | null = sentDir;
        if (sentDir === null && agg && agg.agg_long_pct !== 50) {
          sentTieDir = agg.agg_long_pct > 50 ? "SHORT" : "LONG";
        }

        // Strength
        const strData = stdStrMap.get(pair);

        // Return
        const retData = returnMap.get(pair);
        const rawRet = retData?.returnPct ?? 0;
        const pairAdr = retData ? getAdrPct(adrMap, pair, retData.assetClass) : 1;
        const adrMult = pairAdr > 0 ? targetAdr / pairAdr : 1;

        // For ADR norm return we need a direction — use combined forced dir
        const dirForReturn = scoreToDir(combinedRawScore);
        const directedRet = dirForReturn === "SHORT" ? -rawRet : rawRet;
        const adrNormReturn = directedRet * adrMult;

        const forcedAgree = dealerForcedDir !== null && commForcedDir !== null && dealerForcedDir === commForcedDir;

        allRecords.push({
          week: weekLabel,
          pair,
          assetClass: ac,
          dealerBaseNet: dBaseNet,
          dealerQuoteNet: dQuoteNet,
          dealerRawScore,
          dealerNormScore,
          commBaseNet: cBaseNet,
          commQuoteNet: cQuoteNet,
          commRawScore,
          commNormScore,
          dealerForcedDir,
          dealerCurrentDir: stdDealerMap.get(pair) ?? null,
          commForcedDir,
          commCurrentDir: stdCommMap.get(pair) ?? null,
          combinedRawScore,
          combinedNormScore,
          combinedDir: scoreToDir(combinedRawScore),
          sentDir,
          sentTieDir,
          sentLongPct: agg?.agg_long_pct ?? null,
          strDir: strData?.dir ?? null,
          strScore: strData?.score ?? 0,
          returnPct: rawRet,
          adrNormReturn,
          forcedAgree,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: The 24 agreements
  // ═══════════════════════════════════════════════════════════════

  const agrees = allRecords.filter((r) => r.forcedAgree);
  const disagrees = allRecords.filter((r) => !r.forcedAgree && r.dealerForcedDir !== null && r.commForcedDir !== null);

  console.log(`\n${"═".repeat(120)}`);
  console.log(`  THE ${agrees.length} AGREEMENTS — When Dealer and Commercial Both Lean Same Way`);
  console.log(`${"═".repeat(120)}`);
  console.log(
    "  " +
    "Week".padEnd(8) +
    "Pair".padEnd(12) +
    "Dir".padEnd(6) +
    "D:Raw".padStart(10) +
    "D:Norm".padStart(8) +
    "C:Raw".padStart(10) +
    "C:Norm".padStart(8) +
    "Comb".padStart(10) +
    "Sent".padStart(6) +
    "Str".padStart(6) +
    "Align".padStart(6) +
    "Ret%".padStart(8) +
    "W/L".padStart(5),
  );
  console.log(`  ${"─".repeat(116)}`);

  let agreeWins = 0;
  let agreeTotal = 0;
  let agreeTrades = 0;

  for (const r of agrees.sort((a, b) => a.week.localeCompare(b.week) || a.pair.localeCompare(b.pair))) {
    const dir = r.dealerForcedDir!;
    const directedRet = dir === "SHORT" ? -r.returnPct : r.returnPct;

    // How many of 4 sources align with the agreed direction?
    let alignCount = 2; // dealer + commercial
    if (r.sentTieDir === dir) alignCount++;
    if (r.strDir === dir) alignCount++;

    const marker = directedRet > 0 ? "W" : "L";
    if (directedRet > 0) agreeWins++;
    agreeTotal += directedRet;
    agreeTrades++;

    console.log(
      "  " +
      r.week.padEnd(8) +
      r.pair.padEnd(12) +
      dir.padEnd(6) +
      r.dealerRawScore.toLocaleString().padStart(10) +
      r.dealerNormScore.toFixed(3).padStart(8) +
      r.commRawScore.toLocaleString().padStart(10) +
      r.commNormScore.toFixed(3).padStart(8) +
      r.combinedRawScore.toLocaleString().padStart(10) +
      (r.sentTieDir ?? "—").padStart(6) +
      (r.strDir ?? "—").padStart(6) +
      `${alignCount}/4`.padStart(6) +
      `${directedRet >= 0 ? "+" : ""}${directedRet.toFixed(2)}`.padStart(8) +
      marker.padStart(5),
    );
  }

  const agreeWR = agreeTrades > 0 ? ((agreeWins / agreeTrades) * 100).toFixed(1) : "0.0";
  console.log(`\n  AGREE summary: ${agreeTrades} trades, ${agreeWins}W/${agreeTrades - agreeWins}L (${agreeWR}% WR), Total: ${agreeTotal >= 0 ? "+" : ""}${agreeTotal.toFixed(2)}%`);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: Agreement by 4-source alignment count
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  ALL TRADES BY SOURCE ALIGNMENT COUNT (forced directions)");
  console.log(`${"═".repeat(100)}`);

  // For each pair-week, count how many of 4 forced sources agree on the majority direction
  const buckets: Record<string, { trades: number; wins: number; total: number; pairs: string[] }> = {
    "4/4 all agree": { trades: 0, wins: 0, total: 0, pairs: [] },
    "3/4 majority": { trades: 0, wins: 0, total: 0, pairs: [] },
    "2/2 split": { trades: 0, wins: 0, total: 0, pairs: [] },
  };

  for (const r of allRecords) {
    const dirs = [r.dealerForcedDir, r.commForcedDir, r.sentTieDir, r.strDir].filter((d) => d !== null);
    if (dirs.length < 4) continue; // skip if any source missing

    const longCount = dirs.filter((d) => d === "LONG").length;
    const shortCount = dirs.filter((d) => d === "SHORT").length;

    let bucket: string;
    let majorityDir: Direction;

    if (longCount === 4 || shortCount === 4) {
      bucket = "4/4 all agree";
      majorityDir = longCount === 4 ? "LONG" : "SHORT";
    } else if (longCount === 3 || shortCount === 3) {
      bucket = "3/4 majority";
      majorityDir = longCount === 3 ? "LONG" : "SHORT";
    } else {
      bucket = "2/2 split";
      majorityDir = "LONG"; // arbitrary for split
    }

    const directedRet = majorityDir === "SHORT" ? -r.returnPct : r.returnPct;
    const b = buckets[bucket]!;
    b.trades++;
    if (directedRet > 0) b.wins++;
    b.total += directedRet;
    if (!b.pairs.includes(r.pair)) b.pairs.push(r.pair);
  }

  console.log(
    "  " +
    "Bucket".padEnd(20) +
    "Trades".padStart(8) +
    "Wins".padStart(8) +
    "Win%".padStart(8) +
    "Total%".padStart(10) +
    "Avg%".padStart(8) +
    "Pairs".padStart(8),
  );
  console.log(`  ${"─".repeat(68)}`);

  for (const [label, b] of Object.entries(buckets)) {
    const wr = b.trades > 0 ? ((b.wins / b.trades) * 100).toFixed(1) : "0.0";
    const avg = b.trades > 0 ? (b.total / b.trades).toFixed(3) : "0.000";
    console.log(
      "  " +
      label.padEnd(20) +
      String(b.trades).padStart(8) +
      String(b.wins).padStart(8) +
      wr.padStart(8) +
      `${b.total >= 0 ? "+" : ""}${b.total.toFixed(2)}`.padStart(10) +
      avg.padStart(8) +
      String(b.pairs.length).padStart(8),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: Pair-level breakdown — which pairs agree most?
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  PAIR-LEVEL: HOW OFTEN DO DEALER AND COMMERCIAL AGREE? (forced direction)");
  console.log(`${"═".repeat(100)}`);

  const pairStats = new Map<string, { agree: number; disagree: number; agreeRet: number; disagreeRet: number }>();

  for (const r of allRecords) {
    if (r.dealerForcedDir === null || r.commForcedDir === null) continue;
    const key = r.pair;
    if (!pairStats.has(key)) pairStats.set(key, { agree: 0, disagree: 0, agreeRet: 0, disagreeRet: 0 });
    const s = pairStats.get(key)!;

    const directedRet = r.dealerForcedDir === "SHORT" ? -r.returnPct : r.returnPct;

    if (r.forcedAgree) {
      s.agree++;
      s.agreeRet += directedRet;
    } else {
      s.disagree++;
      // Use dealer direction for disagree ret
      s.disagreeRet += directedRet;
    }
  }

  console.log(
    "  " +
    "Pair".padEnd(12) +
    "Agree".padStart(7) +
    "Disagr".padStart(8) +
    "Rate".padStart(7) +
    "AgreeRet".padStart(10) +
    "DisagRet".padStart(10) +
    "Pattern".padStart(50),
  );
  console.log(`  ${"─".repeat(102)}`);

  const sortedPairs = [...pairStats.entries()].sort((a, b) => b[1].agree - a[1].agree);
  for (const [pair, s] of sortedPairs) {
    const total = s.agree + s.disagree;
    const rate = total > 0 ? ((s.agree / total) * 100).toFixed(0) : "0";

    // Find the records for this pair to show week-by-week pattern
    const pairRecords = allRecords.filter((r) => r.pair === pair && r.dealerForcedDir !== null);
    const pattern = pairRecords.map((r) => {
      if (r.forcedAgree) return `${r.week.slice(0, 3)}${r.week.slice(-2)}:✓`;
      return `${r.week.slice(0, 3)}${r.week.slice(-2)}:✗`;
    }).join(" ");

    console.log(
      "  " +
      pair.padEnd(12) +
      String(s.agree).padStart(7) +
      String(s.disagree).padStart(8) +
      `${rate}%`.padStart(7) +
      `${s.agreeRet >= 0 ? "+" : ""}${s.agreeRet.toFixed(2)}`.padStart(10) +
      `${s.disagreeRet >= 0 ? "+" : ""}${s.disagreeRet.toFixed(2)}`.padStart(10) +
      pattern.padStart(50),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: Magnitude analysis — how big is the lean when they agree?
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  MAGNITUDE ANALYSIS — Agree vs Disagree");
  console.log(`${"═".repeat(100)}`);

  const agreeNormScores = agrees.map((r) => Math.abs(r.combinedNormScore));
  const disagreeNormScores = disagrees.map((r) => Math.abs(r.combinedNormScore));
  const agreeRawScores = agrees.map((r) => Math.abs(r.combinedRawScore));
  const disagreeRawScores = disagrees.map((r) => Math.abs(r.combinedRawScore));

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };

  console.log(`  AGREE (${agrees.length} cases):`);
  console.log(`    Combined raw score  — avg: ${avg(agreeRawScores).toLocaleString()} | median: ${median(agreeRawScores).toLocaleString()}`);
  console.log(`    Combined norm score — avg: ${avg(agreeNormScores).toFixed(4)} | median: ${median(agreeNormScores).toFixed(4)}`);
  console.log(`  DISAGREE (${disagrees.length} cases):`);
  console.log(`    Combined raw score  — avg: ${avg(disagreeRawScores).toLocaleString()} | median: ${median(disagreeRawScores).toLocaleString()}`);
  console.log(`    Combined norm score — avg: ${avg(disagreeNormScores).toFixed(4)} | median: ${median(disagreeNormScores).toFixed(4)}`);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: Disagree cases — show a sample with full data
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(120)}`);
  console.log("  DISAGREE SAMPLE — First week detail (all pairs)");
  console.log(`${"═".repeat(120)}`);

  const firstWeek = buildWeekLabel(weeks[0]!);
  const firstWeekRecords = allRecords.filter((r) => r.week === firstWeek);

  console.log(
    "  " +
    "Pair".padEnd(12) +
    "D:Dir".padEnd(7) +
    "D:Raw".padStart(10) +
    "C:Dir".padEnd(7).padStart(9) +
    "C:Raw".padStart(10) +
    "Comb".padStart(10) +
    "CmbDir".padStart(7) +
    "Sent".padStart(6) +
    "Str".padStart(6) +
    "Ret%".padStart(8) +
    "Agr?".padStart(5),
  );
  console.log(`  ${"─".repeat(98)}`);

  for (const r of firstWeekRecords.sort((a, b) => a.pair.localeCompare(b.pair))) {
    const dDir = r.dealerForcedDir ?? "—";
    const cDir = r.commForcedDir ?? "—";
    const combDir = r.combinedDir ?? "—";
    console.log(
      "  " +
      r.pair.padEnd(12) +
      dDir.padEnd(7) +
      r.dealerRawScore.toLocaleString().padStart(10) +
      cDir.padEnd(7).padStart(9) +
      r.commRawScore.toLocaleString().padStart(10) +
      r.combinedRawScore.toLocaleString().padStart(10) +
      combDir.padStart(7) +
      (r.sentTieDir ?? "—").padStart(6) +
      (r.strDir ?? "—").padStart(6) +
      `${r.returnPct >= 0 ? "+" : ""}${r.returnPct.toFixed(2)}`.padStart(8) +
      (r.forcedAgree ? "YES" : "no").padStart(5),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 6: What if we only trade the 4/4 and 3/4 cases?
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  SYSTEM: Trade Only When 3/4 or 4/4 Sources Agree (forced directions)");
  console.log(`${"═".repeat(100)}`);

  type WeekEntry = { weekLabel: string; ret: number; trades: number; wins: number; losses: number };
  const system3of4: WeekEntry[] = [];
  const system4of4: WeekEntry[] = [];
  const systemDealerCotAgree: WeekEntry[] = [];

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const weekRecords = allRecords.filter((r) => r.week === weekLabel);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    const acc3 = { ret: 0, trades: 0, wins: 0, losses: 0 };
    const acc4 = { ret: 0, trades: 0, wins: 0, losses: 0 };
    const accDCA = { ret: 0, trades: 0, wins: 0, losses: 0 };

    for (const r of weekRecords) {
      const dirs = [r.dealerForcedDir, r.commForcedDir, r.sentTieDir, r.strDir].filter((d) => d !== null);
      if (dirs.length < 4) continue;

      const longCount = dirs.filter((d) => d === "LONG").length;
      const shortCount = dirs.filter((d) => d === "SHORT").length;
      const maxCount = Math.max(longCount, shortCount);
      const majorityDir: Direction = longCount >= shortCount ? "LONG" : "SHORT";

      const pairAdr = getAdrPct(adrMap, r.pair, r.assetClass);
      const mult = pairAdr > 0 ? targetAdr / pairAdr : 1;
      const directedRet = (majorityDir === "SHORT" ? -r.returnPct : r.returnPct) * mult;

      if (maxCount >= 3) {
        acc3.ret += directedRet;
        acc3.trades++;
        if (directedRet > 0) acc3.wins++; else acc3.losses++;
      }

      if (maxCount === 4) {
        acc4.ret += directedRet;
        acc4.trades++;
        if (directedRet > 0) acc4.wins++; else acc4.losses++;
      }

      // Dealer + Commercial agree system (only trade forced-agree pairs, in agreed direction)
      if (r.forcedAgree && r.dealerForcedDir) {
        const ret2 = (r.dealerForcedDir === "SHORT" ? -r.returnPct : r.returnPct) * mult;
        accDCA.ret += ret2;
        accDCA.trades++;
        if (ret2 > 0) accDCA.wins++; else accDCA.losses++;
      }
    }

    system3of4.push({ weekLabel, ...acc3 });
    system4of4.push({ weekLabel, ...acc4 });
    systemDealerCotAgree.push({ weekLabel, ...accDCA });
  }

  console.log(
    "  " +
    "System".padEnd(30) +
    "Trades".padStart(8) +
    "Total %".padStart(10) +
    "Max DD %".padStart(10) +
    "R/DD".padStart(8) +
    "Win %".padStart(8) +
    "Worst Wk".padStart(10),
  );
  console.log(`  ${"─".repeat(82)}`);

  function printRowLocal(label: string, entries: WeekEntry[]) {
    let cum = 0, peak = 0, maxDD = 0;
    for (const e of entries) {
      cum += e.ret;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
    }
    const totalTrades = entries.reduce((s, e) => s + e.trades, 0);
    const totalWins = entries.reduce((s, e) => s + e.wins, 0);
    const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : "0.0";
    const worstWeek = entries.length > 0 ? Math.min(...entries.map((e) => e.ret)) : 0;
    console.log(
      "  " + label.padEnd(30) +
      String(totalTrades).padStart(8) +
      cum.toFixed(2).padStart(10) +
      maxDD.toFixed(2).padStart(10) +
      (maxDD > 0 ? (cum / maxDD).toFixed(1) : "∞").padStart(8) +
      winRate.padStart(8) +
      worstWeek.toFixed(2).padStart(10),
    );
  }

  printRowLocal("3/4+ Majority (forced)", system3of4);
  printRowLocal("4/4 Unanimous (forced)", system4of4);
  printRowLocal("Dealer+Comm Agree Only", systemDealerCotAgree);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
