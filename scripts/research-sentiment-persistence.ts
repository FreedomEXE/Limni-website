/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-sentiment-persistence.ts
 *
 * Description:
 * Persistence-first sentiment neutral resolver research.
 * Preserves S1 non-neutral logic and tests resolver tiers/stacks for
 * neutral-with-data and no-data pair-weeks using ADR-normalized returns.
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
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/SENTIMENT_PERSISTENCE_RESEARCH_2026-04-04.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];

type Direction = "LONG" | "SHORT";
type TierName = "tierA" | "tierB" | "tierC" | "tierD" | "tierE" | "tierF";
type StackName = "pa" | "pb" | "pc" | "pd" | "pe" | "pf" | "pg";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  sentS1: Direction | null;
  sentHasData: boolean;
  sentIsNeutral: boolean;
  aggLongPct: number | null;
  priorAgg: SentimentAggregate | null;
  priorS1: Direction | null;
  priorLongPct: number | null;
  prior2Agg: SentimentAggregate | null;
  prior2S1: Direction | null;
  prior2LongPct: number | null;
  tiers: PersistenceTiers | null;
};

type PersistenceTiers = {
  tierA: Direction | null;
  tierB: Direction | null;
  tierC: Direction | null;
  tierD: Direction | null;
  tierE: Direction | null;
  tierF: Direction | null;
  tierG: Direction | null;
  tierH: Direction | null;
};

type TierQualityStats = {
  fills: number;
  totalPct: number;
  avgPct: number;
  winRatePct: number;
};

type StackStats = {
  baselineTrades: number;
  baselineReturnPct: number;
  resolvedTrades: number;
  resolvedReturnPct: number;
  resolvedWinRate: number;
  totalTrades: number;
  totalReturnPct: number;
  maxDdPct: number;
  winRatePct: number;
  losingWeeks: number;
  coverage: string;
  tierFills: Record<TierName, number>;
};

type GapBreakdown = {
  weekOpenUtc: string;
  s1Trades: number;
  neutralsWithData: number;
  noData: number;
  totalGaps: number;
};

const STACK_LABELS: Record<StackName, string> = {
  pa: "PA: Persistence-only (55/45)",
  pb: "PB: Prior-S1 carry only",
  pc: "PC: Persistence-first -> 60/40",
  pd: "PD: Prior-S1 -> persistence -> 60/40",
  pe: "PE: All persistence",
  pf: "PF: Full + no-data carry",
  pg: "PG: Max coverage",
};

const STACK_TIERS: Record<StackName, TierName[]> = {
  pa: ["tierB"],
  pb: ["tierA"],
  pc: ["tierB", "tierD"],
  pd: ["tierA", "tierB", "tierD"],
  pe: ["tierA", "tierB", "tierC"],
  pf: ["tierA", "tierB", "tierD", "tierE", "tierF"],
  pg: ["tierA", "tierB", "tierC", "tierD", "tierE", "tierF"],
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

function directionalReturn(row: Row, direction: Direction) {
  return (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
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

function sentimentS1(agg: SentimentAggregate | undefined | null): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  if (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") return "SHORT";
  if (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") return "LONG";
  return null;
}

function tierA_priorS1Carry(row: Row): Direction | null {
  if (!row.sentIsNeutral) return null;
  return row.priorS1;
}

function tierB_persistence55(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null || row.priorLongPct === null) return null;
  const currentSide = row.aggLongPct > 50 ? "long" : row.aggLongPct < 50 ? "short" : null;
  const priorSide = row.priorLongPct > 50 ? "long" : row.priorLongPct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  const avg = (row.aggLongPct + row.priorLongPct) / 2;
  if (avg >= 55) return "SHORT";
  if (avg <= 45) return "LONG";
  return null;
}

function tierC_persistenceAny(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null || row.priorLongPct === null) return null;
  const currentSide = row.aggLongPct > 50 ? "long" : row.aggLongPct < 50 ? "short" : null;
  const priorSide = row.priorLongPct > 50 ? "long" : row.priorLongPct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  return row.aggLongPct > 50 ? "SHORT" : "LONG";
}

function tierD_mildCrowding(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null) return null;
  if (row.aggLongPct >= 60) return "SHORT";
  if (row.aggLongPct <= 40) return "LONG";
  return null;
}

function tierE_noDataCarry1(row: Row): Direction | null {
  if (row.sentHasData) return null;
  return row.priorS1;
}

function tierF_noDataCarry2(row: Row): Direction | null {
  if (row.sentHasData) return null;
  if (row.priorS1) return null;
  return row.prior2S1;
}

function tierG_deep2WeekCarry(row: Row): Direction | null {
  if (!row.sentIsNeutral) return null;
  if (row.priorS1) return null;
  return row.prior2S1;
}

function tierH_persistence52(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null || row.priorLongPct === null) return null;
  const currentSide = row.aggLongPct > 50 ? "long" : row.aggLongPct < 50 ? "short" : null;
  const priorSide = row.priorLongPct > 50 ? "long" : row.priorLongPct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  const avg = (row.aggLongPct + row.priorLongPct) / 2;
  if (avg >= 52) return "SHORT";
  if (avg <= 48) return "LONG";
  return null;
}

function resolveStack(row: Row, stack: StackName): { direction: Direction | null; tier: TierName | null } {
  if (row.sentS1) {
    return { direction: row.sentS1, tier: null };
  }
  for (const tier of STACK_TIERS[stack]) {
    const direction = row.tiers?.[tier] ?? null;
    if (direction) {
      return { direction, tier };
    }
  }
  return { direction: null, tier: null };
}

function makeTierFills(): Record<TierName, number> {
  return {
    tierA: 0,
    tierB: 0,
    tierC: 0,
    tierD: 0,
    tierE: 0,
    tierF: 0,
  };
}

function computeTierQualityStats(
  rows: Row[],
  directionForTier: (row: Row) => Direction | null,
): TierQualityStats {
  let fills = 0;
  let total = 0;
  let wins = 0;
  for (const row of rows) {
    const direction = directionForTier(row);
    if (!direction) continue;
    const ret = directionalReturn(row, direction);
    fills += 1;
    total += ret;
    if (ret > 0) wins += 1;
  }
  return {
    fills,
    totalPct: round(total),
    avgPct: fills > 0 ? round(total / fills, 3) : 0,
    winRatePct: fills > 0 ? round((wins / fills) * 100, 1) : 0,
  };
}

function computeStackStats(
  rows: Row[],
  possibleTrades: number,
  stack: StackName | null,
): StackStats {
  const tierFills = makeTierFills();
  const byWeek = new Map<string, { ret: number; trades: number; wins: number }>();
  let baselineTrades = 0;
  let baselineReturn = 0;
  let resolvedTrades = 0;
  let resolvedReturn = 0;
  let resolvedWins = 0;

  for (const row of rows) {
    let direction = row.sentS1;
    let usedTier: TierName | null = null;
    if (direction === null && stack) {
      const resolved = resolveStack(row, stack);
      direction = resolved.direction;
      usedTier = resolved.tier;
    }
    if (!direction) continue;

    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
    week.ret += ret;
    week.trades += 1;
    if (ret > 0) week.wins += 1;
    byWeek.set(row.weekOpenUtc, week);

    if (row.sentS1) {
      baselineTrades += 1;
      baselineReturn += ret;
    } else if (usedTier) {
      resolvedTrades += 1;
      resolvedReturn += ret;
      if (ret > 0) resolvedWins += 1;
      tierFills[usedTier] += 1;
    }
  }

  const weekly = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weeklyReturns = weekly.map(([, value]) => value.ret);
  const totalTrades = weekly.reduce((sum, [, value]) => sum + value.trades, 0);
  const totalWins = weekly.reduce((sum, [, value]) => sum + value.wins, 0);

  return {
    baselineTrades,
    baselineReturnPct: round(baselineReturn),
    resolvedTrades,
    resolvedReturnPct: round(resolvedReturn),
    resolvedWinRate: resolvedTrades > 0 ? round((resolvedWins / resolvedTrades) * 100, 1) : 0,
    totalTrades,
    totalReturnPct: round(weeklyReturns.reduce((sum, ret) => sum + ret, 0)),
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 1) : 0,
    losingWeeks: weeklyReturns.filter((ret) => ret < 0).length,
    coverage: `${totalTrades}/${possibleTrades}`,
    tierFills,
  };
}

function renderGapTable(rows: GapBreakdown[]) {
  const lines = [
    "### Per-Week Gap Breakdown",
    "",
    "| Week | S1 Trades | Neutrals (data) | No Data | Total Gaps |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${weekLabel(row.weekOpenUtc)} | ${row.s1Trades} | ${row.neutralsWithData} | ${row.noData} | ${row.totalGaps} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderAvailability(title: string, availability: Record<AssetClass, { present: number; possible: number }>) {
  const totalPresent = Object.values(availability).reduce((sum, row) => sum + row.present, 0);
  const totalPossible = Object.values(availability).reduce((sum, row) => sum + row.possible, 0);
  const lines = [`## ${title}`, "", "| Asset Class | Present | Possible | Coverage |", "| --- | ---: | ---: | ---: |"];
  for (const assetClass of ASSET_CLASSES) {
    const row = availability[assetClass];
    lines.push(`| ${assetClass} | ${row.present} | ${row.possible} | ${((row.present / row.possible) * 100).toFixed(1)}% |`);
  }
  lines.push(`| combined | ${totalPresent} | ${totalPossible} | ${((totalPresent / totalPossible) * 100).toFixed(1)}% |`);
  lines.push("");
  return lines.join("\n");
}

function renderTierQualityTable(tierRows: Array<{ name: string; firesOn: string; stats: TierQualityStats }>) {
  const lines = [
    "## Individual Tier Quality",
    "",
    "| Tier | Fires On | Fills | Total% | Avg% | Win% |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  ];
  for (const row of tierRows) {
    lines.push(
      `| ${row.name} | ${row.firesOn} | ${row.stats.fills} | ${signedPct(row.stats.totalPct)} | ${signedPct(row.stats.avgPct, 3)} | ${row.stats.winRatePct.toFixed(1)}% |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderStackAssetTable(label: string, byAsset: Record<AssetClass | "combined", StackStats>) {
  const combined = byAsset.combined;
  const resolverAvg = combined.resolvedTrades > 0
    ? round(combined.resolvedReturnPct / combined.resolvedTrades, 3)
    : 0;
  const tierFillLabel = Object.entries(combined.tierFills)
    .filter(([, fills]) => fills > 0)
    .map(([tier, fills]) => `${tier}=${fills}`)
    .join(", ");

  const lines = [
    `### ${label}`,
    "",
    "| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const assetClass of ASSET_CLASSES) {
    const stats = byAsset[assetClass];
    lines.push(
      `| ${assetClass} | ${stats.totalTrades} | ${signedPct(stats.totalReturnPct)} | ${stats.maxDdPct.toFixed(2)}% | ${stats.winRatePct.toFixed(1)}% | ${stats.losingWeeks} | ${stats.coverage} |`,
    );
  }
  lines.push(
    `| combined | ${combined.totalTrades} | ${signedPct(combined.totalReturnPct)} | ${combined.maxDdPct.toFixed(2)}% | ${combined.winRatePct.toFixed(1)}% | ${combined.losingWeeks} | ${combined.coverage} |`,
  );
  lines.push(
    `| *of which resolver* | ${combined.resolvedTrades} | ${signedPct(combined.resolvedReturnPct)} | — | ${combined.resolvedWinRate.toFixed(1)}% | — | avg ${signedPct(resolverAvg, 3)} |`,
  );
  lines.push("");
  lines.push(`Tier fills: ${tierFillLabel || "none"}`);
  lines.push("");
  return lines.join("\n");
}

function renderStackComparison(baseline: StackStats, stacks: Array<{ name: string; stats: StackStats }>) {
  const lines = [
    "## Stack Comparison",
    "",
    "| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| S1 Baseline (no resolver) | ${baseline.totalTrades} | ${signedPct(baseline.totalReturnPct)} | ${baseline.maxDdPct.toFixed(2)}% | ${baseline.winRatePct.toFixed(1)}% | ${baseline.losingWeeks} | ${baseline.coverage} | — |`,
  ];
  for (const stack of stacks) {
    const resolverAvg = stack.stats.resolvedTrades > 0
      ? round(stack.stats.resolvedReturnPct / stack.stats.resolvedTrades, 3)
      : 0;
    lines.push(
      `| ${stack.name} | ${stack.stats.totalTrades} | ${signedPct(stack.stats.totalReturnPct)} | ${stack.stats.maxDdPct.toFixed(2)}% | ${stack.stats.winRatePct.toFixed(1)}% | ${stack.stats.losingWeeks} | ${stack.stats.coverage} | ${signedPct(resolverAvg, 3)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderNoDataDiagnostic(rows: Row[], possibleByClass: Record<AssetClass, number>) {
  const noDataRows = rows.filter((row) => !row.sentHasData);
  const byAsset = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [
      assetClass,
      noDataRows.filter((row) => row.assetClass === assetClass).length,
    ]),
  ) as Record<AssetClass, number>;
  const pairCounts = new Map<string, { pair: string; assetClass: AssetClass; count: number }>();
  for (const row of noDataRows) {
    const key = `${row.assetClass}:${row.pair}`;
    const current = pairCounts.get(key) ?? { pair: row.pair, assetClass: row.assetClass, count: 0 };
    current.count += 1;
    pairCounts.set(key, current);
  }

  const lines = [
    "## No-Data Diagnostic",
    "",
    "| Asset Class | No-Data Pair-Weeks | Total Possible | Gap% |",
    "| --- | ---: | ---: | ---: |",
  ];
  for (const assetClass of ASSET_CLASSES) {
    lines.push(
      `| ${assetClass} | ${byAsset[assetClass]} | ${possibleByClass[assetClass]} | ${((byAsset[assetClass] / possibleByClass[assetClass]) * 100).toFixed(1)}% |`,
    );
  }
  lines.push("");
  lines.push("### Most Frequent No-Data Pairs");
  lines.push("");
  lines.push("| Pair | Weeks Missing | Total Weeks |");
  lines.push("| --- | ---: | ---: |");
  for (const row of [...pairCounts.values()].sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair))) {
    lines.push(`| ${row.pair} (${row.assetClass}) | ${row.count} | 10 |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const possibleByClass = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, weeks.length * PAIRS_BY_ASSET_CLASS[assetClass].length]),
  ) as Record<AssetClass, number>;
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);

  const availability = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, { present: 0, possible: possibleByClass[assetClass] }]),
  ) as Record<AssetClass, { present: number; possible: number }>;

  const rows: Row[] = [];

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const prior1WeekUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).minus({ weeks: 1 }).toUTC().toISO() ?? weekOpenUtc;
    const prior2WeekUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).minus({ weeks: 2 }).toUTC().toISO() ?? weekOpenUtc;
    const weekCloseUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ days: 7 }).toUTC().toISO() ?? weekOpenUtc;
    const prior1WeekCloseUtc = DateTime.fromISO(prior1WeekUtc, { zone: "utc" }).plus({ days: 7 }).toUTC().toISO() ?? prior1WeekUtc;
    const prior2WeekCloseUtc = DateTime.fromISO(prior2WeekUtc, { zone: "utc" }).plus({ days: 7 }).toUTC().toISO() ?? prior2WeekUtc;

    const [weeklyReturns, adrMap, currentSentiment, prior1Sentiment, prior2Sentiment] = await Promise.all([
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
      getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekCloseUtc),
      getAggregatesForWeekStartWithBackfill(prior1WeekUtc, prior1WeekCloseUtc),
      getAggregatesForWeekStartWithBackfill(prior2WeekUtc, prior2WeekCloseUtc),
    ]);

    const returnMap = new Map(
      weeklyReturns.map((row) => {
        const adrPct = getAdrPct(adrMap, row.symbol.toUpperCase(), row.assetClass);
        return [
          row.symbol.toUpperCase(),
          {
            rawReturnPct: row.returnPct,
            adrMultiplier: adrPct > 0 ? targetAdr / adrPct : 1,
          },
        ] as const;
      }),
    );
    const currentMap = new Map(currentSentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const prior1Map = new Map(prior1Sentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const prior2Map = new Map(prior2Sentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const ret = returnMap.get(pair);
        if (!ret) continue;

        const agg = currentMap.get(pair) ?? null;
        const priorAgg = prior1Map.get(pair) ?? null;
        const prior2Agg = prior2Map.get(pair) ?? null;
        const sentS1 = sentimentS1(agg);
        const sentHasData = Boolean(agg);
        const sentIsNeutral = sentHasData && sentS1 === null;

        if (sentHasData) {
          availability[assetClass].present += 1;
        }

        const row: Row = {
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: ret.rawReturnPct,
          adrMultiplier: ret.adrMultiplier,
          sentS1,
          sentHasData,
          sentIsNeutral,
          aggLongPct: agg?.agg_long_pct ?? null,
          priorAgg,
          priorS1: sentimentS1(priorAgg),
          priorLongPct: priorAgg?.agg_long_pct ?? null,
          prior2Agg,
          prior2S1: sentimentS1(prior2Agg),
          prior2LongPct: prior2Agg?.agg_long_pct ?? null,
          tiers: null,
        };

        if (sentIsNeutral || !sentHasData) {
          row.tiers = {
            tierA: tierA_priorS1Carry(row),
            tierB: tierB_persistence55(row),
            tierC: tierC_persistenceAny(row),
            tierD: tierD_mildCrowding(row),
            tierE: tierE_noDataCarry1(row),
            tierF: tierF_noDataCarry2(row),
            tierG: tierG_deep2WeekCarry(row),
            tierH: tierH_persistence52(row),
          };
        }

        rows.push(row);
      }
    }
  }

  const gapBreakdown: GapBreakdown[] = weeks.map((rawWeekOpenUtc) => {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const weekRows = rows.filter((row) => row.weekOpenUtc === weekOpenUtc);
    const s1Trades = weekRows.filter((row) => row.sentS1 !== null).length;
    const neutralsWithData = weekRows.filter((row) => row.sentIsNeutral).length;
    const noData = weekRows.filter((row) => !row.sentHasData).length;
    return { weekOpenUtc, s1Trades, neutralsWithData, noData, totalGaps: neutralsWithData + noData };
  });

  const baseline = computeStackStats(rows, combinedPossible, null);
  const neutralsWithDataRows = rows.filter((row) => row.sentIsNeutral);
  const noDataRows = rows.filter((row) => !row.sentHasData);

  const tierQualityRows: Array<{ name: string; firesOn: string; stats: TierQualityStats }> = [
    { name: "A: Prior-week S1 carry", firesOn: "neutral w/data", stats: computeTierQualityStats(neutralsWithDataRows, (row) => row.tiers?.tierA ?? null) },
    { name: "B: Persistence (55/45 avg)", firesOn: "neutral w/data", stats: computeTierQualityStats(neutralsWithDataRows, (row) => row.tiers?.tierB ?? null) },
    { name: "C: Persistence (any lean)", firesOn: "neutral w/data", stats: computeTierQualityStats(neutralsWithDataRows, (row) => row.tiers?.tierC ?? null) },
    { name: "D: Mild crowding (60/40)", firesOn: "neutral w/data", stats: computeTierQualityStats(neutralsWithDataRows, (row) => row.tiers?.tierD ?? null) },
    { name: "E: No-data carry (1 week)", firesOn: "no data", stats: computeTierQualityStats(noDataRows, (row) => row.tiers?.tierE ?? null) },
    { name: "F: No-data carry (2 weeks)", firesOn: "no data", stats: computeTierQualityStats(noDataRows, (row) => row.tiers?.tierF ?? null) },
    { name: "G: Deep 2-week carry", firesOn: "neutral w/data", stats: computeTierQualityStats(neutralsWithDataRows, (row) => row.tiers?.tierG ?? null) },
    { name: "H: Persistence (52/48 avg)", firesOn: "neutral w/data", stats: computeTierQualityStats(neutralsWithDataRows, (row) => row.tiers?.tierH ?? null) },
  ];

  const stackCombined = Object.fromEntries(
    (Object.keys(STACK_LABELS) as StackName[]).map((stack) => [stack, computeStackStats(rows, combinedPossible, stack)]),
  ) as Record<StackName, StackStats>;

  const stackByAsset = Object.fromEntries(
    (Object.keys(STACK_LABELS) as StackName[]).map((stack) => [
      stack,
      {
        fx: computeStackStats(rows.filter((row) => row.assetClass === "fx"), possibleByClass.fx, stack),
        indices: computeStackStats(rows.filter((row) => row.assetClass === "indices"), possibleByClass.indices, stack),
        crypto: computeStackStats(rows.filter((row) => row.assetClass === "crypto"), possibleByClass.crypto, stack),
        commodities: computeStackStats(rows.filter((row) => row.assetClass === "commodities"), possibleByClass.commodities, stack),
        combined: stackCombined[stack],
      },
    ]),
  ) as Record<StackName, Record<AssetClass | "combined", StackStats>>;

  console.log(
    `Baseline (current loader): ${baseline.totalTrades} / ${baseline.totalReturnPct}% / ${baseline.maxDdPct}% DD / ${baseline.winRatePct}% WR / LW ${baseline.losingWeeks}`,
  );

  const lines: string[] = [];
  lines.push("# Sentiment Persistence-First Resolver Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} -> ${weekLabel(weeks.at(-1)!)}).`);
  lines.push(`Universe: 36 pairs × ${weeks.length} weeks = ${combinedPossible} possible pair-weeks.`);
  lines.push("");
  lines.push("## Gap Analysis");
  lines.push("");
  lines.push(`- S1 baseline: ${baseline.totalTrades}/${combinedPossible} trades`);
  lines.push(`- Neutrals with data: ${neutralsWithDataRows.length} pair-weeks (have sentiment data but S1 returns null)`);
  lines.push(`- Neutrals without data: ${noDataRows.length} pair-weeks (no sentiment aggregate exists)`);
  lines.push(`- Data ceiling: ${combinedPossible - noDataRows.length}/${combinedPossible} (${(((combinedPossible - noDataRows.length) / combinedPossible) * 100).toFixed(1)}%)`);
  lines.push("");
  lines.push(renderGapTable(gapBreakdown));
  lines.push(renderAvailability("Sentiment Data Availability", availability));
  lines.push(renderTierQualityTable(tierQualityRows));
  lines.push("## Stack Results");
  lines.push("");
  for (const stack of Object.keys(STACK_LABELS) as StackName[]) {
    lines.push(renderStackAssetTable(STACK_LABELS[stack], stackByAsset[stack]));
  }
  lines.push(
    renderStackComparison(
      baseline,
      (Object.keys(STACK_LABELS) as StackName[]).map((stack) => ({
        name: STACK_LABELS[stack],
        stats: stackCombined[stack],
      })),
    ),
  );
  lines.push(renderNoDataDiagnostic(rows, possibleByClass));

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
