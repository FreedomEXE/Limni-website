/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-strength-windows.ts
 *
 * Description:
 * Tests weekly/monthly window extensions for strength using current normalized,
 * hybrid, and universal raw-sign methodologies across all asset classes.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getPairReturnHistory, getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "../src/lib/strength/weeklyStrength";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/STRENGTH_WINDOW_RESEARCH_2026-04-04.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];

type Direction = "LONG" | "SHORT";
type MethodKey =
  | "a1_current_t1"
  | "a2_current_ta"
  | "b1_hybrid_4w_1w"
  | "b2_hybrid_4w_1m"
  | "b3_hybrid_5w"
  | "b4_hybrid_5w_res"
  | "c1_raw_3w"
  | "c2_raw_4w_1w"
  | "c3_raw_5w"
  | "c4_raw_3w_long"
  | "c5_raw_5w_res";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  strength: WeeklyPairStrength | null;
  raw1h: number | null;
  raw4h: number | null;
  raw24h: number | null;
  raw1w: number | null;
  raw1m: number | null;
  methods: Record<MethodKey, Direction | null>;
};

type PairHistoryPoint = {
  periodOpenUtc: string;
  returnPct: number;
};

type Stats = {
  trades: number;
  totalPct: number;
  maxDdPct: number;
  winRatePct: number;
  losingWeeks: number;
  coverage: string;
};

const METHOD_META: Record<MethodKey, { label: string; branch: string; windows: string }> = {
  a1_current_t1: { label: "A1: Current T1", branch: "Baseline", windows: "3w norm" },
  a2_current_ta: { label: "A2: Current TA", branch: "Baseline", windows: "3w norm+res" },
  b1_hybrid_4w_1w: { label: "B1: Hybrid +1w", branch: "Hybrid", windows: "4w" },
  b2_hybrid_4w_1m: { label: "B2: Hybrid +1m", branch: "Hybrid", windows: "4w" },
  b3_hybrid_5w: { label: "B3: Hybrid +1w+1m", branch: "Hybrid", windows: "5w" },
  b4_hybrid_5w_res: { label: "B4: Hybrid +1w+1m+res", branch: "Hybrid", windows: "5w+res" },
  c1_raw_3w: { label: "C1: Raw 3w", branch: "Full raw", windows: "3w raw" },
  c2_raw_4w_1w: { label: "C2: Raw 4w +1w", branch: "Full raw", windows: "4w raw" },
  c3_raw_5w: { label: "C3: Raw 5w", branch: "Full raw", windows: "5w raw" },
  c4_raw_3w_long: { label: "C4: Raw 24h+1w+1m", branch: "Full raw", windows: "3w long" },
  c5_raw_5w_res: { label: "C5: Raw 5w + res", branch: "Full raw", windows: "5w raw+res" },
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

function directionalReturn(row: Row, direction: Direction) {
  return (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
}

function signDirection(value: number | null): Direction | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value > 0) return "LONG";
  if (value < 0) return "SHORT";
  return null;
}

function getRawWindowValue(
  ps: WeeklyPairStrength,
  assetClass: AssetClass,
  windowName: "1h" | "4h" | "24h",
): number | null {
  const w = ps.windows.find((win) => win.window === windowName);
  if (!w || !w.available) return null;
  if (assetClass === "fx") {
    if (w.rawBase === null || w.rawQuote === null) return null;
    return w.rawBase - w.rawQuote;
  }
  return w.rawBase;
}

function currentT1(ps: WeeklyPairStrength | null): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  if (ps.compositeDirection === "NEUTRAL") return null;
  return ps.compositeDirection;
}

function currentTA(ps: WeeklyPairStrength | null): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  if (ps.compositeDirection !== "NEUTRAL") return ps.compositeDirection;
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
      sum += w.signedSpread;
      hasData = true;
    }
  }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}

function hybridDirection(row: Row, includeWeekly: boolean, includeMonthly: boolean): Direction | null {
  if (!row.strength || row.strength.availableWindows === 0) return null;
  let score = 0;
  let windows = 0;
  for (const w of row.strength.windows) {
    if (w.direction === "LONG") {
      score += 1;
      windows += 1;
    } else if (w.direction === "SHORT") {
      score -= 1;
      windows += 1;
    } else if (w.available) {
      windows += 1;
    }
  }
  if (includeWeekly && row.raw1w !== null) {
    const dir = signDirection(row.raw1w);
    if (dir === "LONG") score += 1;
    else if (dir === "SHORT") score -= 1;
    windows += 1;
  }
  if (includeMonthly && row.raw1m !== null) {
    const dir = signDirection(row.raw1m);
    if (dir === "LONG") score += 1;
    else if (dir === "SHORT") score -= 1;
    windows += 1;
  }
  if (windows === 0) return null;
  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}

function hybridWithResolver(row: Row): Direction | null {
  const base = hybridDirection(row, true, true);
  if (base) return base;
  let sum = 0;
  let hasData = false;
  for (const value of [row.raw1h, row.raw4h, row.raw24h, row.raw1w, row.raw1m]) {
    if (value === null || !Number.isFinite(value)) continue;
    sum += value;
    hasData = true;
  }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}

function rawSignDirection(
  row: Row,
  use1h: boolean,
  use4h: boolean,
  use24h: boolean,
  use1w: boolean,
  use1m: boolean,
): Direction | null {
  let score = 0;
  let windows = 0;
  const addRaw = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return;
    windows += 1;
    if (value > 0) score += 1;
    else if (value < 0) score -= 1;
  };
  if (use1h) addRaw(row.raw1h);
  if (use4h) addRaw(row.raw4h);
  if (use24h) addRaw(row.raw24h);
  if (use1w) addRaw(row.raw1w);
  if (use1m) addRaw(row.raw1m);
  if (windows === 0) return null;
  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}

function rawSignWithResolver(row: Row): Direction | null {
  const base = rawSignDirection(row, true, true, true, true, true);
  if (base) return base;
  let sum = 0;
  let hasData = false;
  for (const value of [row.raw1h, row.raw4h, row.raw24h, row.raw1w, row.raw1m]) {
    if (value === null || !Number.isFinite(value)) continue;
    sum += value;
    hasData = true;
  }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}

function computeMethodStats(
  rows: Row[],
  method: MethodKey,
  assetClass: AssetClass | "combined",
  possibleTrades: number,
): Stats {
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
    totalPct: round(weeklyReturns.reduce((sum, ret) => sum + ret, 0)),
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 1) : 0,
    losingWeeks: weeklyReturns.filter((ret) => ret < 0).length,
    coverage: `${totalTrades}/${possibleTrades}`,
  };
}

function renderMethodSection(
  title: string,
  methods: MethodKey[],
  rows: Row[],
  possibleByClass: Record<AssetClass, number>,
) {
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const lines = [`## ${title}`, ""];
  for (const method of methods) {
    lines.push(`### ${METHOD_META[method].label}`);
    lines.push("");
    lines.push("| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const assetClass of ASSET_CLASSES) {
      const stats = computeMethodStats(rows, method, assetClass, possibleByClass[assetClass]);
      lines.push(
        `| ${assetClass} | ${stats.trades} | ${signedPct(stats.totalPct)} | ${stats.maxDdPct.toFixed(2)}% | ${stats.winRatePct.toFixed(1)}% | ${stats.losingWeeks} | ${stats.coverage} |`,
      );
    }
    const combined = computeMethodStats(rows, method, "combined", combinedPossible);
    lines.push(
      `| combined | ${combined.trades} | ${signedPct(combined.totalPct)} | ${combined.maxDdPct.toFixed(2)}% | ${combined.winRatePct.toFixed(1)}% | ${combined.losingWeeks} | ${combined.coverage} |`,
    );
    lines.push("");
  }
  return lines.join("\n");
}

function renderSummary(rows: Row[], possibleByClass: Record<AssetClass, number>) {
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const lines = [
    "## Summary",
    "",
    "| Method | Branch | Windows | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const method of Object.keys(METHOD_META) as MethodKey[]) {
    const stats = computeMethodStats(rows, method, "combined", combinedPossible);
    const meta = METHOD_META[method];
    lines.push(
      `| ${meta.label} | ${meta.branch} | ${meta.windows} | ${stats.trades} | ${signedPct(stats.totalPct)} | ${stats.maxDdPct.toFixed(2)}% | ${stats.winRatePct.toFixed(1)}% | ${stats.losingWeeks} | ${stats.coverage} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderCryptoDiagnostic(rows: Row[]) {
  const cryptoRows = rows.filter((row) => row.assetClass === "crypto");
  const lines = [
    "## Crypto Anti-Correlation Diagnostic",
    "",
    "| Method | Opposite BTC/ETH | Same Direction | Unresolved |",
    "| --- | ---: | ---: | ---: |",
  ];

  const weeks = [...new Set(cryptoRows.map((row) => row.weekOpenUtc))].sort();
  for (const method of Object.keys(METHOD_META) as MethodKey[]) {
    let opposite = 0;
    let same = 0;
    let unresolved = 0;
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
    lines.push(`| ${METHOD_META[method].label} | ${opposite} | ${same} | ${unresolved} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderUnresolvedDiagnostics(rows: Row[], method: MethodKey) {
  const unresolved = rows.filter((row) => row.methods[method] === null);
  const lines = [
    `## Unresolved ${METHOD_META[method].label}`,
    "",
    `Count: ${unresolved.length}`,
    "",
  ];

  if (unresolved.length === 0) {
    lines.push("None.", "");
    return lines.join("\n");
  }

  lines.push(
    "| Week | Asset Class | Pair | 1h | 4h | 24h | 1w | 1m | Composite |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  );

  for (const row of unresolved) {
    lines.push(
      `| ${weekLabel(row.weekOpenUtc)} | ${row.assetClass} | ${row.pair} | ${row.raw1h ?? "NA"} | ${row.raw4h ?? "NA"} | ${row.raw24h ?? "NA"} | ${row.raw1w ?? "NA"} | ${row.raw1m ?? "NA"} | ${row.strength?.compositeDirection ?? "NA"} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function renderRankings(rows: Row[], possibleByClass: Record<AssetClass, number>) {
  const lines = ["## Per-Asset-Class Rankings", ""];
  for (const assetClass of [...ASSET_CLASSES, "combined"] as Array<AssetClass | "combined">) {
    const possible =
      assetClass === "combined"
        ? Object.values(possibleByClass).reduce((sum, value) => sum + value, 0)
        : possibleByClass[assetClass];
    const ranked = (Object.keys(METHOD_META) as MethodKey[])
      .map((method) => ({ method, stats: computeMethodStats(rows, method, assetClass, possible) }))
      .sort(
        (a, b) =>
          b.stats.totalPct - a.stats.totalPct ||
          a.stats.maxDdPct - b.stats.maxDdPct ||
          b.stats.winRatePct - a.stats.winRatePct,
      )
      .slice(0, 3);

    lines.push(`### ${assetClass.toUpperCase()} (best by Total%)`);
    ranked.forEach((row, idx) => {
      lines.push(
        `${idx + 1}. ${METHOD_META[row.method].label}: ${row.stats.trades}, ${signedPct(row.stats.totalPct)}, ${row.stats.maxDdPct.toFixed(2)}% DD, ${row.stats.winRatePct.toFixed(1)}% WR`,
      );
    });
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Strength Window Extension Research                           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const possibleByClass = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, weeks.length * PAIRS_BY_ASSET_CLASS[assetClass].length]),
  ) as Record<AssetClass, number>;

  const windowAvailability = {
    raw1h: 0,
    raw4h: 0,
    raw24h: 0,
    raw1w: 0,
    raw1m: 0,
  };

  const rows: Row[] = [];
  const pairHistoryMap = new Map<string, PairHistoryPoint[]>();

  await Promise.all(
    ASSET_CLASSES.flatMap((assetClass) =>
      PAIRS_BY_ASSET_CLASS[assetClass].map(async (pairDef) => {
        const history = await getPairReturnHistory(pairDef.pair.toUpperCase(), "weekly");
        pairHistoryMap.set(
          pairDef.pair.toUpperCase(),
          history.map((row) => ({
            periodOpenUtc: normalizeWeekOpenUtc(row.periodOpenUtc) ?? row.periodOpenUtc,
            returnPct: row.returnPct,
          })),
        );
      }),
    ),
  );

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const [currentReturns, adrMap, currentStrength] = await Promise.all([
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
      readWeeklyPairStrengths(weekOpenUtc),
    ]);

    const currentReturnMap = new Map(
      currentReturns.map((row) => [row.symbol.toUpperCase(), row] as const),
    );
    const strengthMap = new Map(currentStrength.map((row) => [row.pair.toUpperCase(), row] as const));

    const getPriorHistory = (pair: string) =>
      (pairHistoryMap.get(pair) ?? []).filter((row) => row.periodOpenUtc < weekOpenUtc);

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const currentRet = currentReturnMap.get(pair);
        if (!currentRet) continue;

        const ps = strengthMap.get(pair) ?? null;
        const pairAdr = getAdrPct(adrMap, pair, currentRet.assetClass);
        const adrMultiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
        const raw1h = ps ? getRawWindowValue(ps, assetClass, "1h") : null;
        const raw4h = ps ? getRawWindowValue(ps, assetClass, "4h") : null;
        const raw24h = ps ? getRawWindowValue(ps, assetClass, "24h") : null;
        const priorHistory = getPriorHistory(pair);
        const raw1w = priorHistory.at(-1)?.returnPct ?? null;
        const raw1m =
          priorHistory.length > 0
            ? priorHistory
                .slice(-4)
                .reduce((sum, row) => sum + row.returnPct, 0)
            : null;

        if (raw1h !== null) windowAvailability.raw1h += 1;
        if (raw4h !== null) windowAvailability.raw4h += 1;
        if (raw24h !== null) windowAvailability.raw24h += 1;
        if (raw1w !== null) windowAvailability.raw1w += 1;
        if (raw1m !== null) windowAvailability.raw1m += 1;

        const row: Row = {
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: currentRet.returnPct,
          adrMultiplier,
          strength: ps,
          raw1h,
          raw4h,
          raw24h,
          raw1w,
          raw1m,
          methods: {
            a1_current_t1: null,
            a2_current_ta: null,
            b1_hybrid_4w_1w: null,
            b2_hybrid_4w_1m: null,
            b3_hybrid_5w: null,
            b4_hybrid_5w_res: null,
            c1_raw_3w: null,
            c2_raw_4w_1w: null,
            c3_raw_5w: null,
            c4_raw_3w_long: null,
            c5_raw_5w_res: null,
          },
        };

        row.methods.a1_current_t1 = currentT1(ps);
        row.methods.a2_current_ta = currentTA(ps);
        row.methods.b1_hybrid_4w_1w = hybridDirection(row, true, false);
        row.methods.b2_hybrid_4w_1m = hybridDirection(row, false, true);
        row.methods.b3_hybrid_5w = hybridDirection(row, true, true);
        row.methods.b4_hybrid_5w_res = hybridWithResolver(row);
        row.methods.c1_raw_3w = rawSignDirection(row, true, true, true, false, false);
        row.methods.c2_raw_4w_1w = rawSignDirection(row, true, true, true, true, false);
        row.methods.c3_raw_5w = rawSignDirection(row, true, true, true, true, true);
        row.methods.c4_raw_3w_long = rawSignDirection(row, false, false, true, true, true);
        row.methods.c5_raw_5w_res = rawSignWithResolver(row);

        rows.push(row);
      }
    }
  }

  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const a1 = computeMethodStats(rows, "a1_current_t1", "combined", combinedPossible);
  const a2 = computeMethodStats(rows, "a2_current_ta", "combined", combinedPossible);
  const approx = (a: number, b: number) => Math.abs(a - b) < 0.02;
  if (
    a1.trades !== 335 ||
    !approx(a1.totalPct, 80.89) ||
    !approx(a1.maxDdPct, 14.98) ||
    !approx(a1.winRatePct, 54.6)
  ) {
    throw new Error(`A1 baseline mismatch: got ${JSON.stringify(a1)}`);
  }
  if (
    a2.trades !== 351 ||
    !approx(a2.totalPct, 78.72) ||
    !approx(a2.maxDdPct, 15.09) ||
    !approx(a2.winRatePct, 54.4)
  ) {
    throw new Error(`A2 baseline mismatch: got ${JSON.stringify(a2)}`);
  }

  const totalPossible = combinedPossible;
  const availabilityLines = [
    "## Window Data Availability",
    "",
    "| Window | Pairs with Data | Total Possible | Coverage |",
    "| --- | ---: | ---: | ---: |",
    `| 1h | ${windowAvailability.raw1h} | ${totalPossible} | ${((windowAvailability.raw1h / totalPossible) * 100).toFixed(1)}% |`,
    `| 4h | ${windowAvailability.raw4h} | ${totalPossible} | ${((windowAvailability.raw4h / totalPossible) * 100).toFixed(1)}% |`,
    `| 24h | ${windowAvailability.raw24h} | ${totalPossible} | ${((windowAvailability.raw24h / totalPossible) * 100).toFixed(1)}% |`,
    `| 1w | ${windowAvailability.raw1w} | ${totalPossible} | ${((windowAvailability.raw1w / totalPossible) * 100).toFixed(1)}% |`,
    `| 1m | ${windowAvailability.raw1m} | ${totalPossible} | ${((windowAvailability.raw1m / totalPossible) * 100).toFixed(1)}% |`,
    "",
  ];

  const lines: string[] = [];
  lines.push("# Strength Window Extension Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} -> ${weekLabel(weeks.at(-1)!)}).`);
  lines.push(`Universe: 36 pairs × ${weeks.length} weeks = ${combinedPossible} possible pair-weeks.`);
  lines.push("");
  lines.push("Windows tested:");
  lines.push("- Current: 1h, 4h, 24h (normalized, threshold=5)");
  lines.push("- New: 1w (prior week return sign), 1m (prior 4 weeks return sum sign)");
  lines.push("- Raw-sign: raw pair % change sign (no normalization, no threshold)");
  lines.push("");
  lines.push(availabilityLines.join("\n"));
  lines.push(renderMethodSection("Branch A: Current Baseline", ["a1_current_t1", "a2_current_ta"], rows, possibleByClass));
  lines.push(renderMethodSection("Branch B: Hybrid", ["b1_hybrid_4w_1w", "b2_hybrid_4w_1m", "b3_hybrid_5w", "b4_hybrid_5w_res"], rows, possibleByClass));
  lines.push(renderMethodSection("Branch C: Full Raw-Sign", ["c1_raw_3w", "c2_raw_4w_1w", "c3_raw_5w", "c4_raw_3w_long", "c5_raw_5w_res"], rows, possibleByClass));
  lines.push(renderSummary(rows, possibleByClass));
  lines.push(renderCryptoDiagnostic(rows));
  lines.push(renderUnresolvedDiagnostics(rows, "b4_hybrid_5w_res"));
  lines.push(renderRankings(rows, possibleByClass));

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
