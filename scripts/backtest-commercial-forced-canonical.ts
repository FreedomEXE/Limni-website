/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-commercial-forced-canonical.ts
 *
 * Description:
 * Tests what happens when commercial's canonical direction is replaced
 * with forced-raw (base_net - quote_net) across ALL systems.
 *
 * This changes commercial's veto votes, its participation in composites,
 * and how other sources get vetoed. The hypothesis: current commercial
 * directions are anti-signal (-38%), so every veto vote commercial casts
 * is probably wrong. Forced-raw commercial (+23%) should cast better votes.
 *
 * Compares side-by-side:
 *   Column A: Original (commercial uses bias-label directions)
 *   Column B: Forced-raw commercial canonical
 *
 * Reuses the same infrastructure as backtest-veto-composite-sweep.ts.
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
import { getStrategy } from "../src/lib/performance/strategyConfig";
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
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

// ─── Direction resolvers ──────────────────────────────────────────

function buildForcedRawMap(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
  mode: "dealer" | "commercial",
): Map<string, Direction> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const result = new Map<string, Direction>();

  for (const pd of pairDefs) {
    const bm = currencies[pd.base];
    const qm = currencies[pd.quote];
    if (!bm || !qm) continue;

    let baseNet: number, quoteNet: number;
    if (mode === "dealer") {
      baseNet = bm.dealer_net;
      quoteNet = qm.dealer_net;
    } else {
      baseNet = bm.commercial_net ?? 0;
      quoteNet = qm.commercial_net ?? 0;
    }

    const score = assetClass === "fx" ? baseNet - quoteNet : baseNet;
    if (score > 0) result.set(pd.pair.toUpperCase(), "LONG");
    else if (score < 0) result.set(pd.pair.toUpperCase(), "SHORT");
  }

  return result;
}

function buildTiebreakerMap(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
  mode: "dealer" | "commercial",
): Map<string, Direction> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const result = new Map<string, Direction>();

  for (const pd of pairDefs) {
    const bm = currencies[pd.base];
    const qm = currencies[pd.quote];
    if (!bm || !qm) continue;

    let baseNet: number, baseLong: number, baseShort: number;
    let quoteNet: number, quoteLong: number, quoteShort: number;
    if (mode === "dealer") {
      baseNet = bm.dealer_net; baseLong = bm.dealer_long; baseShort = bm.dealer_short;
      quoteNet = qm.dealer_net; quoteLong = qm.dealer_long; quoteShort = qm.dealer_short;
    } else {
      baseNet = bm.commercial_net ?? 0; baseLong = bm.commercial_long ?? 0; baseShort = bm.commercial_short ?? 0;
      quoteNet = qm.commercial_net ?? 0; quoteLong = qm.commercial_long ?? 0; quoteShort = qm.commercial_short ?? 0;
    }

    const baseBias = baseNet > 0 ? "B" : baseNet < 0 ? "S" : "N";
    const quoteBias = quoteNet > 0 ? "B" : quoteNet < 0 ? "S" : "N";

    if (assetClass === "fx") {
      if (baseBias !== "N" && quoteBias !== "N" && baseBias !== quoteBias) {
        result.set(pd.pair.toUpperCase(), baseBias === "B" ? "LONG" : "SHORT");
        continue;
      }
      const baseLean = normalizeLean(baseNet, baseLong, baseShort);
      const quoteLean = normalizeLean(quoteNet, quoteLong, quoteShort);
      if (baseBias === quoteBias && baseBias !== "N") {
        const bs = Math.abs(baseLean), qs = Math.abs(quoteLean);
        if (bs !== qs) result.set(pd.pair.toUpperCase(), bs > qs ? "LONG" : "SHORT");
      } else if (baseBias === "N" || quoteBias === "N") {
        if (baseBias === "B") result.set(pd.pair.toUpperCase(), "LONG");
        else if (baseBias === "S") result.set(pd.pair.toUpperCase(), "SHORT");
        else if (quoteBias === "B") result.set(pd.pair.toUpperCase(), "SHORT");
        else if (quoteBias === "S") result.set(pd.pair.toUpperCase(), "LONG");
      }
    } else {
      if (baseBias === "B") { result.set(pd.pair.toUpperCase(), "LONG"); continue; }
      if (baseBias === "S") { result.set(pd.pair.toUpperCase(), "SHORT"); continue; }
      const baseLean = normalizeLean(baseNet, baseLong, baseShort);
      if (baseLean > 0) result.set(pd.pair.toUpperCase(), "LONG");
      else if (baseLean < 0) result.set(pd.pair.toUpperCase(), "SHORT");
    }
  }

  return result;
}

// ─── Metrics ──────────────────────────────────────────────────────

type WeekEntry = { weekLabel: string; ret: number; trades: number; wins: number; losses: number };

function computeResults(entries: WeekEntry[]) {
  let cumulative = 0, peak = 0, maxDD = 0;
  for (const e of entries) {
    cumulative += e.ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
  }
  const totalTrades = entries.reduce((s, e) => s + e.trades, 0);
  const totalWins = entries.reduce((s, e) => s + e.wins, 0);
  const losingWeeks = entries.filter((e) => e.ret < 0).length;
  const worstWeek = entries.length > 0 ? Math.min(...entries.map((e) => e.ret)) : 0;
  return { total: cumulative, maxDD, totalTrades, totalWins, losingWeeks, worstWeek };
}

function printRow(label: string, entries: WeekEntry[]) {
  const r = computeResults(entries);
  const winRate = r.totalTrades > 0 ? (r.totalWins / r.totalTrades) * 100 : 0;
  console.log(
    "  " +
    label.padEnd(36) +
    String(r.totalTrades).padStart(7) +
    r.total.toFixed(2).padStart(10) +
    r.maxDD.toFixed(2).padStart(9) +
    (r.maxDD > 0 ? (r.total / r.maxDD).toFixed(1) : "∞").padStart(8) +
    `${winRate.toFixed(1)}`.padStart(7) +
    String(r.losingWeeks).padStart(5) +
    r.worstWeek.toFixed(2).padStart(9),
  );
}

const HEADER =
  "  " +
  "System".padEnd(36) +
  "Trades".padStart(7) +
  "Total %".padStart(10) +
  "Max DD".padStart(9) +
  "R/DD".padStart(8) +
  "Win %".padStart(7) +
  "LW".padStart(5) +
  "Worst".padStart(9);

const DIV = `  ${"─".repeat(89)}`;

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║   Commercial Forced-Raw as Canonical — Full Sweep (ADR Norm)       ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks.sort((a, b) => a.localeCompare(b)).filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();
  const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];
  const agreeStrategy = getStrategy("agree_2of3_nocomm");
  if (!agreeStrategy) {
    throw new Error("Missing strategy config: agree_2of3_nocomm");
  }

  // Systems: [A] = original commercial, [B] = forced-raw commercial
  // For each source: raw, veto_A, veto_B, tieveto_A, tieveto_B
  const sysKeys = [
    // Standalones
    "dealer_raw",
    "dealer_vetoA", "dealer_vetoB",
    "dealer_tievetoA", "dealer_tievetoB",
    "sent_raw",
    "sent_vetoA", "sent_vetoB",
    "sent_tievetoA", "sent_tievetoB",
    "str_raw",
    "str_vetoA", "str_vetoB",
    "str_tievetoA", "str_tievetoB",
    "comm_std_raw", "comm_forced_raw",
    "comm_std_vetoA", "comm_forced_vetoB",
    "comm_forced_tievetoB",
    // 2-of-3 NoComm
    "agree_raw",
    "agree_vetoA", "agree_vetoB",
    "agree_tievetoA", "agree_tievetoB",
    // Portfolios
    "tandem3_vetoA", "tandem3_vetoB",
    "dealer_sent_vetoA", "dealer_sent_vetoB",
    "dealer_sent_tievetoA", "dealer_sent_tievetoB",
  ] as const;

  const systems: Record<string, WeekEntry[]> = {};
  for (const k of sysKeys) systems[k] = [];

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
    const reportDate = deriveCotReportDate(normalizedWeek);

    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);

    const returnMap = new Map<string, { returnPct: number; assetClass: string }>();
    for (const r of weeklyReturns) returnMap.set(r.symbol.toUpperCase(), { returnPct: r.returnPct, assetClass: r.assetClass });

    function getNormRet(pair: string, dir: Direction): number | null {
      const r = returnMap.get(pair.toUpperCase());
      if (!r) return null;
      const directed = dir === "SHORT" ? -r.returnPct : r.returnPct;
      const pairAdr = getAdrPct(adrMap, pair.toUpperCase(), r.assetClass);
      return directed * (pairAdr > 0 ? targetAdr / pairAdr : 1);
    }

    // ── Standard direction maps (A = original) ──
    const stdDealer = new Map<string, Direction>();
    for (const s of nonNeutralSignals(filterByModel(basketWeek, "dealer")))
      stdDealer.set(s.symbol.toUpperCase(), s.direction as Direction);

    const stdCommA = new Map<string, Direction>(); // original commercial
    for (const s of nonNeutralSignals(filterByModel(basketWeek, "commercial")))
      stdCommA.set(s.symbol.toUpperCase(), s.direction as Direction);

    const stdSent = new Map<string, Direction>();
    for (const s of nonNeutralSignals(filterByModel(basketWeek, "sentiment")))
      stdSent.set(s.symbol.toUpperCase(), s.direction as Direction);

    const stdStr = new Map<string, Direction>();
    for (const row of strengthRows)
      if (row.compositeDirection !== "NEUTRAL") stdStr.set(row.pair.toUpperCase(), row.compositeDirection);

    // ── Forced-raw commercial (B = new canonical) ──
    const stdCommB = new Map<string, Direction>();
    for (const ac of ASSET_CLASSES) {
      const snap = await readSnapshot({ assetClass: ac, reportDate });
      if (!snap) continue;
      for (const [p, d] of buildForcedRawMap(snap.currencies, ac, "commercial"))
        stdCommB.set(p, d);
    }

    // ── Tiebreaker maps ──
    const tieDealer = new Map<string, Direction>();
    const tieCommA = new Map<string, Direction>(); // tiebreaker on original commercial
    const tieCommB = new Map<string, Direction>(); // forced-raw IS the tiebreaker for commercial
    const tieSent = new Map<string, Direction>();
    const tieStr = new Map<string, Direction>();

    for (const ac of ASSET_CLASSES) {
      const snap = await readSnapshot({ assetClass: ac, reportDate });
      if (!snap) continue;
      for (const [p, d] of buildTiebreakerMap(snap.currencies, ac, "dealer")) tieDealer.set(p, d);
      for (const [p, d] of buildTiebreakerMap(snap.currencies, ac, "commercial")) tieCommA.set(p, d);
      // For B tiebreaker: forced-raw already covers all pairs, use it directly
      for (const [p, d] of buildForcedRawMap(snap.currencies, ac, "commercial")) tieCommB.set(p, d);
    }

    const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const close = open.plus({ days: 7 });
    const aggregates = await getAggregatesForWeekStartWithBackfill(open.toUTC().toISO()!, close.toUTC().toISO()!);
    for (const agg of aggregates) {
      const pair = agg.symbol.toUpperCase();
      const dir = sentimentDirectionFromAggregate(agg);
      if (dir !== "NEUTRAL") { tieSent.set(pair, dir); }
      else if (agg.agg_long_pct !== 50) { tieSent.set(pair, agg.agg_long_pct > 50 ? "SHORT" : "LONG"); }
    }

    for (const row of strengthRows) {
      if (row.compositeDirection !== "NEUTRAL") { tieStr.set(row.pair.toUpperCase(), row.compositeDirection); }
      else if (row.compositeScore === 0) {
        const sp = row.windows.reduce((s, w) => s + (w.signedSpread ?? 0), 0);
        if (sp > 0) tieStr.set(row.pair.toUpperCase(), "LONG");
        else if (sp < 0) tieStr.set(row.pair.toUpperCase(), "SHORT");
      }
    }

    // ── 2-of-3 NoComm (resolve via the real strategy engine, not basketSource) ──
    const agreeMap = new Map<string, Direction>();
    const agreeWeek = await computeWeeklyHold(
      agreeStrategy,
      weekOpenUtc,
      { id: "weekly_hold" },
      { id: "adr_normalized" },
    );
    for (const trade of agreeWeek.trades) {
      agreeMap.set(trade.symbol.toUpperCase(), trade.direction as Direction);
    }

    // ── Week accumulators ──
    const acc: Record<string, { ret: number; trades: number; wins: number; losses: number }> = {};
    for (const k of sysKeys) acc[k] = { ret: 0, trades: 0, wins: 0, losses: 0 };

    function add(key: string, ret: number) {
      acc[key].ret += ret;
      acc[key].trades++;
      if (ret > 0) acc[key].wins++; else acc[key].losses++;
    }

    function countOpp(dir: Direction, sources: (Map<string, Direction>)[], pair: string): number {
      let count = 0;
      for (const m of sources) {
        const d = m.get(pair);
        if (d !== undefined && d !== dir) count++;
      }
      return count;
    }

    // Collect all pairs
    const allPairs = new Set<string>();
    for (const m of [stdDealer, stdCommA, stdCommB, stdSent, stdStr, agreeMap])
      for (const p of m.keys()) allPairs.add(p);

    for (const pair of allPairs) {
      const de = stdDealer.get(pair) ?? null;
      const coA = stdCommA.get(pair) ?? null;
      const coB = stdCommB.get(pair) ?? null;
      const se = stdSent.get(pair) ?? null;
      const st = stdStr.get(pair) ?? null;
      const ag = agreeMap.get(pair) ?? null;

      // ── DEALER ──
      if (de) {
        const ret = getNormRet(pair, de);
        if (ret !== null) {
          add("dealer_raw", ret);
          // Veto A: original commercial as voter
          if (countOpp(de, [stdCommA, stdSent, stdStr], pair) < 2) add("dealer_vetoA", ret);
          // Veto B: forced-raw commercial as voter
          if (countOpp(de, [stdCommB, stdSent, stdStr], pair) < 2) add("dealer_vetoB", ret);
          // TieVeto A: tiebreaker on original commercial
          if (countOpp(de, [tieCommA, tieSent, tieStr], pair) < 2) add("dealer_tievetoA", ret);
          // TieVeto B: forced-raw commercial as tiebreaker voter
          if (countOpp(de, [tieCommB, tieSent, tieStr], pair) < 2) add("dealer_tievetoB", ret);
        }
      }

      // ── SENTIMENT ──
      if (se) {
        const ret = getNormRet(pair, se);
        if (ret !== null) {
          add("sent_raw", ret);
          if (countOpp(se, [stdDealer, stdCommA, stdStr], pair) < 2) add("sent_vetoA", ret);
          if (countOpp(se, [stdDealer, stdCommB, stdStr], pair) < 2) add("sent_vetoB", ret);
          if (countOpp(se, [tieDealer, tieCommA, tieStr], pair) < 2) add("sent_tievetoA", ret);
          if (countOpp(se, [tieDealer, tieCommB, tieStr], pair) < 2) add("sent_tievetoB", ret);
        }
      }

      // ── STRENGTH ──
      if (st) {
        const ret = getNormRet(pair, st);
        if (ret !== null) {
          add("str_raw", ret);
          if (countOpp(st, [stdDealer, stdCommA, stdSent], pair) < 2) add("str_vetoA", ret);
          if (countOpp(st, [stdDealer, stdCommB, stdSent], pair) < 2) add("str_vetoB", ret);
          if (countOpp(st, [tieDealer, tieCommA, tieSent], pair) < 2) add("str_tievetoA", ret);
          if (countOpp(st, [tieDealer, tieCommB, tieSent], pair) < 2) add("str_tievetoB", ret);
        }
      }

      // ── COMMERCIAL (standalone comparison) ──
      if (coA) {
        const ret = getNormRet(pair, coA);
        if (ret !== null) {
          add("comm_std_raw", ret);
          if (countOpp(coA, [stdDealer, stdSent, stdStr], pair) < 2) add("comm_std_vetoA", ret);
        }
      }
      if (coB) {
        const ret = getNormRet(pair, coB);
        if (ret !== null) {
          add("comm_forced_raw", ret);
          if (countOpp(coB, [stdDealer, stdSent, stdStr], pair) < 2) add("comm_forced_vetoB", ret);
          if (countOpp(coB, [tieDealer, tieSent, tieStr], pair) < 2) add("comm_forced_tievetoB", ret);
        }
      }

      // ── 2-of-3 NoComm ──
      if (ag) {
        const ret = getNormRet(pair, ag);
        if (ret !== null) {
          add("agree_raw", ret);
          if (countOpp(ag, [stdDealer, stdCommA, stdSent, stdStr], pair) < 2) add("agree_vetoA", ret);
          if (countOpp(ag, [stdDealer, stdCommB, stdSent, stdStr], pair) < 2) add("agree_vetoB", ret);
          if (countOpp(ag, [tieDealer, tieCommA, tieSent, tieStr], pair) < 2) add("agree_tievetoA", ret);
          if (countOpp(ag, [tieDealer, tieCommB, tieSent, tieStr], pair) < 2) add("agree_tievetoB", ret);
        }
      }
    }

    // ── Portfolio sleeves ──
    // Tandem 3 Veto A vs B
    acc["tandem3_vetoA"].ret = acc["dealer_vetoA"].ret + acc["sent_vetoA"].ret + acc["str_vetoA"].ret;
    acc["tandem3_vetoA"].trades = acc["dealer_vetoA"].trades + acc["sent_vetoA"].trades + acc["str_vetoA"].trades;
    acc["tandem3_vetoA"].wins = acc["dealer_vetoA"].wins + acc["sent_vetoA"].wins + acc["str_vetoA"].wins;
    acc["tandem3_vetoA"].losses = acc["dealer_vetoA"].losses + acc["sent_vetoA"].losses + acc["str_vetoA"].losses;

    acc["tandem3_vetoB"].ret = acc["dealer_vetoB"].ret + acc["sent_vetoB"].ret + acc["str_vetoB"].ret;
    acc["tandem3_vetoB"].trades = acc["dealer_vetoB"].trades + acc["sent_vetoB"].trades + acc["str_vetoB"].trades;
    acc["tandem3_vetoB"].wins = acc["dealer_vetoB"].wins + acc["sent_vetoB"].wins + acc["str_vetoB"].wins;
    acc["tandem3_vetoB"].losses = acc["dealer_vetoB"].losses + acc["sent_vetoB"].losses + acc["str_vetoB"].losses;

    // Dealer+Sent Veto A vs B
    acc["dealer_sent_vetoA"].ret = acc["dealer_vetoA"].ret + acc["sent_vetoA"].ret;
    acc["dealer_sent_vetoA"].trades = acc["dealer_vetoA"].trades + acc["sent_vetoA"].trades;
    acc["dealer_sent_vetoA"].wins = acc["dealer_vetoA"].wins + acc["sent_vetoA"].wins;
    acc["dealer_sent_vetoA"].losses = acc["dealer_vetoA"].losses + acc["sent_vetoA"].losses;

    acc["dealer_sent_vetoB"].ret = acc["dealer_vetoB"].ret + acc["sent_vetoB"].ret;
    acc["dealer_sent_vetoB"].trades = acc["dealer_vetoB"].trades + acc["sent_vetoB"].trades;
    acc["dealer_sent_vetoB"].wins = acc["dealer_vetoB"].wins + acc["sent_vetoB"].wins;
    acc["dealer_sent_vetoB"].losses = acc["dealer_vetoB"].losses + acc["sent_vetoB"].losses;

    // Dealer+Sent TieVeto A vs B
    acc["dealer_sent_tievetoA"].ret = acc["dealer_tievetoA"].ret + acc["sent_tievetoA"].ret;
    acc["dealer_sent_tievetoA"].trades = acc["dealer_tievetoA"].trades + acc["sent_tievetoA"].trades;
    acc["dealer_sent_tievetoA"].wins = acc["dealer_tievetoA"].wins + acc["sent_tievetoA"].wins;
    acc["dealer_sent_tievetoA"].losses = acc["dealer_tievetoA"].losses + acc["sent_tievetoA"].losses;

    acc["dealer_sent_tievetoB"].ret = acc["dealer_tievetoB"].ret + acc["sent_tievetoB"].ret;
    acc["dealer_sent_tievetoB"].trades = acc["dealer_tievetoB"].trades + acc["sent_tievetoB"].trades;
    acc["dealer_sent_tievetoB"].wins = acc["dealer_tievetoB"].wins + acc["sent_tievetoB"].wins;
    acc["dealer_sent_tievetoB"].losses = acc["dealer_tievetoB"].losses + acc["sent_tievetoB"].losses;

    for (const k of sysKeys) {
      systems[k].push({ weekLabel, ...acc[k] });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(93)}`);
  console.log("  BASELINE VERIFICATION");
  console.log(`${"═".repeat(93)}`);
  const dBase = computeResults(systems["dealer_raw"]);
  const sBase = computeResults(systems["sent_raw"]);
  console.log(`  Dealer Raw:  ${dBase.totalTrades} trades, +${dBase.total.toFixed(2)}%, ${dBase.maxDD.toFixed(2)}% DD  ${dBase.totalTrades === 230 && Math.abs(dBase.total - 73.18) < 0.15 ? "✓ MATCH" : "✗ MISMATCH"}`);
  console.log(`  Sent Raw:    ${sBase.totalTrades} trades, +${sBase.total.toFixed(2)}%, ${sBase.maxDD.toFixed(2)}% DD  ${sBase.totalTrades === 265 && Math.abs(sBase.total - 92.4) < 0.15 ? "✓ MATCH" : "✗ MISMATCH"}`);

  // SECTION 1: Side-by-side standalone
  console.log(`\n${"═".repeat(93)}`);
  console.log("  DEALER — Original (A) vs Forced-Raw Commercial Voter (B)");
  console.log(`${"═".repeat(93)}`);
  console.log(HEADER);
  console.log(DIV);
  printRow("Dealer Raw (baseline)", systems["dealer_raw"]);
  printRow("Dealer Veto [A] orig commercial", systems["dealer_vetoA"]);
  printRow("Dealer Veto [B] forced-raw comm", systems["dealer_vetoB"]);
  printRow("Dealer TieVeto [A] orig comm", systems["dealer_tievetoA"]);
  printRow("Dealer TieVeto [B] forced-raw comm", systems["dealer_tievetoB"]);

  console.log(`\n${"═".repeat(93)}`);
  console.log("  SENTIMENT — Original (A) vs Forced-Raw Commercial Voter (B)");
  console.log(`${"═".repeat(93)}`);
  console.log(HEADER);
  console.log(DIV);
  printRow("Sentiment Raw (baseline)", systems["sent_raw"]);
  printRow("Sent Veto [A] orig commercial", systems["sent_vetoA"]);
  printRow("Sent Veto [B] forced-raw comm", systems["sent_vetoB"]);
  printRow("Sent TieVeto [A] orig comm", systems["sent_tievetoA"]);
  printRow("Sent TieVeto [B] forced-raw comm", systems["sent_tievetoB"]);

  console.log(`\n${"═".repeat(93)}`);
  console.log("  STRENGTH — Original (A) vs Forced-Raw Commercial Voter (B)");
  console.log(`${"═".repeat(93)}`);
  console.log(HEADER);
  console.log(DIV);
  printRow("Strength Raw (baseline)", systems["str_raw"]);
  printRow("Str Veto [A] orig commercial", systems["str_vetoA"]);
  printRow("Str Veto [B] forced-raw comm", systems["str_vetoB"]);
  printRow("Str TieVeto [A] orig comm", systems["str_tievetoA"]);
  printRow("Str TieVeto [B] forced-raw comm", systems["str_tievetoB"]);

  console.log(`\n${"═".repeat(93)}`);
  console.log("  COMMERCIAL — Standard vs Forced-Raw (standalone)");
  console.log(`${"═".repeat(93)}`);
  console.log(HEADER);
  console.log(DIV);
  printRow("Commercial Std (baseline)", systems["comm_std_raw"]);
  printRow("Commercial Std + Veto", systems["comm_std_vetoA"]);
  printRow("Commercial Forced Raw", systems["comm_forced_raw"]);
  printRow("Comm Forced Raw + Veto [B]", systems["comm_forced_vetoB"]);
  printRow("Comm Forced Raw + TieVeto [B]", systems["comm_forced_tievetoB"]);

  console.log(`\n${"═".repeat(93)}`);
  console.log("  2-of-3 NoComm — Original (A) vs Forced-Raw Commercial Voter (B)");
  console.log(`${"═".repeat(93)}`);
  console.log(HEADER);
  console.log(DIV);
  printRow("2of3 NoComm Raw (baseline)", systems["agree_raw"]);
  printRow("2of3 Veto [A] orig commercial", systems["agree_vetoA"]);
  printRow("2of3 Veto [B] forced-raw comm", systems["agree_vetoB"]);
  printRow("2of3 TieVeto [A] orig comm", systems["agree_tievetoA"]);
  printRow("2of3 TieVeto [B] forced-raw comm", systems["agree_tievetoB"]);

  // SECTION 2: Portfolios
  console.log(`\n${"═".repeat(93)}`);
  console.log("  PORTFOLIOS — A vs B");
  console.log(`${"═".repeat(93)}`);
  console.log(HEADER);
  console.log(DIV);
  printRow("Tandem3 Veto [A]", systems["tandem3_vetoA"]);
  printRow("Tandem3 Veto [B] forced-raw", systems["tandem3_vetoB"]);
  console.log(DIV);
  printRow("Dealer+Sent Veto [A]", systems["dealer_sent_vetoA"]);
  printRow("Dealer+Sent Veto [B] forced-raw", systems["dealer_sent_vetoB"]);
  console.log(DIV);
  printRow("Dealer+Sent TieVeto [A]", systems["dealer_sent_tievetoA"]);
  printRow("Dealer+Sent TieVeto [B] forced-raw", systems["dealer_sent_tievetoB"]);

  // SECTION 3: Grand comparison — best of each
  console.log(`\n${"═".repeat(93)}`);
  console.log("  GRAND COMPARISON — Best Systems A vs B");
  console.log(`${"═".repeat(93)}`);
  console.log(HEADER);
  console.log(DIV);
  printRow("Dealer TieVeto [A]", systems["dealer_tievetoA"]);
  printRow("Dealer TieVeto [B]", systems["dealer_tievetoB"]);
  console.log(DIV);
  printRow("Sent TieVeto [A]", systems["sent_tievetoA"]);
  printRow("Sent TieVeto [B]", systems["sent_tievetoB"]);
  console.log(DIV);
  printRow("2of3 TieVeto [A]", systems["agree_tievetoA"]);
  printRow("2of3 TieVeto [B]", systems["agree_tievetoB"]);
  console.log(DIV);
  printRow("Dealer+Sent TieVeto [A]", systems["dealer_sent_tievetoA"]);
  printRow("Dealer+Sent TieVeto [B]", systems["dealer_sent_tievetoB"]);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
