/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-commercial-veto.ts
 *
 * Description:
 * Tests whether the veto filter can rescue commercial standalone.
 * Three variants:
 *   1. Commercial raw (no filter)
 *   2. Commercial vetoed by 3-of-3 opposing (dealer + sentiment + strength all disagree)
 *   3. Commercial vetoed by 2-of-3 opposing (any 2 of dealer/sentiment/strength disagree)
 *
 * Also re-runs dealer/sentiment/strength vetoed for side-by-side comparison.
 * Reports weekly equity curves and drawdown for all variants.
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

type WeeklyEntry = { weekLabel: string; ret: number; trades: number; wins: number; losses: number };

function computeDrawdown(entries: WeeklyEntry[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  const curve: { weekLabel: string; ret: number; cumulative: number; dd: number }[] = [];

  for (const e of entries) {
    cumulative += e.ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
    curve.push({ weekLabel: e.weekLabel, ret: e.ret, cumulative, dd });
  }

  return { curve, maxDD, total: cumulative };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Commercial Veto Analysis (ADR Normalized)                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();

  // Track per-system weekly data
  const systems: Record<string, WeeklyEntry[]> = {
    "comm_raw": [],
    "comm_veto3": [],    // vetoed when all 3 others oppose
    "comm_veto2": [],    // vetoed when 2+ of 3 others oppose
    "dealer_raw": [],
    "dealer_veto": [],
    "sent_raw": [],
    "sent_veto": [],
    "str_raw": [],
    "str_veto": [],
  };

  // Track vetoed trades for analysis
  const vetoedTrades: {
    variant: string;
    weekLabel: string;
    pair: string;
    direction: Direction;
    ret: number;
    opposers: string[];
  }[] = [];

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);

    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
    const commercialSignals = nonNeutralSignals(filterByModel(basketWeek, "commercial"));
    const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    // Build direction maps
    const dealerMap = new Map<string, Direction>();
    for (const s of dealerSignals) dealerMap.set(s.symbol.toUpperCase(), s.direction as Direction);

    const commMap = new Map<string, Direction>();
    for (const s of commercialSignals) commMap.set(s.symbol.toUpperCase(), s.direction as Direction);

    const sentMap = new Map<string, Direction>();
    for (const s of sentimentSignals) sentMap.set(s.symbol.toUpperCase(), s.direction as Direction);

    const strengthMap = new Map<string, { direction: Direction; assetClass: AssetClass }>();
    for (const row of strengthRows) {
      if (row.compositeDirection !== "NEUTRAL") {
        strengthMap.set(row.pair.toUpperCase(), { direction: row.compositeDirection, assetClass: row.assetClass });
      }
    }

    const returnMap = new Map<string, number>();
    for (const r of weeklyReturns) returnMap.set(r.symbol.toUpperCase(), r.returnPct);

    function getNormRet(pair: string, direction: Direction, ac: AssetClass): number | null {
      const raw = returnMap.get(pair);
      if (raw === undefined) return null;
      const directed = direction === "SHORT" ? -raw : raw;
      const pairAdr = getAdrPct(adrMap, pair, ac);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      return directed * multiplier;
    }

    // Weekly accumulators
    const weekAcc: Record<string, { ret: number; trades: number; wins: number; losses: number }> = {};
    for (const key of Object.keys(systems)) {
      weekAcc[key] = { ret: 0, trades: 0, wins: 0, losses: 0 };
    }

    const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys(), ...strengthMap.keys()]);

    for (const pair of allPairs) {
      const de = dealerMap.get(pair) ?? null;
      const co = commMap.get(pair) ?? null;
      const se = sentMap.get(pair) ?? null;
      const st = strengthMap.get(pair)?.direction ?? null;
      const ac = strengthMap.get(pair)?.assetClass ?? inferAssetClass(pair);

      // ── Commercial sleeves ──
      if (co) {
        const ret = getNormRet(pair, co, ac);
        if (ret !== null) {
          // Raw
          weekAcc["comm_raw"].ret += ret;
          weekAcc["comm_raw"].trades++;
          if (ret > 0) weekAcc["comm_raw"].wins++;
          else weekAcc["comm_raw"].losses++;

          // Count how many of the 3 others actively oppose
          const opposers: string[] = [];
          if (de !== null && de !== co) opposers.push("dealer");
          if (se !== null && se !== co) opposers.push("sentiment");
          if (st !== null && st !== co) opposers.push("strength");

          // Veto3: all 3 must oppose
          if (opposers.length >= 3) {
            vetoedTrades.push({ variant: "veto3", weekLabel, pair, direction: co, ret, opposers });
          } else {
            weekAcc["comm_veto3"].ret += ret;
            weekAcc["comm_veto3"].trades++;
            if (ret > 0) weekAcc["comm_veto3"].wins++;
            else weekAcc["comm_veto3"].losses++;
          }

          // Veto2: 2+ of 3 must oppose
          if (opposers.length >= 2) {
            vetoedTrades.push({ variant: "veto2", weekLabel, pair, direction: co, ret, opposers });
          } else {
            weekAcc["comm_veto2"].ret += ret;
            weekAcc["comm_veto2"].trades++;
            if (ret > 0) weekAcc["comm_veto2"].wins++;
            else weekAcc["comm_veto2"].losses++;
          }
        }
      }

      // ── Dealer (veto = sent+str both oppose, same as before) ──
      if (de) {
        const ret = getNormRet(pair, de, ac);
        if (ret !== null) {
          weekAcc["dealer_raw"].ret += ret;
          weekAcc["dealer_raw"].trades++;
          if (ret > 0) weekAcc["dealer_raw"].wins++;
          else weekAcc["dealer_raw"].losses++;

          const seOpp = se !== null && se !== de;
          const stOpp = st !== null && st !== de;
          if (!(seOpp && stOpp)) {
            weekAcc["dealer_veto"].ret += ret;
            weekAcc["dealer_veto"].trades++;
            if (ret > 0) weekAcc["dealer_veto"].wins++;
            else weekAcc["dealer_veto"].losses++;
          }
        }
      }

      // ── Sentiment (veto = dealer+str both oppose) ──
      if (se) {
        const ret = getNormRet(pair, se, ac);
        if (ret !== null) {
          weekAcc["sent_raw"].ret += ret;
          weekAcc["sent_raw"].trades++;
          if (ret > 0) weekAcc["sent_raw"].wins++;
          else weekAcc["sent_raw"].losses++;

          const deOpp = de !== null && de !== se;
          const stOpp = st !== null && st !== se;
          if (!(deOpp && stOpp)) {
            weekAcc["sent_veto"].ret += ret;
            weekAcc["sent_veto"].trades++;
            if (ret > 0) weekAcc["sent_veto"].wins++;
            else weekAcc["sent_veto"].losses++;
          }
        }
      }

      // ── Strength (veto = dealer+sent both oppose) ──
      if (st) {
        const ret = getNormRet(pair, st, ac);
        if (ret !== null) {
          weekAcc["str_raw"].ret += ret;
          weekAcc["str_raw"].trades++;
          if (ret > 0) weekAcc["str_raw"].wins++;
          else weekAcc["str_raw"].losses++;

          const deOpp = de !== null && de !== st;
          const seOpp = se !== null && se !== st;
          if (!(deOpp && seOpp)) {
            weekAcc["str_veto"].ret += ret;
            weekAcc["str_veto"].trades++;
            if (ret > 0) weekAcc["str_veto"].wins++;
            else weekAcc["str_veto"].losses++;
          }
        }
      }
    }

    for (const key of Object.keys(systems)) {
      systems[key].push({ weekLabel, ...weekAcc[key] });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: Summary table
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  ALL SOURCES: RAW vs VETOED — DRAWDOWN FOCUS");
  console.log(`${"═".repeat(100)}`);
  console.log(
    "  " +
    "System".padEnd(24) +
    "Trades".padStart(8) +
    "Total %".padStart(10) +
    "Max DD %".padStart(10) +
    "R/DD".padStart(8) +
    "Win %".padStart(8) +
    "Worst Wk".padStart(10) +
    "Lose Wks".padStart(10) +
    "Win Wks".padStart(9),
  );
  console.log(`  ${"─".repeat(96)}`);

  const displayOrder = [
    ["Commercial Raw", "comm_raw"],
    ["Commercial Veto(3of3)", "comm_veto3"],
    ["Commercial Veto(2of3)", "comm_veto2"],
    ["─", ""],
    ["Dealer Raw", "dealer_raw"],
    ["Dealer Vetoed", "dealer_veto"],
    ["─", ""],
    ["Sentiment Raw", "sent_raw"],
    ["Sentiment Vetoed", "sent_veto"],
    ["─", ""],
    ["Strength Raw", "str_raw"],
    ["Strength Vetoed", "str_veto"],
  ] as const;

  for (const [label, key] of displayOrder) {
    if (key === "") {
      console.log(`  ${"─".repeat(96)}`);
      continue;
    }
    const data = systems[key];
    const { maxDD, total } = computeDrawdown(data);
    const totalTrades = data.reduce((s, d) => s + d.trades, 0);
    const totalWins = data.reduce((s, d) => s + d.wins, 0);
    const worstWeek = Math.min(...data.map((d) => d.ret));
    const loseWks = data.filter((d) => d.ret < 0).length;
    const winWks = data.filter((d) => d.ret >= 0).length;
    const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

    console.log(
      "  " +
      label.padEnd(24) +
      String(totalTrades).padStart(8) +
      total.toFixed(2).padStart(10) +
      maxDD.toFixed(2).padStart(10) +
      (maxDD > 0 ? (total / maxDD).toFixed(1) : "∞").padStart(8) +
      `${winRate.toFixed(1)}`.padStart(8) +
      worstWeek.toFixed(2).padStart(10) +
      String(loseWks).padStart(10) +
      String(winWks).padStart(9),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: Commercial weekly equity curve
  // ═══════════════════════════════════════════════════════════════

  const commRawDD = computeDrawdown(systems["comm_raw"]);
  const commV3DD = computeDrawdown(systems["comm_veto3"]);
  const commV2DD = computeDrawdown(systems["comm_veto2"]);

  console.log(`\n${"═".repeat(100)}`);
  console.log("  COMMERCIAL WEEKLY EQUITY CURVE");
  console.log(`${"═".repeat(100)}`);
  console.log(
    "  " +
    "Week".padEnd(10) +
    "Raw".padStart(10) +
    "Cum Raw".padStart(10) +
    "DD Raw".padStart(8) +
    "  │" +
    "V3of3".padStart(10) +
    "Cum V3".padStart(10) +
    "DD V3".padStart(8) +
    "  │" +
    "V2of3".padStart(10) +
    "Cum V2".padStart(10) +
    "DD V2".padStart(8),
  );
  console.log(`  ${"─".repeat(96)}`);

  for (let i = 0; i < weeks.length; i++) {
    const r = commRawDD.curve[i]!;
    const v3 = commV3DD.curve[i]!;
    const v2 = commV2DD.curve[i]!;

    console.log(
      "  " +
      r.weekLabel.padEnd(10) +
      r.ret.toFixed(2).padStart(10) +
      r.cumulative.toFixed(2).padStart(10) +
      r.dd.toFixed(2).padStart(8) +
      "  │" +
      v3.ret.toFixed(2).padStart(10) +
      v3.cumulative.toFixed(2).padStart(10) +
      v3.dd.toFixed(2).padStart(8) +
      "  │" +
      v2.ret.toFixed(2).padStart(10) +
      v2.cumulative.toFixed(2).padStart(10) +
      v2.dd.toFixed(2).padStart(8),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: What commercial trades got vetoed
  // ═══════════════════════════════════════════════════════════════

  for (const variant of ["veto3", "veto2"] as const) {
    const trades = vetoedTrades.filter((t) => t.variant === variant);
    if (trades.length === 0) {
      console.log(`\n  COMMERCIAL ${variant.toUpperCase()}: 0 trades vetoed`);
      continue;
    }
    const wins = trades.filter((t) => t.ret > 0).length;
    const total = trades.reduce((s, t) => s + t.ret, 0);
    console.log(
      `\n  COMMERCIAL ${variant.toUpperCase()}: ${trades.length} vetoed — ` +
      `${wins}W/${trades.length - wins}L (${((wins / trades.length) * 100).toFixed(1)}% WR) — ` +
      `Total: ${total >= 0 ? "+" : ""}${total.toFixed(2)}% — ` +
      `Avg: ${(total / trades.length).toFixed(3)}%`,
    );
    for (const t of trades.sort((a, b) => a.weekLabel.localeCompare(b.weekLabel))) {
      const marker = t.ret > 0 ? "✓" : "✗";
      console.log(
        `    ${marker} ${t.weekLabel.padEnd(8)} ${t.pair.padEnd(12)} ${t.direction.padEnd(6)} ${t.ret >= 0 ? "+" : ""}${t.ret.toFixed(3)}%  opposed by: ${t.opposers.join(", ")}`,
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
