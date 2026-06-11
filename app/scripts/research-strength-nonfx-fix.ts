/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-strength-nonfx-fix.ts
 *
 * Description:
 * Compares current non-FX strength normalization against raw-change and
 * ADR-normalized alternatives using locked weekly strength snapshots.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "../src/lib/strength/weeklyStrength";
import type { AssetClass } from "../src/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/STRENGTH_NONFX_FIX_RESEARCH_2026-04-04.md";
const NON_FX_ASSET_CLASSES: AssetClass[] = ["indices", "crypto", "commodities"];

type Direction = "LONG" | "SHORT";
type MethodKey =
  | "current_t1"
  | "current_ta"
  | "raw_threshold"
  | "raw_threshold_resolver"
  | "raw_weighted_resolver"
  | "raw_sign_sum"
  | "raw_24h"
  | "raw_strongest"
  | "raw_majority_24h"
  | "adr025_resolver"
  | "adr050_resolver"
  | "adr_weighted_resolver";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  returnPct: number;
  adrMultiplier: number;
  pairAdr: number;
  strength: WeeklyPairStrength;
  methods: Record<MethodKey, Direction | null>;
};

type Stats = {
  trades: number;
  totalPct: number;
  maxDdPct: number;
  winRatePct: number;
  losingWeeks: number;
  coverage: string;
};

const METHOD_LABELS: Record<MethodKey, string> = {
  current_t1: "Current T1",
  current_ta: "Current TA",
  raw_threshold: "Raw Threshold",
  raw_threshold_resolver: "Raw Threshold + Resolver",
  raw_weighted_resolver: "Raw Weighted Resolver",
  raw_sign_sum: "Raw Sign Sum",
  raw_24h: "Raw 24h Only",
  raw_strongest: "Raw Strongest Window",
  raw_majority_24h: "Raw Majority + 24h",
  adr025_resolver: "ADR 0.25 + Resolver",
  adr050_resolver: "ADR 0.50 + Resolver",
  adr_weighted_resolver: "ADR Weighted Resolver",
};

const RAW_THRESHOLDS: Record<AssetClass, number> = {
  fx: 0,
  crypto: 2,
  indices: 0.5,
  commodities: 1,
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signedPct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function computeMaxDd(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of weeklyReturns) {
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    maxDd = Math.max(maxDd, peak - cumulative);
  }
  return round(maxDd);
}

function signToDirection(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) return null;
  return value > 0 ? "LONG" : "SHORT";
}

function classifyWithThreshold(value: number | null, threshold: number): Direction | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value > threshold) return "LONG";
  if (value < -threshold) return "SHORT";
  return null;
}

function currentT1(ps: WeeklyPairStrength): Direction | null {
  return ps.compositeDirection === "NEUTRAL" ? null : ps.compositeDirection;
}

function currentTA(ps: WeeklyPairStrength): Direction | null {
  const t1 = currentT1(ps);
  if (t1) return t1;
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (!w.available || w.signedSpread === null || !Number.isFinite(w.signedSpread)) continue;
    sum += w.signedSpread;
    hasData = true;
  }
  return hasData ? signToDirection(sum) : null;
}

function rawThreshold(ps: WeeklyPairStrength): Direction | null {
  const threshold = RAW_THRESHOLDS[ps.assetClass];
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available || w.rawBase === null || !Number.isFinite(w.rawBase)) continue;
    const dir = classifyWithThreshold(w.rawBase, threshold);
    if (dir === "LONG") score += 1;
    if (dir === "SHORT") score -= 1;
  }
  return signToDirection(score);
}

function rawThresholdResolver(ps: WeeklyPairStrength): Direction | null {
  const baseline = rawThreshold(ps);
  if (baseline) return baseline;
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (!w.available || w.rawBase === null || !Number.isFinite(w.rawBase)) continue;
    sum += w.rawBase;
    hasData = true;
  }
  return hasData ? signToDirection(sum) : null;
}

function rawWeightedResolver(ps: WeeklyPairStrength): Direction | null {
  const baseline = rawThreshold(ps);
  if (baseline) return baseline;
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (!w.available || w.rawBase === null || !Number.isFinite(w.rawBase)) continue;
    const weight = w.window === "24h" ? 2 : 1;
    sum += weight * w.rawBase;
    hasData = true;
  }
  return hasData ? signToDirection(sum) : null;
}

function rawSignSum(ps: WeeklyPairStrength): Direction | null {
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (!w.available || w.rawBase === null || !Number.isFinite(w.rawBase)) continue;
    sum += w.rawBase;
    hasData = true;
  }
  return hasData ? signToDirection(sum) : null;
}

function raw24h(ps: WeeklyPairStrength): Direction | null {
  const window = ps.windows.find((w) => w.window === "24h");
  if (!window || !window.available || window.rawBase === null || !Number.isFinite(window.rawBase)) {
    return null;
  }
  return signToDirection(window.rawBase);
}

function rawStrongest(ps: WeeklyPairStrength): Direction | null {
  let best: number | null = null;
  for (const w of ps.windows) {
    if (!w.available || w.rawBase === null || !Number.isFinite(w.rawBase)) continue;
    if (best === null || Math.abs(w.rawBase) > Math.abs(best)) {
      best = w.rawBase;
    }
  }
  return signToDirection(best);
}

function rawMajority24h(ps: WeeklyPairStrength): Direction | null {
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available || w.rawBase === null || !Number.isFinite(w.rawBase) || w.rawBase === 0) continue;
    score += w.rawBase > 0 ? 1 : -1;
  }
  const majority = signToDirection(score);
  if (majority) return majority;
  return raw24h(ps);
}

function adrResolver(ps: WeeklyPairStrength, pairAdr: number, threshold: number, weighted: boolean): Direction | null {
  if (!(pairAdr > 0)) return null;
  let score = 0;
  let scoreHasData = false;
  let sum = 0;
  let sumHasData = false;
  for (const w of ps.windows) {
    if (!w.available || w.rawBase === null || !Number.isFinite(w.rawBase)) continue;
    const normalized = w.rawBase / pairAdr;
    const dir = classifyWithThreshold(normalized, threshold);
    if (dir === "LONG") score += 1;
    if (dir === "SHORT") score -= 1;
    if (dir) scoreHasData = true;
    const weight = weighted && w.window === "24h" ? 2 : 1;
    sum += weight * normalized;
    sumHasData = true;
  }
  const baseline = signToDirection(score);
  if (baseline) return baseline;
  if (!scoreHasData && !sumHasData) return null;
  return signToDirection(sum);
}

function directionalReturn(row: Row, direction: Direction) {
  return (direction === "SHORT" ? -row.returnPct : row.returnPct) * row.adrMultiplier;
}

function computeStats(rows: Row[], method: MethodKey, assetClass: AssetClass | "combined", possible: number): Stats {
  const filtered = assetClass === "combined" ? rows : rows.filter((row) => row.assetClass === assetClass);
  const byWeek = new Map<string, { ret: number; trades: number; wins: number }>();

  for (const row of filtered) {
    const direction = row.methods[method];
    if (!direction) continue;
    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
    week.ret += ret;
    week.trades += 1;
    if (ret > 0) week.wins += 1;
    byWeek.set(row.weekOpenUtc, week);
  }

  const weekly = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalTrades = weekly.reduce((sum, [, value]) => sum + value.trades, 0);
  const totalWins = weekly.reduce((sum, [, value]) => sum + value.wins, 0);
  const weeklyReturns = weekly.map(([, value]) => value.ret);

  return {
    trades: totalTrades,
    totalPct: round(weeklyReturns.reduce((sum, value) => sum + value, 0)),
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 1) : 0,
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    coverage: `${totalTrades}/${possible}`,
  };
}

function renderMethodTable(rows: Row[], possibleByClass: Record<AssetClass, number>) {
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const lines = ["## Method Results", ""];
  for (const method of Object.keys(METHOD_LABELS) as MethodKey[]) {
    lines.push(`### ${METHOD_LABELS[method]}`);
    lines.push("");
    lines.push("| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const assetClass of NON_FX_ASSET_CLASSES) {
      const stats = computeStats(rows, method, assetClass, possibleByClass[assetClass]);
      lines.push(
        `| ${assetClass} | ${stats.trades} | ${signedPct(stats.totalPct)} | ${stats.maxDdPct.toFixed(2)}% | ${stats.winRatePct.toFixed(1)}% | ${stats.losingWeeks} | ${stats.coverage} |`,
      );
    }
    const combined = computeStats(rows, method, "combined", combinedPossible);
    lines.push(
      `| combined | ${combined.trades} | ${signedPct(combined.totalPct)} | ${combined.maxDdPct.toFixed(2)}% | ${combined.winRatePct.toFixed(1)}% | ${combined.losingWeeks} | ${combined.coverage} |`,
    );
    lines.push("");
  }
  return lines.join("\n");
}

function renderSummary(rows: Row[], possibleByClass: Record<AssetClass, number>) {
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const summary = (Object.keys(METHOD_LABELS) as MethodKey[]).map((method) => ({
    method,
    stats: computeStats(rows, method, "combined", combinedPossible),
  }));
  const sorted = [...summary].sort(
    (a, b) =>
      a.stats.losingWeeks - b.stats.losingWeeks ||
      a.stats.maxDdPct - b.stats.maxDdPct ||
      b.stats.totalPct - a.stats.totalPct ||
      b.stats.winRatePct - a.stats.winRatePct,
  );

  const lines = [
    "## Summary",
    "",
    "| Method | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of sorted) {
    lines.push(
      `| ${METHOD_LABELS[row.method]} | ${row.stats.trades} | ${signedPct(row.stats.totalPct)} | ${row.stats.maxDdPct.toFixed(2)}% | ${row.stats.winRatePct.toFixed(1)}% | ${row.stats.losingWeeks} | ${row.stats.coverage} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderCryptoDiagnostic(rows: Row[]) {
  const cryptoRows = rows.filter((row) => row.assetClass === "crypto");
  const methods = Object.keys(METHOD_LABELS) as MethodKey[];
  const lines = [
    "## Crypto Anti-Correlation Diagnostic",
    "",
    "| Method | Opposite BTC/ETH | Same Direction | Unresolved Weeks |",
    "| --- | ---: | ---: | ---: |",
  ];

  for (const method of methods) {
    let opposite = 0;
    let same = 0;
    let unresolved = 0;
    const weeks = [...new Set(cryptoRows.map((row) => row.weekOpenUtc))];
    for (const week of weeks) {
      const btc = cryptoRows.find((row) => row.weekOpenUtc === week && row.pair === "BTCUSD")?.methods[method] ?? null;
      const eth = cryptoRows.find((row) => row.weekOpenUtc === week && row.pair === "ETHUSD")?.methods[method] ?? null;
      if (!btc || !eth) {
        unresolved += 1;
      } else if (btc === eth) {
        same += 1;
      } else {
        opposite += 1;
      }
    }
    lines.push(`| ${METHOD_LABELS[method]} | ${opposite} | ${same} | ${unresolved} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Strength Non-FX Fix Research                                 ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const possibleByClass = Object.fromEntries(
    NON_FX_ASSET_CLASSES.map((assetClass) => [assetClass, weeks.length * PAIRS_BY_ASSET_CLASS[assetClass].length]),
  ) as Record<AssetClass, number>;

  const rows: Row[] = [];

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const [weeklyReturns, adrMap, weeklyStrengths] = await Promise.all([
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
      readWeeklyPairStrengths(weekOpenUtc),
    ]);

    const returnsMap = new Map(
      weeklyReturns.map((row) => [
        row.symbol.toUpperCase(),
        {
          returnPct: row.returnPct,
          assetClass: row.assetClass,
        },
      ] as const),
    );

    for (const assetClass of NON_FX_ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const ret = returnsMap.get(pair);
        const ps = weeklyStrengths.find((row) => row.pair.toUpperCase() === pair);
        if (!ret || !ps || ps.availableWindows === 0) continue;

        const pairAdr = getAdrPct(adrMap, pair, ret.assetClass);
        const adrMultiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;

        rows.push({
          weekOpenUtc,
          assetClass,
          pair,
          returnPct: ret.returnPct,
          adrMultiplier,
          pairAdr,
          strength: ps,
          methods: {
            current_t1: currentT1(ps),
            current_ta: currentTA(ps),
            raw_threshold: rawThreshold(ps),
            raw_threshold_resolver: rawThresholdResolver(ps),
            raw_weighted_resolver: rawWeightedResolver(ps),
            raw_sign_sum: rawSignSum(ps),
            raw_24h: raw24h(ps),
            raw_strongest: rawStrongest(ps),
            raw_majority_24h: rawMajority24h(ps),
            adr025_resolver: adrResolver(ps, pairAdr, 0.25, false),
            adr050_resolver: adrResolver(ps, pairAdr, 0.5, false),
            adr_weighted_resolver: adrResolver(ps, pairAdr, 0.25, true),
          },
        });
      }
    }
  }

  const lines: string[] = [];
  lines.push("# Strength Non-FX Fix Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} -> ${weekLabel(weeks.at(-1)!)}).`);
  lines.push("Universe: non-FX only (8 pairs × 10 weeks = 80 pair-weeks).");
  lines.push("");
  lines.push("Raw threshold assumptions:");
  lines.push(`- crypto: +/-${RAW_THRESHOLDS.crypto}%`);
  lines.push(`- indices: +/-${RAW_THRESHOLDS.indices}%`);
  lines.push(`- commodities: +/-${RAW_THRESHOLDS.commodities}%`);
  lines.push("");
  lines.push(renderMethodTable(rows, possibleByClass));
  lines.push(renderSummary(rows, possibleByClass));
  lines.push(renderCryptoDiagnostic(rows));

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
