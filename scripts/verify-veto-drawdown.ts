/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-veto-drawdown.ts
 *
 * Description:
 * Computes weekly equity curves and max drawdown for:
 *   - Each source raw vs vetoed
 *   - Combined veto basket vs 2-of-3 NoComm
 * Focuses on what the veto does to drawdown, not just total return.
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

type EquityCurve = { weekLabel: string; weekReturn: number; cumulative: number; drawdown: number }[];

function buildEquityCurve(weeklyReturns: { weekLabel: string; ret: number }[]): { curve: EquityCurve; maxDD: number } {
  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  const curve: EquityCurve = [];

  for (const { weekLabel, ret } of weeklyReturns) {
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
    curve.push({ weekLabel, weekReturn: ret, cumulative, drawdown: dd });
  }

  return { curve, maxDD };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Veto Drawdown Analysis (ADR Normalized)                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();

  // Per-week accumulators for each system variant
  const weeklyData: Record<string, { weekLabel: string; ret: number }[]> = {
    "dealer_raw": [],
    "dealer_vetoed": [],
    "sentiment_raw": [],
    "sentiment_vetoed": [],
    "strength_raw": [],
    "strength_vetoed": [],
    "veto_combined": [],
    "2of3_nocomm": [],
  };

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);

    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
    const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    const dealerMap = new Map<string, Direction>();
    for (const s of dealerSignals) dealerMap.set(s.symbol.toUpperCase(), s.direction as Direction);

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

    const allPairs = new Set([...dealerMap.keys(), ...sentMap.keys(), ...strengthMap.keys()]);

    function getNormalizedReturn(pair: string, direction: Direction, ac: AssetClass): number | null {
      const raw = returnMap.get(pair);
      if (raw === undefined) return null;
      const directed = direction === "SHORT" ? -raw : raw;
      const pairAdr = getAdrPct(adrMap, pair, ac);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      return directed * multiplier;
    }

    // Weekly totals
    let dealerRawWeek = 0, dealerVetoedWeek = 0;
    let sentRawWeek = 0, sentVetoedWeek = 0;
    let strRawWeek = 0, strVetoedWeek = 0;
    let vetoCombinedWeek = 0;
    let nocommWeek = 0;

    const combinedPairDone = new Set<string>();
    const nocommPairDone = new Set<string>();

    for (const pair of allPairs) {
      const de = dealerMap.get(pair) ?? null;
      const se = sentMap.get(pair) ?? null;
      const st = strengthMap.get(pair)?.direction ?? null;
      const ac = strengthMap.get(pair)?.assetClass ?? inferAssetClass(pair);

      // ── Dealer sleeve ──
      if (de) {
        const ret = getNormalizedReturn(pair, de, ac);
        if (ret !== null) {
          dealerRawWeek += ret;
          const seOpposes = se !== null && se !== de;
          const stOpposes = st !== null && st !== de;
          if (!(seOpposes && stOpposes)) {
            dealerVetoedWeek += ret;
          }
        }
      }

      // ── Sentiment sleeve ──
      if (se) {
        const ret = getNormalizedReturn(pair, se, ac);
        if (ret !== null) {
          sentRawWeek += ret;
          const deOpposes = de !== null && de !== se;
          const stOpposes = st !== null && st !== se;
          if (!(deOpposes && stOpposes)) {
            sentVetoedWeek += ret;
          }
        }
      }

      // ── Strength sleeve ──
      if (st) {
        const ret = getNormalizedReturn(pair, st, ac);
        if (ret !== null) {
          strRawWeek += ret;
          const deOpposes = de !== null && de !== st;
          const seOpposes = se !== null && se !== st;
          if (!(deOpposes && seOpposes)) {
            strVetoedWeek += ret;
          }
        }
      }

      // ── Veto combined basket ──
      if (!combinedPairDone.has(pair)) {
        const surviving: { direction: Direction }[] = [];
        if (de) {
          const seOpp = se !== null && se !== de;
          const stOpp = st !== null && st !== de;
          if (!(seOpp && stOpp)) surviving.push({ direction: de });
        }
        if (se) {
          const deOpp = de !== null && de !== se;
          const stOpp = st !== null && st !== se;
          if (!(deOpp && stOpp)) surviving.push({ direction: se });
        }
        if (st) {
          const deOpp = de !== null && de !== st;
          const seOpp = se !== null && se !== st;
          if (!(deOpp && seOpp)) surviving.push({ direction: st });
        }

        if (surviving.length > 0) {
          const longs = surviving.filter((s) => s.direction === "LONG").length;
          const shorts = surviving.filter((s) => s.direction === "SHORT").length;
          if (!(longs > 0 && shorts > 0)) {
            const dir = surviving[0]!.direction;
            const ret = getNormalizedReturn(pair, dir, ac);
            if (ret !== null) {
              vetoCombinedWeek += ret;
              combinedPairDone.add(pair);
            }
          }
        }
      }

      // ── 2-of-3 NoComm ──
      if (!nocommPairDone.has(pair)) {
        const votes = [de, se, st].filter(Boolean) as Direction[];
        const longs = votes.filter((v) => v === "LONG").length;
        const shorts = votes.filter((v) => v === "SHORT").length;
        let dir: Direction | null = null;
        if (longs >= 2) dir = "LONG";
        else if (shorts >= 2) dir = "SHORT";
        if (dir) {
          const ret = getNormalizedReturn(pair, dir, ac);
          if (ret !== null) {
            nocommWeek += ret;
            nocommPairDone.add(pair);
          }
        }
      }
    }

    weeklyData["dealer_raw"].push({ weekLabel, ret: dealerRawWeek });
    weeklyData["dealer_vetoed"].push({ weekLabel, ret: dealerVetoedWeek });
    weeklyData["sentiment_raw"].push({ weekLabel, ret: sentRawWeek });
    weeklyData["sentiment_vetoed"].push({ weekLabel, ret: sentVetoedWeek });
    weeklyData["strength_raw"].push({ weekLabel, ret: strRawWeek });
    weeklyData["strength_vetoed"].push({ weekLabel, ret: strVetoedWeek });
    weeklyData["veto_combined"].push({ weekLabel, ret: vetoCombinedWeek });
    weeklyData["2of3_nocomm"].push({ weekLabel, ret: nocommWeek });
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: Drawdown comparison table
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(90)}`);
  console.log("  DRAWDOWN COMPARISON: RAW vs VETOED");
  console.log(`${"═".repeat(90)}`);
  console.log(
    "  " +
    "System".padEnd(24) +
    "Total %".padStart(10) +
    "Max DD %".padStart(10) +
    "R/DD".padStart(8) +
    "Worst Wk".padStart(10) +
    "Losing Wks".padStart(12) +
    "Win Wks".padStart(10),
  );
  console.log(`  ${"─".repeat(86)}`);

  const systems = [
    ["Dealer Raw", "dealer_raw"],
    ["Dealer Vetoed", "dealer_vetoed"],
    ["Sentiment Raw", "sentiment_raw"],
    ["Sentiment Vetoed", "sentiment_vetoed"],
    ["Strength Raw", "strength_raw"],
    ["Strength Vetoed", "strength_vetoed"],
    ["", ""],
    ["Veto Combined", "veto_combined"],
    ["2-of-3 NoComm", "2of3_nocomm"],
  ] as const;

  for (const [label, key] of systems) {
    if (key === "") {
      console.log(`  ${"─".repeat(86)}`);
      continue;
    }
    const data = weeklyData[key];
    const { curve, maxDD } = buildEquityCurve(data);
    const total = curve.at(-1)?.cumulative ?? 0;
    const worstWeek = Math.min(...data.map((d) => d.ret));
    const losingWeeks = data.filter((d) => d.ret < 0).length;
    const winWeeks = data.filter((d) => d.ret >= 0).length;

    console.log(
      "  " +
      label.padEnd(24) +
      total.toFixed(2).padStart(10) +
      maxDD.toFixed(2).padStart(10) +
      (maxDD > 0 ? (total / maxDD).toFixed(1) : "∞").padStart(8) +
      worstWeek.toFixed(2).padStart(10) +
      String(losingWeeks).padStart(12) +
      String(winWeeks).padStart(10),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: Weekly equity curves side by side
  // ═══════════════════════════════════════════════════════════════

  const dealerRawCurve = buildEquityCurve(weeklyData["dealer_raw"]);
  const dealerVetoCurve = buildEquityCurve(weeklyData["dealer_vetoed"]);
  const vetoCombCurve = buildEquityCurve(weeklyData["veto_combined"]);
  const nocommCurve = buildEquityCurve(weeklyData["2of3_nocomm"]);

  console.log(`\n${"═".repeat(110)}`);
  console.log("  WEEKLY EQUITY CURVES");
  console.log(`${"═".repeat(110)}`);
  console.log(
    "  " +
    "Week".padEnd(10) +
    "D:Raw".padStart(10) +
    "D:Veto".padStart(10) +
    "D:Δ".padStart(8) +
    "  │" +
    "VetoComb".padStart(10) +
    "2of3NC".padStart(10) +
    "Δ".padStart(8) +
    "  │" +
    "D:Raw DD".padStart(10) +
    "D:Veto DD".padStart(11) +
    "VC DD".padStart(8) +
    "NC DD".padStart(8),
  );
  console.log(`  ${"─".repeat(106)}`);

  for (let i = 0; i < weeks.length; i++) {
    const dr = dealerRawCurve.curve[i]!;
    const dv = dealerVetoCurve.curve[i]!;
    const vc = vetoCombCurve.curve[i]!;
    const nc = nocommCurve.curve[i]!;

    console.log(
      "  " +
      dr.weekLabel.padEnd(10) +
      dr.cumulative.toFixed(2).padStart(10) +
      dv.cumulative.toFixed(2).padStart(10) +
      `${(dv.cumulative - dr.cumulative) >= 0 ? "+" : ""}${(dv.cumulative - dr.cumulative).toFixed(2)}`.padStart(8) +
      "  │" +
      vc.cumulative.toFixed(2).padStart(10) +
      nc.cumulative.toFixed(2).padStart(10) +
      `${(vc.cumulative - nc.cumulative) >= 0 ? "+" : ""}${(vc.cumulative - nc.cumulative).toFixed(2)}`.padStart(8) +
      "  │" +
      dr.drawdown.toFixed(2).padStart(10) +
      dv.drawdown.toFixed(2).padStart(11) +
      vc.drawdown.toFixed(2).padStart(8) +
      nc.drawdown.toFixed(2).padStart(8),
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
