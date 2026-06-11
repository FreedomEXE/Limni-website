/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-veto-2of4.ts
 *
 * Description:
 * Standardized 2/4 veto filter. All 4 sources (dealer, commercial,
 * sentiment, strength) participate. For each source's trade, if 2+
 * of the other 3 actively disagree (non-neutral + opposite direction),
 * the trade is vetoed.
 *
 * Tests each standalone source with the standardized veto and compares
 * to the previous 2/3 veto (without commercial in the pool).
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

type WeekEntry = { weekLabel: string; ret: number; trades: number; wins: number; losses: number };

type VetoedTrade = {
  weekLabel: string;
  pair: string;
  direction: Direction;
  ret: number;
  opposers: string[];
};

function computeResults(entries: WeekEntry[]) {
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

  const totalTrades = entries.reduce((s, e) => s + e.trades, 0);
  const totalWins = entries.reduce((s, e) => s + e.wins, 0);
  const losingWeeks = entries.filter((e) => e.ret < 0).length;
  const winningWeeks = entries.filter((e) => e.ret >= 0).length;
  const worstWeek = entries.length > 0 ? Math.min(...entries.map((e) => e.ret)) : 0;

  return { curve, maxDD, total: cumulative, totalTrades, totalWins, losingWeeks, winningWeeks, worstWeek };
}

function printSummaryRow(label: string, entries: WeekEntry[]) {
  const r = computeResults(entries);
  const winRate = r.totalTrades > 0 ? (r.totalWins / r.totalTrades) * 100 : 0;
  console.log(
    "  " +
    label.padEnd(26) +
    String(r.totalTrades).padStart(8) +
    r.total.toFixed(2).padStart(10) +
    r.maxDD.toFixed(2).padStart(10) +
    (r.maxDD > 0 ? (r.total / r.maxDD).toFixed(1) : "∞").padStart(8) +
    `${winRate.toFixed(1)}`.padStart(8) +
    r.worstWeek.toFixed(2).padStart(10) +
    String(r.losingWeeks).padStart(8) +
    String(r.winningWeeks).padStart(8),
  );
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Standardized 2/4 Veto — All Sources (ADR Normalized)     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();

  // Systems to track
  const systemKeys = [
    "dealer_raw", "dealer_veto4", "dealer_veto3",
    "sent_raw", "sent_veto4", "sent_veto3",
    "str_raw", "str_veto4", "str_veto3",
    "comm_raw", "comm_veto4", "comm_veto3",
  ] as const;

  const systems: Record<string, WeekEntry[]> = {};
  for (const k of systemKeys) systems[k] = [];

  // Vetoed trade logs
  const vetoLog: Record<string, VetoedTrade[]> = {
    dealer_veto4: [], dealer_veto3: [],
    sent_veto4: [], sent_veto3: [],
    str_veto4: [], str_veto3: [],
    comm_veto4: [], comm_veto3: [],
  };

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);

    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
    const commercialSignals = nonNeutralSignals(filterByModel(basketWeek, "commercial"));
    const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    // Direction maps
    const dealerMap = new Map<string, Direction>();
    for (const s of dealerSignals) dealerMap.set(s.symbol.toUpperCase(), s.direction as Direction);

    const commMap = new Map<string, Direction>();
    for (const s of commercialSignals) commMap.set(s.symbol.toUpperCase(), s.direction as Direction);

    const sentMap = new Map<string, Direction>();
    for (const s of sentimentSignals) sentMap.set(s.symbol.toUpperCase(), s.direction as Direction);

    const strMap = new Map<string, { direction: Direction; assetClass: AssetClass }>();
    for (const row of strengthRows) {
      if (row.compositeDirection !== "NEUTRAL") {
        strMap.set(row.pair.toUpperCase(), { direction: row.compositeDirection, assetClass: row.assetClass });
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

    // Init week accumulators
    const acc: Record<string, { ret: number; trades: number; wins: number; losses: number }> = {};
    for (const k of systemKeys) acc[k] = { ret: 0, trades: 0, wins: 0, losses: 0 };

    const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys(), ...strMap.keys()]);

    for (const pair of allPairs) {
      const de = dealerMap.get(pair) ?? null;
      const co = commMap.get(pair) ?? null;
      const se = sentMap.get(pair) ?? null;
      const st = strMap.get(pair)?.direction ?? null;
      const ac = strMap.get(pair)?.assetClass ?? inferAssetClass(pair);

      // Helper: count how many of given sources actively oppose a direction
      function countOpposers(dir: Direction, sources: { name: string; dir: Direction | null }[]) {
        const opposers: string[] = [];
        for (const s of sources) {
          if (s.dir !== null && s.dir !== dir) opposers.push(s.name);
        }
        return opposers;
      }

      function addTrade(
        rawKey: string, veto4Key: string, veto3Key: string,
        dir: Direction,
        others4: { name: string; dir: Direction | null }[],
        others3: { name: string; dir: Direction | null }[],
      ) {
        const ret = getNormRet(pair, dir, ac);
        if (ret === null) return;

        // Raw
        acc[rawKey].ret += ret;
        acc[rawKey].trades++;
        if (ret > 0) acc[rawKey].wins++; else acc[rawKey].losses++;

        // 2/4 veto (2+ of OTHER 3 oppose, all 4 sources in pool)
        const opp4 = countOpposers(dir, others4);
        if (opp4.length >= 2) {
          vetoLog[veto4Key].push({ weekLabel, pair, direction: dir, ret, opposers: opp4 });
        } else {
          acc[veto4Key].ret += ret;
          acc[veto4Key].trades++;
          if (ret > 0) acc[veto4Key].wins++; else acc[veto4Key].losses++;
        }

        // 2/3 veto (old style, only 3 sources in pool — no commercial)
        const opp3 = countOpposers(dir, others3);
        if (opp3.length >= 2) {
          vetoLog[veto3Key].push({ weekLabel, pair, direction: dir, ret, opposers: opp3 });
        } else {
          acc[veto3Key].ret += ret;
          acc[veto3Key].trades++;
          if (ret > 0) acc[veto3Key].wins++; else acc[veto3Key].losses++;
        }
      }

      // ── Dealer ──
      if (de) {
        addTrade(
          "dealer_raw", "dealer_veto4", "dealer_veto3",
          de,
          // 2/4: other 3 = commercial, sentiment, strength
          [{ name: "commercial", dir: co }, { name: "sentiment", dir: se }, { name: "strength", dir: st }],
          // 2/3: other 2 = sentiment, strength (original veto without commercial)
          [{ name: "sentiment", dir: se }, { name: "strength", dir: st }],
        );
      }

      // ── Sentiment ──
      if (se) {
        addTrade(
          "sent_raw", "sent_veto4", "sent_veto3",
          se,
          [{ name: "dealer", dir: de }, { name: "commercial", dir: co }, { name: "strength", dir: st }],
          [{ name: "dealer", dir: de }, { name: "strength", dir: st }],
        );
      }

      // ── Strength ──
      if (st) {
        addTrade(
          "str_raw", "str_veto4", "str_veto3",
          st,
          [{ name: "dealer", dir: de }, { name: "commercial", dir: co }, { name: "sentiment", dir: se }],
          [{ name: "dealer", dir: de }, { name: "sentiment", dir: se }],
        );
      }

      // ── Commercial ──
      if (co) {
        addTrade(
          "comm_raw", "comm_veto4", "comm_veto3",
          co,
          [{ name: "dealer", dir: de }, { name: "sentiment", dir: se }, { name: "strength", dir: st }],
          [{ name: "dealer", dir: de }, { name: "sentiment", dir: se }, { name: "strength", dir: st }],
        );
      }
    }

    for (const k of systemKeys) {
      systems[k].push({ weekLabel, ...acc[k] });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: Summary — all sources, raw vs 2/4 veto vs 2/3 veto
  // ═══════════════════════════════════════════════════════════════

  const header =
    "  " +
    "System".padEnd(26) +
    "Trades".padStart(8) +
    "Total %".padStart(10) +
    "Max DD %".padStart(10) +
    "R/DD".padStart(8) +
    "Win %".padStart(8) +
    "Worst Wk".padStart(10) +
    "Lose".padStart(8) +
    "Win".padStart(8);

  console.log(`\n${"═".repeat(98)}`);
  console.log("  DEALER: RAW vs 2/4 VETO vs 2/3 VETO");
  console.log(`${"═".repeat(98)}`);
  console.log(header);
  console.log(`  ${"─".repeat(94)}`);
  printSummaryRow("Dealer Raw", systems["dealer_raw"]);
  printSummaryRow("Dealer 2/4 Veto", systems["dealer_veto4"]);
  printSummaryRow("Dealer 2/3 Veto (old)", systems["dealer_veto3"]);

  // Dealer weekly curve
  const drRaw = computeResults(systems["dealer_raw"]);
  const drV4 = computeResults(systems["dealer_veto4"]);
  const drV3 = computeResults(systems["dealer_veto3"]);

  console.log(`\n  DEALER WEEKLY EQUITY CURVE`);
  console.log(
    "  " + "Week".padEnd(10) +
    "Raw".padStart(8) + "Cum".padStart(10) + "DD".padStart(8) +
    "  │" + "2/4".padStart(8) + "Cum".padStart(10) + "DD".padStart(8) +
    "  │" + "2/3".padStart(8) + "Cum".padStart(10) + "DD".padStart(8),
  );
  console.log(`  ${"─".repeat(90)}`);
  for (let i = 0; i < weeks.length; i++) {
    const r = drRaw.curve[i]!;
    const v4 = drV4.curve[i]!;
    const v3 = drV3.curve[i]!;
    console.log(
      "  " + r.weekLabel.padEnd(10) +
      r.ret.toFixed(2).padStart(8) + r.cumulative.toFixed(2).padStart(10) + r.dd.toFixed(2).padStart(8) +
      "  │" + v4.ret.toFixed(2).padStart(8) + v4.cumulative.toFixed(2).padStart(10) + v4.dd.toFixed(2).padStart(8) +
      "  │" + v3.ret.toFixed(2).padStart(8) + v3.cumulative.toFixed(2).padStart(10) + v3.dd.toFixed(2).padStart(8),
    );
  }

  // Vetoed trades detail for dealer
  for (const [key, label] of [["dealer_veto4", "DEALER 2/4 VETO"], ["dealer_veto3", "DEALER 2/3 VETO"]] as const) {
    const trades = vetoLog[key];
    const wins = trades.filter((t) => t.ret > 0).length;
    const total = trades.reduce((s, t) => s + t.ret, 0);
    console.log(
      `\n  ${label}: ${trades.length} vetoed — ` +
      `${wins}W/${trades.length - wins}L (${trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : "0.0"}% WR) — ` +
      `Total: ${total >= 0 ? "+" : ""}${total.toFixed(2)}%`,
    );
    for (const t of trades.sort((a, b) => a.weekLabel.localeCompare(b.weekLabel))) {
      const marker = t.ret > 0 ? "✓" : "✗";
      console.log(
        `    ${marker} ${t.weekLabel.padEnd(8)} ${t.pair.padEnd(12)} ${t.direction.padEnd(6)} ${t.ret >= 0 ? "+" : ""}${t.ret.toFixed(3)}%  by: ${t.opposers.join(", ")}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: Sentiment
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(98)}`);
  console.log("  SENTIMENT: RAW vs 2/4 VETO vs 2/3 VETO");
  console.log(`${"═".repeat(98)}`);
  console.log(header);
  console.log(`  ${"─".repeat(94)}`);
  printSummaryRow("Sentiment Raw", systems["sent_raw"]);
  printSummaryRow("Sentiment 2/4 Veto", systems["sent_veto4"]);
  printSummaryRow("Sentiment 2/3 Veto (old)", systems["sent_veto3"]);

  for (const [key, label] of [["sent_veto4", "SENTIMENT 2/4 VETO"], ["sent_veto3", "SENTIMENT 2/3 VETO"]] as const) {
    const trades = vetoLog[key];
    const wins = trades.filter((t) => t.ret > 0).length;
    const total = trades.reduce((s, t) => s + t.ret, 0);
    console.log(
      `\n  ${label}: ${trades.length} vetoed — ` +
      `${wins}W/${trades.length - wins}L (${trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : "0.0"}% WR) — ` +
      `Total: ${total >= 0 ? "+" : ""}${total.toFixed(2)}%`,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: Strength
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(98)}`);
  console.log("  STRENGTH: RAW vs 2/4 VETO vs 2/3 VETO");
  console.log(`${"═".repeat(98)}`);
  console.log(header);
  console.log(`  ${"─".repeat(94)}`);
  printSummaryRow("Strength Raw", systems["str_raw"]);
  printSummaryRow("Strength 2/4 Veto", systems["str_veto4"]);
  printSummaryRow("Strength 2/3 Veto (old)", systems["str_veto3"]);

  for (const [key, label] of [["str_veto4", "STRENGTH 2/4 VETO"], ["str_veto3", "STRENGTH 2/3 VETO"]] as const) {
    const trades = vetoLog[key];
    const wins = trades.filter((t) => t.ret > 0).length;
    const total = trades.reduce((s, t) => s + t.ret, 0);
    console.log(
      `\n  ${label}: ${trades.length} vetoed — ` +
      `${wins}W/${trades.length - wins}L (${trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : "0.0"}% WR) — ` +
      `Total: ${total >= 0 ? "+" : ""}${total.toFixed(2)}%`,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: Commercial (for reference)
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(98)}`);
  console.log("  COMMERCIAL: RAW vs 2/4 VETO");
  console.log(`${"═".repeat(98)}`);
  console.log(header);
  console.log(`  ${"─".repeat(94)}`);
  printSummaryRow("Commercial Raw", systems["comm_raw"]);
  printSummaryRow("Commercial 2/4 Veto", systems["comm_veto4"]);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: Grand comparison
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(98)}`);
  console.log("  GRAND COMPARISON — ALL SOURCES WITH 2/4 VETO");
  console.log(`${"═".repeat(98)}`);
  console.log(header);
  console.log(`  ${"─".repeat(94)}`);
  printSummaryRow("Dealer 2/4 Veto", systems["dealer_veto4"]);
  printSummaryRow("Sentiment 2/4 Veto", systems["sent_veto4"]);
  printSummaryRow("Strength 2/4 Veto", systems["str_veto4"]);
  printSummaryRow("Commercial 2/4 Veto", systems["comm_veto4"]);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
