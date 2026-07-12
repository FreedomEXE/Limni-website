/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-cot-combined.ts
 *
 * Description:
 * Tests the hypothesis that dealer + commercial should be merged into
 * a single "COT" source rather than treated as independent signals.
 *
 * Tests 7 COT variants (all force direction on every pair):
 *   1. Dealer Current     — existing system with neutrals
 *   2. Dealer Forced Raw  — pair_score = base_net - quote_net
 *   3. Dealer Forced Norm — pair_score = base_norm - quote_norm (net/OI)
 *   4. Commercial Current — existing system with neutrals
 *   5. Comm Forced Raw    — pair_score = base_net - quote_net
 *   6. Comm Forced Norm   — pair_score = base_norm - quote_norm
 *   7. COT Combined Raw   — dealer_pair_score + comm_pair_score
 *   8. COT Combined Norm  — dealer_norm_score + comm_norm_score
 *
 * Then tests veto in two architectures:
 *   A. 4-source veto (current): dealer, commercial, sentiment, strength
 *   B. 3-source veto (combined): COT_combined, sentiment, strength
 *
 * All ADR-normalized, 10-week backtest.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks, deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { readSnapshot } from "../src/lib/cotStore";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
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

function inferAssetClass(pair: string): AssetClass {
  const upper = pair.toUpperCase();
  if (["BTCUSD", "ETHUSD"].includes(upper)) return "crypto";
  if (["XAUUSD", "XAGUSD", "WTIUSD"].includes(upper)) return "commodities";
  if (["SPXUSD", "NDXUSD", "NIKKEIUSD"].includes(upper)) return "indices";
  return "fx";
}

// ─── COT direction resolvers ──────────────────────────────────────

function normalizeLean(net: number, long: number, short: number): number {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

type CotPairSignal = {
  pair: string;
  assetClass: AssetClass;
  dealerRawScore: number;
  dealerNormScore: number;
  commRawScore: number;
  commNormScore: number;
  combinedRawScore: number;
  combinedNormScore: number;
  // Directions derived from scores
  dealerRawDir: Direction | null;
  dealerNormDir: Direction | null;
  commRawDir: Direction | null;
  commNormDir: Direction | null;
  combinedRawDir: Direction | null;
  combinedNormDir: Direction | null;
};

function buildCotPairSignals(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
): CotPairSignal[] {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const results: CotPairSignal[] = [];

  for (const pd of pairDefs) {
    const bm = currencies[pd.base];
    const qm = currencies[pd.quote];

    if (!bm || !qm) continue;

    // Dealer
    const dBaseNet = bm.dealer_net;
    const dQuoteNet = qm.dealer_net;
    const dBaseNorm = normalizeLean(bm.dealer_net, bm.dealer_long, bm.dealer_short);
    const dQuoteNorm = normalizeLean(qm.dealer_net, qm.dealer_long, qm.dealer_short);

    // Commercial (handle nulls)
    const cBaseNet = bm.commercial_net ?? 0;
    const cQuoteNet = qm.commercial_net ?? 0;
    const cBaseNorm = normalizeLean(
      bm.commercial_net ?? 0,
      bm.commercial_long ?? 0,
      bm.commercial_short ?? 0,
    );
    const cQuoteNorm = normalizeLean(
      qm.commercial_net ?? 0,
      qm.commercial_long ?? 0,
      qm.commercial_short ?? 0,
    );

    let dealerRawScore: number;
    let dealerNormScore: number;
    let commRawScore: number;
    let commNormScore: number;

    if (assetClass === "fx") {
      // FX: pair_score = base_score - quote_score
      dealerRawScore = dBaseNet - dQuoteNet;
      dealerNormScore = dBaseNorm - dQuoteNorm;
      commRawScore = cBaseNet - cQuoteNet;
      commNormScore = cBaseNorm - cQuoteNorm;
    } else {
      // Non-FX: just base direction
      dealerRawScore = dBaseNet;
      dealerNormScore = dBaseNorm;
      commRawScore = cBaseNet;
      commNormScore = cBaseNorm;
    }

    const combinedRawScore = dealerRawScore + commRawScore;
    const combinedNormScore = dealerNormScore + commNormScore;

    function scoreToDir(score: number): Direction | null {
      if (score > 0) return "LONG";
      if (score < 0) return "SHORT";
      return null;
    }

    results.push({
      pair: pd.pair,
      assetClass,
      dealerRawScore,
      dealerNormScore,
      commRawScore,
      commNormScore,
      combinedRawScore,
      combinedNormScore,
      dealerRawDir: scoreToDir(dealerRawScore),
      dealerNormDir: scoreToDir(dealerNormScore),
      commRawDir: scoreToDir(commRawScore),
      commNormDir: scoreToDir(commNormScore),
      combinedRawDir: scoreToDir(combinedRawScore),
      combinedNormDir: scoreToDir(combinedNormScore),
    });
  }

  return results;
}

// ─── Metrics ──────────────────────────────────────────────────────

type WeekEntry = { weekLabel: string; ret: number; trades: number; wins: number; losses: number };

function computeResults(entries: WeekEntry[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  const curve: number[] = [];

  for (const e of entries) {
    cumulative += e.ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
    curve.push(cumulative);
  }

  const totalTrades = entries.reduce((s, e) => s + e.trades, 0);
  const totalWins = entries.reduce((s, e) => s + e.wins, 0);
  const worstWeek = entries.length > 0 ? Math.min(...entries.map((e) => e.ret)) : 0;

  return { total: cumulative, maxDD, totalTrades, totalWins, worstWeek, curve };
}

function printRow(label: string, entries: WeekEntry[]) {
  const r = computeResults(entries);
  const winRate = r.totalTrades > 0 ? (r.totalWins / r.totalTrades) * 100 : 0;
  console.log(
    "  " +
    label.padEnd(30) +
    String(r.totalTrades).padStart(8) +
    r.total.toFixed(2).padStart(10) +
    r.maxDD.toFixed(2).padStart(10) +
    (r.maxDD > 0 ? (r.total / r.maxDD).toFixed(1) : "∞").padStart(8) +
    `${winRate.toFixed(1)}`.padStart(8) +
    r.worstWeek.toFixed(2).padStart(10),
  );
}

const HEADER =
  "  " +
  "System".padEnd(30) +
  "Trades".padStart(8) +
  "Total %".padStart(10) +
  "Max DD %".padStart(10) +
  "R/DD".padStart(8) +
  "Win %".padStart(8) +
  "Worst Wk".padStart(10);

const DIVIDER = `  ${"─".repeat(82)}`;

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Combined — Dealer + Commercial Merge (ADR Normalized)    ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();
  const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];

  // ── System keys ──
  // Standalone COT variants
  const cotKeys = [
    "dealer_current",          // existing system with neutrals
    "dealer_forced_raw",       // base_net - quote_net
    "dealer_forced_norm",      // normalized
    "comm_current",            // existing system with neutrals
    "comm_forced_raw",         // base_net - quote_net
    "comm_forced_norm",        // normalized
    "cot_combined_raw",        // dealer + commercial raw pair scores
    "cot_combined_norm",       // dealer + commercial normalized
  ] as const;

  // Veto variants
  const vetoKeys = [
    "dealer_veto4_std",           // current: 4-source veto with neutral gaps
    "dealer_tieveto4",            // tiebreaker+veto from previous test
    "cot_combined_raw_veto3",     // 3-source: combined COT, sent, str
    "cot_combined_norm_veto3",    // 3-source: combined COT norm, sent, str
    "sent_veto4_std",             // current: sentiment with 4-source veto
    "sent_veto3_combined",        // 3-source: sentiment vs COT_combined + strength
    "str_veto4_std",              // current: strength with 4-source veto
    "str_veto3_combined",         // 3-source: strength vs COT_combined + strength
  ] as const;

  const allKeys = [...cotKeys, ...vetoKeys];
  const systems: Record<string, WeekEntry[]> = {};
  for (const k of allKeys) systems[k] = [];

  // Track agreement rates
  let dealerCommAgree = 0;
  let dealerCommDisagree = 0;
  let dealerCommBothNeutral = 0;
  let dealerCommOneNeutral = 0;
  let forcedDealerCommAgree = 0;
  let forcedDealerCommDisagree = 0;
  let totalPairWeeks = 0;

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
    const reportDate = deriveCotReportDate(normalizedWeek);

    // Canonical basket (for current system baseline)
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    const returnMap = new Map<string, { returnPct: number; assetClass: string }>();
    for (const r of weeklyReturns) {
      returnMap.set(r.symbol.toUpperCase(), { returnPct: r.returnPct, assetClass: r.assetClass });
    }

    function getNormRet(pair: string, direction: Direction): number | null {
      const r = returnMap.get(pair.toUpperCase());
      if (!r) return null;
      const directed = direction === "SHORT" ? -r.returnPct : r.returnPct;
      const pairAdr = getAdrPct(adrMap, pair.toUpperCase(), r.assetClass);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      return directed * multiplier;
    }

    // Init week accumulators
    const acc: Record<string, { ret: number; trades: number; wins: number; losses: number }> = {};
    for (const k of allKeys) acc[k] = { ret: 0, trades: 0, wins: 0, losses: 0 };

    function addToAcc(key: string, ret: number) {
      acc[key].ret += ret;
      acc[key].trades++;
      if (ret > 0) acc[key].wins++;
      else acc[key].losses++;
    }

    // ── Build COT signals (forced direction) ──
    const cotSignalMap = new Map<string, CotPairSignal>();
    for (const ac of ASSET_CLASSES) {
      const snapshot = await readSnapshot({ assetClass: ac, reportDate });
      if (!snapshot) continue;
      const signals = buildCotPairSignals(snapshot.currencies, ac);
      for (const sig of signals) {
        cotSignalMap.set(sig.pair.toUpperCase(), sig);
      }
    }

    // ── Current system signals ──
    const dealerCurrentAll = filterByModel(basketWeek, "dealer");
    const commCurrentAll = filterByModel(basketWeek, "commercial");
    const sentCurrentAll = filterByModel(basketWeek, "sentiment");
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);

    // Standard direction maps (null = neutral)
    const stdDealerMap = new Map<string, Direction | null>();
    for (const s of dealerCurrentAll) stdDealerMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdCommMap = new Map<string, Direction | null>();
    for (const s of commCurrentAll) stdCommMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdSentMap = new Map<string, Direction | null>();
    for (const s of sentCurrentAll) stdSentMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdStrMap = new Map<string, Direction | null>();
    for (const row of strengthRows) {
      stdStrMap.set(row.pair.toUpperCase(), row.compositeDirection === "NEUTRAL" ? null : row.compositeDirection);
    }

    // Sentiment tiebreaker map (for full coverage)
    const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const close = open.plus({ days: 7 });
    const aggregates = await getAggregatesForWeekStartWithBackfill(
      open.toUTC().toISO()!, close.toUTC().toISO()!,
    );
    const tieSentMap = new Map<string, Direction>();
    for (const agg of aggregates) {
      const pair = agg.symbol.toUpperCase();
      const dir = sentimentDirectionFromAggregate(agg);
      if (dir !== "NEUTRAL") {
        tieSentMap.set(pair, dir);
      } else if (agg.agg_long_pct !== 50) {
        tieSentMap.set(pair, agg.agg_long_pct > 50 ? "SHORT" : "LONG");
      }
    }

    // Strength tiebreaker map
    const tieStrMap = new Map<string, Direction>();
    for (const row of strengthRows) {
      if (row.compositeDirection !== "NEUTRAL") {
        tieStrMap.set(row.pair.toUpperCase(), row.compositeDirection);
      } else if (row.compositeScore === 0) {
        const spreadSum = row.windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0);
        if (spreadSum > 0) tieStrMap.set(row.pair.toUpperCase(), "LONG");
        else if (spreadSum < 0) tieStrMap.set(row.pair.toUpperCase(), "SHORT");
      }
    }

    // ── Collect all pairs ──
    const allPairs = new Set<string>();
    for (const m of [stdDealerMap, stdCommMap, stdSentMap, stdStrMap, cotSignalMap]) {
      for (const p of m.keys()) allPairs.add(p.toUpperCase());
    }

    function countOpposers(dir: Direction, others: (Direction | null)[]): number {
      let count = 0;
      for (const o of others) {
        if (o !== null && o !== dir) count++;
      }
      return count;
    }

    for (const pair of allPairs) {
      const cot = cotSignalMap.get(pair);

      // Current system directions
      const deCurrent = stdDealerMap.get(pair) ?? null;
      const coCurrent = stdCommMap.get(pair) ?? null;
      const seCurrent = stdSentMap.get(pair) ?? null;
      const stCurrent = stdStrMap.get(pair) ?? null;

      // Forced directions from COT
      const deForcedRaw = cot?.dealerRawDir ?? null;
      const deForcedNorm = cot?.dealerNormDir ?? null;
      const coForcedRaw = cot?.commRawDir ?? null;
      const coForcedNorm = cot?.commNormDir ?? null;
      const combinedRaw = cot?.combinedRawDir ?? null;
      const combinedNorm = cot?.combinedNormDir ?? null;

      // Tiebreaker directions for veto
      const seTie = tieSentMap.get(pair) ?? null;
      const stTie = tieStrMap.get(pair) ?? null;

      // Track dealer/commercial agreement
      if (deForcedRaw !== null && coForcedRaw !== null) {
        totalPairWeeks++;
        if (deForcedRaw === coForcedRaw) forcedDealerCommAgree++;
        else forcedDealerCommDisagree++;
      }
      if (deCurrent !== null || coCurrent !== null) {
        if (deCurrent !== null && coCurrent !== null) {
          if (deCurrent === coCurrent) dealerCommAgree++;
          else dealerCommDisagree++;
        } else if (deCurrent === null && coCurrent === null) {
          dealerCommBothNeutral++;
        } else {
          dealerCommOneNeutral++;
        }
      }

      // ── STANDALONE COT VARIANTS ──

      // Dealer current (non-neutral only)
      if (deCurrent !== null) {
        const ret = getNormRet(pair, deCurrent);
        if (ret !== null) addToAcc("dealer_current", ret);
      }

      // Dealer forced raw (all pairs)
      if (deForcedRaw !== null) {
        const ret = getNormRet(pair, deForcedRaw);
        if (ret !== null) addToAcc("dealer_forced_raw", ret);
      }

      // Dealer forced norm (all pairs)
      if (deForcedNorm !== null) {
        const ret = getNormRet(pair, deForcedNorm);
        if (ret !== null) addToAcc("dealer_forced_norm", ret);
      }

      // Commercial current
      if (coCurrent !== null) {
        const ret = getNormRet(pair, coCurrent);
        if (ret !== null) addToAcc("comm_current", ret);
      }

      // Commercial forced raw
      if (coForcedRaw !== null) {
        const ret = getNormRet(pair, coForcedRaw);
        if (ret !== null) addToAcc("comm_forced_raw", ret);
      }

      // Commercial forced norm
      if (coForcedNorm !== null) {
        const ret = getNormRet(pair, coForcedNorm);
        if (ret !== null) addToAcc("comm_forced_norm", ret);
      }

      // COT combined raw
      if (combinedRaw !== null) {
        const ret = getNormRet(pair, combinedRaw);
        if (ret !== null) addToAcc("cot_combined_raw", ret);
      }

      // COT combined norm
      if (combinedNorm !== null) {
        const ret = getNormRet(pair, combinedNorm);
        if (ret !== null) addToAcc("cot_combined_norm", ret);
      }

      // ── VETO VARIANTS ──

      // A. Current 4-source veto for dealer (std = with neutral gaps)
      if (deCurrent !== null) {
        const ret = getNormRet(pair, deCurrent);
        if (ret !== null) {
          const opp = countOpposers(deCurrent, [coCurrent, seCurrent, stCurrent]);
          if (opp < 2) addToAcc("dealer_veto4_std", ret);
        }
      }

      // B. Tiebreaker+veto for dealer (enriched other sources)
      if (deCurrent !== null) {
        const ret = getNormRet(pair, deCurrent);
        if (ret !== null) {
          // Use tiebreaker for ALL other sources (COT forced + sent tie + str tie)
          const opp = countOpposers(deCurrent, [coForcedNorm, seTie, stTie]);
          if (opp < 2) addToAcc("dealer_tieveto4", ret);
        }
      }

      // C. Combined COT raw + 3-source veto (2 of 2 others must oppose)
      if (combinedRaw !== null) {
        const ret = getNormRet(pair, combinedRaw);
        if (ret !== null) {
          const opp = countOpposers(combinedRaw, [seTie, stTie]);
          if (opp >= 2) { /* vetoed */ }
          else addToAcc("cot_combined_raw_veto3", ret);
        }
      }

      // D. Combined COT norm + 3-source veto
      if (combinedNorm !== null) {
        const ret = getNormRet(pair, combinedNorm);
        if (ret !== null) {
          const opp = countOpposers(combinedNorm, [seTie, stTie]);
          if (opp >= 2) { /* vetoed */ }
          else addToAcc("cot_combined_norm_veto3", ret);
        }
      }

      // E. Sentiment with 4-source veto (current)
      if (seCurrent !== null) {
        const ret = getNormRet(pair, seCurrent);
        if (ret !== null) {
          const opp = countOpposers(seCurrent, [deCurrent, coCurrent, stCurrent]);
          if (opp < 2) addToAcc("sent_veto4_std", ret);
        }
      }

      // F. Sentiment with 3-source veto (combined COT)
      if (seCurrent !== null) {
        const ret = getNormRet(pair, seCurrent);
        if (ret !== null) {
          const opp = countOpposers(seCurrent, [combinedNorm, stTie]);
          if (opp >= 2) { /* vetoed */ }
          else addToAcc("sent_veto3_combined", ret);
        }
      }

      // G. Strength with 4-source veto (current)
      if (stCurrent !== null) {
        const ret = getNormRet(pair, stCurrent);
        if (ret !== null) {
          const opp = countOpposers(stCurrent, [deCurrent, coCurrent, seCurrent]);
          if (opp < 2) addToAcc("str_veto4_std", ret);
        }
      }

      // H. Strength with 3-source veto (combined COT)
      if (stCurrent !== null) {
        const ret = getNormRet(pair, stCurrent);
        if (ret !== null) {
          const opp = countOpposers(stCurrent, [combinedNorm, seTie]);
          if (opp >= 2) { /* vetoed */ }
          else addToAcc("str_veto3_combined", ret);
        }
      }
    }

    for (const k of allKeys) {
      systems[k].push({ weekLabel, ...acc[k] });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════════════════════════

  // Section 0: Dealer/Commercial agreement
  console.log(`\n${"═".repeat(86)}`);
  console.log("  DEALER vs COMMERCIAL AGREEMENT (current system)");
  console.log(`${"═".repeat(86)}`);
  const totalSigs = dealerCommAgree + dealerCommDisagree + dealerCommBothNeutral + dealerCommOneNeutral;
  console.log(`  Both have signal & AGREE:     ${dealerCommAgree} (${((dealerCommAgree / totalSigs) * 100).toFixed(1)}%)`);
  console.log(`  Both have signal & DISAGREE:  ${dealerCommDisagree} (${((dealerCommDisagree / totalSigs) * 100).toFixed(1)}%)`);
  console.log(`  One neutral / one signal:     ${dealerCommOneNeutral} (${((dealerCommOneNeutral / totalSigs) * 100).toFixed(1)}%)`);
  console.log(`  Both neutral:                 ${dealerCommBothNeutral} (${((dealerCommBothNeutral / totalSigs) * 100).toFixed(1)}%)`);
  console.log(`\n  FORCED direction agreement:`);
  console.log(`  Agree:    ${forcedDealerCommAgree}/${totalPairWeeks} (${((forcedDealerCommAgree / totalPairWeeks) * 100).toFixed(1)}%)`);
  console.log(`  Disagree: ${forcedDealerCommDisagree}/${totalPairWeeks} (${((forcedDealerCommDisagree / totalPairWeeks) * 100).toFixed(1)}%)`);

  // Section 1: Dealer variants
  console.log(`\n${"═".repeat(86)}`);
  console.log("  SECTION 1: DEALER — Current vs Forced-Raw vs Forced-Norm");
  console.log(`${"═".repeat(86)}`);
  console.log(HEADER);
  console.log(DIVIDER);
  printRow("Dealer Current", systems["dealer_current"]);
  printRow("Dealer Forced Raw", systems["dealer_forced_raw"]);
  printRow("Dealer Forced Norm", systems["dealer_forced_norm"]);

  // Section 2: Commercial variants
  console.log(`\n${"═".repeat(86)}`);
  console.log("  SECTION 2: COMMERCIAL — Current vs Forced-Raw vs Forced-Norm");
  console.log(`${"═".repeat(86)}`);
  console.log(HEADER);
  console.log(DIVIDER);
  printRow("Comm Current", systems["comm_current"]);
  printRow("Comm Forced Raw", systems["comm_forced_raw"]);
  printRow("Comm Forced Norm", systems["comm_forced_norm"]);

  // Section 3: Combined COT
  console.log(`\n${"═".repeat(86)}`);
  console.log("  SECTION 3: COT COMBINED — Dealer + Commercial Merged");
  console.log(`${"═".repeat(86)}`);
  console.log(HEADER);
  console.log(DIVIDER);
  printRow("COT Combined Raw", systems["cot_combined_raw"]);
  printRow("COT Combined Norm", systems["cot_combined_norm"]);
  console.log(DIVIDER);
  printRow("(ref) Dealer Current", systems["dealer_current"]);
  printRow("(ref) Comm Current", systems["comm_current"]);

  // Section 4: Veto comparison
  console.log(`\n${"═".repeat(86)}`);
  console.log("  SECTION 4: VETO — 4-Source (current) vs 3-Source (combined COT)");
  console.log(`${"═".repeat(86)}`);
  console.log(HEADER);
  console.log(DIVIDER);
  console.log("  — COT-based systems —");
  printRow("Dealer Veto4 (std)", systems["dealer_veto4_std"]);
  printRow("Dealer TieVeto4", systems["dealer_tieveto4"]);
  printRow("COT Combined Raw Veto3", systems["cot_combined_raw_veto3"]);
  printRow("COT Combined Norm Veto3", systems["cot_combined_norm_veto3"]);
  console.log(DIVIDER);
  console.log("  — Sentiment —");
  printRow("Sent Veto4 (std)", systems["sent_veto4_std"]);
  printRow("Sent Veto3 (combined COT)", systems["sent_veto3_combined"]);
  console.log(DIVIDER);
  console.log("  — Strength —");
  printRow("Str Veto4 (std)", systems["str_veto4_std"]);
  printRow("Str Veto3 (combined COT)", systems["str_veto3_combined"]);

  // Section 5: Grand comparison — best from each architecture
  console.log(`\n${"═".repeat(86)}`);
  console.log("  SECTION 5: GRAND COMPARISON");
  console.log(`${"═".repeat(86)}`);
  console.log(HEADER);
  console.log(DIVIDER);
  printRow("Dealer Current (baseline)", systems["dealer_current"]);
  printRow("Dealer Veto4 (std)", systems["dealer_veto4_std"]);
  printRow("Dealer TieVeto4", systems["dealer_tieveto4"]);
  printRow("COT Combined Norm", systems["cot_combined_norm"]);
  printRow("COT Comb Norm Veto3", systems["cot_combined_norm_veto3"]);

  // Weekly equity curves
  console.log(`\n${"═".repeat(86)}`);
  console.log("  WEEKLY CURVES — Key Systems");
  console.log(`${"═".repeat(86)}`);
  console.log(
    "  " + "Week".padEnd(10) +
    "D:Curr".padStart(8) +
    "D:V4std".padStart(9) +
    "D:TieV4".padStart(9) +
    "CotRaw".padStart(9) +
    "CotNorm".padStart(9) +
    "CotNV3".padStart(9) +
    "S:V4std".padStart(9) +
    "S:V3cmb".padStart(9),
  );
  console.log(`  ${"─".repeat(78)}`);

  const cumsFor = (key: string) => {
    const entries = systems[key];
    let cum = 0;
    return entries.map((e) => { cum += e.ret; return cum; });
  };

  const c1 = cumsFor("dealer_current");
  const c2 = cumsFor("dealer_veto4_std");
  const c3 = cumsFor("dealer_tieveto4");
  const c4 = cumsFor("cot_combined_raw");
  const c5 = cumsFor("cot_combined_norm");
  const c6 = cumsFor("cot_combined_norm_veto3");
  const c7 = cumsFor("sent_veto4_std");
  const c8 = cumsFor("sent_veto3_combined");

  for (let i = 0; i < weeks.length; i++) {
    const wl = buildWeekLabel(weeks[i]!);
    console.log(
      "  " + wl.padEnd(10) +
      c1[i]!.toFixed(1).padStart(8) +
      c2[i]!.toFixed(1).padStart(9) +
      c3[i]!.toFixed(1).padStart(9) +
      c4[i]!.toFixed(1).padStart(9) +
      c5[i]!.toFixed(1).padStart(9) +
      c6[i]!.toFixed(1).padStart(9) +
      c7[i]!.toFixed(1).padStart(9) +
      c8[i]!.toFixed(1).padStart(9),
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
