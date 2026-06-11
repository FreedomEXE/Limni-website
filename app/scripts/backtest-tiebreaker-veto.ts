/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-tiebreaker-veto.ts
 *
 * Description:
 * Tests 2/4 veto with tiebreaker-enriched sources. Instead of having
 * neutral gaps in veto coverage, every source is forced to pick a
 * direction on every pair (via tiebreaker). This means veto always
 * has 3 full opinions to evaluate against, no blind spots.
 *
 * Compares three modes per source:
 *   1. Raw — standalone, neutrals excluded (baseline)
 *   2. Veto Only — current 2/4 veto, neutrals = missing votes
 *   3. Tiebreaker + Veto — all 36 pairs directional, veto fully informed
 *
 * The hypothesis: tiebreaker alone adds noise (more trades, more DD),
 * but tiebreaker + veto should filter that noise while keeping the
 * benefit of full veto coverage.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { deriveCotReportDate } from "../src/lib/dataSectionWeeks";
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

// ─── COT tiebreaker ───────────────────────────────────────────────

function normalizeLean(net: number, long: number, short: number): number {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

function resolveCotTiebreaker(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
  mode: "dealer" | "commercial",
): Map<string, Direction> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const result = new Map<string, Direction>();

  for (const pd of pairDefs) {
    const baseMarket = currencies[pd.base];
    const quoteMarket = currencies[pd.quote];
    if (!baseMarket || !quoteMarket) continue;

    let baseNet: number, baseLong: number, baseShort: number;
    let quoteNet: number, quoteLong: number, quoteShort: number;

    if (mode === "dealer") {
      baseNet = baseMarket.dealer_net;
      baseLong = baseMarket.dealer_long;
      baseShort = baseMarket.dealer_short;
      quoteNet = quoteMarket.dealer_net;
      quoteLong = quoteMarket.dealer_long;
      quoteShort = quoteMarket.dealer_short;
    } else {
      baseNet = baseMarket.commercial_net ?? 0;
      baseLong = baseMarket.commercial_long ?? 0;
      baseShort = baseMarket.commercial_short ?? 0;
      quoteNet = quoteMarket.commercial_net ?? 0;
      quoteLong = quoteMarket.commercial_long ?? 0;
      quoteShort = quoteMarket.commercial_short ?? 0;
    }

    const baseBias = baseNet > 0 ? "BULLISH" : baseNet < 0 ? "BEARISH" : "NEUTRAL";
    const quoteBias = quoteNet > 0 ? "BULLISH" : quoteNet < 0 ? "BEARISH" : "NEUTRAL";

    // Standard direction first
    if (assetClass === "fx") {
      if (baseBias !== "NEUTRAL" && quoteBias !== "NEUTRAL" && baseBias !== quoteBias) {
        result.set(pd.pair, baseBias === "BULLISH" ? "LONG" : "SHORT");
        continue;
      }
      // Tiebreaker for FX neutrals
      const baseLean = normalizeLean(baseNet, baseLong, baseShort);
      const quoteLean = normalizeLean(quoteNet, quoteLong, quoteShort);

      if (baseBias === quoteBias && baseBias !== "NEUTRAL") {
        const baseStrength = Math.abs(baseLean);
        const quoteStrength = Math.abs(quoteLean);
        if (baseStrength !== quoteStrength) {
          result.set(pd.pair, baseStrength > quoteStrength ? "LONG" : "SHORT");
        }
      } else if (baseBias === "NEUTRAL" || quoteBias === "NEUTRAL") {
        if (baseBias === "BULLISH") result.set(pd.pair, "LONG");
        else if (baseBias === "BEARISH") result.set(pd.pair, "SHORT");
        else if (quoteBias === "BULLISH") result.set(pd.pair, "SHORT");
        else if (quoteBias === "BEARISH") result.set(pd.pair, "LONG");
      }
    } else {
      // Non-FX: base only
      if (baseBias === "BULLISH") { result.set(pd.pair, "LONG"); continue; }
      if (baseBias === "BEARISH") { result.set(pd.pair, "SHORT"); continue; }
      const baseLean = normalizeLean(baseNet, baseLong, baseShort);
      if (baseLean > 0) result.set(pd.pair, "LONG");
      else if (baseLean < 0) result.set(pd.pair, "SHORT");
    }
  }

  return result;
}

// ─── Metrics helpers ──────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Tiebreaker + Veto — Full Coverage 2/4 (ADR Normalized)       ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();
  const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];

  // 3 modes × 4 sources = 12 systems
  const sources = ["dealer", "comm", "sent", "str"] as const;
  const modes = ["raw", "veto", "tieveto"] as const;

  const systems: Record<string, WeekEntry[]> = {};
  for (const src of sources) {
    for (const mode of modes) {
      systems[`${src}_${mode}`] = [];
    }
  }

  // Also track: tiebreaker standalone (for reference)
  for (const src of sources) systems[`${src}_tie`] = [];

  // Coverage stats
  let totalVetoCoverage = 0;
  let totalTieVetoCoverage = 0;
  let coverageChecks = 0;

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

    function getNormRet(pair: string, direction: Direction): number | null {
      const r = returnMap.get(pair.toUpperCase());
      if (!r) return null;
      const directed = direction === "SHORT" ? -r.returnPct : r.returnPct;
      const pairAdr = getAdrPct(adrMap, pair.toUpperCase(), r.assetClass);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      return directed * multiplier;
    }

    // ── Build direction maps ──

    // 1. Standard (from basketSource) — neutrals included as null
    const dealerAll = filterByModel(basketWeek, "dealer");
    const commAll = filterByModel(basketWeek, "commercial");
    const sentAll = filterByModel(basketWeek, "sentiment");
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);

    const stdDealerMap = new Map<string, Direction | null>();
    for (const s of dealerAll) stdDealerMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdCommMap = new Map<string, Direction | null>();
    for (const s of commAll) stdCommMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdSentMap = new Map<string, Direction | null>();
    for (const s of sentAll) stdSentMap.set(s.symbol.toUpperCase(), s.direction === "NEUTRAL" ? null : s.direction as Direction);

    const stdStrMap = new Map<string, Direction | null>();
    for (const row of strengthRows) {
      stdStrMap.set(row.pair.toUpperCase(), row.compositeDirection === "NEUTRAL" ? null : row.compositeDirection);
    }

    // 2. Tiebreaker maps — forced direction for everything
    // COT
    const cotSnapshots: Record<string, Record<string, MarketSnapshot>> = {};
    for (const ac of ASSET_CLASSES) {
      const snapshot = await readSnapshot({ assetClass: ac, reportDate });
      if (snapshot) cotSnapshots[ac] = snapshot.currencies;
    }

    const tieDealerMap = new Map<string, Direction>();
    const tieCommMap = new Map<string, Direction>();
    for (const ac of ASSET_CLASSES) {
      const currencies = cotSnapshots[ac];
      if (!currencies) continue;
      for (const [pair, dir] of resolveCotTiebreaker(currencies, ac, "dealer")) {
        tieDealerMap.set(pair.toUpperCase(), dir);
      }
      for (const [pair, dir] of resolveCotTiebreaker(currencies, ac, "commercial")) {
        tieCommMap.set(pair.toUpperCase(), dir);
      }
    }

    // Sentiment tiebreaker
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

    // Strength tiebreaker
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

    // ── Collect all pairs that any source has a signal for ──
    const allPairs = new Set<string>();
    for (const m of [stdDealerMap, stdCommMap, stdSentMap, stdStrMap]) {
      for (const p of m.keys()) allPairs.add(p);
    }
    // Also add tiebreaker pairs (may have more due to forced neutrals)
    for (const m of [tieDealerMap, tieCommMap, tieSentMap, tieStrMap]) {
      for (const p of m.keys()) allPairs.add(p);
    }

    // ── Week accumulators ──
    const acc: Record<string, { ret: number; trades: number; wins: number; losses: number }> = {};
    for (const src of sources) {
      for (const mode of [...modes, "tie" as const]) {
        acc[`${src}_${mode}`] = { ret: 0, trades: 0, wins: 0, losses: 0 };
      }
    }

    function addToAcc(key: string, ret: number) {
      acc[key].ret += ret;
      acc[key].trades++;
      if (ret > 0) acc[key].wins++;
      else acc[key].losses++;
    }

    function countOpposers(dir: Direction, others: (Direction | null)[]): number {
      let count = 0;
      for (const o of others) {
        if (o !== null && o !== dir) count++;
      }
      return count;
    }

    for (const pair of allPairs) {
      const ac = inferAssetClass(pair);

      // Standard directions (null = neutral/absent)
      const de = stdDealerMap.get(pair) ?? null;
      const co = stdCommMap.get(pair) ?? null;
      const se = stdSentMap.get(pair) ?? null;
      const st = stdStrMap.get(pair) ?? null;

      // Tiebreaker directions (may still be null if data truly missing)
      const tDe = tieDealerMap.get(pair) ?? null;
      const tCo = tieCommMap.get(pair) ?? null;
      const tSe = tieSentMap.get(pair) ?? null;
      const tSt = tieStrMap.get(pair) ?? null;

      // ── DEALER ──
      if (de !== null) {
        const ret = getNormRet(pair, de, ac);
        if (ret !== null) {
          // Raw
          addToAcc("dealer_raw", ret);
          // Veto (standard: neutrals = missing vote)
          const opp = countOpposers(de, [co, se, st]);
          if (opp < 2) addToAcc("dealer_veto", ret);
          // TieVeto (tiebreaker enriched: full votes)
          const tOpp = countOpposers(de, [tCo, tSe, tSt]);
          if (tOpp < 2) addToAcc("dealer_tieveto", ret);
        }
      }
      // Tiebreaker standalone (for reference)
      if (tDe !== null) {
        const ret = getNormRet(pair, tDe, ac);
        if (ret !== null) addToAcc("dealer_tie", ret);
      }

      // ── COMMERCIAL ──
      if (co !== null) {
        const ret = getNormRet(pair, co, ac);
        if (ret !== null) {
          addToAcc("comm_raw", ret);
          const opp = countOpposers(co, [de, se, st]);
          if (opp < 2) addToAcc("comm_veto", ret);
          const tOpp = countOpposers(co, [tDe, tSe, tSt]);
          if (tOpp < 2) addToAcc("comm_tieveto", ret);
        }
      }
      if (tCo !== null) {
        const ret = getNormRet(pair, tCo, ac);
        if (ret !== null) addToAcc("comm_tie", ret);
      }

      // ── SENTIMENT ──
      if (se !== null) {
        const ret = getNormRet(pair, se, ac);
        if (ret !== null) {
          addToAcc("sent_raw", ret);
          const opp = countOpposers(se, [de, co, st]);
          if (opp < 2) addToAcc("sent_veto", ret);
          const tOpp = countOpposers(se, [tDe, tCo, tSt]);
          if (tOpp < 2) addToAcc("sent_tieveto", ret);
        }
      }
      if (tSe !== null) {
        const ret = getNormRet(pair, tSe, ac);
        if (ret !== null) addToAcc("sent_tie", ret);
      }

      // ── STRENGTH ──
      if (st !== null) {
        const ret = getNormRet(pair, st, ac);
        if (ret !== null) {
          addToAcc("str_raw", ret);
          const opp = countOpposers(st, [de, co, se]);
          if (opp < 2) addToAcc("str_veto", ret);
          const tOpp = countOpposers(st, [tDe, tCo, tSe]);
          if (tOpp < 2) addToAcc("str_tieveto", ret);
        }
      }
      if (tSt !== null) {
        const ret = getNormRet(pair, tSt, ac);
        if (ret !== null) addToAcc("str_tie", ret);
      }

      // Track veto coverage (for any source trade, how many veto votes existed?)
      if (de !== null || se !== null || st !== null || co !== null) {
        // Standard: count non-null among the 4
        const stdVotes = [de, co, se, st].filter((d) => d !== null).length;
        const tieVotes = [tDe, tCo, tSe, tSt].filter((d) => d !== null).length;
        totalVetoCoverage += stdVotes;
        totalTieVetoCoverage += tieVotes;
        coverageChecks++;
      }
    }

    for (const src of sources) {
      for (const mode of [...modes, "tie" as const]) {
        const key = `${src}_${mode}`;
        systems[key].push({ weekLabel, ...acc[key] });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════════════════════════

  const header =
    "  " +
    "System".padEnd(30) +
    "Trades".padStart(8) +
    "Total %".padStart(10) +
    "Max DD %".padStart(10) +
    "R/DD".padStart(8) +
    "Win %".padStart(8) +
    "Worst Wk".padStart(10);

  // Veto coverage improvement
  const avgStdVotes = coverageChecks > 0 ? (totalVetoCoverage / coverageChecks).toFixed(2) : "?";
  const avgTieVotes = coverageChecks > 0 ? (totalTieVetoCoverage / coverageChecks).toFixed(2) : "?";
  console.log(`\n${"═".repeat(86)}`);
  console.log("  VETO COVERAGE IMPROVEMENT");
  console.log(`${"═".repeat(86)}`);
  console.log(`  Avg veto votes per trade (standard): ${avgStdVotes} / 4`);
  console.log(`  Avg veto votes per trade (tiebreak): ${avgTieVotes} / 4`);
  console.log(`  Coverage improvement: ${coverageChecks > 0 ? (((totalTieVetoCoverage - totalVetoCoverage) / totalVetoCoverage) * 100).toFixed(1) : "?"}%`);

  for (const [srcKey, srcLabel] of [
    ["dealer", "DEALER"],
    ["sent", "SENTIMENT"],
    ["str", "STRENGTH"],
    ["comm", "COMMERCIAL"],
  ] as const) {
    console.log(`\n${"═".repeat(86)}`);
    console.log(`  ${srcLabel}: RAW → VETO → TIEBREAKER+VETO`);
    console.log(`${"═".repeat(86)}`);
    console.log(header);
    console.log(`  ${"─".repeat(82)}`);
    printRow(`${srcLabel} Raw`, systems[`${srcKey}_raw`]);
    printRow(`${srcLabel} Veto (std)`, systems[`${srcKey}_veto`]);
    printRow(`${srcLabel} Tie+Veto`, systems[`${srcKey}_tieveto`]);
    printRow(`${srcLabel} Tie (standalone)`, systems[`${srcKey}_tie`]);
  }

  // ═══════════════════════════════════════════════════════════════
  // GRAND COMPARISON — Best of each
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(86)}`);
  console.log("  GRAND COMPARISON — VETO vs TIE+VETO");
  console.log(`${"═".repeat(86)}`);
  console.log(header);
  console.log(`  ${"─".repeat(82)}`);
  printRow("Dealer Veto (std)", systems["dealer_veto"]);
  printRow("Dealer Tie+Veto", systems["dealer_tieveto"]);
  console.log(`  ${"─".repeat(82)}`);
  printRow("Sentiment Veto (std)", systems["sent_veto"]);
  printRow("Sentiment Tie+Veto", systems["sent_tieveto"]);
  console.log(`  ${"─".repeat(82)}`);
  printRow("Strength Veto (std)", systems["str_veto"]);
  printRow("Strength Tie+Veto", systems["str_tieveto"]);
  console.log(`  ${"─".repeat(82)}`);
  printRow("Commercial Veto (std)", systems["comm_veto"]);
  printRow("Commercial Tie+Veto", systems["comm_tieveto"]);

  // ═══════════════════════════════════════════════════════════════
  // WEEKLY EQUITY CURVES — Dealer focus
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(86)}`);
  console.log("  WEEKLY EQUITY CURVES — DEALER");
  console.log(`${"═".repeat(86)}`);
  console.log(
    "  " + "Week".padEnd(10) +
    "Raw".padStart(8) +
    "Veto".padStart(8) +
    "Tie+Veto".padStart(10) +
    "Tie Solo".padStart(10) +
    "  │" +
    "V Trades".padStart(10) +
    "TV Trades".padStart(10),
  );
  console.log(`  ${"─".repeat(68)}`);

  let rawCum = 0, vetoCum = 0, tievetoCum = 0, tieCum = 0;
  for (let i = 0; i < weeks.length; i++) {
    const wl = buildWeekLabel(weeks[i]!);
    rawCum += systems["dealer_raw"][i]!.ret;
    vetoCum += systems["dealer_veto"][i]!.ret;
    tievetoCum += systems["dealer_tieveto"][i]!.ret;
    tieCum += systems["dealer_tie"][i]!.ret;

    console.log(
      "  " + wl.padEnd(10) +
      rawCum.toFixed(1).padStart(8) +
      vetoCum.toFixed(1).padStart(8) +
      tievetoCum.toFixed(1).padStart(10) +
      tieCum.toFixed(1).padStart(10) +
      "  │" +
      String(systems["dealer_veto"][i]!.trades).padStart(10) +
      String(systems["dealer_tieveto"][i]!.trades).padStart(10),
    );
  }

  // Same for sentiment
  console.log(`\n${"═".repeat(86)}`);
  console.log("  WEEKLY EQUITY CURVES — SENTIMENT");
  console.log(`${"═".repeat(86)}`);
  console.log(
    "  " + "Week".padEnd(10) +
    "Raw".padStart(8) +
    "Veto".padStart(8) +
    "Tie+Veto".padStart(10) +
    "Tie Solo".padStart(10),
  );
  console.log(`  ${"─".repeat(48)}`);

  let sRawCum = 0, sVetoCum = 0, sTvCum = 0, sTieCum = 0;
  for (let i = 0; i < weeks.length; i++) {
    const wl = buildWeekLabel(weeks[i]!);
    sRawCum += systems["sent_raw"][i]!.ret;
    sVetoCum += systems["sent_veto"][i]!.ret;
    sTvCum += systems["sent_tieveto"][i]!.ret;
    sTieCum += systems["sent_tie"][i]!.ret;

    console.log(
      "  " + wl.padEnd(10) +
      sRawCum.toFixed(1).padStart(8) +
      sVetoCum.toFixed(1).padStart(8) +
      sTvCum.toFixed(1).padStart(10) +
      sTieCum.toFixed(1).padStart(10),
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
